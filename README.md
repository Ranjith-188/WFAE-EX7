# Leave Application System (LeaveFlow)

A production-grade, workflow-driven leave management system built with **Camunda 8 (Self-Managed)**, **Spring Boot 3.4/3.5**, and **React + TypeScript + Vite**.

---

## 1. Architecture Overview

```
                      HTTP 5173 (Dev) / 3000 (Docker)
[ Browser (User) ] ──────────────────────────────────────────► [ React SPA (Vite + TS) ]
                                                                       │
                                                              REST     │ /api
                                                                       ▼
                                                          [ Spring Boot Backend (8081) ]
                                                               ├── JPA / Hibernate ──► H2 / PostgreSQL (5432)
                                                               └── Camunda Client (gRPC 26500 + REST 8080)
                                                                       │
                                                                       ▼
                                                          [ Camunda 8 Self-Managed ]
                                                               ├── Zeebe Engine (26500)
                                                               ├── Operate Dashboard (8080/operate)
                                                               └── Tasklist (8080/tasklist)
```

- **Separation of Concerns**: The browser only communicates with the Spring Boot backend via `/api`. React never calls Camunda directly.
- **Workflow Orchestration**: Camunda 8 runs the BPMN process definition (`leave-request`). Service tasks are fulfilled by Spring Boot `@JobWorker`s, and user approvals are handled as Camunda User Tasks (`leave-approval.form`).
- **Data Persistence**:
  - **Local Development**: In-memory / file-based H2 database (`jdbc:h2:file:./data/leavedb`).
  - **Docker Deployment**: Containerized PostgreSQL 15 database.

---

## 2. Folder Structure

```
leave-system/
├── bpmn/
│   ├── leave-request.bpmn             # BPMN 2.0 XML with full diagram DI layout
│   └── leave-approval.form            # Camunda Forms JSON (approved checkbox & managerComment)
├── camunda/                           # Official Camunda 8 Self-Managed distribution
│   ├── docker-compose.yaml            # Zeebe + Operate + Tasklist + Elasticsearch
│   ├── .env                           # Camunda image versions and environment variables
│   └── connector-secrets.txt          # Connector secrets template
├── backend/
│   ├── pom.xml                        # Maven build (Java 21, Spring Boot 3.4.x, Camunda 8.8.0)
│   ├── Dockerfile                     # Multi-stage build (Maven -> Eclipse Temurin 21 JRE slim)
│   └── src/
│       ├── main/
│       │   ├── java/com/example/leave/
│       │   │   ├── LeaveApplication.java   # @SpringBootApplication & @Deployment
│       │   │   ├── api/                    # Controllers, DTOs, Exception Handlers
│       │   │   ├── domain/                 # JPA Entities & Repositories
│       │   │   ├── service/                # Business logic & CamundaClient integration
│       │   │   ├── worker/                 # @JobWorker ("validate-leave", "finalize-leave")
│       │   │   └── config/                 # CORS & Camunda configurations
│       │   └── resources/
│       │       ├── application.yml         # Default (H2) and Docker (Postgres) profiles
│       │       └── bpmn/                   # Classpath deployment copies of BPMN & form
│       └── test/java/com/example/leave/    # Unit tests for validation, deduction, and weekdays
├── frontend/
│   ├── Dockerfile                     # Multi-stage build (Node 20 -> Nginx alpine)
│   ├── nginx.conf                     # SPA routing fallback & reverse proxy /api to backend
│   ├── vite.config.ts                 # Dev server port 5173 with proxy to backend (8081)
│   ├── package.json                   # React 19, TypeScript, Lucide Icons, Vite
│   └── src/
│       ├── types/leave.ts             # TypeScript definitions & payloads
│       ├── services/api.ts            # Typed API client with readable error surfacing
│       ├── components/                # Navbar, StatusBadge, etc.
│       ├── pages/                     # ApplyPage, MyRequestsPage, ManagerInboxPage
│       └── App.tsx, index.css, main.tsx
├── scripts/
│   ├── e2e.ps1                        # PowerShell end-to-end automated test suite
│   └── e2e.sh                         # Bash/curl end-to-end automated test suite
├── docker-compose.yml                 # Root compose (frontend:3000, backend:8081, postgres:5432)
├── .env.example                       # Environment template with placeholders
├── .env                               # Active environment configuration
├── .gitignore                         # Git exclusion rules
└── README.md                          # Documentation and operational manual
```

