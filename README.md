# PRIAGE 🚑💨 
An AI powered emergency department patient pipeline.

Priage improves the emergency room experience for hospitals and patients. Through seemless data transfer, open communication, and quality patient monitoring--Priage transforms confusement and concern into certainty and satisfaction. Priage saves lives by tracking patients, and informing staff on potential disease or injury progression before treatment: whether on the way to the hospital or in the waiting room.

Priage enables communication between patients and ER staff, allowing for updates directly from the waiting room. The medical team can view the condition, health status, messages and more for all patients. 

# OUTLINE:
**This is a comprehensive README, with both the value proposition for the competition, and the software architecture. For developers, scroll down to the development half of this document.**
- 1) Our mission
- 2) Development

---

## Our Mission

**Our healthcare system is bursting at the seems: overloaded testing infrastructure, family doctor shortages, deep dissatisfaction, culminating to Canadians dying in the waiting room.**

**This is unacceptable.** Though, pointing fingers and shifting responsibility is not how we solve problems. Our healthcare system is riddled with inefficiency, neglect, and overworked staff—this is a deeply intrenched issue laden by conflicting interests, incentives and agendas. We want to challenge the system, and provide better ways to manage incoming traffic.

**1 in 7 of ~15 million visits to the ER could be managed by primary care. That’s 15% excess burden on Hospitals** who spent those resources, especially the time, on non-severe cases. That’s 2 million extra people where our hospitals could have been otherwise devoting their time to saving lives. Additionally, 1.2 million people leave the waiting room without being seen (in 2024). While many of those people could have be in a non-life-threatening emergency, others might leave prematurely; walk-outs may have a progressing condition, an oversight that could cost them their life.

Further, while research focus grows on prevention, **5.9 million Canadians lack a primary care provider**. Individuals who may have high-risk profiles cannot access the support they need. Symptoms that may be indicative of late stage disease (such as cancer, coronary artery disease, and even diabetes) can be passed off as insignificant. While the majority of Canadians do have access to the primary care network, there is consensus that Canadians are unsatisfied. Long wait times, unaccommodating services, and poor understanding of their condition. Many Canadians seek help, and understanding, though they are left concerned and conflicted about their health. 

**It is clear that this is a social, and systemic problem. We allow the slow-adapting public system to fall further behind immediate, modern needs. It is time that we force against this inertia towards a healthcare system that works with patients, and enables hospitals to provide more care with less.**

### Presenting Priage 

Priage is our platform to address the patient traffic and support for Hospitals. We want to build the infrastructure for managing patients before treatment: from starting their encounters from their phones, wherever they are. Priage is intent to create better access to information where previously overlooked. 

Our core value proposition:
#### 1) Priage. To manage patient traffic, and identify where patients need and can go to for treatment

We are prioritizing true emergencies, to reduce unnecessary burden on the care network. We are evaluating severity before triage: Pre-Triage.

Some patients are simply concerned about their health, and are not educated about medicine. They do not understand how to recognize potential life-threatening signs or symptoms. A purple spot under the skins could be a simple bruise. It could also be internal bleeding. It could very well be flesh-eating bacteria. This is an education problem. We need to be able to make fast decisions, and give the understanding to patients that quell their fears.

**Priage will leverage performant AI Vision models**, which are capable of recognizing pathological features to 99% accuracy, crushing human performance in few-shot analysis. Priage in fact, it solving an easier problem. We are not trying to replace doctors or triage staff: we are trying to help make the decisions for patients on whether they should go to the emergency room. It is a layer where we can accelerate patient inflow for those who need it, and course-correction for cases better solved by primary care, or clinics other than the emergency room.  

Thus, we also will manage the routing to the alternative treatment resources. With a network of hospitals and clinics, we can access live wait times and patient load data, which is currently inaccessible at scale without partnerships. We can reallocate concerned patients who do not have emergency cases to treatment resources with better fit. 

#### 2) To support hospitals by accelerating patient processing

For hospital to provider more and easier, we want to enable the most efficient transfer of information. By helping hospitals, we help patients get the care they need.

