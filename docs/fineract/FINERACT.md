# Apache Fineract — How It Works in This Project

## What is Apache Fineract?

Apache Fineract is a complete **banking core engine**. It is not a library you import — it is a **standalone Java application** (a Spring Boot server) that runs as its own process. It manages:

- **Clients** (borrowers / members)
- **Loan products, loan accounts, repayment schedules**
- **Transactions** (disbursements, repayments, write-offs)
- **Financial calculations** (interest, penalties, PAR — portfolio at risk)
- **Multi-tenancy** (one Fineract instance can serve multiple institutions)

Your app is not *using* Fineract like a library. It is *talking to* Fineract like a microservice.

---

## How Fineract Runs in This Project

From `docker-compose.yml`, Fineract runs as a Docker container (`apache/fineract:latest`) — a Spring Boot Java server listening on port 8080:

```
Browser / Mobile App
        │
  Fastify API  (port 3001, Node.js)
        │  HTTP REST  (Basic Auth)
  Apache Fineract  (port 8080, Java / Spring Boot)
        │  JDBC / JPA / Hibernate
  PostgreSQL  (port 5432)
```

---

## Why `fineract.ts` is Enough

Fineract already **does all the work**. It exposes its own REST API at `/fineract-provider/api/v1/...`. The file `apps/api/src/fineract.ts` is just a **pre-configured HTTP client** — like a remote control. All financial logic lives inside the Fineract Java server, not in your code:

```ts
// apps/api/src/fineract.ts
export function createFineractClient(): AxiosInstance {
  return axios.create({
    baseURL: process.env.FINERACT_URL,          // points to the Java server
    auth: { username, password },               // Basic Auth
    headers: { 'Fineract-Platform-TenantId' },  // which tenant's data
  });
}
```

When `routes/clients.ts` calls `fineract.get('/clients')`, it makes an HTTP GET to:

```
http://fineract:8080/fineract-provider/api/v1/clients
```

Fineract receives that, queries PostgreSQL, and returns JSON. Your app just passes it through.

---

## How Fineract Manages Its Database

Fineract uses **two PostgreSQL databases**, both managed entirely by Fineract itself:

| Database | Purpose |
|---|---|
| `fineract_tenants` | The **master registry** — lists which tenants exist and which DB to use for each |
| `fineract_default` | The **tenant database** — all actual financial data for the `default` tenant |

Fineract manages its schema with **Liquibase** (a Java DB migration tool). On startup it automatically creates and migrates all its own tables — you never write SQL for Fineract's schema. The tables it owns all use the `m_` prefix (short for "Mifos"):

| Table | What it stores |
|---|---|
| `m_client` | Borrower records |
| `m_loan` | Loan accounts and their status |
| `m_loan_repayment_schedule` | Each repayment installment per loan |
| `m_loan_transaction` | Disbursements, repayments, write-offs |
| `m_product_loan` | Loan product definitions (interest rate, term, etc.) |

Fineract's Liquibase fills `fineract_default` with ~200+ tables on first boot automatically.

---

## The Single Database Engine

This project uses **only PostgreSQL**. There is no MySQL.

```
PostgreSQL (port 5432)
├── fineract_tenants  ← Fineract's tenant registry
├── fineract_default  ← All financial data (Fineract writes, Reporting reads)
└── keycloak          ← User auth data (managed by Keycloak)
```

- **Fineract** writes all loan and client data into `fineract_default`
- **Reporting service** reads from `fineract_default` using raw SQL
- **Keycloak** manages `keycloak` independently
- **MySQL is not used**

---

## The Two Ways This Project Reads Fineract Data

### 1. Via REST API (writes and individual record reads)

The Fastify API calls Fineract's REST endpoints. Fineract enforces all business rules, updates PostgreSQL, and returns the result.

| Route | What it calls on Fineract |
|---|---|
| `GET /clients` | `GET /fineract.../clients` |
| `GET /clients/:id` | `GET /fineract.../clients/:id` |
| `POST /clients` | `POST /fineract.../clients` |
| `GET /loans` | `GET /fineract.../loans` |
| `GET /loans/:id` | `GET /fineract.../loans/:id?associations=repaymentSchedule,transactions` |
| `POST /loans/:id/repayments` | `POST /fineract.../loans/:id/transactions?command=repayment` |
| `POST /loans/:id/actions` | `POST /fineract.../loans/:id?command=approve\|disburse\|reject` |

After a successful KBZ Pay mobile payment, `routes/payments.ts` also posts a repayment back to Fineract to keep the loan balance in sync.

### 2. Via Direct SQL (reporting and analytics)

The Python **reporting service** (`services/reporting`) connects **directly to PostgreSQL `fineract_default`** using SQLAlchemy and runs raw SQL SELECT queries against Fineract's internal tables:

```python
# reads directly from Fineract's own tables in PostgreSQL
SELECT COUNT(l.id), SUM(l.total_outstanding_derived)
FROM m_loan l
LEFT JOIN m_loan_repayment_schedule ...
WHERE l.loan_status_id = 300  -- 300 = Active in Fineract's internal enum
```

This avoids making dozens of slow REST calls to build a dashboard. The trade-off is tight coupling to Fineract's internal schema — which is why the reporting code has comments like `-- Loan status 300 = Active` (magic numbers from Fineract's internal enums).

---

## Error Handling

The `fineract.ts` client has a response interceptor that unwraps Fineract's error format into a plain JavaScript error:

```ts
// Fineract errors look like: { errors: [{ developerMessage: "..." }] }
// The interceptor converts this to a standard JS Error with the HTTP status attached.
(error as any).status = status;
return Promise.reject(new Error(`Fineract ${status}: ${message}`));
```

The Fastify error handler in `apps/api/src/index.ts` then forwards the status code back to the client.

---

## Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Apache Fineract  (Java / Spring Boot, port 8080)            │
│                                                              │
│  Business Logic: loan lifecycle, interest, repayments, PAR   │
│  Liquibase:       auto-manages DB schema on startup          │
│                         │                                    │
│                   JPA / Hibernate                            │
│                         │                                    │
│  PostgreSQL:  fineract_tenants  +  fineract_default          │
│  Tables: m_loan, m_client, m_loan_transaction, ...           │
└──────────────┬───────────────────────────────┬───────────────┘
               │ REST API (Basic Auth)          │ Direct SQL (read-only)
   ┌───────────▼───────────┐       ┌────────────▼────────────┐
   │  Fastify API          │       │  Reporting Service      │
   │  apps/api/src/        │       │  services/reporting/    │
   │  fineract.ts          │       │  (Python / SQLAlchemy)  │
   └───────────┬───────────┘       └─────────────────────────┘
               │ JWT-protected REST
   ┌───────────▼───────────┐
   │  Web App  (Next.js)   │
   │  Mobile App  (Expo)   │
   └───────────────────────┘
```

---

## Key Takeaway

**Fineract is the bank's brain.** Your code is a UI and orchestration layer built on top of it. The `fineract.ts` file is small on purpose — there is no financial logic to write because Fineract already implements it. You only configure how to reach it (URL, credentials, tenant) and let it do its job.
