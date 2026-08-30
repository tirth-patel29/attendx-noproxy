<div align="center">

# ⚡ AttendX

### Zero-Trust Cryptographic Attendance Gateway

**A self-hosted college attendance platform designed to verify classroom presence instead of blindly trusting an attendance request.**

<br/>

[![TypeScript](https://img.shields.io/badge/Backend-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Flutter](https://img.shields.io/badge/Mobile-Flutter-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Self--Hosted-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📖 Overview

AttendX is a college software-group project built around a simple principle:

> **Attendance should be a verifiable event, not a trusted checkbox.**

The system combines a student mobile application, teacher portal, administrative portal, a Node.js/TypeScript attendance gateway, and a self-hosted PostgreSQL/Supabase backend.

The original project architecture is designed to make a classroom attendance claim difficult to fake by combining multiple independent signals: device binding, biometric pre-checks, a short-lived rotating classroom token, and server-side cryptographic/time verification.

The project is intentionally designed for a self-hosted homelab environment with constrained resources and power-cut recovery requirements.

---

## ✨ What AttendX Does

```text
Teacher starts a class
        │
        ▼
Gateway creates short-lived token
        │
        ▼
Live QR/token is shown in Teacher Portal
        │
        ▼
Student performs security pre-check
        │
        ├── Hardware/device check
        ├── Time synchronization check
        └── Biometric check
        │
        ▼
Student scans live QR
        │
        ▼
Student sends cryptographically signed claim
        │
        ▼
Attendance Gateway validates the request
        │
        ▼
Attendance is recorded in PostgreSQL
```

The documented baseline uses a rotating token every **3 seconds** and a server-side acceptance threshold of **≤250 ms** between the student's observed time and the token timing.

---

# 🧭 Table of Contents

- [Architecture](#-architecture)
- [Security Model](#-security-model)
- [Academic Hierarchy](#-academic-hierarchy)
- [Database](#-database)
- [Applications](#-applications)
- [API](#-api)
- [Repository Structure](#-repository-structure)
- [Local Development](#-local-development)
- [Database Migrations](#-database-migrations)
- [Docker & Homelab](#-docker--homelab)
- [Gitea Workflow](#-gitea-workflow)
- [Troubleshooting](#-troubleshooting)
- [Development Workflow](#-development-workflow)
- [Security Rules](#-security-rules)
- [Project Documentation](#-project-documentation)
- [Contributing](#-contributing)

---

# 🏗️ Architecture

```mermaid
flowchart TB
    Student["📱 Student App<br/>Flutter"]
    Teacher["👨‍🏫 Teacher Portal"]
    Admin["🛠️ Admin Portal"]

    Gateway["⚡ Attendance Gateway<br/>Node.js + TypeScript"]

    REST["🌐 REST API"]
    WS["🔄 WebSocket / Live Token Flow"]
    Judge["⚖️ Attendance Judge"]
    Metronome["⏱️ Token Metronome"]

    DB["🗄️ PostgreSQL<br/>Self-hosted Supabase"]

    Student --> REST
    Student --> WS
    Teacher --> REST
    Teacher --> WS
    Admin --> REST

    REST --> Gateway
    WS --> Gateway

    Gateway --> Judge
    Gateway --> Metronome

    Judge --> DB
    Metronome --> DB
```

### Major components

| Component | Responsibility |
|---|---|
| 📱 Student App | Attendance scanning, security pre-checks and attendance submission |
| 👨‍🏫 Teacher Portal | Course/session control and live classroom token display |
| 🛠️ Admin Portal | Administrative and academic hierarchy management |
| ⚡ Backend | REST APIs, authentication, session handling and attendance verification |
| ⏱️ Metronome | Generates/rotates short-lived classroom tokens |
| ⚖️ Judge | Validates attendance claims |
| 🗄️ Supabase/PostgreSQL | Persistent application and attendance data |
| 🐳 Docker | Self-hosted service deployment |

---

# 🔐 Security Model

AttendX follows a **zero-trust client model**.

The server does not simply trust:

- the student's account
- the device
- the QR image
- the timestamp
- or the client application

Instead, multiple checks are combined.

## Gate 1 — Device / Hardware Binding

A student's account can be associated with a device identity/key.

This makes simple account sharing less useful because an attendance claim can be tied to the expected device.

## Gate 2 — Biometric Pre-check

The mobile application can require the device's local biometric authentication before allowing the attendance flow to continue.

The biometric itself remains a device-level authentication mechanism; the gateway does not need the student's raw biometric data.

## Gate 3 — Rotating Classroom Token

The teacher-facing session exposes a short-lived token/QR.

The documented baseline rotates the token every **3 seconds**.

A static screenshot therefore should not remain a valid attendance credential indefinitely.

## Gate 4 — Cryptographic Time Verification

The student client signs attendance information using the device-held secret/HMAC mechanism.

The gateway validates the cryptographic claim and compares the student's observed time against the session token timing.

The documented baseline accepts a difference of up to **250 ms**.

> These mechanisms improve resistance to common attendance abuse; they are not a claim that the system is impossible to attack.

---

# 🎓 Academic Hierarchy

The administrative system is being structured around a proper academic hierarchy rather than a flat division list.

```mermaid
flowchart TD
    College["🏫 College"]
    Department["🏛️ Department"]
    Branch["🎓 Branch"]
    Division["📚 Division"]
    Batch["👥 Batch"]
    Student["🧑‍🎓 Student"]

    College --> Department
    Department --> Branch
    Branch --> Division
    Division --> Batch
    Batch --> Student
```

## Why?

A college can contain multiple departments.

A department can contain multiple branches.

A branch can contain multiple divisions.

A division can contain multiple batches/students.

This allows the admin system to model the institution rather than encoding academic relationships into unrelated strings.

### Current institutional naming model

The project distinguishes **college**, **department**, and **branch**.

Examples include:

| Institution | Department | Branch |
|---|---|---|
| DEPSTAR | DCE | Computer Engineering |
| DEPSTAR | DCS | Computer Science |
| DEPSTAR | DIT | Information Technology |
| DEPSTAR | DAIML | AI & Machine Learning |
| CSPIT | — | CE |
| CSPIT | — | CS |
| CSPIT | — | IT |
| CSPIT | — | AIML |

### Roll-number convention

Examples discussed by the project:

```text
24DCE001
24CE001
25DCE152
```

The leading year can represent the admission/joining year:

```text
24 → 3rd-year cohort
25 → 2nd-year cohort
26 → 1st-year cohort
```

The exact automatic roll-number resolver should always follow the current backend implementation and database configuration rather than being inferred only from the string.

---

# 🗄️ Database

AttendX uses PostgreSQL through the self-hosted Supabase environment.

The database contains application identity, academic, attendance, session, security and audit information.

## Core entities

```mermaid
erDiagram
    COLLEGE ||--o{ DEPARTMENT : contains
    DEPARTMENT ||--o{ BRANCH : contains
    BRANCH ||--o{ DIVISION : contains
    DIVISION ||--o{ BATCH : contains
    BATCH ||--o{ STUDENT : contains

    PROFESSOR ||--o{ COURSE_SESSION : starts
    COURSE ||--o{ COURSE_SESSION : has
    COURSE_SESSION ||--o{ ATTENDANCE_LEDGER : produces
    STUDENT ||--o{ ATTENDANCE_LEDGER : receives

    PROFESSOR ||--o{ TEACHER_ASSIGNMENT : receives
    COURSE ||--o{ TEACHER_ASSIGNMENT : uses
    DIVISION ||--o{ TEACHER_ASSIGNMENT : targets
```

### Important database concepts

| Entity | Purpose |
|---|---|
| `students` | Student identity and attendance ownership |
| `professors` | Faculty identity |
| `courses` | Course definitions |
| `course_sessions` | Individual live attendance sessions |
| `attendance_ledger` | Attendance records |
| `teacher_assignments` | Teacher/course/division relationships |
| `divisions` | Academic division information |
| `admin_users` | Administrative users |
| `api_keys` | API key metadata |
| `active_tokens` | Live session token state |
| `crypto_challenges` | Cryptographic challenge state |
| `device_fingerprints` | Device association data |
| `biometric_templates` | Encrypted biometric template storage where used |
| `audit_logs` | Security/administrative audit events |

Newer academic-hierarchy migrations extend this model with explicit institutional relationships.

---

# 📱 Applications

## Student App

The student application is Flutter-based.

The security-oriented mobile flow includes:

```text
Open App
   ↓
Device / hardware pre-check
   ↓
Time synchronization
   ↓
Biometric authentication
   ↓
Scan live classroom QR
   ↓
Create cryptographic attendance claim
   ↓
Send to gateway
   ↓
Receive attendance result
```

Relevant mobile technologies in the project include:

- Flutter
- `flutter_secure_storage`
- `local_auth`
- `mobile_scanner`
- cryptographic tooling

---

## 👨‍🏫 Teacher Portal

The teacher portal is the classroom-facing web application.

Typical flow:

```text
Teacher Login
     ↓
Select Course
     ↓
Start Session
     ↓
Live QR / Token
     ↓
Students Scan
     ↓
Attendance Results
```

The teacher portal is responsible for controlling the session rather than directly deciding whether a student is present.

The final attendance decision belongs to the backend verification flow.

---

## 🛠️ Admin Portal

The Admin Portal handles system administration and academic organization.

The academic management structure is:

```text
College
  └── Department
       └── Branch
            └── Division
                 └── Batch
                      └── Students
```

Administrative management can therefore be performed at the appropriate level instead of maintaining disconnected lists.

---

# 🌐 API

The backend exposes REST APIs and WebSocket functionality for the live attendance/session system.

## API categories

```text
/api/v1
│
├── Authentication
├── Attendance
├── Sessions
├── Admin
│
└── Academic
    ├── Colleges
    ├── Departments
    ├── Branches
    ├── Divisions
    └── Batches
```

## Academic hierarchy endpoints

### Colleges

```http
GET    /api/v1/admin/academic/colleges
POST   /api/v1/admin/academic/colleges
PUT    /api/v1/admin/academic/colleges/:id
DELETE /api/v1/admin/academic/colleges/:id
```

### Departments

```http
GET    /api/v1/admin/academic/departments
POST   /api/v1/admin/academic/departments
PUT    /api/v1/admin/academic/departments/:id
DELETE /api/v1/admin/academic/departments/:id
```

### Branches

```http
GET    /api/v1/admin/academic/branches
POST   /api/v1/admin/academic/branches
PUT    /api/v1/admin/academic/branches/:id
DELETE /api/v1/admin/academic/branches/:id
```

### Divisions

```http
GET    /api/v1/admin/academic/divisions
POST   /api/v1/admin/academic/divisions
PUT    /api/v1/admin/academic/divisions/:id
DELETE /api/v1/admin/academic/divisions/:id
```

### Batches

```http
GET    /api/v1/admin/academic/batches
POST   /api/v1/admin/academic/batches
PUT    /api/v1/admin/academic/batches/:id
DELETE /api/v1/admin/academic/batches/:id
```

### Legacy divisions

Legacy division endpoints remain relevant where existing parts of the application still reference them:

```http
GET    /api/v1/admin/divisions
POST   /api/v1/admin/divisions
PUT    /api/v1/admin/divisions/:id
DELETE /api/v1/admin/divisions/:id
```

> Endpoint paths should be treated as implementation details and verified against the current backend route definitions when integrating new clients.

---

# 📁 Repository Structure

```text
attendx-noproxy/
│
├── .gitea/
│   └── workflows/          # Gitea Actions
│
├── admin/                  # Admin web portal
├── app/                    # Flutter student application
├── backend/                # Node.js / TypeScript backend
├── deploy/                 # Self-hosted deployment resources
├── docs/                   # SRS / architecture / operations docs
├── migrations/             # PostgreSQL migrations
├── portal/                 # Teacher portal
├── scripts/                # Operational/deployment scripts
│
├── CONTEXT.md              # Project context and architecture rationale
├── DEPLOY.md               # Deployment documentation
├── PROJECT_PLAN.md         # Project planning
├── QUICK_REFERENCE.md      # Quick developer reference
├── ROADMAP.md              # Development roadmap
├── docker-compose.yml      # Docker services
├── docker-compose.ports.yml
└── README.md
```

---

# 🛠️ Local Development

## Prerequisites

Depending on the component being developed:

- Node.js
- npm
- Flutter SDK
- Dart
- PostgreSQL / Supabase
- Docker

## Backend

```bash
cd backend
npm install
npm run dev
```

## Teacher Portal

```bash
cd portal
npm install
npm run dev
```

## Admin Portal

```bash
cd admin
npm install
npm run dev
```

## Flutter App

```bash
cd app
flutter pub get
flutter run
```

### Important: database environment

The Docker/homelab environment can use Docker-internal database hostnames such as:

```text
supabase-db
```

That hostname is meaningful inside the Docker network.

If the backend is executed directly on Windows, `supabase-db` is not automatically resolvable from the Windows host. Local development therefore needs an appropriate reachable PostgreSQL/Supabase connection configuration.

Do not replace a production Docker hostname with `localhost` unless PostgreSQL is actually running locally.

---

# 🗃️ Database Migrations

Database schema changes live in:

```text
migrations/
```

Academic hierarchy migrations are part of the ongoing expansion from the original division-oriented model to:

```text
College
  ↓
Department
  ↓
Branch
  ↓
Division
  ↓
Batch
  ↓
Student
```

### Migration discipline

Before applying a migration to a production database:

1. Inspect the current schema.
2. Back up important data.
3. Check existing tables and constraints.
4. Review foreign keys.
5. Review unique constraints.
6. Apply the migration.
7. Verify the resulting records.

**Never blindly drop or reset the production database.**

---

# 🐳 Docker & Homelab

AttendX is designed for a self-hosted homelab rather than requiring a large cloud deployment.

The project's original environment targets a constrained host and explicitly considers:

- RAM usage
- persistent storage
- power outages
- automatic restart
- backups
- Docker networking

High-level deployment:

```mermaid
flowchart LR
    Git["Git Repository"]
    Actions["Gitea Actions"]
    Host["Homelab"]
    Docker["Docker"]
    Gateway["Attendance Gateway"]
    Portal["Teacher Portal"]
    Admin["Admin Portal"]
    DB["Supabase / PostgreSQL"]

    Git --> Actions
    Actions --> Host
    Host --> Docker

    Docker --> Gateway
    Docker --> Portal
    Docker --> Admin
    Docker --> DB
```

---

# 🔄 Gitea Workflow

The repository uses Gitea for source control and Actions for build/deployment automation.

The intended development lifecycle is:

```text
Feature branch
      ↓
Pull Request
      ↓
Backend / Portal / Admin validation
      ↓
Docker validation
      ↓
Review
      ↓
Merge to main
      ↓
Deployment workflow
      ↓
Homelab
```

The deployment pipeline is infrastructure owned by the project maintainers.

**Application changes should not casually modify the CI/CD pipeline.**

---

# 🧪 Validation Before a PR

Before pushing a feature:

### Backend

```bash
cd backend
npm run build
```

### Portal

```bash
cd portal
npm run build
```

### Admin

```bash
cd admin
npm run build
```

### Git

```bash
git status
git diff
```

Then:

```bash
git add <changed-files>
git commit -m "type(scope): description"
git push origin <branch>
```

---

# 🐛 Troubleshooting

## `getaddrinfo ENOTFOUND supabase-db`

Usually means the backend is running outside the Docker network where `supabase-db` exists.

Check whether you are running:

```text
Windows host
```

or:

```text
Docker / homelab network
```

Do not blindly change database configuration.

---

## `ECONNREFUSED 127.0.0.1:5432`

This means PostgreSQL is not listening on your local Windows machine at port `5432`.

It does not necessarily mean the remote Supabase database is down.

---

## Portal TypeScript build errors

Run:

```bash
cd portal
npm run build
```

Fix the actual TypeScript error instead of disabling type checking.

Avoid using:

```text
@ts-ignore
@ts-expect-error
any
```

as a shortcut.

---

## API returns `401`

Check:

- authentication state
- access token/session
- API base URL
- backend availability
- browser storage/cookies
- CORS configuration

Do not hardcode credentials into frontend code.

---

## Academic hierarchy fails to load

Check in this order:

```text
Admin UI
   ↓
Frontend API service
   ↓
Backend academic route
   ↓
Database query
   ↓
Academic hierarchy tables
```

A failure at any layer can surface as a generic UI error.

---

# 🔑 Environment Variables

Environment variables are component-specific.

Typical categories include:

| Category | Purpose |
|---|---|
| Server | Port, environment and logging |
| Database | PostgreSQL/Supabase connection |
| CORS | Allowed frontend origins |
| Authentication | Admin/auth configuration |
| Metronome | Token generation interval |
| Judge | Attendance verification window |
| Deployment | Homelab/SSH configuration |

**Never commit actual secrets.**

Keep credentials in `.env` files or the appropriate secret-management system.

---

# 🚨 Security Rules

Never commit:

```text
.env
database passwords
API keys
SSH private keys
deployment credentials
JWT secrets
HMAC secrets
private certificates
```

Use placeholders/examples in documentation.

Also remember:

> A cryptographic attendance system is only as secure as its key management, server configuration, database permissions and client implementation.

---

# 📚 Project Documentation

The repository already contains dedicated documentation areas:

| File / Directory | Purpose |
|---|---|
| `CONTEXT.md` | Why the system exists and architectural constraints |
| `ROADMAP.md` | Project milestones and future direction |
| `PROJECT_PLAN.md` | Project planning |
| `QUICK_REFERENCE.md` | Fast developer reference |
| `DEPLOY.md` | Deployment |
| `docs/` | Detailed specifications and architecture |
| `migrations/` | Database schema evolution |
| `deploy/` | Homelab deployment resources |
| `scripts/` | Operational tooling |

For deep architectural decisions, read `CONTEXT.md` and the documents under `docs/` before changing core security or deployment behavior.

---

# 🤝 Development Workflow

Recommended workflow:

```text
1. Understand the existing architecture
             ↓
2. Create a feature branch
             ↓
3. Implement the smallest required change
             ↓
4. Test locally
             ↓
5. Inspect git diff
             ↓
6. Commit focused changes
             ↓
7. Push branch
             ↓
8. Open Pull Request
             ↓
9. CI validation
             ↓
10. Review + merge
```

Example:

```bash
git switch -c feat/academic-batches

git status
git diff

git add migrations backend portal admin
git commit -m "feat(admin): add academic batch management"

git push -u origin feat/academic-batches
```

Keep unrelated changes out of the same commit.

---

# 🧱 Design Principles

AttendX is built around a few core principles:

### 1. Verify, don't trust

The server independently verifies important attendance claims.

### 2. Short-lived credentials

Classroom tokens should not remain valid indefinitely.

### 3. Layered security

No single client-side check should be treated as sufficient proof.

### 4. Explicit academic relationships

College, department, branch, division and batch should be represented as data relationships.

### 5. Self-hosting

The system is designed to run within a constrained homelab environment.

### 6. Operational awareness

RAM usage, persistent storage, backups and power-cut recovery matter.

### 7. Keep infrastructure separate

Application development should not unnecessarily modify deployment infrastructure.

---

# 🚧 Project Status

AttendX is an actively developed college software project.

The repository began with the zero-trust attendance foundation and has expanded toward a complete ecosystem containing:

- Student mobile application
- Teacher portal
- Admin portal
- Attendance gateway
- Academic hierarchy
- PostgreSQL/Supabase database
- Docker/homelab deployment
- Gitea-based development workflow

Some areas may still be under active development.

The source repository should be treated as the final authority for what is currently implemented.

---

# 🗺️ High-Level Roadmap

```text
Foundation
    │
    ├── Backend gateway
    ├── Database
    └── Student client
          │
          ▼
Attendance Security
    │
    ├── Device binding
    ├── Biometric pre-check
    ├── Rotating QR
    └── Cryptographic verification
          │
          ▼
Web Portals
    │
    ├── Teacher Portal
    └── Admin Portal
          │
          ▼
Academic Management
    │
    ├── Colleges
    ├── Departments
    ├── Branches
    ├── Divisions
    └── Batches
          │
          ▼
Production Homelab
    │
    ├── Docker
    ├── Supabase/PostgreSQL
    ├── Backups
    └── Automated deployment
```

---

# 💡 Philosophy

AttendX is not trying to make attendance complicated for the sake of complexity.

The goal is simple:

> **Make a student's attendance claim something the server can actually verify.**

That means combining:

```text
IDENTITY
   +
DEVICE
   +
BIOMETRIC PRE-CHECK
   +
LIVE CLASSROOM SIGNAL
   +
CRYPTOGRAPHIC PROOF
   +
SERVER VERIFICATION
   +
AUDITABLE RECORD
```

into one attendance decision.

---

<div align="center">

## ⚡ AttendX

**Built for classrooms. Designed for verification. Self-hosted by choice.**

<br/>

Made with TypeScript · Flutter · PostgreSQL · Supabase · Docker

</div>
