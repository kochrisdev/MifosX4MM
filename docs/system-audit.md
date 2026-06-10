# MifosX4MM — Full System Audit

> **Purpose:** Complete codebase audit — every service, every route, every known bug or missing implementation. Use this file as your fix checklist.
> **Last audited:** 2026-06-05

---

## Quick Status Overview

| Service | Starts | Routes Work | Auth | Persistence | Production-Ready |
|---------|--------|-------------|------|-------------|-----------------|
| API Gateway | ✅ | ✅ | ✅ JWT | n/a | ❌ bugs |
| Web Portal | ✅ | ✅ | ✅ | n/a | ❌ bugs |
| Mobile App | ✅ | ✅ | ✅ | AsyncStorage | ❌ bugs |
| KYC Service | ✅ | ✅ | ❌ NONE | ❌ in-memory | ❌ stub only |
| Reporting Service | ✅ | ✅ | ❌ NONE | ✅ PostgreSQL | ❌ no auth |
| Mobile Money | ✅ | ✅ | ❌ NONE | n/a | ❌ webhook incomplete |
| Keycloak | ✅ | n/a | ✅ | ✅ | ⚠️ default creds |
| Fineract | ✅ | ✅ | ✅ | ✅ MySQL | ⚠️ default creds |

---

## Priority Fix List

### 🔴 CRITICAL — Fix Before Any Real Use

| # | Where | Issue |
|---|-------|-------|
| C1 | `apps/api/src/routes/loans.ts:15` | SQL injection via `sqlSearch` parameter |
| C2 | `services/kyc/src/routes.ts` | Zero authentication on all KYC endpoints |
| C3 | `services/reporting/main.py` | Zero authentication on all reporting endpoints |
| C4 | `services/mobile-money/src/routes.ts` | Zero authentication on all payment endpoints |
| C5 | `services/mobile-money/src/routes.ts:32` | Webhook confirmed but repayment never posted to Fineract (TODO left in code) |
| C6 | `apps/api/src/routes/payments.ts:42` | No idempotency — calling status endpoint twice posts duplicate repayment to Fineract |
| C7 | `.env` / `docker-compose.yml` | All passwords are `password`, JWT secret is `changeme_...`, KBZ Pay creds are placeholders |
| C8 | `apps/mobile/app/loans/[loanId].tsx:148` | No try/catch on `mutateAsync` — user shown success screen even when repayment POST fails |

### 🟠 HIGH — Fix Before Team Testing

| # | Where | Issue |
|---|-------|-------|
| H1 | `services/kyc/src/providers/stub.ts:6` | In-memory store — all KYC data lost on container restart |
| H2 | `services/kyc/src/index.ts:9` | Only `stub` provider exists — no real KYC provider implemented |
| H3 | `apps/api/src/routes/loans.ts:42` | Any authenticated user can post a repayment on any loan (no ownership check) |
| H4 | `apps/api/src/routes/clients.ts` | No role check on create/update client — any authenticated user can do it |
| H5 | `apps/api/src/routes/payments.ts:44` | Wrong date format — comment says `dd MMM yyyy` but code outputs `YYYY/MM/DD` |
| H6 | `apps/api/src/index.ts:14` | CORS defaults to `*` if `CORS_ORIGIN` env var is not set |
| H7 | `apps/api/src/routes/auth.ts` | No rate limiting on login endpoint — brute force possible |
| H8 | `apps/mobile/app/loans/[loanId].tsx:155` | No try/catch on KBZ Pay initiation — unhandled promise rejection crashes screen |
| H9 | `apps/mobile/app/loans/[loanId].tsx:180` | KBZ Pay deep-link params not URL-encoded — injection possible via `prepayId` |
| H10 | `services/reporting/routers/portfolio.py` | SQL uses f-string interpolation for `DATE_TRUNC` granularity (even though enum-guarded) |
| H11 | `docker-compose.yml` | Fineract, Keycloak, API, Web have no health checks — startup order not guaranteed |
| H12 | `apps/web/src/app/(protected)/collections/page.tsx` | Uses bare `fetch()` with no `.ok` check or error handling — page crashes if reporting is down |
| H13 | `apps/web/src/app/(protected)/reports/page.tsx` | Same as H12 — bare fetch, no error handling |

### 🟡 MEDIUM — Fix for Stability

