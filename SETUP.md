# Priage — Full-Stack Setup Guide

> From repo clone to a working local environment with seeded data. This guide covers the ED app and the gated local clinic preview; the pilot scope is in [the pilot plan](docs/CLINIC_PILOT_PLAN.md).

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| **Node.js** | 20+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Docker** | 20+ | `docker --version` |
| **Docker Compose** | v2+ | `docker compose version` |
| **Git** | 2.x | `git --version` |

---

## 1. Clone the Repo

```bash
git clone <your-repo-url> Priage
cd Priage
```

Project structure:

```
Priage/
├── docker-compose.yml        # Postgres + Redis
├── backend/                  # NestJS API (port 3000)
└── Apps/
    ├── HospitalApp/          # Vite + React frontend (port 5173)
    └── PatientApp/           # Vite + React frontend (port 5174)
```

---

## 2. Start Infrastructure (Postgres + Redis)

```bash
docker compose up -d
```

Verify both containers are running:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:

```
NAMES             STATUS      PORTS
priage-postgres   Up ...      0.0.0.0:5432->5432/tcp
priage-redis      Up ...      0.0.0.0:6379->6379/tcp
```

---

## 3. Set Up the Backend

```bash
cd backend
```

### 3a. Install dependencies

```bash
npm install
```

### 3b. Create the `.env` file

```bash
cp .env.example .env
```

If `.env.example` doesn't exist, create `.env` manually:

```env
# Database (matches docker-compose.yml)
DATABASE_URL="postgresql://priage:priage@localhost:5432/priage?schema=public"

# Auth
JWT_SECRET="priage-dev-secret-change-in-production"

# Server
PORT=3000
CORS_ORIGINS="http://localhost:5173,http://localhost:5174"

# Redis (matches docker-compose.yml)
REDIS_HOST="localhost"
REDIS_PORT=6379

# Logging
LOG_LEVEL="log"

# Server-owned alert rules remain non-materializing until pilot review
ALERT_RULE_ENGINE_MODE="shadow"

# Production must remain deterministic until the approved regional provider pass
TRIAGE_INTERVIEW_MODE="deterministic"

# App
APP_VERSION="0.1.0"
```

### 3c. Run database migrations

```bash
npx prisma migrate deploy
```

This applies the committed migrations. Use `prisma migrate dev --name <name>` only when authoring a schema change.

### 3d. Create a private local admin + hospital

```bash
node scripts/bootstrap-dev-accounts.js
```

This creates or reuses a private local admin for your dev machine and writes it to `.priage-dev/accounts.json`.

### 3e. Seed patient demo data into that hospital

```bash
TARGET_HOSPITAL_SLUG="<slug printed by bootstrap-dev-accounts.js>" node scripts/seed.js
```

This creates:

| What | Details |
|------|---------|
| **Hospital target** | Your existing private dev hospital |
| **5 Patients** | Alice (EXPECTED), Bob (ADMITTED), Carol (TRIAGE), Diana (WAITING), Evan (account only) |
| **Patient sessions** | One per seeded patient for local demo/testing |

The seed script no longer creates public canned staff users. It attaches demo patient data to the hospital you target and prints the demo patient password plus session tokens.

### 3f. Start the backend

```bash
npm run start:dev
```

Verify it's running:

```bash
curl http://localhost:3000/health
# Expected: {"ok":true,"status":"ready",...}
```

**Leave this terminal running.**

---

## 4. Set Up the Frontend

Open a **new terminal**:

```bash
cd Apps/HospitalApp
```

### 4a. Install dependencies

```bash
npm install
```

### 4b. Create the `.env` file (optional)

```bash
cp .env.example .env
```

The default value `http://localhost:3000` is already compiled in, so this step is optional for local dev. Only needed if the backend runs on a different port.

### 4c. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

## 5. Set Up the Patient App

Open a **new terminal**:

```bash
cd Apps/PatientApp
```

### 5a. Install dependencies

```bash
npm install
```

### 5b. Create the `.env` file (optional)

