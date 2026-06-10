# Database Design Overview

MifosX4MM uses **two database engines** with **three logical databases**. Apache Fineract owns all financial data in MySQL; PostgreSQL serves Keycloak's auth schema and is the direct query target for the reporting service. The KYC service has no database of its own — see the note in section 3.

---

## Storage Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────┐
│  MySQL 8.0  :3306                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  fineract_tenants          (Fineract registry DB)       │   │
│  │  fineract_default          (Tenant operational DB)      │   │
│  │    m_client · m_loan · m_loan_repayment_schedule        │   │
│  │    m_loan_transaction · m_product_loan · m_office       │   │
│  │    m_savings_account  (and ~300 other Fineract tables)  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  Written by: Apache Fineract (via its own JPA/Hibernate layer) │
│  Read by:    API Gateway (via Fineract REST) · Reporting svc   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  PostgreSQL 15  :5432                                          │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │  keycloak           │  │  fineract_default               │  │
│  │  (Keycloak schema)  │  │  (Reporting read target)        │  │
│  │  users · sessions   │  │  Same m_* table names as MySQL  │  │
│  │  realms · clients   │  │  Queried directly by reporting  │  │
│  │  role_mapping · …   │  │  service via asyncpg            │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                │
│  Written by: Keycloak (keycloak db) · Fineract (fineract_default) │
│  Read by:    Keycloak · Reporting service (asyncpg)            │
└────────────────────────────────────────────────────────────────┘
```

---

## 1. MySQL — Fineract Financial Database

### Why MySQL?

Apache Fineract ships with a Liquibase-managed MySQL schema. The project uses this as-is — Fineract is never forked. The reporting service also writes into a PostgreSQL mirror named `fineract_default`, which has the same table names but is populated and managed by Fineract pointing at the PostgreSQL host (set via `FINERACT_DEFAULT_TENANTDB_HOSTNAME`).

> **Note on the dual DB:** In `docker-compose.yml`, Fineract is configured to point at MySQL. The reporting service connects to PostgreSQL's `fineract_default` database. Both databases carry the same `m_*` schema, populated by Fineract. The PostgreSQL copy is what the reporting service queries directly — this gives it asyncpg-based async access without going through Fineract's REST layer.

### `fineract_tenants` — Registry Database

Fineract's internal registry. It holds one row per tenant and is managed entirely by Fineract. The project has a single tenant (`default`), identified by the `Fineract-Platform-TenantId: default` HTTP header sent on every API call.

| Table | Purpose |
|---|---|
| `tenants` | One row per tenant; holds JDBC connection details for the tenant DB |
| `tenant_server_connections` | Connection pool config per tenant |

### `fineract_default` — Tenant Operational Database

This is where all financial data lives. The tables below are the ones actively queried by this project; Fineract's full schema has ~300+ tables.

#### `m_office` — Branch / Office Hierarchy

Represents the organisational tree of branches. Every client and staff member belongs to an office.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `name` | VARCHAR(100) | Branch display name |
| `hierarchy` | VARCHAR(50) | Materialized path (e.g. `.1.3.`) for tree queries |
| `parent_id` | BIGINT | FK → `m_office` (NULL for root) |
| `opening_date` | DATE | When the branch opened |
| `external_id` | VARCHAR(100) | Optional external reference |

#### `m_client` — Borrower Records

The central identity record for every microfinance client/borrower.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `account_no` | VARCHAR(20) | Human-readable client reference (e.g. `0000000001`) |
| `external_id` | VARCHAR(100) | Used as the `clientRef` passed to the KYC service on submission |
| `firstname` | VARCHAR(50) | |
| `lastname` | VARCHAR(50) | |
| `display_name` | VARCHAR(100) | Derived full name; used in overdue reports |
| `mobile_no` | VARCHAR(50) | Phone number; used for KBZ Pay `customerPhone` |
| `email_address` | VARCHAR(100) | Optional |
| `date_of_birth` | DATE | Used in KYC submission |
| `status_enum` | SMALLINT | **300** = Active, 100 = Pending, 600 = Closed |
| `office_id` | BIGINT | FK → `m_office` |
| `activation_date` | DATE | When client became active |

**Key relationships:**
- `office_id → m_office.id` — places the client in a branch
- `external_id` is the value the API passes as `clientRef` when submitting a KYC request, so the KYC service knows which Fineract client a verification belongs to

#### `m_product_loan` — Loan Product Definitions

Defines the loan product templates (interest rate, repayment schedule, currency, etc.). Loans are instances of a product.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `name` | VARCHAR(100) | e.g. "Group Solidarity Loan", "Individual Agricultural" |
| `short_name` | VARCHAR(4) | Short code |
| `currency_code` | VARCHAR(3) | e.g. `MMK` |
| `principal_amount` | DECIMAL(19,6) | Default principal |
| `annual_nominal_interest_rate` | DECIMAL(19,6) | |
| `repayment_every` | SMALLINT | Repayment frequency value |
| `repayment_period_frequency_enum` | SMALLINT | **0** = Days, **1** = Weeks, **2** = Months |
| `number_of_repayments` | SMALLINT | Number of instalments |
| `interest_method_enum` | SMALLINT | **0** = Declining balance, **1** = Flat |

#### `m_loan` — Loan Accounts

The core financial entity. Each row is one loan account for one client.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `account_no` | VARCHAR(20) | Human-readable loan reference |
| `external_id` | VARCHAR(100) | Optional external identifier |
| `client_id` | BIGINT | FK → `m_client` |
| `product_id` | BIGINT | FK → `m_product_loan` |
| `loan_officer_id` | BIGINT | FK → `m_staff` |
| `loan_status_id` | SMALLINT | **100** = Submitted, **200** = Approved, **300** = Active, **600** = Closed, **700** = Written-off |
| `currency_code` | VARCHAR(3) | e.g. `MMK` |
| `principal_amount` | DECIMAL(19,6) | Requested principal |
| `approved_principal` | DECIMAL(19,6) | Amount approved |
| `principal_disbursed_derived` | DECIMAL(19,6) | Actual disbursed amount |
| `principal_outstanding_derived` | DECIMAL(19,6) | Outstanding principal (derived, updated by batch) |
| `total_outstanding_derived` | DECIMAL(19,6) | **Total outstanding** (principal + interest + fees) — used in PAR calculation |
| `disbursedon_date` | DATE | Actual disbursal date |
| `maturedon_date` | DATE | Expected maturity date |
| `interest_rate_per_period` | DECIMAL(19,6) | Per-period rate |
| `annual_nominal_interest_rate` | DECIMAL(19,6) | Annualised rate |
| `number_of_repayments` | SMALLINT | Number of instalments |
| `repay_every` | SMALLINT | Repayment frequency value |
| `repayment_period_frequency_enum` | SMALLINT | Frequency type (weeks/months) |

**Key relationships:**
- `client_id → m_client.id`
- `product_id → m_product_loan.id`

**Status lifecycle:**

```
Submitted (100) → Approved (200) → Active (300) → Closed (600)
                                               → Written-off (700)
                               ↓
                           Rejected (500)
