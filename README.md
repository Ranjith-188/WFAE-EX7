# Leave Application System

A workflow-driven leave management app. Employees apply for leave and track their requests, and managers approve or reject them. The approval workflow is modelled in BPMN and executed by **Camunda 8**, with a **Spring Boot** backend and a **React** frontend.


## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Workflow (BPMN)](#workflow-bpmn)
- [Screenshots](#screenshots)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Docker Deployment](#docker-deployment)
- [API Reference](#api-reference)
- [Testing Scenarios](#testing-scenarios)
- [Troubleshooting](#troubleshooting)

## Features
- Employees submit leave requests (Annual, Sick, Unpaid, Other).
- Automatic validation of the date range, working days and leave balance.
- Manager inbox to approve or reject with a comment.
- Leave balance is deducted only after approval.
- Full process visibility through Camunda Operate.
- One-command Docker deployment.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Nginx |
| Backend | Java 21, Spring Boot 3.5, Spring Data JPA, Maven |
| Workflow | Camunda 8 Self-Managed (Zeebe, Operate, Tasklist) |
| Database | H2 (local dev), PostgreSQL (Docker) |
| Deployment | Docker, Docker Compose |

## Architecture
| Component | Port | Role |
|---|---|---|
| React frontend | 5173 (dev) / 3000 (Docker) | Apply form, My Requests, Manager Inbox |
| Spring Boot backend | 8081 | REST APIs, business logic, job workers |
| Camunda 8 | 8080 (REST/UI), 26500 (gRPC) | Runs the BPMN process |
| Database | H2 file / PostgreSQL 5432 | Leave requests and balances |

The browser talks only to the Spring Boot backend. The backend starts process instances, completes user tasks and runs the job workers through Camunda's gRPC and REST APIs.

## Workflow (BPMN)
Process ID: `leave-request`

1. **Leave requested** starts the process.
2. **Validate leave request** (`validate-leave` worker) checks the dates, working days and balance.
3. **Request valid?** Invalid requests go straight to rejection.
4. **Manager approval** is a user task using the `leave-approval` form.
5. **Approved?** The manager decision routes to approval or rejection.
6. **Finalize leave** (`finalize-leave` worker) records the final status and updates the balance.
7. The process ends with **Leave approved** or **Leave rejected**.

### Process variables
| Variable | Set by |
|---|---|
| `requestId`, `employeeEmail`, `leaveType`, `days`, `startDate`, `endDate` | Backend, when starting the process |
| `valid`, `validationMessage` | `validate-leave` worker |
| `approved`, `managerComment` | Manager approval task |
| `outcome` | Input mapping on each finalize task |

## Screenshots

### Apply Leave
Employees fill in the leave details and submit.

<img width="1600" height="787" alt="image" src="https://github.com/user-attachments/assets/70faf96b-2ec0-4166-a3f8-d96794417e75" />


### Manager Inbox
Managers review pending requests and approve or reject them.

<img width="1600" height="783" alt="image" src="https://github.com/user-attachments/assets/fb4510e8-74d3-498c-8663-3b4554acc424" />


### H2 Database Console
Backend data (leave requests and balances) viewed in the H2 console at `http://localhost:8081/h2-console`.

<img width="1600" height="393" alt="image" src="https://github.com/user-attachments/assets/fda70609-e937-46a2-9564-8b0d80979249" />


### Camunda Operate: Processes
The deployed `leave-request` process and its running and completed instances.

<img width="1600" height="567" alt="image" src="https://github.com/user-attachments/assets/8c0d58ca-48cc-485e-b078-bac6b71f49fc" />


### Camunda Operate: Process Instance
A single instance showing the path taken through the BPMN diagram and its variables.

<img width="1600" height="780" alt="image" src="https://github.com/user-attachments/assets/d3ae92c5-0815-409e-8ec8-752c2a78ab69" />


## Project Structure
```
leave-system/
├── bpmn/                  # leave-request.bpmn, leave-approval.form
├── camunda/               # Camunda 8 Docker Compose
├── backend/               # Spring Boot app
│   └── src/main/
│       ├── java/com/example/leave/{api,domain,service,worker}/
│       └── resources/{application.yml, bpmn/}
├── frontend/              # React + Vite + TypeScript
│   └── src/{components,pages,services,types}/
├── docs/                  # architecture.png and screenshots
├── docker-compose.yml     # frontend + backend + database
└── README.md
```

## Getting Started

### Prerequisites
- Java 21
- Maven 3.9+
- Node.js 20+
- Docker and Docker Compose

### 1. Start Camunda 8
```bash
cd camunda
docker compose up -d
```
Wait until the containers are healthy, then open Operate at http://localhost:8080/operate.

### 2. Start the backend
```bash
cd backend
mvn clean package
mvn spring-boot:run
```
The backend runs on http://localhost:8081 and deploys the BPMN and form to Camunda on startup. The H2 console is at http://localhost:8081/h2-console with JDBC URL `jdbc:h2:file:./data/leavedb`, user `sa`, empty password.

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

### Configuration
Never commit credentials. Copy the example file and fill it in locally:
```bash
cp .env.example .env
```
Camunda connection settings and database credentials are read from environment variables.

## Docker Deployment
Start Camunda first (see above), then the application stack:
```bash
docker compose up --build
```
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8081 |
| Camunda Operate | http://localhost:8080/operate |
| PostgreSQL | localhost:5432 |

## API Reference
Base path: `/api/leaves`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/leaves` | Submit a leave request |
| GET | `/api/leaves?employeeEmail=` | List an employee's requests |
| GET | `/api/leaves/pending` | List requests awaiting approval |
| POST | `/api/leaves/{id}/decision` | Approve or reject (`{ "approved": true, "comment": "..." }`) |
| GET | `/api/leaves/balance?employeeEmail=` | Get remaining leave days |

## Testing Scenarios
| # | Scenario | Expected result |
|---|---|---|
| 1 | Valid annual leave, manager approves | Status `APPROVED`, balance reduced |
| 2 | Manager rejects with a comment | Status `REJECTED`, balance unchanged |
| 3 | Days exceed the balance | Rejected automatically by validation |
| 4 | Date range with no working days | Rejected by validation |
| 5 | End date before start date | Rejected with an error message |
| 6 | Invalid email or missing fields | HTTP 400 with readable errors |

Use Camunda Operate to confirm the path each instance took.

## Troubleshooting
- **Work waiting in Camunda with no worker:** the job types in the BPMN must exactly match the `@JobWorker` types (`validate-leave`, `finalize-leave`).
- **Backend cannot reach Camunda:** confirm Camunda is healthy and ports 8080 and 26500 are reachable.
- **Port already in use:** Camunda uses 8080 and the backend uses 8081. Stop conflicting services.
- **Process not visible in Operate:** check the backend startup logs for deployment errors.

## Author
Ranjith, B.Tech Computer Science, SRM Institute of Science and Technology
