import { redirectToDemo, validateDemoSession, type PagesFunction } from './_shared/demoAccess';

const PROTECTED_PREFIXES = ['/patient', '/care', '/hospital'];

export const onRequest: PagesFunction = async ({ request, env, next }) => {
  const pathname = new URL(request.url).pathname;
  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));

  if (!protectedRoute) {
    return next ? next() : new Response(null, { status: 404 });
  }

  const session = await validateDemoSession(request, env);
  if (session) {
    return next ? next() : new Response(null, { status: 404 });
  }

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html') || pathname === '/patient' || pathname === '/care' || pathname === '/hospital') {
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