```

The API Gateway enforces that only `branch_manager` or `super_admin` roles can call `/loans/:loanId/actions` with `command=approve|disburse|reject`.

#### `m_loan_repayment_schedule` — Instalment Schedule

One row per expected instalment for a loan. This is the table the reporting service queries directly for PAR calculations — it is more accurate than the `_derived` columns in `m_loan`, which are only updated when Fineract's batch job runs.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `loan_id` | BIGINT | FK → `m_loan` |
| `fromdate` | DATE | Period start |
| `duedate` | DATE | **Instalment due date** — used to determine overdue status |
| `installment` | SMALLINT | Instalment number (1-indexed) |
| `principal_amount` | DECIMAL(19,6) | Principal scheduled for this instalment |
| `interest_amount` | DECIMAL(19,6) | Interest scheduled |
| `fee_charges_amount` | DECIMAL(19,6) | Fees scheduled |
| `penalty_charges_amount` | DECIMAL(19,6) | Penalties scheduled |
| `principal_completed_derived` | DECIMAL(19,6) | Principal paid |
| `interest_completed_derived` | DECIMAL(19,6) | Interest paid |
| `interest_waived_derived` | DECIMAL(19,6) | Interest waived |
| `fee_charges_completed_derived` | DECIMAL(19,6) | Fees paid |
| `fee_charges_waived_derived` | DECIMAL(19,6) | Fees waived |
| `penalty_charges_completed_derived` | DECIMAL(19,6) | Penalties paid |
| `principal_writtenoff_derived` | DECIMAL(19,6) | Principal written off |
| `interest_writtenoff_derived` | DECIMAL(19,6) | Interest written off |
| `completed_derived` | BOOLEAN | **True when instalment is fully settled** |
| `obligations_met_on_date` | DATE | Date instalment was fully paid (NULL if still open) |

**How overdue is determined:**

An instalment is overdue when `duedate < CURRENT_DATE AND completed_derived = false AND obligations_met_on_date IS NULL`. The reporting service queries this table directly rather than relying on `m_loan.total_overdue_derived`, which lags behind real-time by the batch job interval.

#### `m_loan_transaction` — Loan Movement Ledger

Every financial movement against a loan — disbursements, repayments, charges, write-offs — produces a row here.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `loan_id` | BIGINT | FK → `m_loan` |
| `transaction_type_enum` | SMALLINT | **1** = Disbursement, **2** = Repayment, **5** = Waiver, **9** = Write-off |
| `transaction_date` | DATE | Effective date of the transaction |
| `amount` | DECIMAL(19,6) | Transaction amount in `currency_code` |
| `principal_portion_derived` | DECIMAL(19,6) | How much of `amount` went to principal |
| `interest_portion_derived` | DECIMAL(19,6) | How much went to interest |
| `fee_charges_portion_derived` | DECIMAL(19,6) | How much went to fees |
| `penalty_charges_portion_derived` | DECIMAL(19,6) | How much went to penalties |
| `is_reversed` | BOOLEAN | Transaction was reversed (excluded from sums) |
| `manually_adjusted_or_reversed` | BOOLEAN | Manually adjusted; also excluded from sums |
| `external_id` | VARCHAR(100) | Set to `KBZ Pay orderId` when payment comes via mobile money |

**Collections query pattern** (used by `reporting/routers/collections.py`):

```sql
-- Collected today
SELECT SUM(amount)
FROM m_loan_transaction
WHERE transaction_type_enum = 2        -- repayment
  AND transaction_date = CURRENT_DATE
  AND is_reversed = false
  AND manually_adjusted_or_reversed = false;