```bash
cp .env.example .env
```

Like the Hospital App, the default API URL already points at `http://localhost:3000`.

### 5c. Start the dev server

```bash
npm run dev
```

Open the printed local URL, typically **http://localhost:5174**.

The Patient App supports two demo entry paths:

| Entry | Purpose | Backend |
|------|---------|---------|
| **Quick Check-In** | Guest intake / fast hospital check-in | `/intake/*` |
| **Sign In / Create Account** | Full patient dashboard/messages/profile flow | `/patient-auth/*`, `/patient/*` |

---

## 6. Manual Testing Checklist

Log in with the private local admin recorded in `.priage-dev/accounts.json`. Seeded names and encounter counts vary by seed option, so check behavior rather than specific patients.

1. Open Admittance. An `EXPECTED` encounter should appear; opening its details should load data from the backend. Confirm arrival and verify it becomes `ADMITTED`.
2. Start triage for an admitted encounter. Open the Triage workspace, review the AI assessment if available, save a triage assessment, and reload to verify persistence.
3. Open Waiting Room for an encounter in `WAITING`; verify patient messages and alerts load from the backend. This ED screen will be hidden for the clinic pilot.
4. Start a guest visit in the Patient App. Complete the interview, choose a hospital, and verify an `EXPECTED` encounter appears in the staff app. This currently does **not** book an appointment.
5. Refresh both apps and check that the session and encounter state remain accurate. Verify a user from another clinic cannot see the encounter.

