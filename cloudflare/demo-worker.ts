import {
  validateDemoSession,
  type D1Database,
} from './demo-session';

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type DemoWorkerEnv = {
  ASSETS: AssetsBinding;
  DEMO_DB: D1Database;
  DEMO_SESSION_SECRET: string;
};

const DEMO_PREFIX = '/demo';
const PATIENT_PREFIX = '/demo/patient';
const CARE_PREFIX = '/demo/care';
const HOSPITAL_PREFIX = '/demo/hospital';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

export default {
  async fetch(request: Request, env: DemoWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (!matchesPrefix(url.pathname, DEMO_PREFIX)) {
      return secureResponse(new Response('Not found.', { status: 404 }));
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secureResponse(new Response('Method not allowed.', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      }), true);
    }

    if (matchesPrefix(url.pathname, HOSPITAL_PREFIX)) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = `${CARE_PREFIX}${url.pathname.slice(HOSPITAL_PREFIX.length)}`;
      return secureResponse(Response.redirect(redirectUrl.toString(), 308), true);
    }

    if (
      url.pathname === '/demo' ||
      url.pathname === '/demo/' ||
      url.pathname === '/demo/index.html'
    ) {
      const redirectUrl = new URL('/demo/access', url.origin);
      redirectUrl.search = url.search;

      return secureResponse(
        Response.redirect(redirectUrl.toString(), 302),
        true,
      );
    }

    if (isAccessRoute(url.pathname)) {
      return serveSpaIndex(request, env, '/demo/index.html', true);
    }

    if (matchesPrefix(url.pathname, '/demo/assets')) {
      return serveExactAsset(request, env, false);
    }

    const appIndex = matchesPrefix(url.pathname, PATIENT_PREFIX)
      ? '/demo/patient/index.html'
      : matchesPrefix(url.pathname, CARE_PREFIX)
        ? '/demo/care/index.html'
        : null;

    if (!appIndex) {
      return secureResponse(new Response('Not found.', { status: 404 }));
    }

    if (!env.DEMO_DB || !env.DEMO_SESSION_SECRET) {
      console.error('Demo Worker is missing DEMO_DB or DEMO_SESSION_SECRET.');
      return secureResponse(new Response('Demo access is temporarily unavailable.', { status: 503 }), true);
    }

    let authorized = false;
    try {
      authorized = Boolean(await validateDemoSession(request, env, { touch: false }));
    } catch (error) {
      console.error('Demo session validation failed.', error);
      return secureResponse(new Response('Demo access is temporarily unavailable.', { status: 503 }), true);
    }

    if (!authorized) {
      if (isHtmlNavigation(request, url.pathname)) {
        const redirectUrl = new URL('/demo/access', url.origin);
        redirectUrl.searchParams.set('returnTo', url.pathname + url.search);
        return secureResponse(Response.redirect(redirectUrl.toString(), 302), true);
      }

      return secureResponse(new Response('Demo access required.', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }), true);
    }

    const exactResponse = await fetchAsset(request, env, url.pathname);
    if (exactResponse.status !== 404) {
      return secureResponse(exactResponse, true);
    }

    if (hasFileExtension(url.pathname)) {
      return secureResponse(exactResponse, true);
    }

    return serveSpaIndex(request, env, appIndex, true);
  },
};

async function serveExactAsset(
  request: Request,
  env: DemoWorkerEnv,
  noStore: boolean,
): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  return secureResponse(response, noStore);
}

async function serveSpaIndex(
  request: Request,
  env: DemoWorkerEnv,
  indexPath: string,
  noStore: boolean,
): Promise<Response> {
  const response = await fetchAsset(request, env, indexPath);
  return secureResponse(response, noStore);
}

function fetchAsset(
  request: Request,
  env: DemoWorkerEnv,
  pathname: string,
): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  assetUrl.search = '';
  return env.ASSETS.fetch(new Request(assetUrl.toString(), {
    method: request.method,
    headers: request.headers,
  }));
}

function secureResponse(response: Response, noStore = false): Response {
  const headers = new Headers(response.headers);
  headers.set('x-priage-demo-worker', 'true');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('content-security-policy', CONTENT_SECURITY_POLICY);
  if (noStore) headers.set('cache-control', 'private, no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAccessRoute(pathname: string): boolean {
  return pathname === '/demo/access' || pathname.startsWith('/demo/access/');
}

function isHtmlNavigation(request: Request, pathname: string): boolean {
  return (
    pathname === PATIENT_PREFIX ||
    pathname === CARE_PREFIX ||
    request.headers.get('sec-fetch-mode') === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasFileExtension(pathname: string): boolean {
  const leaf = pathname.slice(pathname.lastIndexOf('/') + 1);
  return leaf.includes('.');
}
