# Cloudflare Demo Worker Deployment

This deployment publishes only the browser-local Priage demo. It does not
deploy, replace, or call the production NestJS backend, and it does not take
ownership of the main `priage.ca` site.

## Build and verify

Use Node.js 22 or newer for the checked-in Wrangler release.

Install the root Wrangler tooling and both frontend dependency trees:

```bash
npm ci
npm --prefix Apps/HospitalApp ci
npm --prefix Apps/PatientApp ci
```

Build the static demo:

```bash
node scripts/build-static-demo.mjs
```

The essential output is:

```text
dist/static-demo/
└── demo/
    ├── index.html
    ├── assets/
    ├── patient/
    │   ├── index.html
    │   └── assets/
    └── care/
        ├── index.html
        └── assets/
```

Run the automated output and bundle check:

```bash
node scripts/check-static-demo-release.mjs
```

Or build and check together:

```bash
npm run check:demo-release
```

The check rejects a canonical `demo/hospital` output, localhost backend URLs,
and `demoCode` or `demoSessionId` propagation in the built bundle.

## Workers Builds settings

Cloudflare Workers Builds runs a build command first, then a deploy command.
Use these settings for this repository:

```text
Root directory: <blank/default repository root>
Build command: npm ci && npm --prefix Apps/HospitalApp ci && npm --prefix Apps/PatientApp ci && npm run check:demo-release
Deploy command: npm run deploy:demo:worker
```

Alternatively, set no build command and use `npm run deploy:demo` as the deploy
command. That single command installs both app dependency trees, builds the
static demo, runs the release check, and uploads the Worker.

Do not set the root directory to `dist/static-demo`, `cloudflare`, or an app
subdirectory. The Worker config, root package scripts, frontend apps, and build
scripts all need to be available from the repository root.

The deploy command intentionally only uploads the already-built Worker and
assets. `dist/static-demo` is generated output and is ignored by git, so a fresh
Cloudflare clone must run the build command before Wrangler deploys.

If the build log says `Executing user deploy command: npx wrangler deploy` and
then fails with `Missing entry-point to Worker script or to assets directory`,
Cloudflare is either running without the build command above or from the wrong
root directory. Correct the Workers Builds settings rather than broadening the
Worker route or committing `dist/`.

## Existing Cloudflare resources

The Worker must reuse the resources already owned by the landing/access
deployment:

- D1 database: `priage-demo-access`
- D1 binding in this Worker: `DEMO_DB`
- shared secret: `DEMO_SESSION_SECRET`
- session cookie: `priage_demo_session=<sessionId>.<signature>`

The existing D1 database ID is carried forward from the prior checked-in Pages
configuration into `wrangler.jsonc`. Confirm that it still identifies the
landing deployment's database in the target Cloudflare account before release.
Do not create a second database. `cloudflare/d1/schema.sql` documents the shared
schema; do not apply it blindly to an established production database.

Set the Worker secret to exactly the same value used by the landing service:

```bash
npx wrangler secret put DEMO_SESSION_SECRET
```

The Worker does not need `DEMO_CODE_PEPPER`, because it never creates or
verifies a demo code. Secret rotation must be coordinated between both
deployments; changing only one side invalidates every session.

## Route and deploy

`wrangler.jsonc` configures Worker Static Assets with `run_worker_first: true`
and the production route:

```text
priage.ca/demo/*
```

The route must be attached to the existing proxied `priage.ca` zone. It must
not be broadened to `priage.ca/*`. The landing deployment may handle the exact
`/demo` URL and redirect it to `/demo/access`.

After review and creation of the intended release branch, deploy with:

```bash
npm run deploy:demo
```

For Cloudflare Workers Builds, use `npm run deploy:demo:worker` as the deploy
command because the build command has already run `npm run check:demo-release`.
This repository does not deploy production automatically outside that explicit
release operation.

The legacy `functions/` Pages sources are not deployment entrypoints for this
Worker. They remain source-compatible with the extracted session validator,
but this repository must not be configured or published as a Pages project.

## Landing/access integration contract

The landing repository remains authoritative for:

- demo request and code generation
- email delivery
- `POST /api/request-demo`
- `POST /api/verify-demo-code`
- `GET /api/demo-session`
- `POST /api/demo-events`
- `POST /api/callback-request`
- session creation and all D1 writes related to access

The demo deployment is authoritative for:

- `/demo/access` and DemoShell static assets
- `/demo/patient` static assets and SPA fallback
- `/demo/care` static assets and SPA fallback
- authorization before protected asset delivery
- browser-local fictional state, synchronization, and guided UI

DemoShell deliberately calls the landing APIs using same-origin root paths such
as `/api/verify-demo-code`, `/api/demo-session`, and `/api/demo-events`. Because
the Worker route covers only `/demo/*`, those requests continue to reach the
landing deployment. They must not be rewritten to the NestJS backend.

The email access link may use:

```text
https://priage.ca/demo/access?request=<demoRequestId>
```

After verification, authorization is carried only by the signed HttpOnly
cookie. DemoShell does not copy the plaintext code or session ID into a launch
URL or local storage.

## Authorization and routing behavior

The Worker accepts a session only when the cookie signature is valid and its
`demo_sessions` row exists, has not expired, and has `revoked_at IS NULL`.
Request lifecycle status is not used as an authorization prerequisite. To
revoke access, the landing/access service must set `demo_sessions.revoked_at`
for the relevant active sessions.

Routing is explicit:

- `/demo/access` uses `/demo/index.html` and is public.
- `/demo/assets/*` is public and served only when the requested asset exists.
- `/demo/patient/*` is protected and falls back to
  `/demo/patient/index.html` for non-file deep routes.
- `/demo/care/*` is protected and falls back to `/demo/care/index.html` for
  non-file deep routes.
- `/demo/hospital/*` permanently redirects to the equivalent `/demo/care/*`
  path.

Unauthenticated HTML navigations redirect to `/demo/access`. Unauthenticated
asset-style requests receive `403`. D1 failures or missing bindings fail closed
with `503`. The Worker applies the production CSP and other security headers;
the build no longer relies on Pages `_headers`, `_routes.json`, or `_redirects`.

## Release verification

Run at minimum:

```bash
node scripts/build-static-demo.mjs
npm run build --prefix Apps/HospitalApp
npm run build --prefix Apps/PatientApp
rg -n "localhost:3000|http://localhost" dist/static-demo
git diff --check
```

Before deployment, also use a non-deploying Worker bundle check:

```bash
npx wrangler deploy --dry-run --outdir /tmp/priage-demo-worker
```

Then test the production route with an anonymous browser, a valid session, an
expired session, and a revoked session. Confirm that deep-link refreshes work
for both apps and that the landing site remains unchanged outside `/demo/*`.