| # | Where | Issue |
|---|-------|-------|
| M1 | `apps/web/src/app/(protected)/clients/[clientId]/page.tsx:80` | KYC status hardcoded to "Verified" — not read from real data |
| M2 | `apps/web/src/app/(protected)/clients/page.tsx:35` | `(window as any).__searchTimer` — unsafe global, breaks in SSR |
| M3 | `apps/web/src/app/(protected)/loans/page.tsx:16` | Same window global pattern for loan search debounce |
| M4 | `apps/web/src/lib/api.ts:6` | No axios timeout set — requests can hang forever |
| M5 | `apps/mobile/app/(tabs)/index.tsx` | `isError` state from `useQuery` not handled — blank cards shown silently |
| M6 | `apps/mobile/app/(tabs)/collections.tsx` | Error state from overdue loans query not handled |
| M7 | `apps/mobile/app/loans/[loanId].tsx:124` | KBZ Pay status poll has no error exit — retries forever at 5s intervals on failure |
| M8 | `apps/api/src/routes/clients.ts:9` | No validation on `page` / `pageSize` params — can request millions of records |
| M9 | `apps/api/src/routes/dashboard.ts` | Returns zeros silently if reporting service is down — client has no idea data is stale |
| M10 | `services/mobile-money/src/client.ts:45` | No try/catch around HTTP calls to KBZ Pay API — unhandled network failures |
| M11 | `infra/keycloak/realm-mifos.json:40` | Wildcard `*.oqtiva.ai` in redirect URIs — potential subdomain takeover |
| M12 | `packages/shared-types/src/index.ts` | `DashboardStats.collectionsToday` field shape doesn't match what `/reports/collections/today` returns |
| M13 | `services/reporting/routers/collections.py` | `days_overdue` query param has no upper bound — can trigger very heavy queries |

### 🔵 LOW — Code Quality / Nice to Have

| # | Where | Issue |
|---|-------|-------|
| L1 | `apps/api/src/plugins/keycloak.ts:70` | JWT verified twice — once in `authenticate`, again inside `authorize` |
| L2 | `apps/api/src/fineract.ts:21` | `developerMessage` from Fineract exposed in error responses |
| L3 | `apps/web/src/app/(protected)/clients/[clientId]/page.tsx` | Date conversion from `[y,m,d]` array duplicated — should be a shared util |
| L4 | `apps/mobile/app/loans/[loanId].tsx:84` | Hardcoded strings `'Active'`, `'Approved'` for loan status check — should be constants |
| L5 | `apps/mobile/app/clients/[clientId].tsx:26` | Uses `firstname`/`lastname` but web uses `displayName` — schema inconsistency |
| L6 | `services/reporting/main.py` | Generic exception handler exposes raw exception text to HTTP clients |
| L7 | `scripts/seed-fineract.ts` | Hardcoded `localhost` URL — seed fails when running inside Docker |
| L8 | `docker-compose.yml` | MySQL health check command contains `-ppassword` in plaintext in compose file |

---

## Service-by-Service Breakdown

---

### 1. API Gateway — `apps/api/src/`

#### Entry Point — `index.ts`
| What | Status | Notes |
|------|--------|-------|
| Fastify server starts | ✅ | |
| CORS registered | ⚠️ | Defaults to `*` if `CORS_ORIGIN` not set — **fix H6** |
| Keycloak plugin registered | ✅ | Adds `app.authenticate` and `app.authorize` decorators |
| Public routes (`/auth/*`) | ✅ | No JWT required |
| Protected routes | ✅ | All require valid JWT via `onRequest: [app.authenticate]` |
| Global error handler | ✅ | |
| Request timeout | ❌ | Not configured — slow-loris risk |

#### Fineract Client — `fineract.ts`
| What | Status | Notes |
|------|--------|-------|
| Axios instance created | ✅ | |
| Basic auth (username/password) | ✅ | Reads from env vars |
| Tenant header always sent | ✅ | `Fineract-Platform-TenantId: default` |
| Error interceptor | ✅ | Converts Fineract Java errors to clean objects |
| HTTPS enforcement | ❌ | No TLS cert validation config |
| Env var validation | ❌ | `FINERACT_URL` used without checking it exists |

#### Keycloak Plugin — `plugins/keycloak.ts`
| What | Status | Notes |
|------|--------|-------|
| JWKS client set up | ✅ | Caches public key 10 min |
| JWT RS256 verification | ✅ | |
| `app.authenticate` decorator | ✅ | |
| `app.authorize(roles)` decorator | ✅ | |
| Redundant JWT verify in `authorize` | ⚠️ | Verified twice — fix **L1** |
| 401 vs 403 distinction | ⚠️ | Both return same "Unauthorized" message |