```

#### `m_savings_account` — Savings / Wallet Accounts

Clients may also hold savings accounts (mobile wallets or group savings). Exposed through the API via `GET /clients/:clientId/accounts`.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `account_no` | VARCHAR(20) | Human-readable reference |
| `client_id` | BIGINT | FK → `m_client` |
| `product_id` | BIGINT | FK → `m_savings_product` |
| `status_enum` | SMALLINT | **300** = Active |
| `currency_code` | VARCHAR(3) | e.g. `MMK` |
| `account_balance_derived` | DECIMAL(19,6) | Current balance |
| `available_balance` | DECIMAL(19,6) | Available (excludes holds) |

---

## 2. PostgreSQL — Auth & Reporting

PostgreSQL runs two logical databases within the same server instance.

### `keycloak` Database — Identity & Access Management

Keycloak manages all identity, authentication, and RBAC state. The project never reads or writes this database directly — Keycloak owns it entirely. It is documented here so developers understand what the PostgreSQL instance is doing beyond serving the reporting service.

**Key Keycloak concepts stored here:**

| Concept | What it stores |
|---|---|
| Realm (`mifos`) | The security domain; all users, clients, and roles belong to this realm |
| Clients | `mifos-staff` (web/mobile login), `mifos-api` (service account), `mifos-mobile` (field app) |
| Users | Staff user accounts (loan officers, branch managers, tellers, super admins) |
| Realm roles | `super_admin`, `branch_manager`, `loan_officer`, `teller`, `customer` |
| Sessions | Active SSO sessions; access token TTL = 15 min, session TTL = 10 hours |
| JWKS | RS256 signing keys; fetched by the API Gateway at startup and cached for 10 min |

**Client configuration summary:**

| Client | Flow | Used by |
|---|---|---|
| `mifos-staff` | Direct grant + standard flow | Web portal (`apps/web`), mobile app (`apps/mobile`) |
| `mifos-api` | Service account (client credentials) | API Gateway ↔ Keycloak management |
| `mifos-mobile` | Direct grant | Expo mobile app (custom scheme redirect `mifosxmobile://`) |

