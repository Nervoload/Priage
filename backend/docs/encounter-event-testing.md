# Encounter + Event smoke testing

This guide exercises the encounter state machine endpoints and verifies encounter events via Prisma.

## Prerequisites

- A running Postgres database with `DATABASE_URL` set.
- The NestJS backend running locally (defaults to `http://localhost:3000`).
- An existing `Hospital` row in the database (use its numeric `id`).

## 1) Install dependencies + migrate

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

## 2) Start the API

```bash
cd backend
npm run start:dev
```

## 3) Run the encounter + event smoke script

In a second terminal:

```bash
cd backend
API_BASE_URL=http://localhost:3000 \
HOSPITAL_ID=1 \
node scripts/encounter-event-smoke.js
```

### Required environment overrides

```bash
API_BASE_URL=http://localhost:3000 \
HOSPITAL_ID=1 \
node scripts/encounter-event-smoke.js
```

### Expected output

- A new encounter is created.
- The script drives `arrived`, `start-exam`, `waiting`, and `discharge` transitions.
- Encounter events are printed in order (e.g., `ENCOUNTER_CREATED`, `STATUS_CHANGE`, etc.).