#### Route: `routes/auth.ts`
| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `/api/v1/auth/login` | POST | None | ✅ Works | No rate limiting — **H7** |
| `/api/v1/auth/refresh` | POST | None | ✅ Works | No timeout on Keycloak call |
| `/api/v1/auth/logout` | POST | None | ✅ Works | Refresh token not validated before sending |
| `/api/v1/auth/me` | GET | JWT | ✅ Works | |

#### Route: `routes/clients.ts`
| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `/api/v1/clients` | GET | JWT | ✅ Works | No pagination limit validation — **M8** |
| `/api/v1/clients/:clientId` | GET | JWT | ✅ Works | |
| `/api/v1/clients` | POST | JWT | ⚠️ Works but | No role check — any user can create — **H4** |
| `/api/v1/clients/:clientId` | PUT | JWT | ⚠️ Works but | No role check — **H4** |

#### Route: `routes/loans.ts`
| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `/api/v1/loans` | GET | JWT | ❌ BUG | SQL injection in `sqlSearch` — **C1** |
| `/api/v1/clients/:clientId/loans` | GET | JWT | ⚠️ Works but | No ownership check — **H3** |
| `/api/v1/loans/:loanId` | GET | JWT | ⚠️ Works but | No ownership check — **H3** |
| `/api/v1/loans/:loanId/repayments` | POST | JWT | ⚠️ Works but | No ownership check, body passed raw — **H3** |
| `/api/v1/loans/:loanId/actions` | POST | branch_manager/super_admin | ✅ Works | Command only TypeScript-validated, not runtime |

**Fix C1 — SQL Injection:**
```typescript
// ❌ CURRENT (loans.ts:15)
if (search) params['sqlSearch'] = `l.account_no like '%${search}%'`;

// ✅ FIX — use Fineract's displayName search instead, or sanitize:
if (search) params['displayName'] = search; // no SQL interpolation
```

#### Route: `routes/payments.ts`
| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `/api/v1/payments/initiate` | POST | JWT | ⚠️ Works but | No loan ownership check — **C4 area** |
| `/api/v1/payments/status/:orderId` | GET | JWT | ❌ BUG | Duplicate repayment if called twice — **C6**; wrong date format — **H5** |

**Fix H5 — Date format:**
```typescript
// ❌ CURRENT (payments.ts:44) — produces YYYY/MM/DD, comment says dd MMM yyyy
const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');

// ✅ FIX — Fineract expects dd MMMM yyyy
const today = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'long', year: 'numeric'
}); // e.g. "05 June 2026"
```

#### Route: `routes/dashboard.ts`
| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `/api/v1/dashboard/stats` | GET | JWT | ⚠️ Works but | Returns zeros silently if reporting is down — **M9** |

---

### 2. KYC Service — `services/kyc/src/`

| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `POST /kyc/submit` | POST | ❌ NONE | ✅ Works | No auth, no input validation — **C2** |
| `GET /kyc/status/:id` | GET | ❌ NONE | ✅ Works | No auth; throws 500 (not 404) on missing ID |
| `GET /kyc/stats` | GET | ❌ NONE | ✅ Works | No auth |
| `POST /webhooks/kyc` | POST | ❌ NONE | ❌ BROKEN | No auth; stub handler throws `"Stub provider does not receive external webhooks"` |
| `GET /health` | GET | None | ✅ | |

#### Provider Status

| Provider | File | Status | Notes |
|----------|------|--------|-------|
| `stub` | `providers/stub.ts` | ✅ Works | Dev only — in-memory, auto-approves in 2s — **H1** |
| `smile_identity` | ❌ Does not exist | ❌ Not implemented | Referenced in docs, no code — **H2** |
| `onfido` | ❌ Does not exist | ❌ Not implemented | Referenced in docs, no code — **H2** |

**Fix C2 — Add auth to KYC routes:**
```typescript
// In routes.ts — add authenticate hook to each route:
app.post('/kyc/submit', { onRequest: [app.authenticate] }, async (req, reply) => { ... });
```

**Fix H1 — Persist KYC submissions:**
```typescript
// Replace in-memory Map with a DB table
// providers/stub.ts:6 — replace:
const store = new Map<string, KycSubmission>();
// With a DB query (PostgreSQL table: kyc_submissions)
```

---

