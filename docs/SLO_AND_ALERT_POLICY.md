# SLO And Alert Policy

## Service Objectives

| Signal | Objective | Warning | Critical |
| --- | --- | --- | --- |
| API availability | 99.9% monthly for authenticated clinical and patient APIs | 5-minute burn above budget | 1-hour burn above budget |
| API latency | 95% of normal reads below 750 ms; writes below 1.5 s | p95 above target for 10 min | p95 above 2x target for 10 min |
| Event delivery lag | 99% below 30 seconds | oldest pending event at 30 seconds | oldest pending event at 120 seconds |
| Dead-letter events | Zero unresolved | any new dead letter | any unresolved for 15 min |
| Database pool waiters | Zero sustained | any waiter for 1 min | saturation above 80% with waiters |
| Asset deletion reconciliation | 99% below 24 hours | pending above 12 hours | pending above 24 hours |
| Security signals | All break-glass and suspicious auth reviewed | any break-glass event | repeated invalid-token or cross-tenant attempt |

## Instrumentation

- Every HTTP request receives an `x-correlation-id` and records a sanitized route, method, status, duration, actor, and tenant context.
- `/health/prometheus` exposes non-tenant aggregate event, pool, and deletion-backlog metrics through the trusted gateway only.
- `/health/metrics` gives hospital admins tenant-scoped operational, SLO, sensitive-read, and break-glass summaries.
- Prometheus rules and the Grafana developer dashboard live under `infra/dev/`.

## Alert Handling

Critical alerts page the on-call engineer. Security alerts notify security and the hospital privacy contact. Clinical event-lag alerts notify operations and the clinical incident lead because delayed messages or status changes may affect care. Every alert must link to a runbook, dashboard, release version, and correlation IDs.

## Release Gate

Do not claim a capacity or SLO until the deployed-stack workload has passed with the intended instance sizes, proxy settings, WAF/API gateway, managed Redis, object storage, and representative network latency.
