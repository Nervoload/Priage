# 🚑💨 Priage 🤕
An AI powered emergency department patient pipeline.

Priage improves the emergency room experience for hospitals and patients. Through seemless data transfer, open communication, and quality patient monitoring--Priage transforms confusement and concern into certainty and satisfaction. Priage saves lives by tracking patients, and informing staff on potential disease or injury progression before treatment: whether on the way to the hospital or in the waiting room.

Priage enables communication between patients and ER staff, allowing for updates directly from the waiting room. The medical team can view the condition, health status, messages and more for all patients. 

# Development 

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
