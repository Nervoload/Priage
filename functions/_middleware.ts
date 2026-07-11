import { redirectToDemo, validateDemoSession, type PagesFunction } from './_shared/demoAccess';

const PROTECTED_PREFIXES = [
  '/demo/patient',
  '/demo/hospital',
  '/demo/care',
  '/patient',
  '/care',
  '/hospital',
];

export const onRequest: PagesFunction = async ({ request, env, next }) => {
  const pathname = new URL(request.url).pathname;
  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));

  if (!protectedRoute) {
    return next ? next() : new Response(null, { status: 404 });
  }

  const session = await validateDemoSession(request, env, { touch: false });
  if (session) {
    return next ? next() : new Response(null, { status: 404 });
  }

  const accept = request.headers.get('accept') || '';
  const htmlNavigation = accept.includes('text/html') || PROTECTED_PREFIXES.includes(pathname);
  if (htmlNavigation) {
    return redirectToDemo(request);
  }

  return new Response('Demo access required.', {
    status: 403,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
};

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
