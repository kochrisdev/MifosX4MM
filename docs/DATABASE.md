# Database Design — MifosX4MM

> Written for developers who are new to databases and want to understand every detail of how this project stores and reads data.

---

## Table of Contents

1. [The Big Picture — Why Two Databases?](#1-the-big-picture--why-two-databases)
2. [MySQL — Fineract's Database](#2-mysql--finaracts-database)
3. [PostgreSQL — Keycloak + Reporting](#3-postgresql--keycloak--reporting)
4. [The Write/Read Split Explained](#4-the-writeread-split-explained)
5. [Why Not Just Read From MySQL?](#5-why-not-just-read-from-mysql)
6. [The Real-Time Reporting Problem](#6-the-real-time-reporting-problem)
7. [Key Database Tables](#7-key-database-tables)
8. [SQL Constants You Will See Everywhere](#8-sql-constants-you-will-see-everywhere)
9. [How Data Flows Through the System](#9-how-data-flows-through-the-system)
10. [Connection Strings and Configuration](#10-connection-strings-and-configuration)
11. [Quick Reference](#11-quick-reference)

---

## 1. The Big Picture — Why Two Databases?

Before getting into details, here is the key concept to hold in your head:

> **This project did not choose to use two databases because it is fashionable. It uses two databases because it has two completely separate concerns that happen to need different tools.**

Think of it like a bank branch:

- The **teller's system** (MySQL) handles live transactions — opening accounts, approving loans, recording payments. It must be fast, consistent, and correct at all times.
- The **manager's reports** (PostgreSQL) handle analytics — how many loans are overdue, what is the portfolio performance this month, how much was collected today. These need flexibility and real-time accuracy that the teller's system cannot provide.

In this project:
- **MySQL** is owned by **Apache Fineract** — the core banking engine. Fineract writes all loan and client data here.
- **PostgreSQL** is used by **Keycloak** (authentication) and the **Reporting service** (analytics). The reporting service reads Fineract's data from here for portfolio and collections reports.

---

## 2. MySQL — Fineract's Database

### What is it?

MySQL is a **relational database** — data is stored in tables with rows and columns, like Excel spreadsheets, but with strict rules and relationships between tables.

### Why does Fineract use MySQL?

Apache Fineract is a mature, open-source **core banking platform** written in Java. It was built years ago when MySQL was the standard choice for financial applications. Fineract requires MySQL — you cannot swap it out. It is a black box: you hand it data through its REST API, and it manages its own MySQL schema internally.

### What databases are inside MySQL?

| Database name | Purpose |
|---|---|
| `fineract_tenants` | Stores the list of "tenants" (organisations using Fineract). Even in single-tenant mode this is required. |
| `fineract_default` | The actual financial data — all clients, loans, repayments, transactions, products, branches. |

### Who manages the MySQL schema?

**Fineract manages it — not you.** Fineract uses a tool called **Liquibase** to automatically create and update all its tables when it boots. The rule is simple: never write SQL directly against MySQL. You should only talk to Fineract through its REST API at port `8080`.

### Port and credentials

| Setting | Value |
|---|---|
| Port | `3306` |
| Root password | `password` |
| Init script | `infra/mysql/init.sql` |

The init script just pre-creates the `fineract_default` database so Fineract does not need root privileges to create it:

```sql
CREATE DATABASE IF NOT EXISTS fineract_default
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

`utf8mb4` is important — it supports all Unicode characters including emojis and Myanmar script (this is a Myanmar-focused microfinance app).

---

## 3. PostgreSQL — Keycloak + Reporting

### What is PostgreSQL?

PostgreSQL (also called "Postgres") is another relational database, but it is more powerful than MySQL for complex analytical queries. It supports advanced SQL features like **CTEs (Common Table Expressions)**, window functions, and better concurrency handling.

### What databases are inside PostgreSQL?

| Database name | Purpose |
|---|---|
| `keycloak` | Stores all authentication data — users, roles, sessions, tokens. Managed entirely by Keycloak. |
| `fineract_default` | A second copy of the name but in Postgres — used by the Reporting service to run analytics queries. |

### Why is the reporting database also called `fineract_default`?

This is just a naming convention — it mirrors the MySQL database name so the reporting service knows it is working with Fineract's data. They are two separate databases on two separate database engines.

### Port and credentials

| Setting | Value |
|---|---|
| Port | `5432` |
| User | `mifos` |
| Password | `password` |
| Init script | `infra/postgres/init.sql` |

The init script creates the Keycloak database and grants permissions:

```sql
CREATE DATABASE keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO mifos;
```

The `fineract_default` Postgres database is created and populated by Fineract itself when it connects via PostgreSQL drivers.

---

## 4. The Write/Read Split Explained

This is the most important concept in the database design. Here is the flow in plain English:

```
USER ACTION (e.g. approve a loan)
    │
    ▼
Web App or Mobile App
    │
    ▼
API Gateway (Fastify, port 3001)
    │
    ▼
Apache Fineract REST API (port 8080)   ← WRITES happen here
    │
    ▼
MySQL fineract_default                  ← DATA is stored here


MANAGER VIEWS REPORTS
    │
    ▼
Web App
    │
    ▼
API Gateway
    │
    ▼
Reporting Service (FastAPI, port 3005)  ← READS happen here
    │
    ▼
PostgreSQL fineract_default             ← DATA is read from here
```

**Writes go to MySQL via Fineract.**
**Reads (for reports) go directly to PostgreSQL.**

---

## 5. Why Not Just Read From MySQL?

This is the question every developer asks first. The answer has three parts:

### Part A — You cannot safely query Fineract's MySQL directly

Fineract's MySQL schema is **owned by Fineract**. Fineract can change the schema whenever it upgrades. If you build reports by directly querying MySQL, your SQL queries will break every time Fineract releases a new version. The rule is: access Fineract data through its API or through a controlled read layer — not directly.

### Part B — Fineract's REST API is slow for analytics

Fineract's REST API is designed for **transactional operations** — create a loan, approve a loan, record a payment. It is not designed for analytical questions like "show me all loans overdue by more than 30 days across all branches, grouped by product type." To answer that question through the API, you would need to make dozens of individual API calls and combine the results in code. That is slow and fragile.

Raw SQL against the database can answer that same question in a single query in milliseconds.

### Part C — Fineract's REST API returns stale data for overdue calculations

This is the deepest reason, explained next.

---

## 6. The Real-Time Reporting Problem

This is the core reason the reporting service exists and why it reads from PostgreSQL directly.

### What is the `inArrears` flag?

Inside Fineract's database, every loan has a flag called `inArrears`. When this flag is `true`, it means the loan is overdue. Loan officers and managers rely on this flag to identify problem loans.

### The problem: batch jobs

Fineract **does not update `inArrears` in real time**. Instead, it runs a **batch job** — a scheduled task — once per day (usually overnight) that recalculates which loans are overdue and updates the flag.

This means:

- A loan becomes overdue at 9:00 AM
- A manager asks "how many loans are overdue?" at 11:00 AM
- Fineract's API says "zero" — because the batch job has not run yet
- The batch job runs at midnight
- Now Fineract says the loan is overdue

**For a microfinance institution in Myanmar, this is a serious problem.** Loan officers need to know which clients to call today, not tomorrow.

### The solution: direct SQL with CTEs

The reporting service solves this by calculating overdue status **in real time** using raw SQL. Instead of trusting the `inArrears` flag, it runs a SQL query that looks at the repayment schedule directly:

```
"Is today past the due date for this installment?
Has the installment been paid?
If today > due date AND not paid → this loan IS overdue right now."
```

This CTE (Common Table Expression) pattern gives accurate real-time data regardless of when the batch job last ran.

Here is a simplified version of what the reporting service does:

```sql
WITH overdue_loans AS (
  SELECT
    loan_id,
    duedate,
    CURRENT_DATE - duedate AS days_overdue,
    principal_amount - principal_completed_derived AS outstanding_principal
  FROM m_loan_repayment_schedule
  WHERE duedate < CURRENT_DATE          -- due date has passed
    AND completed_derived = false        -- not yet paid
    AND obligations_met_on_date IS NULL  -- not waived
)
SELECT * FROM overdue_loans;
```

This is only possible because the reporting service connects **directly to the database** rather than going through Fineract's API.

### Why PostgreSQL specifically for this?

PostgreSQL is used here because:
1. It has better support for complex CTEs and window functions than MySQL
2. `asyncpg` (the Python library used) is one of the fastest PostgreSQL drivers available — it handles many concurrent requests efficiently
3. PostgreSQL is already running in the project for Keycloak, so no new infrastructure is needed

---

## 7. Key Database Tables

These are the Fineract tables the reporting service reads from. All table names starting with `m_` are Fineract's own tables (the `m_` prefix is Fineract's naming convention).

### `m_loan` — Loan Records

The central table. Every loan ever created has a row here.

| Column | Type | Meaning |
|---|---|---|
| `id` | integer | Unique loan ID |
| `account_no` | string | Human-readable loan number (e.g. `L-000123`) |
| `client_id` | integer | Links to `m_client` |
| `product_id` | integer | Links to `m_product_loan` |
| `loan_status_id` | integer | Current status — see status codes below |
| `principal_disbursed_derived` | decimal | Original loan amount |
| `total_outstanding_derived` | decimal | How much is still owed |
| `currency_code` | string | Currency (e.g. `MMK` for Myanmar Kyat) |

### `m_loan_repayment_schedule` — Payment Schedule

Every loan is broken into installments. Each installment is a row here.

| Column | Type | Meaning |
|---|---|---|
| `loan_id` | integer | Links to `m_loan` |
| `duedate` | date | When this installment is due |
| `principal_amount` | decimal | Principal portion of this installment |
| `interest_amount` | decimal | Interest portion |
| `fee_charges_amount` | decimal | Fees |
| `penalty_charges_amount` | decimal | Penalties |
| `completed_derived` | boolean | `true` if this installment is fully paid |
| `principal_completed_derived` | decimal | How much principal has been paid |
| `interest_completed_derived` | decimal | How much interest has been paid |
| `obligations_met_on_date` | date | Date it was paid (null if not paid) |

This is the most important table for overdue calculations. The reporting service scans this table to find installments where `duedate < today` and `completed_derived = false`.

### `m_loan_transaction` — Individual Transactions

Every disbursement, repayment, or adjustment is recorded here.

| Column | Type | Meaning |
|---|---|---|
| `loan_id` | integer | Links to `m_loan` |
| `transaction_type_enum` | integer | Type of transaction — see constants |
| `transaction_date` | date | When this happened |
| `amount` | decimal | Amount |
| `is_reversed` | boolean | `true` if this transaction was cancelled/reversed |
| `manually_adjusted_or_reversed` | boolean | `true` if manually corrected |

### `m_client` — Client Records

Every borrower is a client.

| Column | Type | Meaning |
|---|---|---|
| `id` | integer | Unique client ID |
| `display_name` | string | Full name |
| `mobile_no` | string | Phone number (used for SMS/KBZ Pay) |
| `office_id` | integer | Branch the client belongs to |

### `m_product_loan` — Loan Products

Loan products define the terms available (e.g. "3-Month Agricultural Loan", "6-Month Business Loan").

| Column | Type | Meaning |
|---|---|---|
| `id` | integer | Unique product ID |
| `name` | string | Product name |

---

## 8. SQL Constants You Will See Everywhere

Fineract uses integer codes instead of text strings for status and type fields. When you read SQL queries in the reporting service, you will see these numbers. Here is what they mean:

### Loan Status Codes (`m_loan.loan_status_id`)

| Code | Meaning |
|---|---|
| `100` | Submitted and pending approval |
| `200` | Approved |
| `300` | **Active** — disbursed and currently running |
| `400` | Withdrawn by client |
| `500` | Rejected |
| `600` | Closed — fully repaid |
| `700` | Closed (written off) |

The reporting service almost always filters `WHERE loan_status_id = 300` because it only cares about active loans.

### Transaction Type Codes (`m_loan_transaction.transaction_type_enum`)

| Code | Meaning |
|---|---|
| `1` | Disbursement — money sent to client |
| `2` | **Repayment** — client paid an installment |
| `3` | Contra |
| `4` | Waive interest |
| `5` | Apply charges |
| `6` | Apply overdue charges |
| `7` | Recovery repayment |

The reporting service uses `transaction_type_enum = 2` to find all repayments for collection reports.

---

## 9. How Data Flows Through the System

Here is the complete lifecycle of a loan, showing exactly when each database is touched:

### Loan Application

```
Loan Officer (Web App)
    → POST /api/v1/loans  (API Gateway)
    → POST /fineract-api/v1/loans  (Fineract REST)
    → INSERT into MySQL m_loan  (Fineract writes)
```

### Loan Approval

```
Branch Manager (Web App)
    → POST /api/v1/loans/:id/approve  (API Gateway)
    → POST /fineract-api/v1/loans/:id  (Fineract REST)
    → UPDATE MySQL m_loan SET loan_status_id = 200
```

### Disbursement

```
Teller (Web App)
    → POST /api/v1/loans/:id/disburse  (API Gateway)
    → Fineract creates disbursement transaction
    → INSERT into MySQL m_loan_transaction (type=1)
    → UPDATE MySQL m_loan SET loan_status_id = 300
    → INSERT into MySQL m_loan_repayment_schedule (all future installments)
```

### Client Makes a Payment (KBZ Pay)

```
Client (Mobile App)
    → POST /api/v1/payments/initiate  (API Gateway)
    → Mobile Money Service calls KBZ Pay API
    → KBZ Pay calls back our webhook
    → Webhook logs payment (but does NOT post to Fineract yet — known gap)
    → Client polls GET /payments/status/:orderId
```

### Manager Views Portfolio Report

```
Manager (Web App)
    → GET /api/v1/dashboard  (API Gateway)
    → GET /reports/portfolio/summary  (Reporting Service)
    → SELECT from PostgreSQL m_loan, m_loan_repayment_schedule
    → Real-time PAR calculated via CTE
    → JSON response returned
```

### Login / Authentication

```
Any user
    → POST /api/v1/auth/login  (API Gateway)
    → API Gateway calls Keycloak at :8180
    → Keycloak checks credentials against PostgreSQL keycloak database
    → Returns JWT access token + refresh token
    → API Gateway sets accessToken cookie + returns tokens
```

---

## 10. Connection Strings and Configuration

### Reporting Service (Python/FastAPI)

File: `services/reporting/db.py`

```
REPORTING_DB_URL=postgresql://mifos:password@localhost:5432/fineract_default
```

Breakdown:
- `postgresql://` — using PostgreSQL protocol
- `mifos` — username
- `password` — password
- `localhost:5432` — host and port (inside Docker it would be `postgres:5432`)
- `fineract_default` — database name

The reporting service uses **asyncpg** — an asynchronous PostgreSQL driver. "Asynchronous" means it can handle multiple requests at the same time without waiting for one database query to finish before starting the next.

### Keycloak

Keycloak connects to PostgreSQL automatically using these environment variables set in `docker-compose.yml`:

```
KC_DB=postgres
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=mifos
KC_DB_PASSWORD=password
```

### Fineract

Fineract connects to both MySQL and PostgreSQL (its configuration supports multiple datasources). The primary operational data goes to MySQL; the `fineract_default` database on PostgreSQL is available for the reporting service.

---

## 11. Quick Reference

### Which database for which service?

| Service | Database | Why |
|---|---|---|
| Apache Fineract | MySQL `fineract_default` | Fineract requires MySQL; writes all loan/client data here |
| Keycloak | PostgreSQL `keycloak` | Keycloak prefers PostgreSQL; stores all user auth data |
| Reporting Service | PostgreSQL `fineract_default` | Real-time analytics; avoids Fineract's stale batch-job data |
| API Gateway | Neither directly | Proxies to Fineract REST and Keycloak; never queries DB directly |
| Mobile Money | Neither directly | Calls KBZ Pay; no direct DB access |
| KYC Service | Neither directly | Calls external KYC providers; no direct DB access |

### Database ports

| Database | Port | Used by |
|---|---|---|
| MySQL | `3306` | Fineract |
| PostgreSQL | `5432` | Keycloak + Reporting Service |

### The golden rules

1. **Never write directly to MySQL.** All writes go through Fineract's REST API.
2. **Never write directly to PostgreSQL `keycloak`.** All auth writes go through Keycloak's API.
3. **Reading from PostgreSQL `fineract_default` is allowed** — this is what the reporting service does.
4. **The reporting service uses raw SQL because Fineract's API gives stale overdue data.**
5. **PAR = Portfolio At Risk** — the percentage of the loan portfolio that is overdue. The real-time calculation of PAR is the entire reason this two-database design exists.

### PAR (Portfolio At Risk) — What it means

PAR is the most important metric for a microfinance institution. It measures how much of the loan portfolio is at risk of not being repaid.

- **PAR0** — percentage of portfolio with any overdue amount (even 1 day late)
- **PAR30** — percentage overdue by more than 30 days
- **PAR90** — percentage overdue by more than 90 days (serious — usually means write-off risk)

A healthy microfinance portfolio has PAR30 below 5%. The reporting service calculates these in real time so management can act immediately rather than waiting for overnight batch jobs.