---

## 3. Workflow Specification

### BPMN Process: `leave-request`
- **Start Event**: `Leave requested`
- **Service Task**: `Validate leave request` (Job type: `validate-leave`)
  - Evaluates start date vs end date, checks weekday count $> 0$, and checks if Annual leave balance $\ge$ requested days.
- **Exclusive Gateway**: `Request valid?`
  - Flow to `Manager approval`: Condition `=valid`
  - Default flow: Directly merges into `Gateway_Merge` (rejection path).
- **User Task**: `Manager approval` (`zeebe:userTask`, Form ID: `leave-approval`)
  - Waiting stage for manager action via REST or Tasklist.
- **Exclusive Gateway**: `Approved?`
  - Flow to `Finalize as approved`: Condition `=approved`
  - Default flow: Merges into `Gateway_Merge`.
- **Service Task**: `Finalize as approved` (Job type: `finalize-leave`, input mapping `outcome = "APPROVED"`)
  - Deducts requested days from the employee's Annual leave balance, sets status `APPROVED`, and triggers notification hook.
- **End Event**: `Leave approved`
- **Exclusive Gateway**: `Merge`
  - Joins both rejection flows.
- **Service Task**: `Finalize as rejected` (Job type: `finalize-leave`, input mapping `outcome = "REJECTED"`)
  - Leaves balance unchanged, sets status `REJECTED` with specific validation or manager comment, and triggers notification hook.
- **End Event**: `Leave rejected`

---

## 4. Prerequisites

1. **Java**: JDK 21+ (`java -version`)
2. **Node.js**: Node 20+ & npm (`node -v`, `npm -v`)
3. **Maven**: 3.9+ (`mvn -v`)
4. **Camunda 8**: Local Camunda 8 Run (C8 Run 8.8+) or Docker Desktop for running `camunda/docker-compose.yaml`

---

## 5. Local Development Run Instructions (Step-by-Step)

