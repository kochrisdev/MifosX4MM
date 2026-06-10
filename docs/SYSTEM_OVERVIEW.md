# MifosX4MM — System Overview

> **Project:** MifosX4MM (Mifos X for Myanmar)
> **Purpose:** Production-grade microfinance platform built for a mid-size Myanmar MFI
> **Last updated:** 2026-05-28

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Service-by-Service Breakdown](#5-service-by-service-breakdown)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Database Design](#7-database-design)
8. [Key Data Flows](#8-key-data-flows)
9. [KBZ Pay Integration](#9-kbz-pay-integration)
10. [KYC Abstraction Layer](#10-kyc-abstraction-layer)
11. [Reporting & Portfolio Analytics](#11-reporting--portfolio-analytics)
12. [Shared Types Package](#12-shared-types-package)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [User Roles & Access Control](#14-user-roles--access-control)
15. [Known Issues & Open Items](#15-known-issues--open-items)

---

## 1. What This Project Is

**MifosX4MM** is a full-stack microfinance management system built on top of [Apache Fineract](https://fineract.apache.org/) — an open-source core banking engine. The project wraps Fineract with a modern product layer specifically designed for Myanmar microfinance institutions (MFIs):

- A **staff web portal** for loan officers, branch managers, and admins
- A **mobile field app** for loan officers to manage clients and collect repayments on the go
- **KBZ Pay integration** — Myanmar's largest mobile wallet — so borrowers can repay loans digitally
- A **KYC abstraction service** to verify borrower identity via pluggable providers
- A **custom reporting service** for accurate portfolio-at-risk (PAR) metrics and collections dashboards

The core philosophy is: **Fineract handles the financial engine; everything custom lives in the gateway and service layer.** Fineract is never forked — it is accessed only through its REST API.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│   Next.js Staff Portal :3000    Expo Mobile App (iOS/Android)│
└──────────────┬───────────────────────────┬───────────────────┘
               │  JWT RS256                │  JWT RS256
               ▼                           ▼
┌──────────────────────────────────────────────────────────────┐
│               API GATEWAY — Fastify :3001                    │
│  /auth  /clients  /loans  /payments  /dashboard              │
│  • Verifies Keycloak JWTs (JWKS / RS256)                     │
│  • RBAC enforcement per route                                │
│  • Proxies to Fineract + internal services                   │
└──────┬──────────┬──────────┬──────────┬──────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  Keycloak   Apache      Mobile     KYC        Reporting
  :8180      Fineract    Money      Service    Service
  Auth/SSO   :8080       :3003      :3004      :3005
             Core        KBZ Pay    Identity   FastAPI
             Banking     Wallet     Verify     + SQL
               │                              │
               ▼                              ▼
           MySQL :3306                  PostgreSQL :5432
           fineract_tenants             keycloak
           fineract_default             fineract_default
```

Every client (web and mobile) communicates exclusively with the **API Gateway**. The gateway acts as a Backend-for-Frontend (BFF) — it authenticates requests, enforces role-based access control, proxies to Apache Fineract for core banking operations, and fans out to the internal microservices for payments, KYC, and reporting.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Core banking engine | **Apache Fineract** (Java/Spring Boot) | Docker image only — never forked |
| API gateway / BFF | **Fastify 4 + TypeScript** | Single entry point for all clients |
| Web staff portal | **Next.js 14** (App Router, React 18, Tailwind CSS) | Server + client components |
| Mobile field app | **React Native + Expo Router** | iOS and Android |
| Mobile money | **KBZ Pay** direct merchant API (HMAC-SHA256) | Myanmar's largest mobile wallet |
| KYC verification | Pluggable **KycProvider** interface | Stub (dev) → Smile Identity / Onfido |
| Reporting | **Python FastAPI** + SQLAlchemy async + asyncpg | Direct SQL on Fineract DB |
| Authentication | **Keycloak 24** | JWKS-backed JWT verification in gateway |
| Database (Fineract) | **MySQL 8.0** | `fineract_tenants` + `fineract_default` |
| Database (auth + reporting) | **PostgreSQL 15** | `keycloak` + `fineract_default` |
| Monorepo tooling | **Turborepo + pnpm workspaces** | Parallel builds, shared cache |
| Dev infrastructure | **Docker Compose** | All services containerised |
| Shared contracts | **TypeScript interfaces** (`@mifos-x/shared-types`) | Shared across all TS services |

---

## 4. Monorepo Structure

The repository is a **Turborepo + pnpm workspaces** monorepo. All packages build in dependency order and share a single `pnpm-lock.yaml`.

```
MifosX4MM/
├── apps/
│   ├── api/              ← Fastify API gateway (TypeScript)
│   ├── web/              ← Next.js 14 staff portal
│   └── mobile/           ← Expo React Native field app
│
├── services/
│   ├── mobile-money/     ← KBZ Pay integration service (Fastify/TS)
│   ├── kyc/              ← KYC provider abstraction service (Fastify/TS)
│   └── reporting/        ← Portfolio & collections reports (Python FastAPI)
│
├── packages/
│   └── shared-types/     ← Shared TypeScript interfaces (all services import this)
│
├── infra/
│   ├── docker/           ← Shared Dockerfiles (Node, Python, Web)
│   ├── keycloak/         ← realm-mifos.json — auto-imported on first boot
│   ├── postgres/         ← init.sql — creates keycloak database
│   └── mysql/            ← init.sql — creates fineract_default database
│
├── scripts/
│   └── seed-fineract.ts  ← Seeds Fineract with sample clients and loan products
│
├── docker-compose.yml    ← Full dev environment (all 9 services)
├── .env.example          ← All required environment variables
├── turbo.json            ← Turborepo task pipeline
└── pnpm-workspace.yaml   ← Workspace package paths
```

**Workspace packages**: `apps/*`, `services/*`, and `packages/*` are all pnpm workspace packages. They can import each other as local dependencies (e.g. `@mifos-x/shared-types`).

**Turborepo tasks**: `build` → `dev` → `lint` → `test`. Build outputs are cached in `.next/`, `dist/`. The `dev` task runs all services concurrently with hot reload.

---

## 5. Service-by-Service Breakdown

### 5.1 `apps/api` — API Gateway (Fastify)

**Port:** `3001`

The single entry point for all traffic. Its responsibilities are:

**Auth routes** (`/api/v1/auth/*`) — public, no JWT required:
- `POST /auth/login` — forwards credentials to Keycloak's ROPC token endpoint; returns access + refresh tokens and sets an `accessToken` cookie
- `POST /auth/refresh` — exchanges a refresh token for a new access token
- `POST /auth/logout` — revokes session in Keycloak
- `GET /auth/me` — returns the currently authenticated user's profile from the JWT

**Protected routes** — all require a valid Keycloak JWT:
- `GET/POST /clients` — list and create borrower profiles (proxied to Fineract)
- `GET /clients/:id` — fetch a single client with their accounts
- `GET /loans` — paginated loan list with optional `search` query
- `GET /clients/:id/loans` — all loan accounts for a client
- `GET /loans/:id` — single loan with repayment schedule and transaction history
- `POST /loans/:id/repayments` — post a manual repayment to Fineract
- `POST /loans/:id/actions` — approve, disburse, or reject a loan (`branch_manager` / `super_admin` only)
- `POST /payments/initiate` — start a KBZ Pay mobile money repayment
- `GET /payments/status/:orderId` — poll payment status; auto-posts to Fineract on success
- `GET /dashboard/stats` — aggregate portfolio and collections stats from the reporting service

**Keycloak plugin** (`plugins/keycloak.ts`): Decorates the Fastify instance with `app.authenticate` (verifies RS256 JWT against Keycloak's JWKS endpoint, cached 10 min) and `app.authorize(roles[])` (checks `realm_access.roles` in the JWT).

**Fineract client** (`fineract.ts`): Axios instance pre-configured with Basic auth (`mifos` / `password`) and the Fineract base URL. All Fineract calls go through this client.

---

### 5.2 `apps/web` — Staff Portal (Next.js 14)

**Port:** `3000`

A server-side rendered web application for internal staff — loan officers, branch managers, and admins.

- **App Router**: Pages use a mix of React Server Components (layout, navigation) and Client Components (data-fetching pages with React Query)
- **Authentication guard**: `src/middleware.ts` intercepts every request — if the `accessToken` cookie is absent, it redirects to `/login`
- **Data fetching**: React Query with 30-second stale time and 1-minute auto-refresh on the dashboard page
- **Silent token refresh**: An Axios interceptor catches `401` responses and automatically calls `/auth/refresh` before retrying the original request
- **Styling**: Tailwind CSS utility classes

**Key pages:**
- `/login` — login form
- `/dashboard` — portfolio overview with PAR, collections, active loans
- `/clients` — borrower list with search
- `/clients/:id` — client detail with loan history
- `/loans` — loan list
- `/loans/:id` — loan detail with repayment schedule

---

### 5.3 `apps/mobile` — Field App (Expo React Native)

**Platform:** iOS and Android

A mobile app for loan officers working in the field — visiting clients, onboarding borrowers, and collecting repayments via KBZ Pay.

- **Expo Router** (file-based navigation): Two route groups — `(auth)` for login and `(tabs)` for the main app tabs
- **AuthContext**: Manages login state; `NavigationGuard` component redirects unauthenticated users to the login screen
- **Token storage**: `AsyncStorage` stores the access and refresh tokens persistently; silent refresh on `401` mirrors web behaviour
- **KBZ Pay deep link**: Repayment is initiated by calling `Linking.openURL("kbzpay://pay?prepay_id=...")` — this opens the KBZ Pay app on the device. The field app polls the payment status endpoint every 5 seconds after returning from KBZ Pay

---

### 5.4 `services/mobile-money` — KBZ Pay Service (Fastify)

**Port:** `3003`

Handles all communication with KBZ Pay's merchant API. Isolated as its own service so that signing logic, credentials, and callback handling are not in the gateway.

- **`KbzPayClient`**: Encapsulates `createOrder`, `queryOrder`, and `parseCallback`. All outbound requests to KBZ Pay are signed with HMAC-SHA256
- **Signature utility** (`kbzpay/signature.ts`): Isolated signing logic, independently unit-tested
- **Routes**:
  - `POST /payments/kbzpay/initiate` — calls KBZ Pay `/precreate`, returns `prepayId` and `orderId`
  - `GET /payments/kbzpay/status/:orderId` — queries KBZ Pay for order status
  - `POST /webhooks/kbzpay` — receives KBZ Pay's signed payment callback; verifies HMAC-SHA256 signature before processing

---

### 5.5 `services/kyc` — KYC Service (Fastify)

**Port:** `3004`

Provides a **provider-agnostic interface** for Know Your Customer identity verification. The active provider is selected by the `KYC_PROVIDER` environment variable at startup.

**`KycProvider` interface** (four methods):
```
submit(request)       → submissionId + status
getStatus(id)         → KycSubmission
handleWebhook(payload)→ void
getStats()            → {pending, processing, approved, rejected, manual_review, total}
```

**Available providers:**

| `KYC_PROVIDER` | Provider | Behaviour |
|---|---|---|
| `stub` (default) | In-memory stub | Auto-approves after 2 seconds — safe for development |
| `smile_identity` | Smile Identity | Africa/Asia national ID + document verification |
| `onfido` | Onfido | Global biometric + document verification |

Adding a new provider: implement `KycProvider` in `services/kyc/src/providers/` and add one `case` to `resolveProvider()`.

---

### 5.6 `services/reporting` — Reporting API (Python FastAPI)

**Port:** `3005`

Provides accurate financial reporting metrics by querying the Fineract database directly via SQL — rather than calling Fineract's REST API, which can lag behind (PAR figures are only recalculated after Fineract's scheduled batch job runs).

**Routers:**
- `GET /reports/portfolio/summary` — active loan count, total outstanding, PAR0 / PAR30 / PAR90
- `GET /reports/collections/today` — sum of all repayment transactions on today's date
- `GET /reports/kyc/summary` — KYC submission counts by status (fetched from the KYC service via httpx)
- `GET /health` — service health check

**Tech stack**: FastAPI + SQLAlchemy async + asyncpg. Connects to PostgreSQL (`fineract_default`) on startup and verifies connectivity with a `SELECT 1`.

---

## 6. Authentication & Authorization

### Keycloak Setup

Keycloak 24 is the identity provider. It is pre-configured via `infra/keycloak/realm-mifos.json`, which is auto-imported on first boot.

**Two clients in the `mifos` realm:**

| Client | Type | Used by |
|---|---|---|
| `mifos-staff` | Public · Direct Grant | Web portal and mobile app login |
| `mifos-api` | Confidential · Service account | API gateway ↔ Keycloak service calls |

### Login Flow

1. Client sends `POST /api/v1/auth/login {username, password}` to the API gateway
2. Gateway forwards to Keycloak's ROPC endpoint (`grant_type=password`)
3. Keycloak returns an **RS256-signed JWT** (access token, 15 min TTL) and a refresh token
4. Gateway sets the `accessToken` cookie and returns both tokens to the client

### JWT Verification (every protected request)

1. Gateway's `authenticate` hook extracts the `Authorization: Bearer` header
2. Fetches Keycloak's JWKS endpoint (`/realms/mifos/protocol/openid-connect/certs`)
3. JWKS response is cached in memory (10-minute TTL, max 5 keys) via `jwks-rsa`
4. JWT is verified: RS256 signature + issuer + expiry
5. Decoded claims (`id`, `username`, `email`, `realm_access.roles`) are attached to `req.user`

### Role-Based Access Control

The `authorize(roles[])` decorator checks `req.user.roles` at the route level:

```typescript
// Example: only branch_manager or super_admin can approve/disburse
app.post('/loans/:id/actions', {
  onRequest: [app.authorize(['branch_manager', 'super_admin'])]
}, handler)
```

**Token lifetimes (configurable in Keycloak):**
- Access token: **15 minutes**
- SSO session: **10 hours**
- Silent refresh: both web and mobile handle `401` by automatically calling `/auth/refresh`

> **Known issue**: The login flow uses ROPC (`grant_type=password`), which is deprecated in OAuth 2.1. A future improvement would migrate to Authorization Code + PKCE.

---

## 7. Database Design

The system uses **two separate database engines**, each with a specific purpose:

### MySQL 8.0 — Core Banking Data

**Connection**: Apache Fineract via MariaDB JDBC driver
**Databases**: `fineract_tenants` (Fineract's multi-tenancy schema) + `fineract_default` (all client and loan data)

Fineract manages its own schema via Liquibase migrations on startup. The key tables used by the reporting service are:

| Table | Purpose |
|---|---|
| `m_client` | Borrower records (name, phone, NRC, status, branch) |
| `m_loan` | Loan accounts (product, status, principal, outstanding amounts) |
| `m_loan_repayment_schedule` | Installment-level schedule per loan (due dates, paid amounts) |
| `m_loan_transaction` | All financial movements (disbursements, repayments, reversals) |
| `m_office` | Branch / office hierarchy |
| `m_product_loan` | Loan product definitions (interest rates, terms) |

**Key `m_loan` status codes:**
- `300` = Active (performing and non-performing loans)
- `600` = Closed / fully repaid

### PostgreSQL 15 — Auth and Reporting

**Connection**: Keycloak (JDBC) + Reporting service (asyncpg)
**Databases**: `keycloak` (Keycloak's own schema) + `fineract_default` (intended for reporting SQL)

> ⚠️ **Known design issue — Dual Database Gap**: The reporting service is wired to query `PostgreSQL.fineract_default`, but Fineract only writes to `MySQL`. There is currently **no sync** between the two databases. As a result, the reporting service queries empty tables and the dashboard returns zeros. See [Section 15](#15-known-issues--open-items) for the three fix options identified.

### PAR Calculation Method

Portfolio at Risk (PAR) is calculated with a CTE that finds the oldest unpaid past-due installment per loan:

```sql
WITH overdue_schedule AS (
    SELECT
        loan_id,
        MIN(duedate)                AS oldest_overdue_date,
        CURRENT_DATE - MIN(duedate) AS days_in_arrears,
        SUM(principal_amount - principal_completed_derived
            + interest_amount - interest_completed_derived) AS overdue_amount
    FROM m_loan_repayment_schedule
    WHERE duedate < CURRENT_DATE
      AND completed_derived = false
      AND obligations_met_on_date IS NULL
    GROUP BY loan_id
)
-- PAR30 = SUM(total_outstanding) of loans where days_in_arrears >= 30
--         / SUM(total_outstanding) of ALL active loans * 100
```

This method is **more accurate** than Fineract's REST-derived `inArrears` flag, which only updates after a scheduled batch job runs.

---

## 8. Key Data Flows

### 8.1 Staff Login

```
Browser → POST /api/v1/auth/login {username, password}
         → Gateway → Keycloak ROPC endpoint
         ← Keycloak returns RS256 access_token (15 min) + refresh_token
         ← Gateway sets accessToken cookie + returns tokens
Browser → GET /api/v1/auth/me
         → Gateway verifies JWT against JWKS cache
         ← returns AuthUser {id, username, roles}
```

### 8.2 Loan Repayment via KBZ Pay

```
Mobile App
  → POST /api/v1/payments/initiate {loanId, amount, customerName, customerPhone}
    → Gateway generates orderId (nanoid)
      → Mobile Money Service → KBZ Pay /precreate (HMAC-SHA256 signed)
        ← KBZ Pay returns prepayId + orderId
  ← App receives prepayId

App calls: Linking.openURL("kbzpay://pay?prepay_id=...")
  [Customer completes payment inside KBZ Pay app]
  KBZ Pay → POST /webhooks/kbzpay (signed callback) → Mobile Money Service
            → HMAC-SHA256 verification
            → (future: auto-post to Fineract)

App (returned from KBZ Pay) polls every 5 seconds:
  → GET /api/v1/payments/status/:orderId?loanId=X
    → Gateway → Mobile Money Service → KBZ Pay /query
    ← status: "success"
  → Gateway auto-posts repayment to Fineract:
      POST /loans/:loanId/transactions?command=repayment
  ← App shows success screen
```

### 8.3 KYC Submission

```
Loan Officer (Mobile)
  → POST /api/v1/kyc/submit {clientRef, documentType, images}
    → Gateway → KYC Service → Provider.submit()
      [stub: auto-approves after 2s]
      [real: calls Smile Identity / Onfido API]
    ← KYC Service returns submissionId + status: "processing"
  ← Officer sees "verification in progress"

[Later, async]
Provider → POST /webhooks/kyc {submissionId, status: "approved"} → KYC Service
           (future: update Fineract client document status)
```

### 8.4 Dashboard Stats Load

```
Browser → GET /api/v1/dashboard/stats
         → Gateway fans out in parallel:
            → Reporting: GET /reports/portfolio/summary
              → PostgreSQL CTE on m_loan + m_loan_repayment_schedule
            → Reporting: GET /reports/collections/today
              → PostgreSQL: SUM(amount) on m_loan_transaction WHERE date = TODAY
         ← Gateway merges results
         ← Browser receives {activeClients, activeLoans, par0, par30, par90,
                              totalOutstanding, collectionsToday, collectionRate}
```

---

## 9. KBZ Pay Integration

KBZ Pay is Myanmar's largest mobile wallet, operated by KBZ Bank. The integration uses KBZ Bank's **direct merchant API** (not via 2C2P or Dinger aggregators).

### Credentials

Obtained from KBZ Bank's Transaction Banking Department:
- `KBZPAY_APP_ID` — merchant app identifier
- `KBZPAY_MERCHANT_CODE` — merchant code
- `KBZPAY_SIGN_KEY` — HMAC-SHA256 signing key

### Request Signing

Every outbound request to KBZ Pay is signed with **HMAC-SHA256**. The signature is computed over a canonically sorted, concatenated string of all request parameters. This logic lives in `services/mobile-money/src/kbzpay/signature.ts` and is unit-tested independently.

### Payment Flow Summary

1. Gateway generates a unique `orderId` (`loan-{loanId}-{nanoid}`)
2. Mobile Money Service sends a `/precreate` request to KBZ Pay → gets `prepayId`
3. Mobile app opens `kbzpay://pay?prepay_id=...` deep link → KBZ Pay app opens
4. Customer authenticates and confirms payment inside KBZ Pay
5. KBZ Pay sends a signed webhook callback to `POST /webhooks/kbzpay`
6. Mobile app polls `/payments/status/:orderId` every 5 seconds
7. On confirmed `success`, Gateway posts the repayment transaction to Fineract

### Currency

All amounts are in **MMK (Myanmar Kyat)** in the smallest unit (pyas). The payment route converts from pyas to MMK when posting to Fineract (`amount / 100`).

> ⚠️ **Known issue**: There is a **payment idempotency gap** — if the webhook fires multiple times, the repayment could be posted to Fineract more than once. An idempotency key check should be added before posting to Fineract.

---

## 10. KYC Abstraction Layer

The KYC service is designed to be **vendor-neutral**. All call sites depend on the `KycProvider` interface — not on any specific vendor SDK.

### Interface

```typescript
interface KycProvider {
  submit(request: KycVerificationRequest): Promise<KycSubmission>
  getStatus(submissionId: string): Promise<KycSubmission>
  handleWebhook(payload: KycWebhookPayload): Promise<void>
  getStats(): Promise<KycStats>
}
```

### Document Types Supported

```typescript
type KycDocumentType =
  | 'national_id'       // Generic national ID
  | 'passport'          // International passport
  | 'driving_license'   // Driving licence
  | 'nrc'               // Myanmar NRC (National Registration Card)
```

### Stub Provider (Development)

The `StubKycProvider` maintains an in-memory map of submissions and auto-approves them after a 2-second delay. This allows the full loan origination flow to be tested locally without real KYC credentials.

### Adding a New Provider

1. Create a file in `services/kyc/src/providers/` (e.g. `myProvider.ts`)
2. Implement all four methods of the `KycProvider` interface
3. Add a `case 'my_provider':` to `resolveProvider()` in `services/kyc/src/index.ts`
4. Set `KYC_PROVIDER=my_provider` in `.env`

---

## 11. Reporting & Portfolio Analytics

The reporting service (`services/reporting/`) is a **Python FastAPI application** that queries the Fineract database directly via SQLAlchemy async + asyncpg — bypassing Fineract's REST API entirely.

### Why Direct SQL?

Fineract's REST API reports loan performance figures (e.g. `inArrears`) that are only recalculated when a scheduled batch job (`RunLoanCOBJob`) runs. Between batch runs, figures can be stale. The reporting service computes PAR on demand from the raw `m_loan_repayment_schedule` table, giving **real-time accuracy**.

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /reports/portfolio/summary` | Active loan count, outstanding balances, PAR0/30/90 |
| `GET /reports/collections/today` | Total repayments received today |
| `GET /reports/kyc/summary` | KYC submission counts by status |
| `GET /health` | Service liveness check |

### PAR Metrics Explained

| Metric | Definition |
|---|---|
| **PAR0** | % of portfolio outstanding where ANY installment is overdue (≥ 1 day) |
| **PAR30** | % of portfolio outstanding where the oldest overdue installment is ≥ 30 days |
| **PAR90** | % of portfolio outstanding where the oldest overdue installment is ≥ 90 days |
| **Collection Rate** | Collections today / total amount due today × 100 |

---

## 12. Shared Types Package

`packages/shared-types` exports TypeScript interfaces used by all TypeScript services (API gateway, web, mobile, mobile-money, KYC). This ensures request/response shapes are consistent across the entire stack.

**Exported interfaces:**

| Category | Key Types |
|---|---|
| Fineract | `FineractClient`, `FineractLoanAccount`, `FineractSavingsAccount`, `FineractLoanRepayment` |
| KBZ Pay | `KbzPayOrderParams`, `KbzPayPrepayResponse`, `KbzPayCallbackPayload`, `KbzPayStatusResponse`, `KbzPayStatus` |
| KYC | `KycSubmission`, `KycVerificationRequest`, `KycWebhookPayload`, `KycStatus`, `KycDocumentType` |
| Dashboard | `DashboardStats` |
| Auth | `AuthUser`, `TokenPair`, `UserRole` |
| API | `ApiResponse<T>`, `PaginatedResponse<T>` |

---

## 13. Infrastructure & Deployment

### Docker Compose (Development)

All 9 services run on a shared `mifos_net` bridge network. Service startup order is managed via `depends_on` with health checks:

```
PostgreSQL (healthy)
    └─ Keycloak (starts after postgres is healthy)

MySQL (healthy)
    └─ Apache Fineract (starts after mysql is healthy)

Fineract + Keycloak
    └─ API Gateway
         └─ Web Frontend

(all independently)
    ├─ Mobile Money Service
    ├─ KYC Service
    └─ Reporting Service
```

### Service Ports

| Service | Port | Notes |
|---|---|---|
| Web portal | 3000 | Next.js |
| API gateway | 3001 | Fastify |
| Mobile money | 3003 | Fastify |
| KYC service | 3004 | Fastify |
| Reporting | 3005 | FastAPI |
| Apache Fineract | 8080 | Spring Boot (slow start ~2–3 min) |
| Keycloak | 8180 | Quay image (slow start ~60 s) |
| MySQL | 3306 | Fineract data |
| PostgreSQL | 5432 | Keycloak + reporting |

### Dockerfiles

Three shared Dockerfiles in `infra/docker/`:
- `Dockerfile.node` — generic Node service (API gateway, mobile-money, KYC); uses `SERVICE_PATH` build arg
- `Dockerfile.web` — Next.js web portal; accepts `NEXT_PUBLIC_*` build args
- `Dockerfile.python` — Python FastAPI reporting service

### Key Environment Variables

All variables are documented in `.env.example`. The critical ones:

| Variable | Purpose |
|---|---|
| `FINERACT_URL` | Fineract API base URL |
| `KEYCLOAK_URL` / `KEYCLOAK_REALM` | Keycloak base URL and realm name |
| `KEYCLOAK_CLIENT_SECRET` | Secret for the `mifos-api` confidential client |
| `KBZPAY_APP_ID` / `KBZPAY_MERCHANT_CODE` / `KBZPAY_SIGN_KEY` | KBZ Pay merchant credentials |
| `KYC_PROVIDER` | Active KYC provider (`stub`, `smile_identity`, `onfido`) |
| `REPORTING_DB_URL` | PostgreSQL connection string for reporting service |
| `JWT_SECRET` | JWT signing secret (gateway fallback) |

---

## 14. User Roles & Access Control

Five roles are defined in Keycloak and enforced in the API gateway:

| Role | Capabilities |
|---|---|
| `super_admin` | Full access to all operations across all branches |
| `branch_manager` | Loan approval, disbursal, and rejection; all loan officer capabilities |
| `loan_officer` | Client onboarding, loan origination, repayment collection |
| `teller` | Repayment collection only (no loan or client management) |
| `customer` | Reserved for future mobile self-service (not yet implemented) |

**Default seeded users** (password change forced on first login):

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@1234` | `super_admin` |
| `loan.officer` | `Officer@1234` | `loan_officer` |

---

## 15. Known Issues & Open Items

### Critical — Dual Database Gap (Reporting Returns Zeros)

The reporting service is configured to read from **PostgreSQL** (`fineract_default`), but Apache Fineract writes all data to **MySQL**. There is no replication or sync between the two databases. The `infra/postgres/init.sql` only creates the `keycloak` database — the `fineract_default` database exists but is empty.

**Impact**: Dashboard stats (PAR, collections, active loans) all return zeros or errors.

**Three identified fix options:**

| Option | Approach | Effort |
|---|---|---|
| **A** | Point reporting directly at MySQL — change `REPORTING_DB_URL` to MySQL, swap `asyncpg` → `aiomysql`, fix ~5 SQL syntax differences | Low (~1 day) |
| **B** | Migrate Fineract to PostgreSQL — remove MySQL container, configure Fineract to use PostgreSQL natively | Medium (~2–3 days) |
| **C** | Real-time replication — MySQL → PostgreSQL via Debezium CDC + Kafka | High (weeks) |

**Decision pending** as of 2026-05-27.

---

### Medium — Payment Idempotency Gap

The KBZ Pay webhook callback (`POST /webhooks/kbzpay`) does not currently check whether a repayment has already been posted for a given `orderId`. If KBZ Pay retries the webhook, the repayment could be recorded multiple times in Fineract.

**Fix**: Store processed `orderId` values in a database table and reject duplicate webhook calls before posting to Fineract.

---

### Medium — Deprecated Auth Flow (ROPC)

The login flow uses `grant_type=password` (Resource Owner Password Credentials), which is deprecated in OAuth 2.1. This was chosen for simplicity but is not recommended for new systems.

**Fix**: Migrate to Authorization Code + PKCE for the web portal and mobile app.

---

### Low — KYC Stub in Production Risk

The `KYC_PROVIDER=stub` setting auto-approves all KYC submissions after 2 seconds. If accidentally deployed to production, all borrowers would pass KYC without verification.

**Fix**: Add a startup guard that prevents the stub provider from running when `NODE_ENV=production`.

---

### Low — KYC → Fineract Status Sync Not Implemented

When a KYC submission is approved or rejected (via webhook), the client's document status in Fineract is **not updated**. The KYC service stores the result internally, but there is no callback to Fineract's `/clients/:id/documents` endpoint.

---

*For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md). For the full API reference, see [API.md](./API.md). For local development setup, see [DEVELOPMENT.md](./DEVELOPMENT.md).*