### 3. Reporting Service — `services/reporting/`

| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `GET /reports/portfolio/summary` | GET | ❌ NONE | ✅ Works | No auth — **C3** |
| `GET /reports/portfolio/by-product` | GET | ❌ NONE | ✅ Works | No auth |
| `GET /reports/portfolio/disbursements` | GET | ❌ NONE | ✅ Works | No auth; f-string SQL for granularity — **H10**; no date range upper bound — **M13** |
| `GET /reports/collections/today` | GET | ❌ NONE | ✅ Works | No auth |
| `GET /reports/collections/overdue` | GET | ❌ NONE | ✅ Works | No auth; `days_overdue` has no max — **M13** |
| `GET /reports/kyc/status-breakdown` | GET | ❌ NONE | ✅ Works | No auth; silently returns `{}` if KYC service is down |
| `GET /health` | GET | None | ✅ | |

**Fix C3 — Add auth to reporting:**
```python
# main.py — add JWT middleware (FastAPI dependency injection):
from fastapi import Depends, HTTPException, Header
import httpx

async def verify_token(authorization: str = Header(...)):
    # Verify JWT against Keycloak JWKS — same RS256 logic as API gateway
    ...

# Then on each router:
router = APIRouter(dependencies=[Depends(verify_token)])
```

**Fix H10 — SQL f-string:**
```python
# ❌ CURRENT (portfolio.py)
sql = text(f"SELECT DATE_TRUNC('{trunc}', transaction_date) ...")

# ✅ FIX — trunc is already validated against an enum, but safer to use a lookup:
TRUNC_MAP = {"day": "day", "week": "week", "month": "month"}
trunc_literal = TRUNC_MAP[granularity]  # already done — just document why it's safe
```

---

### 4. Mobile Money Service — `services/mobile-money/src/`

| Route | Method | Auth | Status | Issues |
|-------|--------|------|--------|--------|
| `POST /payments/kbzpay/initiate` | POST | ❌ NONE | ✅ Works | No auth, no input validation — **C4** |
| `GET /payments/kbzpay/status/:orderId` | GET | ❌ NONE | ✅ Works | No auth |
| `POST /webhooks/kbzpay` | POST | ❌ NONE | ❌ INCOMPLETE | Signature verified, logs success, but **repayment never posted to Fineract** — **C5** |
| `GET /health` | GET | None | ✅ | |

**Fix C5 — Complete webhook handler:**
```typescript
// routes.ts:32 — current TODO:
// TODO: emit event to API gateway to post repayment to Fineract

// ✅ FIX — call Fineract directly or call API gateway:
if (result.success) {
  await axios.post(`${process.env.API_GATEWAY_URL}/api/v1/payments/confirm`, {
    orderId: result.orderId,
    transactionId: result.transactionId,
  });
}
```

---

### 5. Web Portal — `apps/web/`

#### Pages

| Page | Route | Works | Issues |
|------|-------|-------|--------|
| Login | `/login` | ✅ | |
| Dashboard | `/dashboard` | ✅ | Stats silently show 0 if reporting is down |
| Clients list | `/clients` | ✅ | Window global timer — **M2** |
| Client detail | `/clients/[clientId]` | ⚠️ | KYC status hardcoded "Verified" — **M1** |
| Loans list | `/loans` | ✅ | Window global timer — **M3** |
| Loan detail | `/loans/[loanId]` | ✅ | |
| Collections | `/collections` | ⚠️ | Bare `fetch()`, no error handling — **H12** |
| Reports | `/reports` | ⚠️ | Bare `fetch()`, no error handling — **H13** |
| Documents | `/documents` | ❌ | Placeholder "coming soon" page — not implemented |
| Settings | `/settings` | ❌ | Placeholder "coming soon" page — not implemented |

#### API Client — `apps/web/src/lib/api.ts`
| Feature | Status | Notes |
|---------|--------|-------|
| Axios instance | ✅ | |
| JWT injected on every request | ✅ | Authorization header |
| Auto token refresh on 401 | ✅ | |
| Request timeout | ❌ | Not set — **M4** |
| Refresh failure handling | ⚠️ | Redirects to `/login` with no user message |

**Fix H12/H13 — Error handling on fetch calls:**
```typescript
// ❌ CURRENT (collections/page.tsx)
const r = await fetch(`${REPORTING_URL}/reports/collections/today`);
return r.json();

// ✅ FIX
const r = await fetch(`${REPORTING_URL}/reports/collections/today`);
if (!r.ok) throw new Error(`Reporting service returned ${r.status}`);
return r.json();
```

