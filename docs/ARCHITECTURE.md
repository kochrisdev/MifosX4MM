# Architecture

## Design Principles

1. **Fineract as engine, not framework** — Apache Fineract is accessed only through its REST API. It is never forked or modified. All custom business logic lives in the gateway and services layer.
2. **Single source of truth for financial data** — PostgreSQL (Fineract's database) is authoritative. The reporting service queries it directly for accuracy; it does not re-derive figures from the REST API.
3. **Pluggable third-party integrations** — KYC providers and payment methods implement typed interfaces. Swapping vendors requires adding one file, not refactoring call sites.
4. **JWT-first auth** — All protected routes verify RS256-signed JWTs against Keycloak's JWKS endpoint. No API keys are passed between services in the hot request path.

---

## Component Responsibilities

### `apps/api` — API Gateway (Fastify)

The single entry point for all clients (web, mobile). Responsibilities:

- **Auth**: validates Keycloak JWTs; exposes `POST /auth/login`, `/auth/refresh`, `/auth/logout`
- **RBAC**: `authorize(['branch_manager', 'super_admin'])` decorator enforces role checks at the route level
- **Fineract proxy**: transforms Fineract's verbose responses into clean paginated shapes
- **Payment orchestration**: calls the mobile-money service to create KBZ Pay orders; posts confirmed repayments back to Fineract
- **Dashboard aggregation**: fans out to the reporting service for portfolio and collections stats

### `apps/web` — Staff Portal (Next.js 14)

- App Router with server components for layout; client components for data-fetching pages
- React Query handles all data fetching with 30 s stale time and 1-minute auto-refresh on the dashboard
- `src/middleware.ts` guards all routes — redirects to `/login` if the `accessToken` cookie is absent
- Silent token refresh on 401 via axios interceptor

### `apps/mobile` — Field App (Expo React Native)

- Expo Router (file-based navigation) with `(auth)` and `(tabs)` route groups
- `AuthContext` handles login state; `NavigationGuard` redirects unauthenticated users
- Tokens persisted in `AsyncStorage`; silent refresh on 401 mirrors web behaviour
- KBZ Pay payment initiated via `Linking.openURL("kbzpay://pay?prepay_id=...")`, with 5-second polling on return

### `services/mobile-money` — KBZ Pay Service (Fastify)

- `KbzPayClient` encapsulates all KBZ Pay API calls: `createOrder`, `queryOrder`, `parseCallback`
- Signature utility (`HMAC-SHA256`) is isolated in `kbzpay/signature.ts` and tested separately
- Exposes three routes: initiate, status query, and the webhook receiver
- The webhook verifies signature before trusting payload; logs mismatches without crashing

### `services/kyc` — KYC Service (Fastify)

- `KycProvider` interface has four methods: `submit`, `getStatus`, `handleWebhook`, `getStats`
- `StubKycProvider` keeps an in-memory map; auto-approves after 2 s for development
- Real providers (Smile Identity, Onfido) implement the same interface; active provider is selected by `KYC_PROVIDER` env var at startup

### `services/reporting` — Reporting API (Python FastAPI)

- Connects directly to Fineract's PostgreSQL database via SQLAlchemy async + asyncpg
- **No Fineract REST calls** — all financial figures come from direct SQL for accuracy and performance
- PAR calculations use a CTE on `m_loan_repayment_schedule` to find loans with unpaid past-due installments
- KYC summary is fetched from the KYC service via httpx (that data lives in the KYC service, not Fineract's DB)

---

## Key Data Flows

### 1. Staff Login

```
Web browser
  → POST /api/v1/auth/login  {username, password}
  → Fastify gateway
  → POST keycloak:8180/realms/mifos/.../token  (grant_type=password)
  ← access_token (RS256 JWT, 15 min TTL)  +  refresh_token
  ← stores tokens in localStorage + accessToken cookie
  → GET /api/v1/auth/me  (verifies JWT against JWKS)
  ← AuthUser  {id, username, roles}
```

### 2. Loan Repayment via KBZ Pay

```
Mobile app
  → POST /api/v1/payments/initiate  {loanId, amount, customerName, customerPhone}
  → API gateway
  → POST mobile-money:3003/payments/kbzpay/initiate
  → KBZ Pay /precreate  (signed with HMAC-SHA256)
  ← prepayId + orderId

  Mobile app opens  kbzpay://pay?prepay_id=<prepayId>
  Customer pays in KBZ Pay app

KBZ Pay server
  → POST mobile-money:3003/webhooks/kbzpay  (signed callback)
  → signature verified
  → [event forwarded to API gateway — TODO: message bus]

  Meanwhile, mobile app polls every 5 s:
  → GET /api/v1/payments/status/<orderId>?loanId=<id>
  → API gateway → mobile-money service → KBZ Pay /query
  On success:
  → POST fineract:8080/.../loans/<loanId>/transactions?command=repayment
  ← Fineract transaction ID
  ← mobile app shows success screen
```

### 3. KYC Submission

```
Loan officer (mobile app)
  → POST /api/v1/kyc/submit  {clientRef, documentType, images...}
  → KYC service
  → Provider.submit()  →  stub: auto-approves after 2 s
                           real: Smile Identity / Onfido API call
  ← submissionId + status: "processing"

Provider (async)
  → POST kyc:3004/webhooks/kyc  {submissionId, status: "approved"}
  → [future: update Fineract client document status]

Reporting service
  → GET kyc:3004/kyc/stats
  ← {pending, processing, approved, rejected, manual_review, total}
```

### 4. Dashboard Stats Load

```
Browser → GET /api/v1/dashboard/stats
  → API gateway
  → Promise.allSettled([
      GET reporting:3005/reports/portfolio/summary,
      GET reporting:3005/reports/collections/today
    ])
  → reporting service queries PostgreSQL:
      portfolio/summary:
        WITH overdue_schedule AS (...)  -- CTE on m_loan_repayment_schedule
        SELECT ... FROM m_loan LEFT JOIN overdue_schedule ...
        WHERE loan_status_id = 300
      collections/today:
        SELECT SUM(amount) FROM m_loan_transaction
        WHERE transaction_type_enum = 2
          AND transaction_date = CURRENT_DATE
          AND is_reversed = false
  ← {activeClients, activeLoans, par0, par30, par90, totalOutstanding,
     totalOverdue, collectionsToday, collectionRate}
```

---

## Database Schema (Key Tables)

All tables are in the `fineract_default` PostgreSQL database (`public` schema).

### `m_loan` — Loan accounts

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `account_no` | VARCHAR | Human-readable reference |
| `client_id` | BIGINT | FK → m_client |
| `product_id` | BIGINT | FK → m_product_loan |
| `loan_status_id` | SMALLINT | **300** = Active, 600 = Closed |
| `principal_disbursed_derived` | DECIMAL | Actual disbursed amount |
| `principal_outstanding_derived` | DECIMAL | Outstanding principal |
| `total_outstanding_derived` | DECIMAL | Total outstanding (principal + interest + fees) |
| `disbursedon_date` | DATE | Actual disbursal date |
| `currency_code` | VARCHAR | e.g. `MMK` |

### `m_loan_repayment_schedule` — Installment schedule

| Column | Type | Notes |
|---|---|---|
| `loan_id` | BIGINT | FK → m_loan |
| `duedate` | DATE | Installment due date |
| `completed_derived` | BOOLEAN | True when installment is fully paid |
| `obligations_met_on_date` | DATE | Date paid (NULL if unpaid) |
| `principal_amount` | DECIMAL | Principal due this installment |
| `interest_amount` | DECIMAL | Interest due |
| `principal_completed_derived` | DECIMAL | Principal paid |
| `interest_completed_derived` | DECIMAL | Interest paid |

### `m_loan_transaction` — All loan movements

| Column | Type | Notes |
|---|---|---|
| `loan_id` | BIGINT | FK → m_loan |
| `transaction_type_enum` | SMALLINT | **1** = Disbursement, **2** = Repayment |
| `transaction_date` | DATE | Effective date |
| `amount` | DECIMAL | Transaction amount |
| `is_reversed` | BOOLEAN | True if reversed |
| `manually_adjusted_or_reversed` | BOOLEAN | True if manually adjusted |

### `m_client` — Borrower records

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `account_no` | VARCHAR | Human-readable reference |
| `display_name` | VARCHAR | Full display name |
| `status_enum` | INT | 300 = Active |
| `office_id` | BIGINT | FK → m_office (branch) |
| `mobile_no` | VARCHAR | Phone number |

---

## PAR Calculation Method

PAR (Portfolio at Risk) is calculated using a CTE that identifies the **oldest unpaid past-due installment** per loan.

```sql
WITH overdue_schedule AS (
    SELECT
        loan_id,
        MIN(duedate)                AS oldest_overdue_date,
        CURRENT_DATE - MIN(duedate) AS days_in_arrears,
        SUM( /* unpaid amounts */ ) AS overdue_amount
    FROM m_loan_repayment_schedule
    WHERE duedate < CURRENT_DATE
      AND completed_derived = false
      AND obligations_met_on_date IS NULL
    GROUP BY loan_id
)
-- PAR30 = outstanding of loans where days_in_arrears >= 30
--         / total active portfolio outstanding * 100
```

This is more accurate than Fineract's REST-derived `inArrears` flag, which only updates after a scheduled batch job runs.

---

## Auth Architecture

```
Keycloak realm: mifos
  ├── Client: mifos-staff    (public, direct grant — web + mobile login)
  └── Client: mifos-api      (confidential, service account — gateway-to-Keycloak)

Verification flow:
  Request  →  Fastify gateway
  gateway  →  JWKS endpoint  (keycloak:8180/realms/mifos/.../certs)
  jwks-rsa caches signing key (10 min TTL)
  JWT verified: issuer + algorithm (RS256) + expiry
  req.user populated: {id, username, email, roles}
```

Token lifetimes (configurable in Keycloak):
- Access token: **15 minutes**
- SSO session: **10 hours**
- Clients handle silent refresh on 401

---

## Service Communication

```
Service         Calls                            Protocol
───────────────────────────────────────────────────────────
api             fineract                         HTTP (Basic auth)
api             mobile-money                     HTTP (internal)
api             reporting                        HTTP (internal)
reporting       postgres (fineract_default)      asyncpg / TCP
reporting       kyc                              HTTP (internal)
kyc             [provider API]                   HTTPS
mobile-money    KBZ Pay                          HTTPS
keycloak        postgres (keycloak DB)           JDBC / TCP
```

All inter-service calls are on the `mifos_net` Docker bridge network in development. In production, replace with a service mesh or internal load balancer.