The API Gateway verifies tokens against the JWKS endpoint at `keycloak:8180/realms/mifos/protocol/openid-connect/certs` and maps the `realm_access.roles` claim to `UserRole[]` on `req.user`.

### `fineract_default` Database — Reporting Read Target

This is a PostgreSQL database with the same `m_*` schema as the MySQL tenant DB. The reporting service (`services/reporting`) connects to it directly via asyncpg (SQLAlchemy async engine) for all analytical queries.

**Why query PostgreSQL directly instead of using Fineract's REST API?**

1. **Accuracy** — Fineract's `_derived` columns on `m_loan` (e.g. `total_outstanding_derived`, `inArrears`) are only refreshed when the batch scheduler runs. PAR calculated from `m_loan_repayment_schedule` rows is always current.
2. **Performance** — Dashboard stats aggregate across thousands of loans. A single SQL query with a CTE is faster than N REST calls with client-side aggregation.
3. **Flexibility** — Custom PAR buckets (PAR0, PAR30, PAR90) and time-series disbursement charts are not available as Fineract REST endpoints.

**Connection details** (from `services/reporting/db.py`):

```
REPORTING_DB_URL = postgresql://mifos:password@postgres:5432/fineract_default
# asyncpg driver: postgresql+asyncpg://...
Pool: size=5, max_overflow=10, pre_ping=True
```

---

## 3. KYC Service — No Database

The KYC service has **no database**. There is no table, no schema, and no connection string for it. In the current codebase (`StubKycProvider`), submission records are held in a plain JavaScript `Map` inside the Node.js process:

```ts
// This is the entire "store" — lives in memory, gone on restart
const store = new Map<string, KycSubmission>();
```

This is intentional. The KYC service is built around a pluggable `KycProvider` interface. When you wire in a real provider (Smile Identity, Onfido, or any other), that provider runs its own cloud infrastructure — their servers store the document images, run the verification, and call your `/webhooks/kyc` endpoint with the result. The KYC service in this repo is just a thin adapter between the API Gateway and whichever provider is active.

The only data the service tracks per submission is a small status record (`submissionId`, `clientRef`, `status`, `timestamps`). In production, a real provider class would persist that in the provider's own system or a small backing table — but that is the provider implementation's concern, not the platform's.

**The one cross-service link worth knowing:** when a loan officer submits a KYC request, the API passes `m_client.external_id` as the `clientRef` field. This is just a string the KYC service echoes back — it is not a foreign key and no join is ever performed. It exists purely so that when a verification result comes back, the loan officer can look up the right client in Fineract.

---

## 4. Cross-Database Relationships

The diagram below shows all entity relationships that span service or database boundaries. Solid arrows are enforced FK constraints; dashed arrows are soft references by convention only.

```
PostgreSQL: keycloak              MySQL / PostgreSQL: fineract_default
────────────────────              ────────────────────────────────────
KC User (sub / UUID)              m_office
  │                                 │
  │ JWT: realm_access.roles         ▼ (office_id)
  │ → req.user.roles              m_client ◄─────────── clientRef (string)
  │                                 │                   passed by API on
  │ JWT: officeId (custom)          ▼ (client_id)       KYC submit — not a FK
  └── soft link ──────────►      m_loan
                                   │
                                   ▼ (loan_id)
                                 m_loan_repayment_schedule
                                 m_loan_transaction
                                   │
                                   │ note = "KBZ Pay orderId: xxx"
                                   └── soft link ──► KBZ Pay orderId
```