**We will not allow for anyone to die in the waiting room.** We want to supercharge hospital staff by allowing for live monitoring of any patient in their waiting room, through their personal devices. Everyone has phones, this is no secret. Approximately 95% of Canadian adults own a smartphone as of 2025, with ownership being near-universal across most age demographics. Data from early 2025 shows 41.6 million active cellular mobile connections in Canada, equivalent to 104% of the total population, indicating that many people own more than one device or have multiple plans. 

Patients should be able to interface with their waiting room staff: To send requests if they have any problems, or especially progressing symptoms. Care providers should also be able to interface with their patients, so that they can be aware of any potential high-risk cases. Priage as a platform enables this line of communication, where patients can communicate with their providers directly. 

Waiting Room staff can view a dashboard of all the patients in the waiting room, where they can access necessary information about the patient. We may also enable remote waiting rooms, so that pathogens can’t spread in crowded rooms. To reduce the overhead, we leverage LLMs and hard-coded software to summarize and prioritize messages, so that if a severe alert is hidden amongst dozens of patients, it is ensured to reach the care team. 

We also want to give patients care-provider approved readings, summaries of their treatment, and information about concerns during their encounter and after they are seen by medical staff. We can provide that satisfaction of knowing you are not in danger by answering questions and detailed explanations to patients as they leave the hospital. By taking the burden of lossy explanations from the medical staff, patients don’t receive over-simplified reasons for their symptoms.

---

# Development 

## Architecture:
We are building a modular platform for Hospitals, Clinics and Patients. We want to build a prototype to present to Hospitals, and so we need to build the basic architecture which will be the foundation for scaling in the future. We are going to build the following:

1) The backend infrastructure to transfer patient profile data across the pipeline, send live notifications, and queue jobs for real-time updates. 
2) The Hospital App, with multiple views: The Pre-triage, Triage, and Waiting Room views for different staff members downstream of the pipeline.
3) The Patient App, which can initiate a notice to a hospital, and then can communicate with the hospital according to the stage of the pipeline the patient is in. 

Below is our proposed tech stack: 
```
                ┌───────────────────────────┐
                │   Patient Web App (SPA)   │
                │   React + Vite + TS       │
                └───────────▲───────────────┘
                            │  HTTPS + WebSocket (Socket.IO)
                ┌───────────┴───────────────┐
                │  Hospital Web App (SPA)   │
                │  React + Vite + TS        │
                └───────────▲───────────────┘
                            │  HTTPS + WebSocket (Socket.IO)
                    ┌───────┴────────────────────┐
                    │  AWS ALB (Load Balancer)   │
                    └───────▲────────────────────┘
                            │  HTTP(S) / WS
                  ┌─────────┴────────────────────────┐
                  │   NestJS Backend (Node + TS)     │
                  │----------------------------------│
                  │  • REST Controllers              │
                  │  • WebSocket Gateway (Socket.IO) │
                  │  • Auth (JWT, RBAC)              │
                  │  • Domain Services:              │
                  │      - Admittance                │
                  │      - Triage                    │
                  │      - Waiting Room              │
                  │      - Messaging                 │
                  │  • Prisma ORM                    │
                  └───────┬──────────────────────────┘
                          │
          ┌───────────────┼─────────────────┐
          │                                   │
┌─────────▼───────────┐            ┌─────────▼────────────┐
│  PostgreSQL (RDS)   │            │  Redis (ElastiCache) │
│  • Patients         │            │  • Socket.IO adapter │
│  • Encounters       │            │    pub/sub channels  │
│  • Triage notes     │            │  • (optional cache)  │
│  • Waiting entries  │            └──────────────────────┘
│  • Messages         │
│  • Audit logs       │
└─────────────────────┘
```

For our protoype, we want to implement a complete backend that can handle live updates from our Hospital App users and our Patient App users. 

## Server: 

We will deploy a relational database system, which is the endpoint for reads and writes from our apps.

For our database management, we will use **PostgreSQL** (standard for webapps) to deal with our relational database. To host our databases, we can use a cloud service like **AWS**. We could also just use Google Firebase for testing, and then use AWS for real prototyping/MVP. 

