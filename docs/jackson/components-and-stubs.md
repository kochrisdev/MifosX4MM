# MifosX4MM — Components & Technical Stubs Catalogue

> **Project:** MifosX4MM — Myanmar Microfinance Platform  
> **Author:** Jackson (DEV006) · jackson@tamarind.tech  
> **Date:** June 15, 2026 · **Last updated:** June 17, 2026  
> **Purpose:** Catalogue every component, hook, service, and technical stub in the monorepo.
>
> **June 17 update:** BUG-01 through BUG-07 resolved — all previously missing API routes, plugins, reporting routers, and web hooks now exist. BUG-19 (documents/settings pages) also resolved. STUB-03 resolved. Remaining open items marked accordingly.

---

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. Web App — `apps/web`](#2-web-app--appsweb)
  - [2.1 Pages](#21-pages)
  - [2.2 Layout Components](#22-layout-components)
  - [2.3 UI Components](#23-ui-components)
  - [2.4 Hooks](#24-hooks)
  - [2.5 Providers & Utilities](#25-providers--utilities)
- [3. Mobile App — `apps/mobile`](#3-mobile-app--appsmobile)
  - [3.1 Screens](#31-screens)
  - [3.2 Layouts](#32-layouts)
  - [3.3 Context & Auth State](#33-context--auth-state)
  - [3.4 Hooks](#34-hooks)
  - [3.5 Library Utilities](#35-library-utilities)
  - [3.6 Inline Sub-components](#36-inline-sub-components)
- [4. API Gateway — `apps/api`](#4-api-gateway--appsapi)
  - [4.1 Entry Point & Plugins](#41-entry-point--plugins)
  - [4.2 Route Modules](#42-route-modules)
- [5. Backend Services](#5-backend-services)
  - [5.1 Mobile Money Service](#51-mobile-money-service)
  - [5.2 KYC Service](#52-kyc-service)
  - [5.3 Reporting Service](#53-reporting-service)
- [6. Shared Types — `packages/shared-types`](#6-shared-types--packagesshared-types)
- [7. Technical Stubs](#7-technical-stubs)

---

## 1. Architecture Overview

MifosX4MM is a **Turborepo monorepo** managed with **pnpm workspaces**. It has three client apps, three backend services, and one shared types package.

| Layer | Package | Tech Stack | Port | Purpose |
|-------|---------|-----------|------|---------|
| Web Frontend | `apps/web` | Next.js 14, React, Tailwind CSS | 3000 | Staff portal |
| Mobile Frontend | `apps/mobile` | Expo 51, React Native, expo-router | N/A | Field app |
| API Gateway | `apps/api` | Fastify, TypeScript, Axios | 3001 | Single entry point for all clients |
| KYC Service | `services/kyc` | Fastify, TypeScript | 3004 | Identity verification |
| Mobile Money | `services/mobile-money` | Fastify, TypeScript | 3003 | KBZ Pay integration |
| Reporting | `services/reporting` | Python, FastAPI, SQLAlchemy | 3005 | Direct SQL analytics |
| Shared Types | `packages/shared-types` | TypeScript (types only) | N/A | Shared interfaces |
| Core Banking | Fineract (external) | Apache Fineract 1.9 | 8443 | Loan/client engine |
| Auth | Keycloak (external) | Keycloak 24, RS256 | 8080 | SSO / JWT issuer |
| Database | MySQL (external) | MariaDB 10.6 | 3306 | Fineract datastore |
| Database | PostgreSQL (external) | PostgreSQL 15 | 5432 | Keycloak DB |

---

## 2. Web App — `apps/web`

Next.js 14 App Router with React Server and Client Components. Tailwind CSS for styling. TanStack Query for data fetching.

### 2.1 Pages

| Route | File | Type | Status | Description |
|-------|------|------|--------|-------------|
| `/` | `app/page.tsx` | Server | ✅ Exists | Root redirect → `/dashboard` |
| `/dashboard` | `(protected)/dashboard/page.tsx` | Client | ⚠️ Check | KPI dashboard — uses `useDashboardStats` |
| `/clients` | `(protected)/clients/page.tsx` | Client | ⚠️ Check | Paginated client list with search |
| `/clients/[clientId]` | `(protected)/clients/[clientId]/page.tsx` | Client | ✅ Exists | Client profile — imports missing hooks (BUG-06) |
| `/loans` | `(protected)/loans/page.tsx` | Client | ⚠️ Check | Loan list |
| `/loans/[loanId]` | `(protected)/loans/[loanId]/page.tsx` | Client | ✅ Exists | Loan detail — imports missing hooks (BUG-07) |
| `/collections` | `(protected)/collections/page.tsx` | Client | ✅ Exists | Overdue loans — missing error handling (BUG-16) |
| `/reports` | `(protected)/reports/page.tsx` | Client | ✅ Exists | Portfolio charts — missing error handling (BUG-17) |
| `/login` | `login/page.tsx` | Client | ⚠️ Check | Login form |
| `/documents` | `(protected)/documents/page.tsx` | Client | ✅ **Fixed** | "Coming soon" placeholder page (BUG-19 resolved) |
| `/settings` | `(protected)/settings/page.tsx` | Client | ✅ **Fixed** | "Coming soon" placeholder page (BUG-19 resolved) |
| `/loans/new` | `(protected)/loans/new/page.tsx` | Client | ❌ Missing | New loan form (BUG-20) |

### 2.2 Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `RootLayout` | `src/app/layout.tsx` | HTML shell — wraps all pages in `QueryProvider` |
| `ProtectedLayout` | `src/app/(protected)/layout.tsx` | Auth shell — `Sidebar` + `TopBar` + `<main>`. Hardcoded `ml-60` (not responsive) |
| `Sidebar` | `src/components/layout/Sidebar.tsx` | Fixed `w-60` left nav. Links: Dashboard, Clients, Loans, Collections, Reports, Documents, Settings. Active state via `usePathname` |
| `TopBar` | `src/components/layout/TopBar.tsx` | Page title from pathname map, notification bell (no-op), hardcoded avatar `"A"` |

### 2.3 UI Components

| Component | File | Props / Variants |
|-----------|------|-----------------|
| `Badge` | `src/components/ui/Badge.tsx` | `label: string`, `variant: 'green' \| 'red' \| 'amber' \| 'blue' \| 'gray'`, `className?`. Pill badge with ring border |
| `loanStatusBadge(statusId)` | `src/components/ui/Badge.tsx` | Maps Fineract status IDs → Badge: `100`=Submitted, `200`=Approved, `300`=Active, `400`=Withdrawn, `500`=Rejected, `600`=Closed, `700`=Written Off, `800`=Rescheduled, `900`=Overpaid |

### 2.4 Hooks

| Hook | File | Status | Description |
|------|------|--------|-------------|
| `useDashboardStats()` | `src/hooks/useDashboardStats.ts` | ✅ Exists | Queries `/dashboard/stats`. `refetchInterval: 60s`. Throws on `!data.success` |
| `useClient(clientId)` | `src/hooks/useClients.ts` | ✅ **Fixed** | Queries `GET /clients/:clientId` |
| `useClientLoans(clientId)` | `src/hooks/useClients.ts` | ✅ **Fixed** | Queries `GET /clients/:clientId/loans` |
| `useLoan(loanId)` | `src/hooks/useLoans.ts` | ✅ **Fixed** | Queries `GET /loans/:loanId` |
| `usePostRepayment()` | `src/hooks/useLoans.ts` | ✅ **Fixed** | Mutation — `POST /loans/:loanId/repayments` |
| `useLoanAction()` | `src/hooks/useLoans.ts` | ✅ **Fixed** | Mutation — `POST /loans/:loanId/actions` (approve/disburse/reject) |

### 2.5 Providers & Utilities

| File | Type | Description |
|------|------|-------------|
| `src/providers/query.tsx` | Context Provider | `QueryProvider` — wraps app in TanStack `QueryClientProvider`. `staleTime: 30s`, `retry: 1` |
| `src/lib/api.ts` | API Client | Axios instance. Reads `localStorage.getItem('accessToken')`. On 401: attempts refresh. On refresh failure: clears storage → redirects to `/login`. Also sets `document.cookie` on login for SSR middleware |
| `src/lib/format.ts` | Utility | `formatMMK(n)` — MMK via `my-MM` locale. `formatNumber(n)`. `formatPercent(ratio, decimals)` |
| `src/middleware.ts` | Next.js Middleware | Checks `accessToken` cookie. Redirects to `/login` if absent. Public paths: `['/login']` |

---

## 3. Mobile App — `apps/mobile`

Expo 51 with expo-router v3 (file-based routing). React Native. TanStack Query.

### 3.1 Screens

| Route | File | Description |
|-------|------|-------------|
| `/(auth)/login` | `app/(auth)/login.tsx` | Login form. Calls `useAuth().login()`. Redirects to `/(tabs)` on success. `KeyboardAvoidingView` with platform-specific `behavior` |
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Home tab — greeting, date, `StatCard` grid. `refetchInterval: 60s` |
| `/(tabs)/clients` | `app/(tabs)/clients.tsx` | Clients tab — search + infinite-scroll `FlatList`. Sends wrong pagination params (BUG-18) |
| `/(tabs)/collections` | `app/(tabs)/collections.tsx` | Collections tab — calls reporting service directly via `EXPO_PUBLIC_REPORTING_URL`. Summary banner + overdue `FlatList` |
| `/clients/[clientId]` | `app/clients/[clientId].tsx` | Client detail — avatar, status badge, contact info, loan list |
| `/loans/[loanId]` | `app/loans/[loanId].tsx` | Loan detail — summary, timeline, installments, **Record Repayment** button. `handleCash()` has no try/catch (BUG-14) |

### 3.2 Layouts

| File | Description |
|------|-------------|
| `app/_layout.tsx` | Root layout — `QueryClientProvider` + `AuthProvider`. `NavigationGuard` (auth redirect logic). Defines all `Stack.Screen` entries |
| `app/(auth)/_layout.tsx` | Auth group — `Stack` with `headerShown: false` |
| `app/(tabs)/_layout.tsx` | Bottom tab bar — Home, Clients, Collections. Tab accent: `#0284c7` |

### 3.3 Context & Auth State

| File | Exports | Description |
|------|---------|-------------|
| `src/context/AuthContext.tsx` | `AuthProvider`, `useAuth()` | Provides `user` (`AuthUser \| null`), `isLoading`, `login(username, password)`, `logout()`. Reads stored token on mount via `getStoredUser()` |

### 3.4 Hooks

| Hook | File | Description |
|------|------|-------------|
| `useClients(search?)` | `src/hooks/useClients.ts` | `useInfiniteQuery` — `GET /clients` with `offset/limit`. `PAGE_SIZE=20`. Min 2 chars for search |
| `useClient(clientId)` | `src/hooks/useClients.ts` | Single query — `GET /clients/:clientId` |
| `useClientLoans(clientId)` | `src/hooks/useLoans.ts` | Query — `GET /clients/:clientId/loans`. Disabled when `clientId` is falsy |
| `useLoan(loanId)` | `src/hooks/useLoans.ts` | Query — `GET /loans/:loanId` |
| `usePostRepayment()` | `src/hooks/useLoans.ts` | Mutation — `POST /loans/:loanId/repayments`. Invalidates `['loan', loanId]` on success. Date format: `yyyy/MM/dd` |
| `useInitiateKbzPayment()` | `src/hooks/useLoans.ts` | Mutation — `POST /payments/initiate`. Returns `{ prepayId, orderId, expireTime }` |

### 3.5 Library Utilities

| File | Exports | Description |
|------|---------|-------------|
| `src/lib/api.ts` | `api`, `login()`, `logout()`, `getStoredUser()` | Axios with `AsyncStorage` token. Request interceptor adds `Bearer`. Response interceptor handles 401 refresh. **Bug (BUG-15):** on refresh failure does not navigate to login |
| `src/lib/format.ts` | `fmt.mmk()`, `fmt.number()`, `fmt.percent()`, `fmt.date()` | Note: uses `en-US` locale for MMK (web uses `my-MM`) — inconsistency |

### 3.6 Inline Sub-components

These components are defined inline within their parent screen files (not in separate files):

| Component | Defined in | Description |
|-----------|-----------|-------------|
| `StatCard` | `app/(tabs)/index.tsx` | KPI tile — label, value, accent colour, skeleton loader when `value` is null |
| `LoanRow` | `app/clients/[clientId].tsx` | Touchable row — loan product name, status badge, account number, outstanding balance |
| `InfoRow` | `app/clients/[clientId].tsx` | Icon + label row in client profile card |
| `RepaymentModal` | `app/loans/[loanId].tsx` | Full-screen modal — amount input, Cash/KBZ Pay method toggle, submit handler, KBZ pending state, success state |
| `ScheduleRow` | `app/loans/[loanId].tsx` | Repayment period row — dot indicator, due date, amount |
| `SummaryItem` | `app/loans/[loanId].tsx` | Key–value pair in loan summary card |
| `TimelineRow` | `app/loans/[loanId].tsx` | Timeline entry (Disbursed / Maturity) with done indicator |
| `MethodBtn` | `app/loans/[loanId].tsx` | Payment method selector button (Cash or KBZ Pay) |

---

## 4. API Gateway — `apps/api`

Fastify server with Keycloak JWT authentication. All client requests go through this gateway.

### 4.1 Entry Point & Plugins

| File | Status | Description |
|------|--------|-------------|
| `src/index.ts` | ✅ Exists | Main entry — registers CORS, Keycloak plugin, Fineract client, and all route groups. Exposes `GET /health` |
| `src/fineract.ts` | ✅ Exists | `createFineractClient()` — Axios with Fineract base URL, Tenant-ID header, Basic Auth, and error normalisation interceptor |
| `src/plugins/keycloak.ts` | ✅ **Exists** | JWT verification via JWKS (RS256). Provides `fastify.authenticate` and `fastify.authorize(roles[])` hooks |

### 4.2 Route Modules

| File | Endpoints | Status | Description |
|------|-----------|--------|-------------|
| `src/routes/auth.ts` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | ✅ Exists | ROPC login to Keycloak. `/auth/me` returns decoded JWT `AuthUser` |
| `src/routes/clients.ts` | `GET /clients`, `GET /clients/:id`, `POST /clients`, `PUT /clients/:id` | ✅ Exists | Client CRUD via Fineract. **Missing:** `/clients/:id/loans` sub-route |
| `src/routes/dashboard.ts` | `GET /dashboard/stats` | ✅ Exists | Fetches from reporting service. Uses `Promise.allSettled` — degrades to zeros on service error |
| `src/routes/payments.ts` | `POST /payments/initiate`, `GET /payments/status/:orderId` | ✅ Exists | KBZ Pay initiation via mobile-money service. **BUG-08:** duplicate Fineract post on each poll |
| `src/routes/loans.ts` | `GET /loans`, `GET /loans/:id`, `GET /clients/:id/loans`, `POST /loans/:id/repayments`, `POST /loans/:id/actions` | ✅ **Exists** | Fully implemented with role-based auth on actions (BUG-01 resolved) |

---

## 5. Backend Services

### 5.1 Mobile Money Service

**Path:** `services/mobile-money`  
**Tech:** Fastify, TypeScript  
**Port:** 3003

| File | Description |
|------|-------------|
| `src/index.ts` | Service entry — instantiates `KbzPayClient` and registers routes |
| `src/routes.ts` | `POST /payments/kbzpay/initiate`, `GET /payments/kbzpay/status/:orderId`, `POST /webhooks/kbzpay`. **Webhook handler:** signature verified + logged — **Fineract posting is a TODO** (technical stub) |
| `src/kbzpay/client.ts` | `KbzPayClient` class. `createOrder()`, `queryOrder()`, `parseCallback()`. **BUG-09:** `parseCallback()` status logic inverted |
| `src/kbzpay/signature.ts` | `buildSignature(params, signKey)` — SHA256 of alphabetically sorted `key=value` pairs + `&key=<signKey>`. `verifySignature()` uses `crypto.timingSafeEqual` |

**KBZ Pay deep link format used by mobile:**
```
kbzpay://pay?prepay_id={prepayId}&merch_order_id={orderId}
```
Amount sent to KBZ in **pyas** (×100). Converted back (÷100) in `payments.ts`.

### 5.2 KYC Service

**Path:** `services/kyc`  
**Tech:** Fastify, TypeScript  
**Port:** 3004

| File | Description |
|------|-------------|
| `src/index.ts` | Service entry — instantiates active KYC provider (currently `StubKycProvider`) |
| `src/provider.ts` | `KycProvider` interface — defines `submit()`, `getStatus()`, `handleWebhook()`, `getStats()` |
| `src/providers/stub.ts` | `StubKycProvider` — **STUB.** In-memory `Map` store. Auto-approves after 2s via `setTimeout`. `handleWebhook()` throws. Lost on restart. See [Section 7](#7-technical-stubs) |
| `src/routes.ts` | `POST /kyc/submit`, `GET /kyc/status/:id`, `POST /kyc/webhook`, `GET /kyc/stats` |

### 5.3 Reporting Service

**Path:** `services/reporting`  
**Tech:** Python, FastAPI, SQLAlchemy (async)  
**Port:** 3005

| File | Status | Description |
|------|--------|-------------|
| `main.py` | ✅ Exists | FastAPI app — CORS, exception handler, registers three routers. Startup checks DB connectivity |
| `db.py` | ✅ **Fixed** | SQLAlchemy async engine — auto-detects MySQL vs PostgreSQL URL (BUG-03 resolved) |
| `routers/__init__.py` | ✅ Exists | Empty init |
| `routers/kyc_summary.py` | ✅ Exists | `GET /reports/kyc/status-breakdown` — proxies to KYC service `/kyc/stats`. Works |
| `routers/portfolio.py` | ✅ **Fixed** | `GET /summary` (PAR0/PAR30/PAR90), `GET /by-product`, `GET /disbursements` (BUG-04 resolved) |
| `routers/collections.py` | ✅ **Fixed** | `GET /today` (scheduled vs collected), `GET /overdue` (paginated, branch-filtered) (BUG-05 resolved) |

---

## 6. Shared Types — `packages/shared-types`

Single file `src/index.ts` exporting all TypeScript interfaces used across the monorepo.

| Type / Interface | Used By | Notes |
|------------------|---------|-------|
| `FineractClient` | api, web, mobile | `dateOfBirth` typed as `string` but Fineract returns `number[]` **(BUG-10)**. Missing `gender`, `activationDate` |
| `FineractLoanAccount` | api, web, mobile | Missing ~8 fields used by UI **(BUG-11)** |
| `FineractSavingsAccount` | api | Not currently used in any frontend |
| `FineractLoanRepayment` | api | Repayment transaction body for Fineract POST |
| `KbzPayOrderParams` | mobile-money, api | `callbackUrl` required in type but not always passed |
| `KbzPayPrepayResponse` | mobile-money, api | `{ prepayId, orderId, expireTime }` |
| `KbzPayCallbackPayload` | mobile-money | `status: '0'\|'1'\|'2'` — comment says `0=success` but correct is `1=success` **(BUG-09)** |
| `KbzPayStatusResponse` | api, mobile | Normalised status — `KbzPayStatus` enum |
| `KycSubmission` | kyc, api | KYC submission record with status |
| `KycVerificationRequest` | kyc | Document images in base64 |
| `KycWebhookPayload` | kyc | Inbound webhook from KYC provider |
| `ApiResponse<T>` | all | Standard envelope: `{ success, data?, error?, meta? }` |
| `PaginatedResponse<T>` | api, mobile | `{ items, total, page, pageSize }` |
| `DashboardStats` | api, web, mobile | KPIs — activeClients, activeLoans, parRatio, par30, par90, totalOutstanding, collectionsToday, collectionRate |
| `AuthUser` | api, web, mobile | `{ id, username, email, roles, officeId?, officeName? }` |
| `TokenPair` | api, web, mobile | `{ accessToken, refreshToken, expiresIn }` |
| `UserRole` | api, web | `'super_admin' \| 'branch_manager' \| 'loan_officer' \| 'teller' \| 'customer'` |

---

## 7. Technical Stubs

A **technical stub** is code that exists in the codebase but is intentionally incomplete, uses fake data, or is explicitly marked `TODO`. All stubs below must be replaced before production.

---

### STUB-01 · `StubKycProvider` — always auto-approves

**File:** `services/kyc/src/providers/stub.ts`  
**Status:** 🚧 NOT production ready

**What it does:** Stores submissions in a Node.js in-memory `Map` (lost on restart). Sets status to `"processing"` then calls `setTimeout` to auto-approve after 2 seconds. No actual document checking. `handleWebhook()` throws `"Stub provider does not receive external webhooks"`.

**What to implement instead:** A real `KycProvider` — either `SmileIdentityProvider` or `OnfidoProvider`. Must:
1. Call the vendor REST API with base64 document images
2. Receive status updates via webhook (`POST /kyc/webhook`)
3. Persist submissions to a real database (PostgreSQL)

---

### STUB-02 · KBZ Pay webhook does not post to Fineract

**File:** `services/mobile-money/src/routes.ts` — `POST /webhooks/kbzpay`  
**Status:** 🚧 TODO comment in code

**What it does:** Verifies the KBZ Pay signature and logs the event. After logging:

```ts
// TODO: emit event to API gateway to post repayment to Fineract
// e.g. publish to internal message bus or call Fineract directly
```

No repayment is actually recorded in Fineract from the webhook path.

**What to implement:** Call the API gateway from the webhook handler:

```ts
await axios.post(`${process.env.API_GATEWAY_URL}/internal/payments/post-repayment`, {
  orderId: result.orderId,
});
```

Or publish to a Redis Pub/Sub channel and have the API gateway consume it. This also fixes **BUG-08** (idempotency) since the webhook fires exactly once per payment.

---

### STUB-03 · Keycloak plugin ✅ RESOLVED

**File:** `apps/api/src/plugins/keycloak.ts`  
**Status:** ✅ Now exists and is fully implemented

The plugin fetches the JWKS public key from Keycloak on startup and registers `@fastify/jwt` with RS256 verification. See BUG-02 for the original issue description.

---

### STUB-04 · Notification bell has no functionality

**File:** `apps/web/src/components/layout/TopBar.tsx`  
**Status:** 🚧 Visual placeholder only

**What it does:** Renders a Bell icon button with no `onClick`, no badge count, and no dropdown. Purely decorative.

**What to implement:** 
- Define a notification type (overdue threshold, KYC status change, repayment recorded)
- Add `GET /notifications` endpoint
- TanStack Query polling or WebSocket for live updates
- Dropdown list on bell click

---

### STUB-05 · `/documents` and `/settings` pages ✅ RESOLVED

**Files:** `apps/web/src/app/(protected)/documents/page.tsx`, `settings/page.tsx`  
**Status:** ✅ Both pages now exist with "coming soon" placeholder content. Sidebar links no longer 404.

---

### STUB-06 · `/loans/new` page missing

**File:** `apps/web/src/app/(protected)/loans/new/page.tsx`  
**Status:** ❌ Does not exist  

See **BUG-20**.

---

### STUB-07 · ROPC auth flow — deprecated in OAuth 2.1

**File:** `apps/api/src/routes/auth.ts`  
**Status:** ⚠️ Technical debt — works now, security risk for future

**What it does:** Login uses `grant_type=password` (Resource Owner Password Credentials). This grant is deprecated in OAuth 2.1. Keycloak 24 still supports it but may remove it in future versions.

**Long-term plan:** Migrate to Authorization Code + PKCE via a Keycloak login page redirect. For an internal staff tool this is acceptable short-term.

---

### STUB-08 · KBZ Pay deep link — no return URL handling

**File:** `apps/mobile/app/loans/[loanId].tsx`  
**Status:** 🚧 Incomplete

**What it does:** Opens `kbzpay://pay?prepay_id=XXX&merch_order_id=YYY`. After payment, KBZ app has no URL to return to — the user must manually switch back to the field app.

**What to implement:**
1. Register a custom URL scheme (e.g. `mifosfield://`) in `app.json`
2. Add `returnUrl` to the deep link
3. Handle the incoming URL in `app/_layout.tsx` via `Linking.addEventListener`

---

### STUB-09 · Dual-database architecture — PostgreSQL reporting DB is empty

**Status:** 🚧 Architectural stub — entire reporting pipeline is missing

**What it does:** The reporting service was designed to query a PostgreSQL analytics database. Fineract uses MySQL. The PostgreSQL instance contains only the Keycloak database. There is no replication, CDC, or ETL. Every reporting query returns zero because the tables are empty.

**Options:**

| Option | Effort | Recommendation |
|--------|--------|----------------|
| A: Point reporting service at MySQL directly | Low (1–2 hours) | ✅ Recommended for now |
| B: Migrate Fineract to PostgreSQL | Medium (2–3 days) | Consider if you plan to use RDS PostgreSQL |
| C: Set up Debezium CDC for MySQL → PostgreSQL sync | High (weeks) | Overkill until scale requires it |

**For Option A:** change `DATABASE_URL` env var to `mysql+aiomysql://...`, install `aiomysql`, adjust any PostgreSQL-specific SQL syntax in the routers.

---

*Last updated: June 17, 2026 · MifosX4MM — BUG-01 through BUG-07, BUG-19, STUB-03, STUB-05 resolved*
