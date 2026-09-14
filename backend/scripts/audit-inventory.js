#!/usr/bin/env node

// Read-only review inventory. This uses the TypeScript AST instead of regexes
// so decorator formatting, comments, route templates, and gateway handlers do
// not silently disappear from the safety-review surface.

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const modulesRoot = path.join(backendRoot, 'src', 'modules');
const appRoots = [
  path.join(repositoryRoot, 'Apps', 'HospitalApp', 'src'),
  path.join(repositoryRoot, 'Apps', 'PatientApp', 'src'),
];
const HTTP_DECORATORS = new Map([
  ['Get', 'GET'], ['Post', 'POST'], ['Put', 'PUT'], ['Patch', 'PATCH'], ['Delete', 'DELETE'], ['Sse', 'SSE'],
]);
const API_ROUTE_PREFIX = /^\/(?:patient|encounters|messaging|triage|alerts|assets|intake|auth|patient-auth|hospitals|platform|users|analytics|clinical-access|events|health|demo)/;

const sourceFiles = walk(modulesRoot).filter((file) => file.endsWith('.ts'));
const controllers = sourceFiles
  .filter((file) => file.endsWith('.controller.ts'))
  .map(inventoryController)
  .sort(byFile);
const gateways = sourceFiles
  .filter((file) => file.endsWith('.gateway.ts'))
  .map(inventoryGateway)
  .sort(byFile);
const clientReferences = appRoots
  .flatMap((root) => walk(root).filter((file) => /\.(ts|tsx)$/.test(file)))
  .flatMap(inventoryClientReferences)
  .sort((left, right) => left.file.localeCompare(right.file) || left.route.localeCompare(right.route));

const report = {
  inventoryVersion: 2,
  generatedAt: new Date().toISOString(),
  controllerCount: controllers.length,
  endpointCount: controllers.reduce((total, controller) => total + controller.routes.length, 0),
  gatewayCount: gateways.length,
  gatewaySubscriptionCount: gateways.reduce((total, gateway) => total + gateway.subscriptions.length, 0),
  clientReferenceCount: clientReferences.length,
  controllers,
  gateways,
  clientReferences,
  reviewerReminder: 'This is an AST-derived review index, not authorization proof. Trace each sensitive route through guard, service predicate, response projection, realtime room policy, and negative runtime tests.',
};

if (process.argv.includes('--summary')) {
  process.stdout.write(`${JSON.stringify({
    inventoryVersion: report.inventoryVersion,
    controllerCount: report.controllerCount,
    endpointCount: report.endpointCount,
    gatewayCount: report.gatewayCount,
    gatewaySubscriptionCount: report.gatewaySubscriptionCount,
    clientReferenceCount: report.clientReferenceCount,
  })}\n`);
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function inventoryController(file) {
  const source = parse(file);
  const classNode = firstClass(source, 'Controller');
  if (!classNode) return { file: relative(file), controllerPath: '', routes: [] };
  const classDecorators = decorators(classNode);
  const controllerPath = decoratorArgument(classDecorators, 'Controller') || '';
  const classPolicy = policy(classDecorators);
  const routes = classNode.members
    .filter(ts.isMethodDeclaration)
    .map((method) => routeForMethod(method, controllerPath, classPolicy))
    .filter(Boolean);
  return { file: relative(file), controllerPath, routes };
}

function inventoryGateway(file) {
  const source = parse(file);
  const classNode = firstClass(source, 'WebSocketGateway');
  if (!classNode) return { file: relative(file), namespace: '', subscriptions: [] };
  const classDecorators = decorators(classNode);
  const namespace = decoratorArgument(classDecorators, 'WebSocketGateway') || '';
  const classPolicy = policy(classDecorators);
  const subscriptions = classNode.members
    .filter(ts.isMethodDeclaration)
    .map((method) => {
      const methodDecorators = decorators(method);
      const event = decoratorArgument(methodDecorators, 'SubscribeMessage');
      if (event === null) return null;
      return {
        event,
        handler: propertyName(method.name),
        ...mergePolicy(classPolicy, policy(methodDecorators)),
      };
    })
    .filter(Boolean);
  return { file: relative(file), namespace, subscriptions };
}

function routeForMethod(method, controllerPath, classPolicy) {
  const methodDecorators = decorators(method);
  const route = methodDecorators.find((decorator) => HTTP_DECORATORS.has(decorator.name));
  if (!route) return null;
  return {
    method: HTTP_DECORATORS.get(route.name),
    path: joinRoute(controllerPath, staticArgument(route)),
    handler: propertyName(method.name),
    responseType: method.type ? method.type.getText() : null,
    ...mergePolicy(classPolicy, policy(methodDecorators)),
  };
}

function inventoryClientReferences(file) {
  const source = parse(file);
  const references = new Map();
  const visit = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const firstArgument = node.arguments?.[0];
      const route = firstArgument ? staticArgumentFromNode(firstArgument) : null;
      if (route && API_ROUTE_PREFIX.test(route)) {
        const key = `${route}:${node.getStart(source)}`;
        references.set(key, {
          file: relative(file),
          route,
          call: node.expression ? node.expression.getText(source) : 'new',
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...references.values()];
}

function firstClass(source, decoratorName) {
  return source.statements.find((statement) =>
    ts.isClassDeclaration(statement) && decorators(statement).some((decorator) => decorator.name === decoratorName),
  );
}

function decorators(node) {
  return ts.getDecorators(node)?.map((decorator) => {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      return { name: expressionName(expression.expression), expression };
    }
    return { name: expressionName(expression), expression: null };
  }) || [];
}

function policy(decoratorList) {
  return {
    guarded: decoratorList.some((decorator) => decorator.name === 'UseGuards'),
    roleRestricted: decoratorList.some((decorator) => decorator.name === 'Roles'),
    skipDemoGate: decoratorList.some((decorator) => decorator.name === 'SkipDemoGate'),
  };
}

function mergePolicy(classPolicy, methodPolicy) {
  return {
    guarded: classPolicy.guarded || methodPolicy.guarded,
    roleRestricted: classPolicy.roleRestricted || methodPolicy.roleRestricted,
    skipDemoGate: classPolicy.skipDemoGate || methodPolicy.skipDemoGate,
  };
}

function decoratorArgument(decoratorList, name) {
  const decorator = decoratorList.find((candidate) => candidate.name === name);
  return decorator ? staticArgument(decorator) : null;
}

function staticArgument(decorator) {
  return decorator.expression?.arguments?.[0]
    ? staticArgumentFromNode(decorator.expression.arguments[0])
    : '';
}

function staticArgumentFromNode(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return `${node.head.text}:dynamic`;
  return null;
}

function expressionName(expression) {
  return ts.isIdentifier(expression) ? expression.text : expression.getText();
}

function propertyName(name) {
  return name ? name.getText() : '<anonymous>';
}

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function joinRoute(controllerPath, routePath) {
  return `/${[controllerPath, routePath].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join('/');
}

function byFile(left, right) {
  return left.file.localeCompare(right.file);
}
