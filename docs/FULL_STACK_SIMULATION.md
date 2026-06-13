# Full Stack Simulation

The cloud-shaped developer stack runs the apps across container networks through the same major boundaries expected in deployment:

- nginx edge proxy with gateway-secret injection, request-size limits, rate limits, and socket caps
- backend connected through PgBouncer transaction pooling
- PostgreSQL, Redis, private S3-compatible object storage, and malware-scanner quarantine
- Hospital and Patient apps built with cookie-authenticated API access through the edge
- Prometheus alerts and a provisioned Grafana operations dashboard

## Commands

```bash
./priage-cloud up
./priage-cloud test
./priage-cloud load
./priage-cloud chaos
./priage-cloud restore
./priage-cloud logs backend
./priage-cloud down
./priage-cloud reset
```

`./priage-dev cloud test` is an equivalent entry point from the standard developer launcher.

The simulation is intentionally disposable. `up` removes old containers and volumes before
building a fresh stack, and `down` removes its volumes after stopping it. Use production backup
and restore infrastructure, not this developer stack, when persistence is required.

The MinIO simulation bucket is private and versioned but does not run a local KMS, so object
encryption is explicitly disabled in this developer-only stack. Production configuration still
requires KMS-backed S3 encryption.

## Endpoints

- API edge: `http://localhost:8080`
- Hospital app: `http://localhost:8081`
- Patient app: `http://localhost:8082`
- Grafana: `http://localhost:3001` (`priage` / `priage`)
- Prometheus: `http://localhost:9090`
- PgBouncer: `localhost:6432`

## Test Coverage

`test:deployed-security` creates disposable tenants and verifies unauthenticated access, patient IDOR, tenant isolation, STAFF redaction, clinical role boundaries, care-team access, CSRF/origin enforcement, and patient idempotency.

`test:deployed-stack` defaults to 500 distinct patient sessions and 25 staff users. It performs patient reads, idempotent writes, messages, private uploads, SSE connections, staff list reads, sockets, and reconnect storms. Change counts with `DEPLOYED_TEST_PATIENT_COUNT`, `DEPLOYED_TEST_STAFF_COUNT`, and related environment variables.

The chaos drill interrupts Redis and PgBouncer and verifies readiness failure plus recovery. The restore drill creates a logical snapshot, restores it into an isolated database, and compares integrity counts.

Both drills refuse to run unless the stack is initially healthy. Run commands with `&&` when a
sequence should stop at the first failure:

```bash
./priage-cloud up &&
./priage-cloud test &&
./priage-cloud load &&
./priage-cloud chaos &&
./priage-cloud restore &&
./priage-cloud down
```

This environment authenticates architecture and recovery behavior; it does not prove production capacity. Run the same workload against the deployed managed stack before making a capacity claim.