### Step 1: Start Camunda 8
Start Camunda 8 Run (or start containers from `camunda/`):
```bash
# Using Camunda 8 Run
c8run start
# Or using the Camunda compose stack
cd camunda
docker compose up -d
```
Verify:
- Camunda Operate UI is accessible at [http://localhost:8080/operate](http://localhost:8080/operate) (login: `demo` / `demo`)
- Zeebe gRPC is active on `localhost:26500`

### Step 2: Start Spring Boot Backend
From the root directory:
```bash
cd backend
mvn spring-boot:run
```
- Starts on port `8081`.
- Automatically connects to Camunda (`localhost:26500` and `localhost:8080`).
- Automatically deploys `leave-request.bpmn` and `leave-approval.form`.
- H2 Console is available at [http://localhost:8081/h2-console](http://localhost:8081/h2-console) (JDBC URL: `jdbc:h2:file:./data/leavedb`, user: `sa`, password: empty).

### Step 3: Start React Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.
- Dev server proxies all `/api` requests to `http://localhost:8081`.

---

## 6. Docker Deployment Instructions

To spin up the entire application stack (PostgreSQL, Backend, Frontend) with Docker:

1. **Verify `.env` configuration**:
   Ensure `.env` exists in the root folder with proper settings:
   ```env
   DB_NAME=leavedb
   DB_USER=leave_user
   DB_PASSWORD=leave_secret
   CAMUNDA_GRPC_ADDRESS=http://host.docker.internal:26500
   CAMUNDA_REST_ADDRESS=http://host.docker.internal:8080
   ```

2. **Start the Stack**:
   ```bash
   docker compose up --build -d
   ```

3. **Access Endpoints**:
   - Frontend Application: [http://localhost:3000](http://localhost:3000)
   - Spring Boot Backend REST: [http://localhost:8081/api/leaves](http://localhost:8081/api/leaves)
   - PostgreSQL Database: `localhost:5432`

---

## 7. REST API Reference

Base URL: `/api/leaves`

| Method | Path | Request Body | Status Codes | Description |
|---|---|---|---|---|
| `POST` | `/api/leaves` | `SubmitLeaveRequest` (JSON) | `201 Created`, `400 Bad Request` | Submits a new leave request, computes weekdays, starts Camunda workflow |
| `GET` | `/api/leaves?employeeEmail={email}` | None | `200 OK` | Retrieves all leave requests for the specified employee (newest first) |
| `GET` | `/api/leaves/pending` | None | `200 OK` | Returns all requests in `PENDING_APPROVAL` status |
| `GET` | `/api/leaves/{id}` | None | `200 OK`, `404 Not Found` | Retrieves request by ID |
| `POST` | `/api/leaves/{id}/decision` | `DecisionRequest` (JSON) | `204 No Content`, `404 Not Found`, `409 Conflict` | Manager approves or rejects a pending request; completes Camunda user task |
| `GET` | `/api/leaves/balance?employeeEmail={email}` | None | `200 OK` | Returns `{ "remainingDays": n }` (defaults to 20 days) |

### Request & Response Examples

#### Submit Request (`POST /api/leaves`)
```json
{
  "employeeName": "Alice Smith",
  "employeeEmail": "alice@company.com",
  "leaveType": "Annual",
  "startDate": "2026-11-02",
  "endDate": "2026-11-04",
  "reason": "Family vacation"
}
```

#### Decision Request (`POST /api/leaves/1/decision`)
```json
{
  "approved": true,
  "comment": "Approved, please hand over client tasks"
}
```

---

## 8. Automated Acceptance Test Scenarios

Run the automated test suite at any time:
```powershell
# PowerShell
.\scripts\e2e.ps1

# Bash / Linux
./scripts\e2e.sh
```

### Verified Scenarios (All Passed: 20/20 Assertions)
1. **Happy Path**: 3 weekdays submitted $\rightarrow$ status `SUBMITTED` $\rightarrow$ worker transitions to `PENDING_APPROVAL` $\rightarrow$ appears in Manager Inbox $\rightarrow$ manager approves with comment $\rightarrow$ status `APPROVED` $\rightarrow$ annual balance drops from 20 to 17.
2. **Manager Rejection**: Pending request rejected with comment $\rightarrow$ status `REJECTED` $\rightarrow$ comment visible in history $\rightarrow$ balance remains intact at 20.
3. **Insufficient Balance**: Requesting 25 days with a 20-day balance $\rightarrow$ validation worker catches shortfall $\rightarrow$ directly finalized as `REJECTED` $\rightarrow$ never reaches Manager Inbox.
4. **No Working Days**: Selecting weekend-only dates $\rightarrow$ validated as 0 days $\rightarrow$ rejected with clear reason.
5. **Bad Dates**: End date before start date $\rightarrow$ rejected by validation worker.
6. **Validation Errors**: Malformed body (missing name, invalid email) $\rightarrow$ returns HTTP 400 with field details.
7. **Invalid Decision**: Deciding on an already finalized/rejected request $\rightarrow$ returns HTTP 409 Conflict.
8. **Operate Verification**: BPMN tokens progress through gateways without incidents.

---

## 9. Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| **Camunda Not Reachable (`UNAVAILABLE`)** | C8 Run or Docker containers are not running on ports 8080 and 26500. | Check running processes with `Get-NetTCPConnection -LocalPort 8080, 26500`. Ensure C8 Run (`c8run start`) or Camunda Docker containers are active. |
| **Port 8081 in use** | A previous instance of the backend or another process is holding port 8081. | Identify the process using `Get-Process -Id (Get-NetTCPConnection -LocalPort 8081).OwningProcess` and terminate it before launching Spring Boot. |
| **Job Worker Type Mismatch** | Tasks remain active indefinitely in Operate without moving to the next element. | Confirm that the BPMN service task job type matches the backend `@JobWorker(type = ...)` strings exactly: `validate-leave` and `finalize-leave`. |
| **Docker Container cannot resolve Camunda** | In Docker mode, backend fails to connect to `localhost:26500`. | The backend container must connect to the host machine via `host.docker.internal:26500` (or shared Docker network `camunda`). Verify `extra_hosts` is present in `docker-compose.yml`. |
| **401 Unauthorized in Camunda Client** | Camunda authentication credentials are misconfigured. | If Camunda has basic auth enabled, verify `CAMUNDA_USERNAME=demo` and `CAMUNDA_PASSWORD=demo` in `.env`. Do not configure empty OIDC client-id and basic auth properties together. |