**Fix M2 — Replace window globals with useRef:**
```typescript
// ❌ CURRENT (clients/page.tsx:35)
clearTimeout((window as any).__searchTimer);
(window as any).__searchTimer = setTimeout(...);

// ✅ FIX
const timerRef = useRef<ReturnType<typeof setTimeout>>();
clearTimeout(timerRef.current);
timerRef.current = setTimeout(...);
```

---

### 6. Mobile App — `apps/mobile/`

#### Screens

| Screen | Route | Works | Issues |
|--------|-------|-------|--------|
| Login | `/(auth)/login` | ✅ | Generic error message for all failures |
| Home / Dashboard | `/(tabs)/index` | ⚠️ | No error state displayed — **M5** |
| Clients list | `/(tabs)/clients` | ✅ | |
| Collections | `/(tabs)/collections` | ⚠️ | No error state displayed — **M6** |
| Client detail | `/clients/[clientId]` | ✅ | Uses `firstname` not `displayName` — **L5** |
| Loan detail | `/loans/[loanId]` | ⚠️ | Multiple bugs — see below |

#### Loan Detail Screen — `apps/mobile/app/loans/[loanId].tsx`
| Feature | Status | Notes |
|---------|--------|-------|
| Load loan data | ✅ | |
| Show repayment schedule (next 5) | ✅ | |
| Cash repayment flow | ❌ BUG | No try/catch — shows "success" even on API failure — **C8** |
| KBZ Pay initiation | ❌ BUG | No try/catch — unhandled rejection crashes screen — **H8** |
| KBZ Pay deep-link | ⚠️ | Params not URL-encoded — **H9** |
| KBZ Pay status polling | ⚠️ | No error exit — polls forever on failure — **M7** |
| Amount validation | ⚠️ | Checks `<= 0` but not against outstanding balance |

**Fix C8 — Cash repayment error handling:**
```typescript
// ❌ CURRENT (loans/[loanId].tsx:148)
await postRepayment.mutateAsync({ loanId, amount: amt });
setStep('success');

// ✅ FIX
try {
  await postRepayment.mutateAsync({ loanId, amount: amt });
  setStep('success');
} catch (err) {
  Alert.alert('Payment Failed', 'Could not record repayment. Please try again.');
}
```

**Fix H9 — URL encode deep-link params:**
```typescript
// ❌ CURRENT (loans/[loanId].tsx:180)
return `kbzpay://pay?prepay_id=${prepayId}&merch_order_id=${orderId}`;

// ✅ FIX
return `kbzpay://pay?prepay_id=${encodeURIComponent(prepayId)}&merch_order_id=${encodeURIComponent(orderId)}`;
```

---

### 7. Infrastructure

#### `docker-compose.yml`

| Service | Health Check | Dependency Order | Issues |
|---------|-------------|-----------------|--------|
| postgres | ✅ pg_isready | — | |
| mysql | ✅ mysqladmin ping | — | Password in healthcheck command — **L8** |
| fineract | ❌ None | depends on mysql healthy | No health check — **H11** |
| keycloak | ❌ None | depends on postgres healthy | No health check — **H11** |
| api | ❌ None | depends on fineract, keycloak | No health check — **H11** |
| web | ❌ None | depends on api | No health check — **H11** |
| mobile-money | ❌ None | ❌ No depends_on at all | — |
| kyc | ❌ None | ❌ No depends_on at all | — |
| reporting | ❌ None | depends on postgres healthy | No health check |

**All passwords are `password`, Keycloak admin is `admin` — C7**

**Add health checks (example for Fineract):**
```yaml
fineract:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/fineract-provider/actuator/health"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 120s
```

#### `.env` — Credentials Audit

| Variable | Current Value | Action Needed |
|----------|--------------|---------------|
| `FINERACT_PASSWORD` | `password` | Change to strong password |
| `KEYCLOAK_CLIENT_SECRET` | `changeme-api-secret` | Generate and rotate |
| `KBZPAY_APP_ID` | `your_app_id` | Fill with real UAT credential |
| `KBZPAY_MERCHANT_CODE` | `your_merchant_code` | Fill with real UAT credential |
| `KBZPAY_SIGN_KEY` | `your_sign_key` | Fill with real UAT credential |
| `KBZPAY_CALLBACK_URL` | `https://your-domain.com/...` | Set to real reachable URL |
| `JWT_SECRET` | `changeme_use_strong_secret...` | Generate 64-char random secret |
| `REPORTING_DB_URL` | `...mifos:password@...` | Match whatever you set for DB password |

