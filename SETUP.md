# Priage — Full-Stack Setup Guide

> From repo clone to a working local environment with seeded data.

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
    └── HospitalApp/          # Vite + React frontend (port 5173)
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

# Jobs
TRIAGE_REASSESSMENT_MINUTES=30

# App
APP_VERSION="0.1.0"
```

### 3c. Run database migrations

```bash
npx prisma migrate dev
```

This creates all tables in the PostgreSQL database.

### 3d. Seed test data

```bash
node scripts/seed.js
```

This creates:

| What | Details |
|------|---------|
| **Hospital** | Priage General Hospital |
| **4 Users** | One per role (ADMIN, DOCTOR, NURSE, STAFF) |
| **3 Patients** | Alice (EXPECTED), Bob (ADMITTED), Carol (TRIAGE with assessment) |

**All passwords:** `password123`

| Role | Email |
|------|-------|
| Admin | `admin@priage.dev` |
| Doctor | `doctor@priage.dev` |
| Nurse | `nurse@priage.dev` |
| Staff | `staff@priage.dev` |

### 3e. Start the backend

```bash
npm run start:dev
```

Verify it's running:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok",...}
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

---

## 5. Manual Testing Checklist

Log in at http://localhost:5173 with `nurse@priage.dev` / `password123`.

| # | Test | How | Expected Result |
|---|------|-----|----------------|
| 1 | **Login** | Enter credentials, click Sign In | Dashboard loads, user pill shows top-left |
| 2 | **Admittance list** | Default view | See Alice (EXPECTED) and Bob (ADMITTED) |
| 3 | **View Details** | Click "View Details" on Alice | TriagePopup opens showing chief complaint |
| 4 | **Confirm Arrival** | Click "Confirm Arrival" on Alice | Alice moves from EXPECTED → ADMITTED |
| 5 | **Start Triage** | Click "Start Triage" on Bob (or Alice after confirming) | Patient moves to TRIAGE status |
| 6 | **Triage tab** | Click "Triage" in nav | See triaged patients (Carol is already here) |
| 7 | **Triage assessment** | Click "View Details" on Carol → see existing assessment | Shows CTAS 3, vitals, pain level 6 |
| 8 | **New assessment** | Click "+ New" in Carol's popup | Triage form appears |
| 9 | **Submit assessment** | Fill CTAS level + complaint, submit | Success, assessment appears in popup |
| 10 | **Waiting Room** | Click "Waiting Room" in nav | See patients in TRIAGE/WAITING/COMPLETE |
| 11 | **Alerts** | Check top-right alert badge | Badge shows count of active alerts |
| 12 | **Refresh** | Click ↻ button on any list | Data refreshes from backend |
| 13 | **Role test** | Log out → log in as `staff@priage.dev` | Same dashboard, STAFF role shown in pill |
| 14 | **Bad credentials** | Log out → enter wrong password | "Invalid email or password" error |
| 15 | **Network tab** | Open DevTools → Network | All calls go to `localhost:3000`, no 404s/500s |

---

## 6. Smoke Test (Automated)

With the backend running, in the `backend/` directory:

```bash
# Quick smoke test (tests auth, encounters, triage, messaging, alerts)
npm run test:smoke

# Verbose mode (prints response bodies)
npm run test:smoke:verbose
```

Or run the E2E frontend-flow test:

```bash
node scripts/e2e-frontend-flows.js --seed --verbose
```

---

## 7. Useful Commands

### Backend

```bash
# Start in watch mode
npm run start:dev

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Re-run migrations after schema changes
npx prisma migrate dev --name describe-change

# Re-seed the database
node scripts/seed.js

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

- Was the seed script run? → `node scripts/seed.js`
- Check the hospital exists: `docker exec priage-postgres psql -U priage -d priage -c 'SELECT * FROM "Hospital";'`

### "CORS error" in browser console

- Is `CORS_ORIGINS` in `backend/.env` set to `http://localhost:5173`?
- Restart the backend after changing `.env`

### "relation does not exist" or Prisma errors

- Run migrations: `cd backend && npx prisma migrate dev`
- If stuck, reset: `npx prisma migrate reset` (wipes data — re-run seed after)

### Frontend shows "Loading…" forever

- Backend not running or wrong `VITE_API_URL`
- Check browser DevTools → Network tab for failing requests

### Seed script fails with "column not found"

- Schema drift — run `npx prisma migrate dev` to apply pending schema changes

---

## 10. Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────┐
│   HospitalApp       │  REST   │   NestJS Backend     │
│   (React + Vite)    │────────▶│   (port 3000)        │
│   port 5173         │         │                      │
│                     │◀────────│   JWT Auth           │
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

- **Frontend → Backend:** REST API calls with JWT in `Authorization: Bearer <token>` header
- **Backend → Frontend:** Socket.IO events for real-time encounter/alert/message updates
- **Backend → Postgres:** Prisma ORM with the `@prisma/adapter-pg` driver adapter
- **Backend → Redis:** BullMQ job queues for async event processing
