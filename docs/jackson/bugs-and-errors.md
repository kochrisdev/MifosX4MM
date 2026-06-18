# MifosX4MM — Bugs & Errors Fix List

> **Project:** MifosX4MM — Myanmar Microfinance Platform  
> **Author:** Jackson (DEV006) · jackson@tamarind.tech  
> **Date:** June 15, 2026 · **Last updated:** June 17, 2026  
> **Purpose:** Full catalogue of every known bug and error across the monorepo that must be resolved before the project runs end-to-end without errors.
>
> **Progress:** BUG-01 through BUG-07 and BUG-19 have been resolved since the initial June 15 draft. All files now exist and are fully implemented. The remaining 12 bugs (BUG-08 through BUG-18, BUG-20) are still open.

---

## Table of Contents

- [Severity Key](#severity-key)
- [Summary Table](#summary-table)
- [Critical Bugs](#critical-bugs)
  - [BUG-01 · loans.ts route file missing — API cannot start](#bug-01--loansts-route-file-missing--api-cannot-start)
  - [BUG-02 · Keycloak plugin missing — JWT auth broken](#bug-02--keycloak-plugin-missing--jwt-auth-broken)
  - [BUG-03 · reporting db.py missing — service crashes on startup](#bug-03--reporting-dbpy-missing--service-crashes-on-startup)
  - [BUG-04 · portfolio.py router missing — dashboard shows zeros](#bug-04--portfoliopy-router-missing--dashboard-shows-zeros)
  - [BUG-05 · collections.py router missing — collections always zero](#bug-05--collectionspy-router-missing--collections-always-zero)
  - [BUG-06 · useClients.ts missing — web client pages crash](#bug-06--useclientsts-missing--web-client-pages-crash)
  - [BUG-07 · useLoans.ts missing — web loan pages crash](#bug-07--useloansts-missing--web-loan-pages-crash)
- [High Severity Bugs](#high-severity-bugs)
  - [BUG-08 · Duplicate repayment posting — idempotency missing](#bug-08--duplicate-repayment-posting--idempotency-missing)
  - [BUG-09 · KBZ Pay status code inconsistency](#bug-09--kbz-pay-status-code-inconsistency)
  - [BUG-10 · FineractClient.dateOfBirth wrong type](#bug-10--fineractclientdateofbirth-wrong-type)
  - [BUG-11 · FineractLoanAccount missing fields](#bug-11--fineractloanaccount-missing-fields)
  - [BUG-12 · Loan detail page — wrong field names](#bug-12--loan-detail-page--wrong-field-names)
  - [BUG-13 · Client detail page — missing fields + hardcoded KYC badge](#bug-13--client-detail-page--missing-fields--hardcoded-kyc-badge)
  - [BUG-14 · Mobile handleCash() — no try/catch](#bug-14--mobile-handlecash--no-trycatch)
  - [BUG-15 · Mobile 401 interceptor does not navigate to login](#bug-15--mobile-401-interceptor-does-not-navigate-to-login)
- [Medium Severity Bugs](#medium-severity-bugs)
  - [BUG-16 · collections/page.tsx — no fetch error handling](#bug-16--collectionspagetsxno-fetch-error-handling)
  - [BUG-17 · reports/page.tsx — no fetch error handling](#bug-17--reportspagetsxno-fetch-error-handling)
  - [BUG-18 · Mobile pagination mismatch + autoCapitalize bug](#bug-18--mobile-pagination-mismatch--autocapitalize-bug)
- [Low Severity Bugs](#low-severity-bugs)
  - [BUG-19 · Sidebar links /documents and /settings have no pages](#bug-19--sidebar-links-documents-and-settings-have-no-pages)
  - [BUG-20 · /loans/new link exists but page is missing](#bug-20--loansnew-link-exists-but-page-is-missing)

---

## Severity Key

| Level | Meaning |
|-------|---------|
| 🔴 **Critical** | Prevents the app or a service from starting / running at all |
| 🟠 **High** | A core feature is broken or produces wrong data in production |
| 🟡 **Medium** | Error handling gap — silent failures that confuse users |
| 🟢 **Low** | Cosmetic or stub — broken link / placeholder |

---

## Summary Table

| ID | Severity | Owner | Layer | Description |
|----|----------|-------|-------|-------------|
| BUG-01 | ✅ **Fixed** | Jackson | API Gateway | `loans.ts` route file — now exists, fully implemented |
| BUG-02 | ✅ **Fixed** | Jackson | API Gateway | Keycloak JWT plugin — now exists, RS256 JWKS auth |
| BUG-03 | ✅ **Fixed** | Jackson | Reporting | `db.py` — now exists, supports MySQL + PostgreSQL |
| BUG-04 | ✅ **Fixed** | Jackson | Reporting | `portfolio.py` router — now exists, full PAR SQL |
| BUG-05 | ✅ **Fixed** | Jackson | Reporting | `collections.py` router — now exists, collections + overdue |
| BUG-06 | ✅ **Fixed** | Merlin | Web | `useClients.ts` hook — now exists, fully implemented |
| BUG-07 | ✅ **Fixed** | Merlin | Web | `useLoans.ts` hook — now exists, fully implemented |
| BUG-08 | 🟠 High | Jackson | API Gateway | Duplicate Fineract repayment post (no idempotency) |
| BUG-09 | 🟠 High | Jackson | Mobile Money | KBZ Pay status code inconsistency |
| BUG-10 | 🟠 High | Jackson | Shared Types | `dateOfBirth` typed as `string`, Fineract returns `number[]` |
| BUG-11 | 🟠 High | Jackson | Shared Types | `FineractLoanAccount` missing ~8 fields |
| BUG-12 | 🟠 High | Merlin | Web | Loan detail page accesses wrong field names |
| BUG-13 | 🟠 High | Merlin | Web | Client detail page missing fields + hardcoded KYC badge |
| BUG-14 | 🟠 High | Jackson | Mobile | `handleCash()` has no try/catch |
| BUG-15 | 🟠 High | Jackson | Mobile | 401 refresh interceptor does not redirect to login |
| BUG-16 | 🟡 Medium | Merlin | Web | `collections/page.tsx` — no `r.ok` check on fetch |
| BUG-17 | 🟡 Medium | Merlin | Web | `reports/page.tsx` — no `r.ok` check on fetch |
| BUG-18 | 🟡 Medium | Jackson | Mobile | Pagination `offset/limit` vs `page/pageSize` mismatch |
| BUG-19 | ✅ **Fixed** | Merlin | Web | `/documents` and `/settings` pages — now exist (coming soon stubs) |
| BUG-20 | 🟢 Low | Merlin | Web | `/loans/new` page does not exist |

---

## Critical Bugs

---

### BUG-01 · `loans.ts` route file missing — API cannot start ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Jackson  
**File:** `apps/api/src/routes/loans.ts` — **now exists and is fully implemented**

The file implements `GET /loans`, `GET /clients/:clientId/loans`, `GET /loans/:loanId`, `POST /loans/:loanId/repayments`, and `POST /loans/:loanId/actions` (approve/disburse/reject with role-based auth). The API server can now start.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`apps/api/src/index.ts` has:

```ts
import loanRoutes from './routes/loans';
```

The file `apps/api/src/routes/loans.ts` **does not exist**. Node.js throws a `MODULE_NOT_FOUND` error at startup, which means the entire API gateway never starts. Both the web portal and mobile app are completely broken until this is fixed.

#### Fix

Create `apps/api/src/routes/loans.ts` implementing the following endpoints:

```ts
// GET  /loans/:loanId           — fetch loan detail from Fineract
// GET  /clients/:clientId/loans — list all loans for a client
// POST /loans/:loanId/repayments — post a repayment transaction
// POST /loans/:loanId/actions   — approve / disburse / reject
```

Use the existing `createFineractClient()` helper from `apps/api/src/fineract.ts` to proxy requests to Fineract.

---

### BUG-02 · Keycloak plugin missing — JWT auth broken ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Jackson  
**File:** `apps/api/src/plugins/keycloak.ts` — **now exists and is fully implemented**

The plugin fetches JWKS from Keycloak, registers `@fastify/jwt` with RS256, and decorates the Fastify instance with both `authenticate` and `authorize(roles)` hooks.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`index.ts` registers a Keycloak JWT plugin that does not exist in the repository. All protected routes call `app.authenticate` (a hook registered by this plugin) — which is also undefined. Every authenticated API request will throw.

#### Fix

Create `apps/api/src/plugins/keycloak.ts`:

1. Fetch the JWKS from Keycloak: `GET {KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/certs`
2. Register `@fastify/jwt` with algorithm `RS256` and the fetched public key
3. Decorate the Fastify instance:

```ts
fastify.decorate('authenticate', async (request, reply) => {
  await request.jwtVerify();
});
```

4. Decode the JWT payload into `request.user` matching the `AuthUser` shape from `@mifos-x/shared-types`

---

### BUG-03 · `reporting/db.py` missing — service crashes on startup ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Jackson  
**File:** `services/reporting/db.py` — **now exists**

Implementation is more robust than the original fix spec: it auto-detects whether `REPORTING_DB_URL` is a MySQL or PostgreSQL URL and applies the correct async driver prefix (`mysql+aiomysql://` or `postgresql+asyncpg://`). Uses `asynccontextmanager` pattern for session management.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`services/reporting/main.py` imports:

```python
from db import engine
```

`db.py` does not exist. The reporting service throws an `ImportError` immediately on startup. All dashboard stats and report data return zeros because the API gateway catches the connection error and degrades gracefully.

#### Root cause (also architectural)

The reporting service was originally designed to query a **PostgreSQL** instance that mirrors Fineract data. That PostgreSQL database is empty — there is no replication or CDC pipeline from Fineract's MySQL database. The fastest fix is to point the reporting service directly at MySQL.

#### Fix

Create `services/reporting/db.py` targeting MySQL:

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.environ["MYSQL_URL"]  # e.g. mysql+aiomysql://user:pass@host/fineract_tenants

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

Install dependency: `pip install aiomysql`

---

### BUG-04 · `portfolio.py` router missing — dashboard shows zeros ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Jackson  
**File:** `services/reporting/routers/portfolio.py` — **now exists**

Implements `GET /reports/portfolio/summary` (PAR0/PAR30/PAR90 calculated from raw repayment schedule), `GET /reports/portfolio/by-product`, and `GET /reports/portfolio/disbursements` (time-series with day/week/month granularity).

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`main.py` imports `from routers import portfolio`. The file does not exist → `ImportError` → reporting service cannot start → API gateway `/dashboard/stats` returns all zeros.

#### Fix

Create `services/reporting/routers/portfolio.py` with:

| Endpoint | Description |
|----------|-------------|
| `GET /reports/portfolio/summary` | Total outstanding, PAR30, PAR90, active loan count |
| `GET /reports/portfolio/by-product` | Outstanding grouped by loan product name |
| `GET /reports/portfolio/disbursements?months=12` | Monthly disbursement totals for bar chart |

Query the Fineract `m_loan` and `m_loan_repayment_schedule` tables directly via SQLAlchemy.

---

### BUG-05 · `collections.py` router missing — collections always zero ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Jackson  
**File:** `services/reporting/routers/collections.py` — **now exists**

Implements `GET /reports/collections/today` (scheduled vs collected today + collection rate) and `GET /reports/collections/overdue` (paginated overdue accounts with branch filter, sortable by days overdue).

---

~~**Original problem description below** (kept for reference)~~

#### Problem

Same import failure as BUG-04. `collectionsToday` and `collectionRate` are always `0` on the dashboard.

#### Fix

Create `services/reporting/routers/collections.py` with:

| Endpoint | Description |
|----------|-------------|
| `GET /reports/collections/today` | Sum of `m_loan_transaction.amount` where `transaction_date = today` and `transaction_type_enum = 2` (repayment) |
| `GET /reports/collections/overdue` | Loans with overdue installments — join `m_loan` + `m_loan_repayment_schedule` where `duedate < today AND completed_derived = 0` |

---

### BUG-06 · `useClients.ts` missing — web client pages crash ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Merlin  
**File:** `apps/web/src/hooks/useClients.ts` — **now exists**

Exports `useClients(search)` (infinite query), `useClient(clientId)`, and `useClientLoans(clientId)`.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`apps/web/src/app/(protected)/clients/[clientId]/page.tsx` imports:

```ts
import { useClient, useClientLoans } from '@/hooks/useClients';
```

The file does not exist → TypeScript build error → the entire web app fails to compile.

#### Fix

Create `apps/web/src/hooks/useClients.ts` exporting:

- `useClient(clientId: number)` — `useQuery` on `GET /clients/:clientId`
- `useClientLoans(clientId: number)` — `useQuery` on `GET /clients/:clientId/loans`

Use the shared `api` axios instance from `@/lib/api` and `staleTime: 30_000`.

---

### BUG-07 · `useLoans.ts` missing — web loan pages crash ✅ FIXED

**Severity:** ✅ Fixed (was 🔴 Critical)  
**Owner:** Merlin  
**File:** `apps/web/src/hooks/useLoans.ts` — **now exists**

Exports `useLoans(search)` (infinite query), `useLoan(loanId)`, `useLoanAction()` (approve/disburse/reject mutations), and `usePostRepayment()`.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

`apps/web/src/app/(protected)/loans/[loanId]/page.tsx` imports:

```ts
import { useLoan, usePostRepayment, useLoanAction } from '@/hooks/useLoans';
```

File does not exist → build failure.

#### Fix

Create `apps/web/src/hooks/useLoans.ts` exporting:

- `useLoan(loanId: number)` — `useQuery` on `GET /loans/:loanId`
- `usePostRepayment()` — `useMutation` on `POST /loans/:loanId/repayments`, invalidates `['loan', loanId]` on success
- `useLoanAction()` — `useMutation` on `POST /loans/:loanId/actions?command=...`

---

## High Severity Bugs

---

### BUG-08 · Duplicate repayment posting — idempotency missing

**Severity:** 🟠 High  
**Owner:** Jackson  
**File:** `apps/api/src/routes/payments.ts`

#### Problem

`GET /payments/status/:orderId` polls the KBZ mobile-money service and, on a successful status response, **immediately posts a repayment to Fineract**:

```ts
if (status.status === 'success') {
  await fineract.post(`/loans/${loanId}/transactions?command=repayment`, { ... });
}
```

The mobile app polls this endpoint every 5 seconds. Every single poll that returns `success` creates a **duplicate repayment entry** in Fineract. A 30-second poll window creates 6 duplicate transactions.

#### Fix

**Option A (recommended):** Move the authoritative Fineract post to the KBZ Pay webhook handler (`services/mobile-money/src/routes.ts`). The webhook fires exactly once per payment. Remove the Fineract post from the polling endpoint entirely.

**Option B:** Add an idempotency set in the API gateway. Before posting, check a Redis set (or in-memory Set for now):

```ts
if (!postedOrders.has(orderId)) {
  await fineract.post(...);
  postedOrders.add(orderId);
}
```

---

### BUG-09 · KBZ Pay status code inconsistency

**Severity:** 🟠 High  
**Owner:** Jackson  
**Files:** `services/mobile-money/src/kbzpay/client.ts`, `packages/shared-types/src/index.ts`

#### Problem

There are three contradictory status mappings:

| Location | `'0'` means | `'1'` means |
|----------|------------|------------|
| `queryOrder()` statusMap | `pending` | `success` ✅ |
| `parseCallback()` | `success` ❌ | _(not mapped)_ |
| `KbzPayCallbackPayload` type comment | `0=success` ❌ | `1=pending` ❌ |

The real KBZ Pay API uses: `1=success`, `0=pending`, `2=failed`. The callback and the type comment are both wrong.

#### Fix

1. **`client.ts` `parseCallback()`** — change `payload.status === '0'` to `payload.status === '1'`:

```ts
success: payload.status === '1',
```

2. **`shared-types/src/index.ts`** — fix the type comment:

```ts
status: '0' | '1' | '2'; // 0=pending, 1=success, 2=failed
```

---

### BUG-10 · `FineractClient.dateOfBirth` wrong type

**Severity:** 🟠 High  
**Owner:** Jackson  
**File:** `packages/shared-types/src/index.ts`

#### Problem

```ts
// Current (wrong):
dateOfBirth?: string; // yyyy-MM-dd

// Fineract actually returns:
dateOfBirth?: number[]; // [year, month, day] e.g. [1990, 5, 15]
```

The web client detail page calls `fmtDate(client.dateOfBirth)` passing a `string` to a function that expects a date array → runtime type error.

#### Fix

```ts
dateOfBirth?: number[]; // [year, month, day]
```

Update `fmtDate()` callers to handle the array:

```ts
const fmtDate = (arr?: number[]) =>
  arr ? new Date(arr[0], arr[1] - 1, arr[2]).toLocaleDateString() : '—';
```

---

### BUG-11 · `FineractLoanAccount` missing fields

**Severity:** 🟠 High  
**Owner:** Jackson  
**File:** `packages/shared-types/src/index.ts`

#### Problem

The web loan detail page and mobile loan screens access fields that do not exist on the `FineractLoanAccount` type:

| Field accessed by UI | Should be |
|----------------------|-----------|
| `loan.productName` | `loan.loanProductName` (already exists — naming alias missing) |
| `loan.totalOutstanding` (flat) | `loan.summary.totalOutstanding` |
| `loan.totalRepayment` | `loan.summary.totalRepayment` — **missing from type** |
| `loan.inArrears` | **missing from type** |
| `loan.disbursementDate` | `loan.timeline.actualDisbursementDate` |
| `loan.repaymentSchedule` | **missing from type** |
| `loan.transactions` | **missing from type** |
| `loan.currency.displaySymbol` | **missing from type** |

#### Fix

Extend `FineractLoanAccount` in `shared-types`:

```ts
export interface FineractLoanAccount {
  // ... existing fields ...
  inArrears: boolean;
  repaymentSchedule?: {
    periods: Array<{
      period: number;
      dueDate: number[];
      principalDue: number;
      interestDue: number;
      totalDue: number;
      totalPaid: number;
      totalOutstanding: number;
      complete: boolean;
    }>;
  };
  transactions?: Array<{
    id: number;
    type: { value: string };
    date: number[];
    amount: number;
    outstandingLoanBalance: number;
  }>;
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string; // add this
  };
  summary: {
    // ... existing ...
    totalRepayment: number; // add this
  };
}
```

---

### BUG-12 · Loan detail page — wrong field names

**Severity:** 🟠 High  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/loans/[loanId]/page.tsx`

#### Problem

The page accesses fields using incorrect paths:

```ts
// Wrong → Correct
loan.productName          → loan.loanProductName
loan.totalOutstanding     → loan.summary.totalOutstanding
loan.totalRepayment       → loan.summary.totalRepayment
loan.inArrears            → loan.inArrears (add to type — BUG-11)
loan.disbursementDate     → loan.timeline.actualDisbursementDate
loan.repaymentSchedule.periods → loan.repaymentSchedule?.periods
loan.transactions         → loan.transactions
```

#### Fix

Update all field accesses after BUG-11 type changes are merged. Use optional chaining (`?.`) throughout to avoid runtime errors on partially loaded data.

---

### BUG-13 · Client detail page — missing fields + hardcoded KYC badge

**Severity:** 🟠 High  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/clients/[clientId]/page.tsx`

#### Problem

1. Page accesses `client.gender` and `client.activationDate` — neither field is in `FineractClient`
2. `fmtDate(client.dateOfBirth)` is called with a value typed as `string` — will be `number[]` after BUG-10 fix
3. KYC badge is hardcoded: `<Badge label="Verified" variant="green" />` — always shows Verified regardless of actual KYC status

#### Fix

1. Add `gender?: string` and `activationDate?: number[]` to `FineractClient` type, OR remove those fields from the UI if Fineract does not return them for this tenant
2. Update `fmtDate()` call after BUG-10 is merged
3. Fetch real KYC status from `GET {KYC_SERVICE_URL}/kyc/status/{client.externalId}` and pass to Badge

---

### BUG-14 · Mobile `handleCash()` — no try/catch

**Severity:** 🟠 High  
**Owner:** Jackson  
**File:** `apps/mobile/app/loans/[loanId].tsx`

#### Problem

```ts
const handleCash = async () => {
  setSubmitting(true);
  await postRepayment.mutateAsync({ loanId, amount, date, note });
  // ← no try/catch
  setSuccess(true);
};
```

If `mutateAsync` throws (network error, Fineract 400, etc.), the error propagates uncaught, the `submitting` state is never reset to `false`, and the submit button stays disabled permanently. The user must restart the app to try again.

#### Fix

```ts
const handleCash = async () => {
  setSubmitting(true);
  try {
    await postRepayment.mutateAsync({ loanId, amount, date, note });
    setSuccess(true);
  } catch (err) {
    Alert.alert('Repayment Failed', err instanceof Error ? err.message : 'Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

---

### BUG-15 · Mobile 401 interceptor does not navigate to login

**Severity:** 🟠 High  
**Owner:** Jackson  
**File:** `apps/mobile/src/lib/api.ts`

#### Problem

The Axios response interceptor handles 401 errors by attempting a token refresh. If the refresh fails, it clears AsyncStorage and **re-throws the error** — but does not navigate the user to the login screen:

```ts
// Current:
await clearTokens();
throw error; // user stays on current screen with a broken session
```

The user sees a blank/broken screen with no way to recover except manually closing and reopening the app.

#### Fix

Import the Expo Router navigation function and redirect on refresh failure:

```ts
import { router } from 'expo-router';

// After clearing tokens:
await clearTokens();
router.replace('/(auth)/login');
throw error;
```

---

## Medium Severity Bugs

---

### BUG-16 · `collections/page.tsx` — no fetch error handling

**Severity:** 🟡 Medium  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/collections/page.tsx`

#### Problem

```ts
const res = await fetch(`${API_URL}/collections`);
const data = await res.json(); // no r.ok check
```

If the API returns a 4xx or 5xx, `res.json()` either throws or returns an error object. The UI silently stays blank or renders garbage. There is no error state shown to the user.

#### Fix

```ts
const res = await fetch(`${API_URL}/collections`);
if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`);
const data = await res.json();
```

Add an error boundary or `if (error) return <ErrorMessage />` to surface the failure.

---

### BUG-17 · `reports/page.tsx` — no fetch error handling

**Severity:** 🟡 Medium  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/reports/page.tsx`

#### Problem

All three `fetch()` calls (portfolio by product, disbursements, KYC breakdown) lack `r.ok` checks. Same silent failure pattern as BUG-16.

#### Fix

Apply the same `if (!res.ok) throw` pattern to all three fetch calls, and add per-section error states so a failure in one chart does not blank out the entire reports page.

---

### BUG-18 · Mobile pagination mismatch + `autoCapitalize` bug

**Severity:** 🟡 Medium  
**Owner:** Jackson  
**Files:** `apps/mobile/app/(tabs)/clients.tsx`, `apps/api/src/routes/clients.ts`

#### Problem

**Pagination:** The mobile clients screen sends `offset` and `limit` query params:

```ts
// Mobile sends:
{ offset: pageParam, limit: PAGE_SIZE }

// API gateway expects:
{ page: number, pageSize: number }
```

The API returns results for page 0 every time — infinite scroll never loads more data.

**autoCapitalize:** The client search `TextInput` has `autoCapitalize="words"` which auto-capitalises every word the user types. Client names in Fineract are often lowercase or mixed-case — this causes no-match results.

#### Fix

Either standardise on `offset/limit` everywhere or `page/pageSize` everywhere. Recommended: use `offset/limit` (more flexible for SQL queries in the reporting service).

```ts
// Fix mobile clients.tsx:
return api.get('/clients', { params: { offset: pageParam * PAGE_SIZE, limit: PAGE_SIZE, displayName: search } });
```

```ts
// Fix search input:
autoCapitalize="none"
```

---

## Low Severity Bugs

---

### BUG-19 · Sidebar links `/documents` and `/settings` have no pages ✅ FIXED

**Severity:** ✅ Fixed (was 🟢 Low)  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/documents/page.tsx` and `settings/page.tsx` — **both now exist**

Both pages show a "Coming soon" placeholder with an icon. No more 404 for authenticated users.

---

~~**Original problem description below** (kept for reference)~~

#### Problem

The sidebar links to `/documents` and `/settings`. No pages exist at these routes → Next.js 404 for authenticated users.

#### Fix

Create placeholder pages:

- `apps/web/src/app/(protected)/documents/page.tsx`
- `apps/web/src/app/(protected)/settings/page.tsx`

Minimal "Coming soon" content is fine until the features are designed.

---

### BUG-20 · `/loans/new` page does not exist

**Severity:** 🟢 Low  
**Owner:** Merlin  
**File:** `apps/web/src/app/(protected)/clients/[clientId]/page.tsx` line ~108

#### Problem

The client detail page has a **+ New Loan** link:

```tsx
<Link href={`/loans/new?clientId=${clientId}`}>+ New Loan</Link>
```

The route `/loans/new` does not exist → 404.

#### Fix

Create `apps/web/src/app/(protected)/loans/new/page.tsx` with a loan application form:
- Read `clientId` from search params
- Loan product selector (fetched from Fineract `GET /loanproducts`)
- Principal amount, repayment count, start date inputs
- Submit → `POST /clients/:clientId/loans`

---

*Last updated: June 17, 2026 · MifosX4MM Bug-Fix Sprint · 8 of 20 bugs resolved*