---

### 8. Shared Types — `packages/shared-types/src/index.ts`

| Type | Status | Issue |
|------|--------|-------|
| `FineractClient` | ✅ | |
| `FineractLoanAccount` | ✅ | |
| `FineractLoanRepayment` | ✅ | |
| `KbzPayOrderParams` | ✅ | |
| `KbzPayCallbackPayload` | ⚠️ | `status` is `'0'\|'1'\|'2'` — not mapped to `KbzPayStatus` union |
| `KycSubmission` | ✅ | `providerRef` optional (acceptable for stub) |
| `KycVerificationRequest` | ✅ | |
| `DashboardStats` | ❌ | `collectionsToday` field shape doesn't match `/reports/collections/today` API response — **M12** |
| `AuthUser` | ✅ | |
| `ApiResponse<T>` | ✅ | |
| `PaginatedResponse<T>` | ✅ | |

---

## What's Not Implemented At All

These features are referenced in docs/code comments but have zero implementation:

| Feature | Where Referenced | Status |
|---------|-----------------|--------|
| Smile Identity KYC provider | `index.ts` switch, `.env` comments | ❌ No file exists |
| Onfido KYC provider | `.env` comments | ❌ No file exists |
| KBZ Pay webhook → Fineract repayment | `routes.ts:32` TODO comment | ❌ TODO left in code |
| Documents page | Web sidebar nav | ❌ "Coming soon" placeholder |
| Settings page | Web sidebar nav | ❌ "Coming soon" placeholder |
| Customer mobile self-service | Keycloak role `customer` defined | ❌ No screen exists |
| Production deployment config | README mentions it | ❌ No k8s / cloud config |
| Database migration for KYC persistence | Referenced as fix needed | ❌ No migration files |

---

## What IS Working (for local dev)

If you run `pnpm docker:up && pnpm dev && pnpm seed`:

- ✅ All 8 Docker containers start
- ✅ Web portal loads at `localhost:3000`
- ✅ Login works with `admin / Admin@1234` and `loan.officer / Officer@1234`
- ✅ Dashboard shows real KPI numbers (PAR30, active loans, clients, collections)
- ✅ Clients list, search, detail pages work
- ✅ Loans list, detail, repayment schedule work
- ✅ Approve / disburse / reject actions work (as `branch_manager` or `super_admin`)
- ✅ Cash repayment recording works
- ✅ Collections page shows overdue loans
- ✅ Reports page shows portfolio data, disbursement trend, KYC breakdown
- ✅ Mobile app home, clients, collections screens work
- ✅ Mobile cash repayment works (with the caveat that error case isn't handled)
- ✅ KYC submit/status endpoints respond (stub auto-approves)
- ✅ RBAC enforced — `loan_officer` cannot approve loans

---

## Recommended Fix Order

### Sprint 1 — Make it secure enough for team testing
1. **C1** — Fix SQL injection in `loans.ts`
2. **C2** — Add JWT auth to KYC service routes
3. **C3** — Add JWT auth to reporting service routes
4. **C4** — Add JWT auth to mobile money routes
5. **C7** — Replace all default passwords and placeholder credentials in `.env`
6. **H6** — Remove CORS `*` default

### Sprint 2 — Fix data integrity issues
7. **C5** — Complete KBZ Pay webhook → Fineract repayment flow
8. **C6** — Add idempotency to payment status endpoint
9. **C8** — Add try/catch to mobile cash repayment
10. **H1** — Persist KYC submissions to database (replace in-memory Map)
11. **H3** — Add loan ownership checks on repayment/retrieval routes
12. **H5** — Fix date format in payments route
13. **H8/H9** — Fix mobile KBZ Pay error handling and deep-link encoding

### Sprint 3 — Stability and real KYC
14. **H2** — Implement at least one real KYC provider (Smile Identity recommended for Myanmar)
15. **H11** — Add Docker health checks and proper startup ordering
16. **H12/H13** — Fix bare fetch error handling in web collections and reports pages
17. **M1** — Read real KYC status instead of hardcoding "Verified"
18. **M2/M3** — Replace window globals with useRef for search debounce
19. **M5/M6** — Add error states to mobile dashboard and collections screens
20. **M12** — Fix `DashboardStats` type to match actual API response