Redis will manage read/write jobs from our backend.

## Backend:

Our backend will encapsulate the communication between our apps, the server, and initiate updates via our own REST APIs. We will manage the following:

The Patient Profile

The Hospital App Updates

Real-time notifications, status updates, and pipeline transfer

Prisma will deal with our query packaging for our DB. 

Our backend will be built on Nest.js: Node and typescript

## Frontend:

Our front end will be built using Vite and React --> for interactive webapps, and easy deployment using Vite. 

# Development Setup:

## External Software
- Docker Desktop (required to run local PostgreSQL + Redis)

---

## 1) Pre-flight checks--verify your machine can run the stack:
Make sure you have node and npm installed! Latest version is fine.
You might also have to download nestjs globally.

### macOS (Terminal)
~~~bash
node -v
npm -v
docker --version
docker compose version
~~~

### Windows (PowerShell)
~~~powershell
node -v
npm -v
docker --version
docker compose version
~~~

If `docker compose` fails, open Docker Desktop and confirm it’s running.

---

## 2) Install repo dependencies (Node packages):

From the repo root (the folder that contains `backend/` and `apps/`):

### macOS (Terminal)
~~~bash
cd /Priage/backend/

# Prefer a clean, reproducible install when a lockfile exists
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
~~~

### Windows
~~~powershell
cd C:\Priage\backend\

# Prefer a clean, reproducible install when a lockfile exists
if (Test-Path package-lock.json) {
  npm ci
} else {
  npm install
}
~~~

---

## 3) Create local environment files (secrets/config)

Copy the committed examples into local-only files, then edit them in Priage/backend.

### Backend env (NestJS)
#### macOS
~~~bash
cp .env.example .env
~~~

#### Windows
~~~powershell
Copy-Item .env.example .env
~~~

### ~~Frontend env (Vite apps)~~
**‼️(We don't have this yet)**

#### ~~macOS~~
~~~bash
cp apps/patient/.env.example apps/patient/.env.local
cp apps/hospital/.env.example apps/hospital/.env.local
~~~

#### ~~Windows~~
~~~powershell
Copy-Item apps\patient\.env.example apps\patient\.env.local
Copy-Item apps\hospital\.env.example apps\hospital\.env.local
~~~

---

## 4) Start local infrastructure :PostgreSQL + Redis via Docker Compose

Run from the folder that contains `docker-compose.yml` (The root, /Priage)

### macOS & Windows:
~~~bash/powershell
docker compose up -d
docker compose ps
~~~

To watch logs:
- `docker compose logs -f`

To stop everything:
- `docker compose down`

To wipe DB data volumes (destructive):
- `docker compose down -v`

---

## 5) Generate Prisma client + apply migrations)

Run from `backend/'

### macOS & Windows
~~~bash/powershell
npx prisma generate
npx prisma migrate dev --name init
~~~

If this fails, check:
- Docker DB is up (`docker compose ps`) (or in docker desktop)
- `DATABASE_URL` in `backend/.env` is correct & that backend/.env exists
- Misplaced files (.env, main.ts, tsconfig.json, prisma.config.ts)
---

# Running the Software
For testing locally, we need to start 3 terminals: 1) The backend, 2) the patient app, and 3) the hospital app. Here, we can see how the pipeline works on our docker container DB.

### Terminal 1 — Backend (NestJS)
#### macOS & Windows
~~~bash/powershell
cd backend
npm run start:dev
~~~

### Terminal 2 — Patient web app (React + Vite + TypeScript)
#### macOS
~~~bash
cd apps/patient
npm run dev
~~~

#### Windows
~~~powershell
cd apps\patient
npm run dev
~~~

### Terminal 3 — Hospital web app (React + Vite + TypeScript)
#### macOS
~~~bash
cd apps/hospital
npm run dev
~~~

#### Windows 
~~~powershell
cd apps\hospital
npm run dev
~~~

(Each dev server prints the local URL in the terminal output btw)

---