**Relationship summary:**

| From | To | Type | How |
|---|---|---|---|
| `m_loan.client_id` | `m_client.id` | Hard FK (MySQL) | Enforced by Fineract schema |
| `m_loan.product_id` | `m_product_loan.id` | Hard FK (MySQL) | Enforced by Fineract schema |
| `m_loan_repayment_schedule.loan_id` | `m_loan.id` | Hard FK (MySQL) | Enforced by Fineract schema |
| `m_loan_transaction.loan_id` | `m_loan.id` | Hard FK (MySQL) | Enforced by Fineract schema |
| `m_client.office_id` | `m_office.id` | Hard FK (MySQL) | Enforced by Fineract schema |
| KYC `clientRef` | `m_client.external_id` | Soft reference | Convention only — no constraint, no join |
| `m_loan_transaction.external_id` | KBZ Pay `orderId` | Soft reference | Set by API Gateway on repayment post |
| Keycloak `User.sub` | Fineract `m_staff.external_id` | Soft reference | Not yet wired — future work |

---

## 5. Key Design Decisions

### PAR is calculated from the instalment schedule, not derived columns

Fineract maintains `m_loan.total_outstanding_derived` and an `inArrears` flag, both updated by a scheduled batch job. Because batch jobs may lag, the reporting service computes PAR directly from `m_loan_repayment_schedule`:

```sql
WITH overdue_schedule AS (
    SELECT
        loan_id,
        MIN(duedate)                AS oldest_overdue_date,
        CURRENT_DATE - MIN(duedate) AS days_in_arrears,
        SUM( unpaid_principal + unpaid_interest + unpaid_fees + unpaid_penalties )
                                    AS overdue_amount
    FROM m_loan_repayment_schedule
    WHERE duedate < CURRENT_DATE
      AND completed_derived = false
      AND obligations_met_on_date IS NULL
    GROUP BY loan_id
)
-- PAR30 numerator = outstanding of loans where days_in_arrears >= 30
-- PAR30 denominator = total active portfolio outstanding
```

This gives real-time PAR figures independent of when the last batch ran.

### The reporting service never calls Fineract's REST API

The reporting service connects directly to the PostgreSQL `fineract_default` database. This avoids the overhead of Fineract's REST serialisation/deserialisation for aggregate queries and ensures calculations are deterministic regardless of Fineract's batch schedule.

### KBZ Pay payments are linked to Fineract transactions via a note field

When the API Gateway posts a confirmed KBZ Pay repayment to Fineract (`POST /loans/:loanId/transactions?command=repayment`), it sets the `note` field to `KBZ Pay orderId: {orderId}`. This creates a human-readable audit trail without requiring a separate payment ledger table. A future improvement would be to use Fineract's `externalId` field on the transaction for programmatic linkage.

### The KYC service owns no database — that is by design

The `KycProvider` interface is the boundary. Whatever sits behind it (a third-party cloud service, an internal DB, the stub in-memory map) is an implementation detail of the provider class. No other part of the system should ever need to reach into KYC storage directly.

### Keycloak owns all user credentials

No password hashes or API keys are stored in the application layer. All authentication is delegated to Keycloak. The API Gateway only ever stores the JWKS public key (in a 10-minute in-process cache) to verify token signatures.

---

## 6. Port & Connection Reference

| Service | Database | Engine | Port | URL / JDBC |
|---|---|---|---|---|
| Apache Fineract | `fineract_tenants` + `fineract_default` | MySQL 8.0 | 3306 | `jdbc:mariadb://mysql:3306/fineract_tenants` |
| Keycloak | `keycloak` | PostgreSQL 15 | 5432 | `jdbc:postgresql://postgres:5432/keycloak` |
| Reporting service | `fineract_default` | PostgreSQL 15 | 5432 | `postgresql+asyncpg://mifos:password@postgres:5432/fineract_default` |
| KYC service | none | — | — | — |

All services communicate on the `mifos_net` Docker bridge network. Database ports are exposed on `localhost` for local development but should be firewalled in production.