Do not use the staff-created patient form with real patient data until the fixed-password account issue in [the pilot plan](docs/CLINIC_PILOT_PLAN.md#what-exists-now) is fixed.
---

## 7. Smoke Test (Automated)

With the backend running, in the `backend/` directory:

```bash
# Quick smoke test (tests auth, encounters, triage, messaging, alerts)
npm run test:smoke

# Verbose mode (prints response bodies)
npm run test:smoke:verbose
```

Or run the logging test suite:

```bash
npm run test:logging
npm run test:logging:verbose
```

Or run the E2E frontend-flow test:

```bash
node scripts/e2e-frontend-flows.js --seed --verbose
```

## 7.5 One-Line Dev Launcher

From the repo root:

```bash
./priage-dev
```

Variants:

```bash
./priage-dev newuser
./priage-dev reseed
./priage-dev fullseed
./priage-dev test
./priage-dev logs
./priage-dev logs -v
./priage-dev reseed test
./priage-dev fullseed test
./priage-dev -t clinic
./priage-dev --instance clinic-1 test
./priage-dev -k
./priage-dev --instance ed-1 -k
./priage-dev -all
./priage-dev -all reseed
./priage-dev -all fullseed
./priage-dev -all -k
```

The launcher verifies Docker + local tooling, creates missing `.env` files, installs dependencies when needed, applies Prisma migrations, creates or reuses a private local admin, and opens the API and both web apps in separate macOS Terminal windows. Plain `./priage-dev` starts ED (`ed-1`). `-t clinic` (or `--tenant clinic`) prompts for clinic name, contact details, timezone, check-in instructions and walk-in acceptance, then creates a new clinic instance; repeat it for another clinic. `--instance NAME` targets an existing instance. `-k` without a selector stops only the most recent running instance. `-all` applies startup, `reseed`, `fullseed`, `test`, or `-k` to every registered instance in turn. `reseed` wipes patient-facing data; ED then runs its standard seed, while clinic retains its mock schedule/legal setup. Clinic `fullseed` creates mock intake and appointment visits through the clinic API, preserving the configured hours and using the saved local admin.

The legacy `ed-1` stack retains PostgreSQL/Redis ports 5432/6379 and API/staff/patient ports 3000/5173/5174. The first additional tenant uses 5433/6380 and 3001/5175/5176. Every named tenant uses separate Compose containers, a PostgreSQL database volume, a Redis volume, process records and auth cookies. A new clinic hospital uses the entered display name, address, phone and check-in instructions; its internal slug remains unique. The clinic preview is pinned to that hospital and its entered timezone; default weekday hours and Terms/Privacy text are mock local test data. Staff credentials are in `.priage-dev/tenants/<name>/accounts.json`; the ED manifest remains at `.priage-dev/accounts.json`. Azure still uses the planned shared, hospital-scoped database rather than this local isolation scheme.

---

## 8. Useful Commands

### Backend

```bash
# Start in watch mode
npm run start:dev

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Re-run migrations after schema changes
npx prisma migrate dev --name describe-change

# Re-create private local admin / extra hospital users
node scripts/bootstrap-dev-accounts.js

# Re-seed the database for a specific hospital
TARGET_HOSPITAL_SLUG=<slug> node scripts/seed.js

# Reset DB completely (wipes all data)
npx prisma migrate reset
```

### Frontend

```bash
# Start dev server
npm run dev

# Type-check without building
npx tsc --noEmit

# Production build
npm run build
```

### Docker

```bash
# Start infrastructure
docker compose up -d

# Stop infrastructure
docker compose down

# Stop and wipe volumes (resets DB)
docker compose down -v

# View Postgres logs
docker logs priage-postgres --tail 50
```

### Database (direct access)

```bash
# Connect to psql
docker exec -it priage-postgres psql -U priage -d priage

# Quick queries
docker exec priage-postgres psql -U priage -d priage -c 'SELECT id, email, role FROM "User";'
docker exec priage-postgres psql -U priage -d priage -c 'SELECT id, status, "chiefComplaint" FROM "Encounter";'
docker exec priage-postgres psql -U priage -d priage -c 'SELECT id, "firstName", "lastName" FROM "PatientProfile";'
```

---

## 8. Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (NestJS) | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | `postgresql://priage:priage@localhost:5432/priage` |
| Redis | 6379 | `redis://localhost:6379` |
| Prisma Studio | 5555 | http://localhost:5555 (when running) |

---

## 9. Troubleshooting

### "Connection refused" on login

- Is Docker running? → `docker ps`
- Is the backend running? → `curl http://localhost:3000/health`
- Check backend terminal for errors

### "Invalid credentials" with correct password

- Was the bootstrap + seed flow run? → `node scripts/bootstrap-dev-accounts.js` then `TARGET_HOSPITAL_SLUG=<slug> node scripts/seed.js`
- Check the hospital exists: `docker exec priage-postgres psql -U priage -d priage -c 'SELECT * FROM "Hospital";'`

### "CORS error" in browser console

- Is `CORS_ORIGINS` in `backend/.env` set to `http://localhost:5173`?
- Restart the backend after changing `.env`

### "relation does not exist" or Prisma errors

- Apply committed migrations: `cd backend && npx prisma migrate deploy`
- If stuck, reset: `npx prisma migrate reset` (wipes data — re-run seed after)

### Frontend shows "Loading…" forever

- Backend not running or wrong `VITE_API_URL`
- Check browser DevTools → Network tab for failing requests

### Seed script fails with "column not found"

- Schema drift — run `npx prisma migrate deploy` to apply committed schema changes

---

## 10. Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────┐
│   HospitalApp       │  REST   │   NestJS Backend     │
│   (React + Vite)    │────────▶│   (port 3000)        │
│   port 5173         │         │                      │
│                     │◀────────│  Session cookies     │
│   Socket.IO client  │  WS     │   Socket.IO server   │
└─────────────────────┘         └──────────┬───────────┘
                                           │
                                 ┌─────────┴─────────┐
                                 │                    │
                            ┌────▼────┐         ┌────▼────┐
                            │Postgres │         │  Redis  │
                            │  5432   │         │  6379   │
                            └─────────┘         └─────────┘
```

- **Frontend → Backend:** REST API calls with HttpOnly session cookies; the staff browser does not keep an auth token in JavaScript
- **Backend → Frontend:** Socket.IO events for real-time encounter/alert/message updates
- **Backend → Postgres:** Prisma ORM with the `@prisma/adapter-pg` driver adapter
- **Backend → Redis:** BullMQ job queues for async event processing
