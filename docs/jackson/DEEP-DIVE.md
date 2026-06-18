# MifosX4MM — Complete Deep-Dive Guide

> **Who this is for:** Jackson — understanding the project deeply before building the future strategy.
>
> **Goal:** After reading this, you will understand what every part of the system does, how a loan moves from creation to repayment at the code level, which API calls happen at each step, which services are involved, and how to test it all practically. This is written as if you are a beginner developer seeing the project for the first time.
>
> **Last updated:** 2026-06-17

---

## Table of Contents

1. [Why This Project Exists — The Business Problem](#1-why-this-project-exists--the-business-problem)
2. [The Big Picture — How the System is Built](#2-the-big-picture--how-the-system-is-built)
3. [Technology Choices Explained Simply](#3-technology-choices-explained-simply)
4. [Every Service Explained](#4-every-service-explained)
5. [How Authentication Works — Step by Step](#5-how-authentication-works--step-by-step)
6. [The Loan Lifecycle — Complete End-to-End Trace](#6-the-loan-lifecycle--complete-end-to-end-trace)
7. [Every API Endpoint Reference](#7-every-api-endpoint-reference)
8. [The Database Schema](#8-the-database-schema)
9. [KBZ Pay Payment Flow — Deep Dive](#9-kbz-pay-payment-flow--deep-dive)
10. [KYC Identity Verification — Deep Dive](#10-kyc-identity-verification--deep-dive)
11. [Reporting Service — How PAR is Calculated](#11-reporting-service--how-par-is-calculated)
12. [What's Broken and Why](#12-whats-broken-and-why)
13. [Hands-On Labs — Learn by Doing](#13-hands-on-labs--learn-by-doing)
14. [Key Concepts Glossary](#14-key-concepts-glossary)

---

## 1. Why This Project Exists — The Business Problem

### What is a Microfinance Institution (MFI)?

A Microfinance Institution lends small amounts of money — typically 100,000 to 5,000,000 Myanmar Kyat (MMK) — to individuals and small businesses who cannot get loans from regular banks. Think of village vendors, small farmers, or market stall owners.

In Myanmar, an MFI typically has:
- **Loan Officers** who travel to villages, register borrowers, and collect repayments in cash or via KBZ Pay
- **Branch Managers** who sit in a branch office, review loan applications, and approve or reject credit decisions
- **Tellers** who accept cash repayments at a branch counter

Without software, tracking hundreds of loans, repayment schedules, and daily collections requires massive paper-based manual effort — which is slow, error-prone, and makes it impossible to know the real financial health of the portfolio in real time.

**MifosX4MM solves this** by giving every role a digital tool:
- Loan officers get a **mobile app** (React Native) for the field
- Branch managers and tellers get a **web portal** (Next.js) for the office
- Management gets a **dashboard** showing live portfolio health metrics (PAR, collection rates)
- Borrowers can **pay via KBZ Pay** mobile wallet instead of only cash

### Why "X4MM"?

"MifosX4MM" = Apache **Mifos X** customised **For Myanmar**. The core banking engine underneath is Apache Fineract (the open-source engine that powers Mifos X). The custom code built on top of it is everything in this repository.

---

## 2. The Big Picture — How the System is Built

### The "Black Box" Principle

The most important concept to understand: **Apache Fineract is a black box.** It is never modified. The team never touches its source code. Fineract runs as a Docker container and exposes a REST API. All interactions with Fineract go through that REST API only.

Think of Fineract as a very smart, pre-built engine inside a car. You don't modify the engine — you control it through the dashboard (the API Gateway).

### The Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│  WHO TALKS TO THE SYSTEM                        │
│                                                 │
│  📱 Mobile App (loan officers in the field)     │
│  🖥️  Web Portal (branch staff at a desk)        │
└────────────────────┬────────────────────────────┘
                     │  Both send HTTP requests with JWT tokens
                     ▼
┌─────────────────────────────────────────────────┐
│  API GATEWAY  (apps/api — Fastify on port 3001) │
│                                                 │
│  The ONLY door into the system.                 │
│  1. Checks every JWT token (is this person      │
│     really who they say they are?)              │
│  2. Checks every role (are they allowed to      │
│     do what they're asking?)                    │
│  3. Routes the request to the right place       │
└──┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Keycloak  Apache      Mobile     KYC        Reporting
(auth)    Fineract    Money      Service    Service
:8180     (banking)   (KBZ Pay)  (identity) (analytics)
          :8080       :3003      :3004      :3005
             │                              │
             ▼                              ▼
          MySQL                       PostgreSQL
         (loan data)                 (auth + reporting)
```

**Everything the user does flows through the API Gateway.** The gateway decides: Is this request valid? Is this person allowed? Then it calls the right service to actually do the work.

### Why Not Let the App Talk to Fineract Directly?

Because Fineract uses Basic auth (username/password) and has no concept of your custom roles (loan_officer, branch_manager, etc.). If the app talked to Fineract directly, any user could call any Fineract endpoint with no restrictions. The API Gateway is the security and business-logic layer that sits in front of Fineract.

---

## 3. Technology Choices Explained Simply

### Apache Fineract (Core Banking Engine)

**What it is:** An open-source banking system used by MFIs in 40+ countries, built by the Apache Software Foundation.

**Why not just use a regular database?** Banking has rules that took years of industry effort to get right:
- How do you calculate daily vs. monthly interest correctly?
- What happens when someone misses a payment?
- How do you track a loan through its lifecycle (pending → approved → active → closed)?
- How do you handle partial payments?
- How do you reconcile which payments go to principal vs. interest?

Fineract already implements all of these rules correctly. Building them from scratch would take months and would likely contain errors.

**In practice:** When a loan is disbursed, Fineract automatically generates the entire repayment schedule (all monthly installments with exact amounts). When a repayment is posted, Fineract automatically reduces the outstanding balance and updates the schedule. You get all of this for free.

**The tradeoff:** Fineract takes 2–3 minutes to start (it's a large Java Spring Boot app) and it's a black box — you use it through its API only.

### Keycloak (Authentication & Authorization)

**What it is:** An open-source identity system that handles logins, user management, and JWT tokens.

**Why not build login yourself?** Secure login is notoriously hard:
- How do you store passwords safely? (bcrypt, salting, etc.)
- How do you prevent brute force attacks?
- How do you issue, sign, and verify tokens?
- How do you handle token expiry and refresh?

Keycloak handles all of this correctly and is security-audited. Our code just tells Keycloak "here's a username and password — is it valid?" and Keycloak returns a JWT token.

**What is a JWT token?** A JWT (JSON Web Token) is a small string of text that proves who you are. It looks like `eyJhbGciOiJSUzI1NiJ9.eyJ...`. The API Gateway checks this token on every protected request — without calling a database — by verifying a cryptographic signature. This is fast and stateless.

### Fastify (API Gateway)

A high-performance Node.js web framework. The API Gateway is built with Fastify. It's similar to Express but faster. All the gateway does is: receive an HTTP request, check the JWT, check the role, call the appropriate service, return the result.

### Next.js (Web Portal)

A React framework that handles both server-side rendering (the HTML is generated on the server before being sent to the browser) and client-side React components. The staff portal uses the App Router — routes are defined by folder structure under `apps/web/src/app/`.

### Expo / React Native (Mobile App)

React Native lets you write JavaScript/TypeScript and produce native iOS and Android apps from one codebase. Expo is a toolchain that makes React Native easier to set up and run. The mobile app is under `apps/mobile/`.

### Python FastAPI (Reporting)

Python was chosen for the reporting service because it is better at direct SQL analytics than TypeScript. The service connects directly to the database and runs complex SQL queries to calculate PAR (Portfolio at Risk) figures in real time.

### Turborepo + pnpm

The project is a **monorepo** — one Git repository that contains multiple apps and services. Turborepo manages the build order and caches build outputs. pnpm is the package manager (like npm but faster). Running `pnpm dev` from the root starts all services at once.

---

## 4. Every Service Explained

### 4.1 `apps/api` — The API Gateway

**Port:** 3001  
**Language:** TypeScript (Node.js, Fastify)  
**File:** `apps/api/src/index.ts`

This is the most important service in the whole project. Everything else is useless without it.

**What it does:**
1. Registers the Keycloak JWT plugin (`plugins/keycloak.ts`) so it can verify tokens
2. Creates the Fineract HTTP client (`fineract.ts`) with Basic auth credentials
3. Registers route handlers for each domain: auth, clients, loans, payments, dashboard

**How the code starts up** (reading `apps/api/src/index.ts`):

```typescript
const app = Fastify({ logger: true });

// 1. Register CORS (allows requests from the web portal / mobile app)
await app.register(cors, ...);

// 2. Register the Keycloak JWT plugin
//    This adds app.authenticate (verifies JWT) and app.authorize (checks roles)
await app.register(keycloakPlugin);

// 3. Create the Fineract Axios client (pre-configured with Basic auth)
const fineract = createFineractClient();

// 4. Register public routes (no JWT needed)
await app.register(async (pub) => {
  await authRoutes(pub);  // login, refresh, logout
}, { prefix: '/api/v1' });

// 5. Register protected routes (JWT required — addHook enforces this on ALL routes inside)
await app.register(async (protected_) => {
  protected_.addHook('onRequest', app.authenticate);  // ← JWT check on every request
  await dashboardRoutes(protected_, fineract, REPORTING_URL);
  await clientRoutes(protected_, fineract);
  await loanRoutes(protected_, fineract);
  await paymentRoutes(protected_, fineract, MOBILE_MONEY_URL);
}, { prefix: '/api/v1' });
```

**The Fineract client** (`apps/api/src/fineract.ts`):

```typescript
export function createFineractClient(): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.FINERACT_URL,           // e.g. http://fineract:8080/fineract-provider/api/v1
    timeout: 30_000,
    headers: {
      'Fineract-Platform-TenantId': 'default',   // Fineract multi-tenancy header
      'Content-Type': 'application/json',
    },
    auth: {
      username: process.env.FINERACT_USERNAME,   // 'mifos'
      password: process.env.FINERACT_PASSWORD,   // 'password'
    },
  });
  // Error interceptor: translates Fineract error messages into readable errors
  ...
}
```

Every call to Fineract automatically includes the Basic auth header and the tenant ID.

---

### 4.2 `apps/web` — Staff Portal

**Port:** 3000  
**Language:** TypeScript (React, Next.js 14)

The web app that branch staff use at their desks.

**Authentication guard** (`apps/web/src/middleware.ts`): This file intercepts every page request. If there is no `accessToken` cookie, the user is redirected to `/login`. This means you cannot visit any page in the portal without being logged in.

**How data is fetched:** The portal uses React Query (now called TanStack Query). React Query calls the API Gateway with the user's JWT token in the Authorization header and caches the results for 30 seconds. It also auto-refreshes data on the dashboard every minute.

**Silent token refresh:** When the API Gateway returns a `401` (token expired), an Axios interceptor in the web app automatically calls `POST /auth/refresh` to get a new token, then retries the original request — completely transparent to the user.

**Key pages:**
- `/login` — login form that calls `POST /api/v1/auth/login`
- `/dashboard` — portfolio overview (PAR, collections, active loans)
- `/clients` — list of all registered borrowers with search
- `/clients/:id` — individual borrower details and their loan history
- `/loans` — list of all loans
- `/loans/:id` — individual loan with repayment schedule and transactions

---

### 4.3 `apps/mobile` — Field App

**Platform:** iOS and Android (built with Expo)

The app loan officers carry into the field.

**Navigation:** Uses Expo Router (file-based routing, like Next.js for mobile). There are two route groups:
- `(auth)` — login screen
- `(tabs)` — the main app with tab navigation (dashboard, clients, collections)

**Token storage:** Unlike the web app which uses a cookie, the mobile app stores the JWT token in `AsyncStorage` (a simple key-value store that persists between app launches). When the app opens, it checks AsyncStorage for a saved token. If found and valid, the user goes straight to the main screen without logging in again.

**KBZ Pay integration:** When a repayment is initiated via KBZ Pay:
1. App calls the API to get a `prepayId`
2. App opens the KBZ Pay app using a deep link: `kbzpay://pay?prepay_id=...`
3. The user pays inside the KBZ Pay app
4. When the user returns to the MifosX4MM app, it starts polling the payment status every 5 seconds

---

### 4.4 `services/mobile-money` — KBZ Pay Service

**Port:** 3003  
**Language:** TypeScript (Fastify)

All KBZ Pay communication is isolated here. The API Gateway never calls KBZ Pay directly — it always goes through this service.

**Why isolated?** KBZ Pay credentials (signing key, app ID, merchant code) are sensitive. Isolating them in one service means only this service needs those secrets. Also, the HMAC-SHA256 signing logic is complex and needs to be tested independently.

**Three routes:**
- `POST /payments/kbzpay/initiate` — calls KBZ Pay's `/precreate` endpoint to create a payment order
- `GET /payments/kbzpay/status/:orderId` — queries KBZ Pay for the current status of an order
- `POST /webhooks/kbzpay` — receives the signed callback from KBZ Pay when payment is completed

---

### 4.5 `services/kyc` — KYC Identity Verification Service

**Port:** 3004  
**Language:** TypeScript (Fastify)

Before a borrower can get a loan, their identity must be verified (Know Your Customer regulations). This service handles that verification.

**Key design — the provider interface:** The service has a `KycProvider` TypeScript interface with 4 methods. The actual verification logic (calling Smile Identity, Onfido, etc.) is in separate "provider" files. The environment variable `KYC_PROVIDER` determines which one runs. In development, `KYC_PROVIDER=stub` auto-approves everyone after 2 seconds without calling any real API.

**Adding a new KYC provider** takes three steps:
1. Create a file in `services/kyc/src/providers/` implementing the `KycProvider` interface
2. Add one `case` to `resolveProvider()` in `services/kyc/src/index.ts`
3. Set `KYC_PROVIDER=your_provider` in `.env`

---

### 4.6 `services/reporting` — Reporting Service

**Port:** 3005  
**Language:** Python (FastAPI)

Provides PAR (Portfolio at Risk) metrics and collection statistics by querying the database directly with SQL — rather than calling Fineract's REST API, which can have stale data.

**Why direct SQL instead of calling Fineract's REST API?** Fineract's `inArrears` flag on a loan only updates when a scheduled batch job (`RunLoanCOBJob`) runs. Between batch runs, a loan that became overdue today would still show as not overdue in the Fineract API. The reporting service bypasses this by querying the raw `m_loan_repayment_schedule` table directly — comparing `duedate` to today's date in real time.

**Four endpoints:**
- `GET /reports/portfolio/summary` — active loan count, total outstanding, PAR0/30/90
- `GET /reports/collections/today` — total repayments received today
- `GET /reports/kyc/summary` — KYC counts by status (fetched from the KYC service)
- `GET /health` — service liveness check

---

### 4.7 External: Apache Fineract

**Port:** 8080  
**Language:** Java (Spring Boot)

This is the core banking engine. You never write code inside it. It has its own REST API documented at the Swagger UI: `http://localhost:8080/fineract-provider/swagger-ui/index.html`

On startup, Fineract runs Liquibase database migrations — this creates all the `m_client`, `m_loan`, `m_loan_repayment_schedule`, etc. tables in MySQL. This process takes 2–3 minutes on first boot.

**All calls to Fineract use HTTP Basic auth.** The credentials (`mifos` / `password` by default) are set in the `.env` file and used by the API Gateway's Fineract client.

---

### 4.8 External: Keycloak

**Port:** 8180  
**Language:** Java

The identity and access management system. It auto-imports the `mifos` realm configuration from `infra/keycloak/realm-mifos.json` on first boot.

**Admin UI:** `http://localhost:8180/admin` (login: `admin` / `admin`)

In the Admin UI you can see: all users (loan.officer, admin), their assigned roles (loan_officer, super_admin), and the two clients (`mifos-staff` for web/mobile login, `mifos-api` for gateway ↔ Keycloak service calls).

---

## 5. How Authentication Works — Step by Step

### The Login Flow

Here is exactly what happens when a user types their username and password and clicks "Login":

**Step 1 — Browser sends credentials to the API Gateway**
```
POST http://localhost:3001/api/v1/auth/login
Content-Type: application/json

{ "username": "loan.officer", "password": "Officer@1234" }
```

**Step 2 — The Gateway's `authRoutes` handler runs** (`apps/api/src/routes/auth.ts`):
```typescript
app.post('/auth/login', async (req, reply) => {
  const { username, password } = req.body;

  // Build the Keycloak ROPC (Resource Owner Password Credentials) request
  const params = new URLSearchParams({
    grant_type: 'password',           // ← ROPC flow
    client_id: 'mifos-staff',         // ← the Keycloak client for web/mobile
    username,
    password,
    scope: 'openid profile email',
  });

  // Send to Keycloak's token endpoint
  const { data } = await axios.post(
    'http://keycloak:8180/realms/mifos/protocol/openid-connect/token',
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  // data.access_token  ← the JWT (valid 15 minutes)
  // data.refresh_token ← used to get a new access token when it expires
  ...
```

**Step 3 — Keycloak checks the credentials.** If valid, it returns an RS256-signed JWT. The JWT payload contains:
```json
{
  "sub": "keycloak-user-uuid",
  "preferred_username": "loan.officer",
  "email": "loan.officer@mifos.local",
  "realm_access": {
    "roles": ["loan_officer", "offline_access", "default-roles-mifos"]
  },
  "exp": 1747141200,
  "iss": "http://keycloak:8180/realms/mifos"
}
```

**Step 4 — The Gateway returns the tokens to the browser/app:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 900
  }
}
```

### Every Protected Request

For every subsequent API call, the client sends the token in the `Authorization` header:
```
GET http://localhost:3001/api/v1/clients
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

**The `authenticate` hook** (`apps/api/src/plugins/keycloak.ts`) runs before every protected route handler:

```typescript
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();  // ← This does all the work
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
});
```

`req.jwtVerify()` does three things:
1. Extracts the `kid` (key ID) from the JWT header
2. Fetches Keycloak's public key from `http://keycloak:8180/realms/mifos/protocol/openid-connect/certs` (cached for 10 minutes)
3. Verifies the JWT signature using that public key

If the signature is valid and the token is not expired, `req.user` is populated:
```typescript
req.user = {
  id: "keycloak-user-uuid",
  username: "loan.officer",
  email: "loan.officer@mifos.local",
  roles: ["loan_officer"]
}
```

### Role Enforcement

Some routes require specific roles. For example, only a `branch_manager` or `super_admin` can approve a loan:

```typescript
app.post('/loans/:loanId/actions', {
  onRequest: [app.authorize(['branch_manager', 'super_admin'])],
}, handler);
```

The `authorize` decorator runs `jwtVerify` AND checks that the user's roles contain at least one of the required roles. If not, it returns `403 Forbidden`.

### Token Expiry and Refresh

Access tokens expire after 15 minutes. When an API call returns `401`, the web app's Axios interceptor automatically:
1. Calls `POST /auth/refresh` with the refresh token
2. Stores the new access token
3. Retries the original request

The user never sees an error or gets logged out unexpectedly.

---

## 6. The Loan Lifecycle — Complete End-to-End Trace

This section traces the complete journey of a loan from the moment a client is registered to the moment the loan is fully repaid. For each step, the exact file, function, HTTP call, and what happens in Fineract's database is shown.

### The Loan Lifecycle Overview

```
1. Register Client  →  2. Submit KYC  →  3. Create Loan Application
        →  4. Approve Loan  →  5. Disburse Loan
                →  6. Monthly Repayments  →  7. Loan Closed
```

Fineract's internal loan status codes:
- `100` = Submitted (pending approval)
- `200` = Approved
- `300` = Active (disbursed, repayments ongoing)
- `400` = Withdrawn by client
- `500` = Rejected
- `600` = Closed (fully repaid)

---

### Step 1 — Register a Client

**Who does this:** Loan officer (mobile app) or branch staff (web portal)

**API Call:**
```
POST http://localhost:3001/api/v1/clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstname": "Aye",
  "lastname": "Myat",
  "displayName": "Ma Aye Myat",
  "mobileNo": "+959123456789",
  "dateOfBirth": "1990-05-12",
  "officeId": 1,
  "legalFormId": 1,
  "active": true,
  "locale": "en",
  "dateFormat": "yyyy-MM-dd"
}
```

**What the gateway does** (`apps/api/src/routes/clients.ts`):

The gateway forwards this directly to Fineract's client creation endpoint:
```
POST http://fineract:8080/fineract-provider/api/v1/clients
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=  (Base64 of "mifos:password")
Fineract-Platform-TenantId: default
```

**What Fineract does:** Inserts a row into the `m_client` table in MySQL:
```sql
INSERT INTO m_client (account_no, office_id, firstname, lastname, display_name,
                       mobile_no, date_of_birth, status_enum, ...)
VALUES ('000000042', 1, 'Aye', 'Myat', 'Ma Aye Myat',
        '+959123456789', '1990-05-12', 300, ...);
```
Status 300 = Active client.

**What the gateway returns:**
```json
{ "success": true, "data": { "clientId": 42, "resourceId": 42 } }
```

---

### Step 2 — Submit KYC (Identity Verification)

**Who does this:** Loan officer (mobile app)

**API Call:**
```
POST http://localhost:3001/api/v1/kyc/submit
Authorization: Bearer <token>

{
  "clientRef": "42",
  "documentType": "nrc",
  "images": ["<base64-front-scan>", "<base64-selfie>"]
}
```

**What the gateway does:** Forwards to the KYC service at `http://kyc:3004`:
```
POST http://kyc:3004/kyc/submit
```

**What the KYC service does** (in development with `KYC_PROVIDER=stub`):
1. Generates a `submissionId` (UUID)
2. Stores it in memory: `{ status: "processing", clientRef: "42" }`
3. Schedules an auto-approval after 2 seconds
4. Returns immediately:

```json
{ "submissionId": "abc-123-uuid", "status": "processing" }
```

After 2 seconds, the stub internally flips the status to `"approved"`.

**In production** (Smile Identity / Onfido), the KYC service would call the external API with the document images and return `"processing"`. The final result comes back later via a webhook.

---

### Step 3 — Create a Loan Application

> **Note:** There is currently no dedicated gateway route for loan creation. This is done directly via the Fineract Swagger UI or a direct Fineract API call during development. This is an open item in the project.

**Direct Fineract API Call** (for development/testing):
```
POST http://localhost:8080/fineract-provider/api/v1/loans
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=
Fineract-Platform-TenantId: default

{
  "clientId": 42,
  "productId": 1,
  "principal": 500000,
  "loanTermFrequency": 12,
  "loanTermFrequencyType": 2,
  "numberOfRepayments": 12,
  "repaymentEvery": 1,
  "repaymentFrequencyType": 2,
  "interestRatePerPeriod": 2.0,
  "interestType": 0,
  "interestCalculationPeriodType": 1,
  "transactionProcessingStrategyCode": "mifos-standard-strategy",
  "locale": "en",
  "dateFormat": "dd MMMM yyyy",
  "submittedOnDate": "17 June 2026",
  "expectedDisbursementDate": "17 June 2026"
}
```

**What Fineract does:**
1. Inserts a row into `m_loan` with `loan_status_id = 100` (Submitted/Pending)
2. Calculates the loan's parameters but does NOT yet generate the repayment schedule (that happens on disbursement)

**Database result:**
```
m_loan: { id: 10, client_id: 42, loan_status_id: 100, principal_amount: 500000, ... }
```

---

### Step 4 — Approve the Loan

**Who does this:** Branch manager (web portal) — only `branch_manager` or `super_admin` role can do this

**API Call:**
```
POST http://localhost:3001/api/v1/loans/10/actions
Authorization: Bearer <branch_manager_token>

{ "command": "approve", "note": "Credit committee approved" }
```

**What the gateway does** (`apps/api/src/routes/loans.ts`):
1. The `onRequest: [app.authorize(['branch_manager', 'super_admin'])]` hook fires first — checks the JWT has the right role
2. Calls Fineract:
```
POST http://fineract:8080/fineract-provider/api/v1/loans/10?command=approve
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=

{ "note": "Credit committee approved" }
```

**What Fineract does:** Updates the loan status in MySQL:
```sql
UPDATE m_loan SET loan_status_id = 200 WHERE id = 10;
-- Also: approvedon_date = CURRENT_DATE, approvedon_userid = <officer_id>
```
Status 200 = Approved.

**What the gateway returns:**
```json
{ "success": true, "data": { "loanId": 10, "resourceId": 10 } }
```

---

### Step 5 — Disburse the Loan (Funds Released to Borrower)

This is the most important event in a loan's life. When a loan is disbursed, money moves to the borrower AND Fineract generates the full repayment schedule.

**Who does this:** Branch manager (web portal)

**API Call:**
```
POST http://localhost:3001/api/v1/loans/10/actions
Authorization: Bearer <branch_manager_token>

{ "command": "disburse", "note": "Cash disbursed at Yangon branch" }
```

**What the gateway does:** Same pattern — authorizes the role, then calls Fineract:
```
POST http://fineract:8080/fineract-provider/api/v1/loans/10?command=disburse
```

**What Fineract does internally (multiple database writes):**

1. Updates loan status:
```sql
UPDATE m_loan SET loan_status_id = 300,  -- Active
                  disbursedon_date = '2026-06-17',
                  principal_disbursed_derived = 500000,
                  total_outstanding_derived = 600000  -- principal + interest
WHERE id = 10;
```

2. Creates the repayment schedule — one row per month for 12 months:
```sql
INSERT INTO m_loan_repayment_schedule
  (loan_id, installment, duedate, principal_amount, interest_amount, completed_derived)
VALUES
  (10, 1, '2026-07-17', 41667, 8333, false),
  (10, 2, '2026-08-17', 41667, 7500, false),
  (10, 3, '2026-09-17', 41667, 6667, false),
  ...  -- 12 rows total
```

3. Creates a disbursement transaction:
```sql
INSERT INTO m_loan_transaction
  (loan_id, transaction_type_enum, transaction_date, amount, is_reversed)
VALUES (10, 1, '2026-06-17', 500000, false);
-- transaction_type_enum = 1 means Disbursement
```

**Result:** The loan is now Active. The borrower owes 12 monthly payments. The repayment schedule is set.

---

### Step 6a — Manual Cash Repayment

The borrower pays cash to a loan officer or teller.

**Who does this:** Loan officer (mobile) or teller (web)

**API Call:**
```
POST http://localhost:3001/api/v1/loans/10/repayments
Authorization: Bearer <token>

{
  "dateFormat": "yyyy/MM/dd",
  "locale": "en",
  "transactionDate": "2026/07/17",
  "transactionAmount": 50000,
  "note": "Cash collected at village visit"
}
```

**What the gateway does** (`apps/api/src/routes/loans.ts`):
```typescript
app.post('/loans/:loanId/repayments', async (req, reply) => {
  const { data } = await fineract.post(
    `/loans/${req.params.loanId}/transactions?command=repayment`,
    req.body
  );
  return reply.status(201).send({ success: true, data });
});
```

Direct proxy to Fineract's repayment endpoint.

**What Fineract does internally:**
1. Allocates the 50,000 MMK between principal and interest based on the amortization schedule
2. Marks the installment as paid (or partially paid):
```sql
UPDATE m_loan_repayment_schedule
SET completed_derived = true,
    obligations_met_on_date = '2026-07-17',
    principal_completed_derived = 41667,
    interest_completed_derived = 8333
WHERE loan_id = 10 AND installment = 1;
```

3. Inserts a repayment transaction:
```sql
INSERT INTO m_loan_transaction
  (loan_id, transaction_type_enum, transaction_date, amount, is_reversed)
VALUES (10, 2, '2026-07-17', 50000, false);
-- transaction_type_enum = 2 means Repayment
```

4. Updates the loan's outstanding balance:
```sql
UPDATE m_loan SET principal_outstanding_derived = 458333,
                  total_outstanding_derived = 549167
WHERE id = 10;
```

---

### Step 6b — KBZ Pay Mobile Repayment

Borrower pays via KBZ Pay mobile wallet. This is more complex — see Section 9 for full details.

**Simplified flow:**
1. Loan officer taps "Collect via KBZ Pay" on the mobile app
2. App calls `POST /api/v1/payments/initiate` → Gateway → Mobile Money Service → KBZ Pay
3. KBZ Pay returns a `prepayId`; app opens `kbzpay://pay?prepay_id=...`
4. Borrower pays in their KBZ Pay app
5. Mobile app polls `GET /api/v1/payments/status/:orderId` every 5 seconds
6. When status is `"success"`, the gateway automatically posts the repayment to Fineract (same as Step 6a)

---

### Step 7 — Loan Closed

When the final installment is paid and the loan is fully settled, Fineract automatically updates the status:
```sql
UPDATE m_loan SET loan_status_id = 600  -- Closed
WHERE id = 10;
-- All rows in m_loan_repayment_schedule have completed_derived = true
```

The loan disappears from the "active loans" count on the dashboard.

---

## 7. Every API Endpoint Reference

All endpoints are served by the API Gateway on **port 3001** with prefix `/api/v1`.  
✅ = Public (no JWT needed) | 🔒 = Requires valid JWT | 👑 = Requires specific role

### Auth Endpoints

| Method | Path | Access | What it does |
|--------|------|--------|--------------|
| POST | `/auth/login` | ✅ | Exchange username/password for JWT tokens |
| POST | `/auth/refresh` | ✅ | Get a new access token using a refresh token |
| POST | `/auth/logout` | ✅ | Revoke refresh token in Keycloak |
| GET | `/auth/me` | 🔒 | Get the authenticated user's profile from JWT |

**Login request/response:**
```
POST /api/v1/auth/login
{ "username": "loan.officer", "password": "Officer@1234" }

→ { "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 900 } }
```

---

### Client Endpoints

| Method | Path | Access | What it does |
|--------|------|--------|--------------|
| GET | `/clients` | 🔒 | Paginated list of all clients (supports `page`, `pageSize`, `search`) |
| GET | `/clients/:clientId` | 🔒 | Single client detail |
| POST | `/clients` | 🔒 | Register a new borrower (proxied to Fineract) |
| PUT | `/clients/:clientId` | 🔒 | Update client details |

**List clients with search:**
```
GET /api/v1/clients?page=0&pageSize=20&search=Aye
Authorization: Bearer <token>
```

**Create client request:**
```json
{
  "firstname": "Aye", "lastname": "Myat",
  "mobileNo": "+959123456789", "officeId": 1,
  "active": true, "locale": "en", "dateFormat": "yyyy-MM-dd",
  "dateOfBirth": "1990-05-12"
}
```

---

### Loan Endpoints

| Method | Path | Access | What it does |
|--------|------|--------|--------------|
| GET | `/loans` | 🔒 | Paginated list of all loans |
| GET | `/clients/:clientId/loans` | 🔒 | All loan accounts for a specific client |
| GET | `/loans/:loanId` | 🔒 | Full loan detail with repayment schedule + transactions |
| POST | `/loans/:loanId/repayments` | 🔒 | Post a cash repayment |
| POST | `/loans/:loanId/actions` | 👑 `branch_manager` or `super_admin` | Approve / disburse / reject |

**Loan actions request:**
```json
{ "command": "approve" }   // or "disburse" or "reject"
```

**Loan detail response** (key fields):
```json
{
  "id": 10,
  "accountNo": "000000010",
  "status": { "id": 300, "value": "Active" },
  "principal": 500000,
  "currency": { "code": "MMK" },
  "summary": { "totalOutstanding": 450000, "totalOverdue": 0 },
  "repaymentSchedule": {
    "periods": [
      { "period": 1, "dueDate": "2026-07-17", "principalDue": 41667,
        "interestDue": 8333, "complete": true },
      ...
    ]
  },
  "transactions": [
    { "type": { "value": "Disbursement" }, "date": "2026-06-17", "amount": 500000 },
    { "type": { "value": "Repayment" }, "date": "2026-07-17", "amount": 50000 }
  ]
}
```

---

### Payment Endpoints

| Method | Path | Access | What it does |
|--------|------|--------|--------------|
| POST | `/payments/initiate` | 🔒 | Start a KBZ Pay repayment — returns `prepayId` |
| GET | `/payments/status/:orderId` | 🔒 | Check payment status; auto-posts to Fineract on success |

**Initiate payment:**
```json
{
  "loanId": 10, "amount": 50000,
  "customerName": "Ma Aye Myat", "customerPhone": "+959123456789"
}
→ { "prepayId": "kbz_abc123", "orderId": "loan-10-xK3m9pQr", "expireTime": 1747141200 }
```

---

### Dashboard Endpoint

| Method | Path | Access | What it does |
|--------|------|--------|--------------|
| GET | `/dashboard/stats` | 🔒 | Aggregate portfolio stats (PAR, collections, active loans) |

**Response:**
```json
{
  "activeClients": 142, "activeLoans": 98,
  "par30": 3.21, "par90": 1.04,
  "totalOutstanding": 45200000,
  "collectionsToday": 3800000, "collectionRate": 87.5
}
```

> ⚠️ Currently returns zeros — see Section 12 (What's Broken).

---

## 8. The Database Schema

The system uses two database engines. Understanding why helps you understand the architecture.

### MySQL 8.0 — Core Banking Data (port 3306)

**Used by:** Apache Fineract (the only service that writes here)

**Database name:** `fineract_default`

Fineract creates and manages all tables via Liquibase migrations on startup. The key tables:

#### `m_client` — Borrower records

| Column | Type | Meaning |
|--------|------|---------|
| `id` | BIGINT PK | Internal ID |
| `account_no` | VARCHAR | Human-readable ID (e.g., "000000042") |
| `display_name` | VARCHAR | Full name shown in the UI |
| `firstname`, `lastname` | VARCHAR | Individual name parts |
| `mobile_no` | VARCHAR | Phone number for KBZ Pay |
| `date_of_birth` | DATE | For KYC verification |
| `office_id` | BIGINT FK | Which branch this client belongs to |
| `status_enum` | INT | 300 = Active, 100 = Pending |

#### `m_loan` — Loan accounts

| Column | Type | Meaning |
|--------|------|---------|
| `id` | BIGINT PK | Internal loan ID |
| `account_no` | VARCHAR | Human-readable loan reference |
| `client_id` | BIGINT FK | Which borrower |
| `product_id` | BIGINT FK | Which loan product (e.g., "Group Loan 12M") |
| `loan_status_id` | SMALLINT | **100**=Submitted, **200**=Approved, **300**=Active, **600**=Closed |
| `principal_amount` | DECIMAL | Original loan amount applied for |
| `principal_disbursed_derived` | DECIMAL | Actual amount disbursed |
| `principal_outstanding_derived` | DECIMAL | Principal still owed |
| `total_outstanding_derived` | DECIMAL | Principal + interest + fees still owed |
| `disbursedon_date` | DATE | When funds were released to borrower |
| `currency_code` | VARCHAR | Always `MMK` for Myanmar |
| `loan_officer_id` | BIGINT | FK to the loan officer assigned |

**The most important field for reporting:** `loan_status_id = 300` means the loan is Active. All PAR calculations only include Active loans.

#### `m_loan_repayment_schedule` — Installment schedule

Generated automatically by Fineract when a loan is disbursed. One row per installment (usually one per month).

| Column | Type | Meaning |
|--------|------|---------|
| `loan_id` | BIGINT FK | Which loan |
| `installment` | SMALLINT | 1, 2, 3 ... (month number) |
| `duedate` | DATE | When this installment is due |
| `principal_amount` | DECIMAL | Principal portion due |
| `interest_amount` | DECIMAL | Interest portion due |
| `completed_derived` | BOOLEAN | **true** if fully paid |
| `obligations_met_on_date` | DATE | Date paid (NULL if unpaid) |
| `principal_completed_derived` | DECIMAL | Principal actually paid |
| `interest_completed_derived` | DECIMAL | Interest actually paid |

**How to detect an overdue installment:** `duedate < CURRENT_DATE AND completed_derived = false`

#### `m_loan_transaction` — All financial movements

| Column | Type | Meaning |
|--------|------|---------|
| `loan_id` | BIGINT FK | Which loan |
| `transaction_type_enum` | SMALLINT | **1**=Disbursement, **2**=Repayment |
| `transaction_date` | DATE | When the transaction occurred |
| `amount` | DECIMAL | Amount in MMK |
| `is_reversed` | BOOLEAN | True if this transaction was reversed/cancelled |

---

### PostgreSQL 15 — Auth and Reporting (port 5432)

**Used by:** Keycloak (auth data) + Reporting service (should query Fineract data — see Section 12)

**Databases:** `keycloak` (Keycloak's own schema) + `fineract_default` (for reporting)

> ⚠️ **Important:** `fineract_default` in PostgreSQL is **empty**. Fineract writes to MySQL, not PostgreSQL. The reporting service currently reads empty tables. See Section 12 for the fix options.

---

## 9. KBZ Pay Payment Flow — Deep Dive

### What is KBZ Pay?

KBZ Pay is Myanmar's largest mobile wallet, operated by KBZ Bank. It has the deepest rural penetration of any digital payment channel in Myanmar. Borrowers can pay loan installments from their phone without going to a branch.

### The Signing Mechanism (HMAC-SHA256)

Every request sent to KBZ Pay must be cryptographically signed. This prevents forgery — KBZ Pay will reject any request that has not been signed with your merchant's secret key.

**How signing works** (`services/mobile-money/src/kbzpay/signature.ts`):
1. Take all the request parameters (as key-value pairs)
2. Sort them alphabetically by key name
3. Join them into a string: `appid=xxx&merch_code=yyy&nonce_str=zzz`
4. Append the signing key: `appid=xxx&merch_code=yyy&key=YOUR_SIGN_KEY`
5. Compute HMAC-SHA256 of that string
6. Add the result as the `sign` parameter in the request

This is why the `KBZPAY_SIGN_KEY` environment variable is sensitive — anyone with it can forge KBZ Pay requests as your merchant.

### The Full Payment Flow

```
Step 1: Loan officer taps "Collect via KBZ Pay" in the mobile app
        ↓
Step 2: App calls POST /api/v1/payments/initiate
        { loanId: 10, amount: 50000, customerName: "Ma Aye Myat", customerPhone: "+959..." }
        ↓
Step 3: API Gateway generates a unique orderId = "loan-10-xK3m9pQr" (nanoid)
        ↓
Step 4: Gateway calls Mobile Money Service:
        POST http://mobile-money:3003/payments/kbzpay/initiate
        { orderId, amount: 5000000, currency: "MMK", ... }
        ↓
Step 5: Mobile Money Service signs the request (HMAC-SHA256) and calls KBZ Pay:
        POST https://api.kbzpay.com/payment/gateway/uat/precreate
        { appid, merch_code, nonce_str, timestamp, merch_order_id, total_amount: 5000000, sign }
        ↓ Note: 50000 MMK × 100 = 5000000 pyas (KBZ Pay uses the smallest unit)
        ↓
Step 6: KBZ Pay returns:
        { prepay_id: "kbz_abc123", merch_order_id: "loan-10-xK3m9pQr" }
        ↓
Step 7: Response flows back to the mobile app:
        { prepayId: "kbz_abc123", orderId: "loan-10-xK3m9pQr" }
        ↓
Step 8: Mobile app opens the KBZ Pay deep link:
        Linking.openURL("kbzpay://pay?prepay_id=kbz_abc123&merch_order_id=loan-10-xK3m9pQr")
        ↓ This opens the KBZ Pay app on the borrower's phone
        ↓
Step 9: Borrower authenticates in KBZ Pay and confirms the payment
        ↓
Step 10: KBZ Pay sends a signed webhook callback to the Mobile Money Service:
         POST http://mobile-money:3003/webhooks/kbzpay
         { merch_order_id: "loan-10-xK3m9pQr", trade_status: "PAY_SUCCESS", sign: "..." }
         → Mobile Money Service verifies the HMAC-SHA256 signature before trusting the payload
        ↓
Step 11: Meanwhile, the mobile app polls every 5 seconds:
         GET /api/v1/payments/status/loan-10-xK3m9pQr?loanId=10
        ↓
Step 12: When status = "success", the gateway auto-posts to Fineract:
         POST http://fineract:8080/.../loans/10/transactions?command=repayment
         { transactionDate: "2026/06/17", transactionAmount: 50000, note: "KBZ Pay orderId: loan-10-xK3m9pQr" }
         ↓ Note: 5000000 pyas ÷ 100 = 50000 MMK for Fineract
        ↓
Step 13: Fineract records the repayment and updates the schedule.
         Mobile app shows success screen.
```

### Amount Conversion

| Where | Amount | Unit |
|-------|--------|------|
| UI (what the officer sees) | 50,000 MMK | MMK |
| KBZ Pay API | 5,000,000 | Pyas (MMK × 100) |
| Fineract API | 50,000 | MMK (÷100 conversion in gateway) |
| Database `m_loan_transaction.amount` | 50,000 | MMK |

---

## 10. KYC Identity Verification — Deep Dive

### The Provider Interface Pattern

The KYC service uses a software design pattern called the **Strategy Pattern**. The interface defines *what* must be done, but the implementation (which vendor does it) is swapped via configuration.

```typescript
interface KycProvider {
  submit(request: KycVerificationRequest): Promise<KycSubmission>
  getStatus(submissionId: string): Promise<KycSubmission>
  handleWebhook(payload: KycWebhookPayload): Promise<void>
  getStats(): Promise<KycStats>
}
```

The `resolveProvider()` function in `services/kyc/src/index.ts` reads `KYC_PROVIDER` from the environment at startup and returns the right provider:

```typescript
function resolveProvider(): KycProvider {
  switch (process.env.KYC_PROVIDER) {
    case 'smile_identity': return new SmileIdentityProvider();
    case 'onfido':         return new OnfidoProvider();
    default:               return new StubKycProvider();  // development
  }
}
```

### KYC Submission States

```
"processing" → "approved"
             → "rejected"
             → "manual_review"  (needs a human to check)
```

### Stub Provider (Development)

The `StubKycProvider` maintains an in-memory JavaScript `Map` of submission IDs. When `submit()` is called, it:
1. Creates a new entry: `{ submissionId: uuid, status: "processing", ... }`
2. Uses `setTimeout(2000)` to auto-update status to `"approved"` after 2 seconds
3. Returns immediately with `status: "processing"`

This allows you to test the entire loan origination flow locally without KYC credentials.

### The Myanmar NRC Document

The National Registration Card (NRC) is Myanmar's national identity document. Format: `12/KAMANA(N)123456`
- `12` = state/division code
- `KAMANA` = township code
- `(N)` = card type (N = Normal, P = Pink)
- `123456` = serial number

When a borrower submits KYC with `documentType: "nrc"`, the real providers check this number against the national ID database.

---

## 11. Reporting Service — How PAR is Calculated

### What is PAR?

Portfolio at Risk (PAR) is the standard health metric for microfinance institutions. It measures what percentage of the total loan portfolio has at least one overdue installment.

**Why it matters:** An MFI with 1% PAR30 is healthy. An MFI with 20% PAR30 is in serious trouble — it means 20% of the money lent out is potentially not coming back.

| Metric | Definition | Concern threshold |
|--------|------------|-------------------|
| PAR0 | % of portfolio where ANY installment is overdue (even 1 day) | >10% |
| PAR30 | % where oldest overdue installment is ≥30 days | >5% |
| PAR90 | % where oldest overdue installment is ≥90 days | >2% |

### The SQL Query

The reporting service runs this query to compute PAR (`services/reporting/`):

```sql
WITH overdue_schedule AS (
    -- Find the oldest unpaid past-due installment for each loan
    SELECT
        loan_id,
        MIN(duedate)                                            AS oldest_overdue_date,
        CURRENT_DATE - MIN(duedate)                            AS days_in_arrears,
        SUM(
            (principal_amount  - principal_completed_derived) +
            (interest_amount   - interest_completed_derived)
        )                                                       AS overdue_amount
    FROM m_loan_repayment_schedule
    WHERE duedate < CURRENT_DATE         -- installment is past due
      AND completed_derived = false       -- not yet fully paid
      AND obligations_met_on_date IS NULL -- was never satisfied
    GROUP BY loan_id
),
active_loans AS (
    -- All currently active loans with their total outstanding balance
    SELECT id, total_outstanding_derived
    FROM m_loan
    WHERE loan_status_id = 300  -- Active only
)
SELECT
    COUNT(DISTINCT a.id)                                   AS active_loan_count,
    SUM(a.total_outstanding_derived)                       AS total_outstanding,

    -- PAR0: loans with ANY overdue installment
    SUM(CASE WHEN o.days_in_arrears >= 1  THEN a.total_outstanding_derived ELSE 0 END)
        / NULLIF(SUM(a.total_outstanding_derived), 0) * 100 AS par0,

    -- PAR30: loans where oldest overdue is >= 30 days
    SUM(CASE WHEN o.days_in_arrears >= 30 THEN a.total_outstanding_derived ELSE 0 END)
        / NULLIF(SUM(a.total_outstanding_derived), 0) * 100 AS par30,

    -- PAR90: loans where oldest overdue is >= 90 days
    SUM(CASE WHEN o.days_in_arrears >= 90 THEN a.total_outstanding_derived ELSE 0 END)
        / NULLIF(SUM(a.total_outstanding_derived), 0) * 100 AS par90

FROM active_loans a
LEFT JOIN overdue_schedule o ON o.loan_id = a.id;
```

### Why This Is More Accurate Than Fineract's REST API

Fineract has a scheduled batch job called `RunLoanCOBJob` (Close of Business job) that recalculates loan statuses. This job is typically scheduled to run once per day — usually at midnight. Between batch runs, Fineract's `inArrears` flag on a loan does **not** update.

Example: A loan's installment was due yesterday and wasn't paid. Fineract's REST API might still report `"inArrears": false` until the batch job runs at midnight. The reporting service's SQL query checks `duedate < CURRENT_DATE` in real time, so it shows the loan as overdue immediately.

---

## 12. What's Broken and Why

These are the known issues in the codebase. Understanding them is part of understanding the system's current state.

### 🔴 CRITICAL — Reporting Returns Zeros (Dual Database Gap)

**The bug:** The reporting service (`services/reporting/`) is configured to connect to **PostgreSQL** (`REPORTING_DB_URL`). But Apache Fineract writes all its data to **MySQL**. The `fineract_default` database in PostgreSQL exists but contains **empty tables**.

**What you see:** The dashboard stats (PAR, collections, active loans) all show zero or return errors.

**Why it happened:** The intention was to have Fineract write to PostgreSQL (so reporting and Fineract share one database), but Fineract's production-ready setup requires MySQL (via the MariaDB JDBC driver). The reporting service was wired up before this database mismatch was resolved.

**The three fix options identified:**

| Option | Approach | Effort |
|--------|----------|--------|
| A (fastest) | Point reporting at MySQL — change `REPORTING_DB_URL` to MySQL, swap `asyncpg` to `aiomysql`, fix ~5 SQL syntax differences | ~1 day |
| B (cleaner) | Migrate Fineract to PostgreSQL — reconfigure Fineract to use PG natively, remove MySQL | ~2–3 days |
| C (production-grade) | MySQL → PostgreSQL replication via Debezium CDC + Kafka | Several weeks |

**Decision pending as of June 2026.**

---

### 🟠 MEDIUM — Payment Idempotency Gap (Double Repayment Risk)

**The bug:** When KBZ Pay's webhook fires (telling us a payment succeeded), the code doesn't check if a repayment for this `orderId` has already been posted to Fineract. If KBZ Pay retries the webhook (which it does on network failure), the repayment could be recorded **twice**.

**Impact:** A borrower pays once but their loan shows two repayments. The outstanding balance is reduced by double the payment.

**The fix:** Before posting to Fineract, store the `orderId` in a database table. If it already exists, skip the Fineract post.

---

### 🟠 MEDIUM — Deprecated ROPC Login Flow

**The bug:** Login uses `grant_type=password` (Resource Owner Password Credentials), which is deprecated in OAuth 2.1.

**The risk:** In a future version of Keycloak, this grant type may be disabled by default.

**The fix:** Migrate to Authorization Code + PKCE flow (standard for mobile and web apps).

---

### 🟡 LOW — KYC Stub Can Be Accidentally Used in Production

**The bug:** If `KYC_PROVIDER` is not set in the production `.env`, it defaults to `stub`, which auto-approves all KYC submissions. A real borrower could get a loan without identity verification.

**The fix:** Add a startup check: if `NODE_ENV=production` and `KYC_PROVIDER=stub`, throw an error and refuse to start.

---

### 🟡 LOW — KYC Result Not Written Back to Fineract

**The bug:** When a KYC submission is approved or rejected, the KYC service stores the result internally, but it never calls Fineract to update the client's document status.

**Impact:** The loan officer has no way to see KYC status inside Fineract's standard loan processing workflow.

**The fix:** After a KYC webhook is received with `status: "approved"`, call `POST /clients/:id/documents` in Fineract to record the verification.

---

## 13. Hands-On Labs — Learn by Doing

These labs are the practical component. Run them locally to see the system in action. **Prerequisites:** Docker Desktop running, project cloned, `.env` configured.

### Lab Setup — Start the Stack

```bash
# 1. Navigate to the project
cd MifosX4MM

# 2. Install Node dependencies
pnpm install

# 3. Start all infrastructure (databases, Fineract, Keycloak) in the background
pnpm docker:up
# ⏳ Wait about 3 minutes for Fineract to complete its Liquibase migrations
# You'll see: "Server startup in XXXX ms" in the Fineract logs when it's ready
# Check: docker compose logs -f fineract

# 4. Start all application services in dev mode (hot reload)
pnpm dev
```

**Verify everything is running:**
```bash
curl http://localhost:3001/health         # → {"status":"ok","service":"api"}
curl http://localhost:3005/health         # → {"status":"ok"}
curl http://localhost:8080/fineract-provider/api/v1/serverinfo \
     -u mifos:password \
     -H "Fineract-Platform-TenantId: default"
# → Fineract version info
```

---

### Lab 1 — Login and Get a JWT Token

```bash
# Login with the seeded loan officer account
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"loan.officer","password":"Officer@1234"}' | python3 -m json.tool
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6...",
    "refreshToken": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Save the token for subsequent requests:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"loan.officer","password":"Officer@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo $TOKEN  # verify it's set
```

**Decode the token** (paste into https://jwt.io to see the claims — roles, expiry, etc.)

---

### Lab 2 — Explore Your User Profile

```bash
curl -s http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "id": "some-keycloak-uuid",
    "username": "loan.officer",
    "email": "loan.officer@mifos.local",
    "roles": ["loan_officer", "offline_access", "default-roles-mifos"]
  }
}
```

**What to observe:** The `roles` array is what the gateway uses for RBAC. Notice `branch_manager` is NOT in this list — that's why this user can't approve loans.

---

### Lab 3 — Register a New Client

```bash
curl -s -X POST http://localhost:3001/api/v1/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Zaw",
    "lastname": "Win",
    "displayName": "Ko Zaw Win",
    "mobileNo": "+959987654321",
    "officeId": 1,
    "legalFormId": 1,
    "active": true,
    "locale": "en",
    "dateFormat": "yyyy-MM-dd",
    "dateOfBirth": "1988-03-15",
    "submittedOnDate": "2026-06-17"
  }' | python3 -m json.tool
```

**Expected response:**
```json
{ "success": true, "data": { "clientId": 2, "resourceId": 2 } }
```

Save the `clientId`:
```bash
CLIENT_ID=2
```

**Verify in the database:**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT id, display_name, mobile_no, status_enum FROM m_client WHERE id = $CLIENT_ID;"
```

---

### Lab 4 — List Clients

```bash
# Get first page of clients
curl -s "http://localhost:3001/api/v1/clients?page=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Search by name
curl -s "http://localhost:3001/api/v1/clients?search=Zaw" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

### Lab 5 — Create and Trace a Loan Application via Fineract Directly

Since the gateway doesn't yet have a `POST /loans` route, create it via Fineract's Swagger UI or directly:

```bash
curl -s -X POST \
  "http://localhost:8080/fineract-provider/api/v1/loans" \
  -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": $CLIENT_ID,
    \"productId\": 1,
    \"principal\": 500000,
    \"loanTermFrequency\": 12,
    \"loanTermFrequencyType\": 2,
    \"numberOfRepayments\": 12,
    \"repaymentEvery\": 1,
    \"repaymentFrequencyType\": 2,
    \"interestRatePerPeriod\": 2.0,
    \"interestType\": 0,
    \"interestCalculationPeriodType\": 1,
    \"transactionProcessingStrategyCode\": \"mifos-standard-strategy\",
    \"locale\": \"en\",
    \"dateFormat\": \"dd MMMM yyyy\",
    \"submittedOnDate\": \"17 June 2026\",
    \"expectedDisbursementDate\": \"17 June 2026\"
  }" | python3 -m json.tool
```

Save the loan ID:
```bash
LOAN_ID=<id from response>
```

**Check the loan status in the database:**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT id, loan_status_id, principal_amount, total_outstanding_derived FROM m_loan WHERE id = $LOAN_ID;"
# loan_status_id should be 100 (Submitted)
```

---

### Lab 6 — Approve and Disburse the Loan (as Branch Manager)

First, get a branch manager token:
```bash
MANAGER_TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
```

**Approve the loan:**
```bash
curl -s -X POST "http://localhost:3001/api/v1/loans/$LOAN_ID/actions" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"approve","note":"Lab exercise approval"}' | python3 -m json.tool
```

**Check status (should be 200 = Approved):**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT id, loan_status_id FROM m_loan WHERE id = $LOAN_ID;"
```

**Disburse the loan:**
```bash
curl -s -X POST "http://localhost:3001/api/v1/loans/$LOAN_ID/actions" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"disburse","note":"Lab exercise disbursement"}' | python3 -m json.tool
```

**Check status (should be 300 = Active) and view the repayment schedule:**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT installment, duedate, principal_amount, interest_amount, completed_derived FROM m_loan_repayment_schedule WHERE loan_id = $LOAN_ID ORDER BY installment;"
```

You should now see 12 rows — one per month. All `completed_derived = 0` (unpaid).

---

### Lab 7 — Post a Repayment and See the Schedule Update

```bash
TODAY=$(date +"%Y/%m/%d")

curl -s -X POST "http://localhost:3001/api/v1/loans/$LOAN_ID/repayments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"dateFormat\": \"yyyy/MM/dd\",
    \"locale\": \"en\",
    \"transactionDate\": \"$TODAY\",
    \"transactionAmount\": 50000,
    \"note\": \"Lab 7 cash repayment\"
  }" | python3 -m json.tool
```

**Check that installment 1 is now marked complete:**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT installment, duedate, completed_derived, obligations_met_on_date, principal_completed_derived FROM m_loan_repayment_schedule WHERE loan_id = $LOAN_ID ORDER BY installment LIMIT 3;"
```

**Check the transaction was recorded:**
```bash
docker exec -it mifosx4mm-mysql-1 mysql -umifos -ppassword fineract_default \
  -e "SELECT transaction_type_enum, transaction_date, amount, is_reversed FROM m_loan_transaction WHERE loan_id = $LOAN_ID;"
# Type 1 = Disbursement, Type 2 = Repayment
```

---

### Lab 8 — Test Role-Based Access Control

Try to approve a loan **as a loan officer** (who doesn't have the branch_manager role):

```bash
curl -s -X POST "http://localhost:3001/api/v1/loans/$LOAN_ID/actions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"approve"}' | python3 -m json.tool
```

**Expected response:**
```json
{ "success": false, "error": "Forbidden" }
```

**What happened:** The `authorize(['branch_manager', 'super_admin'])` hook checked `req.user.roles`, found only `["loan_officer"]`, and returned 403.

---

### Lab 9 — Explore the Fineract Swagger UI

Open your browser to: `http://localhost:8080/fineract-provider/swagger-ui/index.html`

This is the complete Fineract REST API documentation with a built-in test interface. You can:
- Browse all available endpoints
- Authenticate with `mifos` / `password` + tenant `default`
- Execute any Fineract API call directly to understand what the gateway is wrapping

Key sections to explore:
- **Clients** — create, search, update borrowers
- **Loans** — loan lifecycle, repayment schedules, transactions
- **Loan Products** — the loan product definitions (interest rates, terms)
- **Offices** — branch hierarchy

---

### Lab 10 — Understand What the KYC Stub Does

```bash
# Submit a KYC verification
curl -s -X POST http://localhost:3004/kyc/submit \
  -H "Content-Type: application/json" \
  -d '{
    "clientRef": "'"$CLIENT_ID"'",
    "documentType": "nrc",
    "documentNumber": "12/KAMANA(N)123456",
    "images": ["base64_placeholder"]
  }' | python3 -m json.tool

# → { "submissionId": "uuid-abc", "status": "processing" }

# Wait 3 seconds, then check status
SUBMISSION_ID=<from above>
sleep 3
curl -s "http://localhost:3004/kyc/status/$SUBMISSION_ID" | python3 -m json.tool
# → { "submissionId": "uuid-abc", "status": "approved" }  ← auto-approved!
```

**What to observe:** The stub auto-approved after 2 seconds with no real verification. In production, `status` would stay `"processing"` until the real KYC provider responded.

---

### Lab 11 — Read Reporting Service Output (Will Show Zeros Until DB Fixed)

```bash
curl -s http://localhost:3005/reports/portfolio/summary | python3 -m json.tool
curl -s http://localhost:3005/reports/collections/today | python3 -m json.tool
```

**Current state:** These return zeros or errors because the reporting service reads from PostgreSQL but Fineract writes to MySQL. This is the critical bug described in Section 12. Understanding *why* it returns zeros is as important as the data itself.

---

## 14. Key Concepts Glossary

| Term | Definition |
|------|------------|
| **Fineract** | Apache Fineract — open-source core banking engine; never modified, accessed via REST API only |
| **API Gateway** | The single entry point for all requests; handles JWT verification, RBAC, and routes to other services |
| **JWT** | JSON Web Token — a cryptographically signed string that proves who you are; expires after 15 minutes |
| **JWKS** | JSON Web Key Set — Keycloak's public key endpoint; the gateway uses it to verify JWT signatures |
| **RBAC** | Role-Based Access Control — restricting what users can do based on their role (loan_officer, branch_manager, etc.) |
| **ROPC** | Resource Owner Password Credentials — the OAuth 2 login flow used here (deprecated in OAuth 2.1) |
| **Disbursement** | The moment loan funds are released to the borrower; triggers repayment schedule generation in Fineract |
| **Repayment Schedule** | The series of monthly installments (stored in `m_loan_repayment_schedule`) generated on disbursement |
| **PAR** | Portfolio at Risk — the % of the total loan portfolio with overdue installments; the headline MFI health metric |
| **PAR30** | Portfolio where the oldest overdue installment is ≥ 30 days past due |
| **Arrears** | A loan is in arrears when at least one installment is past its due date and not yet paid |
| **KBZ Pay** | Myanmar's largest mobile wallet; borrowers pay via deep link to the KBZ Pay app |
| **HMAC-SHA256** | The cryptographic signing algorithm used to authenticate KBZ Pay API requests |
| **KYC** | Know Your Customer — identity verification of borrowers before loan approval |
| **NRC** | National Registration Card — Myanmar's national ID document |
| **Monorepo** | A single Git repository containing multiple apps and services (web, mobile, API, services) |
| **Turborepo** | Build tool for managing the monorepo — handles build order and caching |
| **pnpm** | Package manager used instead of npm (faster, disk-efficient) |
| **Liquibase** | Database migration tool used by Fineract to create/update its MySQL schema on startup |
| **MMK** | Myanmar Kyat — the currency |
| **Pyas** | MMK × 100 — the smallest unit; KBZ Pay uses pyas, Fineract uses MMK |
| **BFF** | Backend for Frontend — the API Gateway pattern where one service is tailored to specific client needs |
| **ROPC** | Resource Owner Password Credentials — deprecated OAuth 2 grant type used for staff login |
| **Collection Rate** | Today's repayments collected ÷ today's repayments due × 100; the daily operational KPI |
| **RunLoanCOBJob** | Fineract's scheduled batch job that recalculates loan statuses; runs once per day |

---

*This document covers the complete MifosX4MM system as of June 2026. For related documents, see: [ARCHITECTURE.md](../ARCHITECTURE.md), [API.md](../API.md), [DOMAIN.md](../DOMAIN.md), [bugs-and-errors.md](./bugs-and-errors.md).*
