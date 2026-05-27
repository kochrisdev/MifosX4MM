# Business Domain & Context

This document explains the business problem MifosX4MM solves, the Myanmar financial context it operates in, and the core concepts the code models. Read this before diving into the code — it explains the *why* behind the architecture.

---

## What this platform does

A Myanmar **Microfinance Institution (MFI)** provides small loans — typically 100K to 5M MMK — to individuals and small businesses that lack access to conventional banking. Loan officers visit borrowers in the field; branch managers oversee a portfolio of 50–200 active loans and approve credit decisions.

MifosX4MM is the operational software for those staff:

- **Loan officers** use the mobile app in the field to register clients, collect identity documents for KYC, and record repayments.
- **Branch managers** use the web portal to review loan applications, approve/reject credit decisions, monitor portfolio health, and track daily collection performance.
- **Tellers** use the web portal to accept cash repayments at the branch counter.

The platform sits on top of **Apache Fineract** — an open-source core banking engine — and adds a modern frontend layer, KBZ Pay mobile money integration, KYC verification, and custom reporting.

---

## The Myanmar context

### Currency

The Myanmar Kyat (MMK) is the currency. Loan amounts are typically displayed in MMK (e.g., 500,000 MMK). The KBZ Pay API stores amounts in **pyas** — MMK × 100 — so 500,000 MMK is sent as `50000000` to KBZ Pay.

### KBZ Pay

KBZ Pay is Myanmar's dominant mobile wallet, operated by KBZ Bank (the country's largest private bank). It has the deepest rural penetration of any digital payment channel in Myanmar. The integration uses the **direct merchant API** — not an aggregator like 2C2P or Dinger — because it provides lower fees and faster settlement for the MFI's transaction volumes.

Borrowers pay loan installments by opening the KBZ Pay app via a deep link (`kbzpay://pay?prepay_id=...`). The payment notification arrives at the platform via a server-to-server HMAC-SHA256 signed webhook.

### NRC

The National Registration Card (NRC) is Myanmar's national identity document. It is the primary document used for KYC verification (`documentType: "nrc"`). The NRC number format is `<township-code>/<town-type>(<card-type>)<serial>` — e.g., `12/KAMANA(N)123456`.

---

## Core concepts glossary

| Term | Meaning |
|---|---|
| **Disbursement** | The moment funds are transferred to the borrower. Triggers creation of the repayment schedule in Fineract. In the code: `POST /loans/:id/actions {command: "disburse"}`. |
| **Repayment schedule** | The series of monthly installments the borrower owes (principal + interest). Stored in `m_loan_repayment_schedule`. Created automatically by Fineract on disbursal. |
| **Installment** | One row in the repayment schedule — a specific amount due on a specific `duedate`. |
| **Arrears** | A loan is in arrears when at least one installment's `duedate` has passed and `completed_derived = false` (not yet paid). |
| **PAR (Portfolio at Risk)** | The percentage of total outstanding portfolio where at least one installment is overdue. The industry-standard health metric for MFIs. Higher PAR = more risk. See [PAR calculation](#par-portfolio-at-risk) below. |
| **PAR30** | Loans where the oldest unpaid overdue installment is ≥ 30 days past due. The headline metric shown on the dashboard. |
| **Collection rate** | `collected today / scheduled today × 100`. The daily operational KPI — what percentage of today's due installments has been paid. |
| **Portfolio outstanding** | The total principal + interest still owed across all active loans. |
| **Credit committee** | The approval step: a branch manager (or super admin) reviews and approves or rejects a submitted loan application. In the code: `POST /loans/:id/actions {command: "approve"}`. |
| **KYC (Know Your Customer)** | Regulatory identity verification. Before a loan is approved, the borrower's identity documents (NRC scan + selfie) are submitted to a KYC provider (stub in dev, Smile Identity or Onfido in production) for automated verification. |
| **Loan officer** | The field staff member who visits borrowers, registers clients, and collects repayments. |
| **Kyat / Pyas** | MMK is the unit displayed to users. Pyas = MMK × 100. KBZ Pay expects pyas; the gateway converts before posting repayments to Fineract. |

---

## PAR (Portfolio at Risk)

PAR is more meaningful than "total overdue amount" because it expresses risk as a proportion of the total portfolio. An MFI with 5 billion MMK outstanding and 10 million overdue has very different risk from one with 50 million outstanding and 10 million overdue.

| Metric | Definition | Threshold (typical MFI concern) |
|---|---|---|
| **PAR0** | % of portfolio with any overdue installment | >10% is a warning sign |
| **PAR30** | % of portfolio where oldest overdue is ≥30 days | >5% triggers review |
| **PAR90** | % of portfolio where oldest overdue is ≥90 days | >2% is serious |

**Why PAR is calculated in the reporting service (not Fineract REST)**: Fineract's `inArrears` flag only updates after a scheduled batch job runs. The reporting service queries `m_loan_repayment_schedule` directly via SQL to get real-time figures. See `docs/ARCHITECTURE.md` for the CTE query.

---

## Loan lifecycle

This is the end-to-end business flow the code models. Every major API endpoint maps to one of these steps.

```
Client registered → KYC submitted → Loan application submitted
→ Branch manager approves  → Branch manager disburses
→ (Monthly repayments via KBZ Pay or cash)
→ Final installment paid → Loan closed (Fineract status 600)
```

### In the code

| Step | API call | Fineract loan status |
|---|---|---|
| Register client | `POST /api/v1/clients` | — |
| Submit KYC | `POST /kyc/submit` (KYC service) | — |
| Create loan application | Via Fineract directly (no gateway route yet) | 100 (Submitted) |
| Approve loan | `POST /api/v1/loans/:id/actions {command: "approve"}` | 200 (Approved) |
| Disburse loan | `POST /api/v1/loans/:id/actions {command: "disburse"}` | 300 (Active) |
| Collect repayment (cash) | `POST /api/v1/loans/:id/repayments` | 300 (Active) |
| Collect repayment (KBZ Pay) | `POST /api/v1/payments/initiate` → poll status | 300 (Active) |
| Loan fully repaid | Fineract auto-closes | 600 (Closed) |

**Loan status codes in Fineract (used in `m_loan.loan_status_id`):**
- `100` — Submitted / Pending approval
- `200` — Approved
- `300` — Active (disbursed, repayments ongoing)
- `400` — Withdrawn by client
- `500` — Rejected
- `600` — Closed (fully repaid)

---

## User roles and daily workflows

Roles are defined in Keycloak (`infra/keycloak/realm-mifos.json`) and enforced in the API gateway (`apps/api/src/plugins/keycloak.ts`).

### `loan_officer`

**Daily tasks**: Field visits to clients. Register new borrowers. Collect and record repayments.

**Typical morning**:
1. Check the loans due today (overdue list)
2. Visit clients, collect cash or initiate KBZ Pay
3. Record cash repayments (`POST /loans/:id/repayments`)
4. Register any new clients encountered

**What they can't do**: Approve or disburse loans. That requires `branch_manager` or `super_admin`.

### `branch_manager`

**Daily tasks**: Review loan applications. Approve or reject credit decisions. Monitor portfolio health. Review overdue loans.

**Typical morning**:
1. Check dashboard — PAR30, collection rate, active loans
2. Review submitted loan applications → approve or reject
3. Disburse approved loans when funds are available
4. Review the overdue list → call or visit delinquent borrowers

### `teller`

**Daily tasks**: Accept cash repayments at the branch counter only.

**Permissions**: Can post repayments (`POST /loans/:id/repayments`). Cannot approve loans, create clients, or access reports.

### `super_admin`

Full access to all operations including system configuration. Used for initial setup and administrative tasks.

### `customer`

Reserved for future borrower self-service via the mobile app. Not implemented.

---

## Why these technology choices?

### Apache Fineract

**What it is:** An open-source core banking system built by the Apache Software Foundation, used by microfinance institutions in 40+ countries.

**Why not just use a regular database?** Banking has complicated rules that took years to get right: how do you calculate interest daily vs. monthly? What happens when a loan payment is late? How do you track a loan through its full lifecycle (pending → approved → active → closed)? How do you handle partial payments? Fineract already implements all of this correctly.

**What it does in this project:** Stores all clients and loan accounts, generates repayment schedules on disbursement, processes repayments, calculates what is overdue, and exposes all of this via a REST API that our API Gateway calls.

**The tradeoff:** Fineract is a Java/Spring Boot application that takes 2-3 minutes to boot and is treated as a black box — we call its REST API, we never touch its code or database schema directly. This means we can upgrade the Docker image without changing our code.

### Keycloak

**What it is:** An open-source identity and access management (IAM) system. Its job is handling authentication ("who are you?") and authorization ("what are you allowed to do?").

**Why not build login ourselves?** Secure login is notoriously hard: safely storing passwords, preventing brute force attacks, issuing and verifying JWT tokens, managing user roles, handling token expiry and refresh. Keycloak handles all of this correctly and is audited by the security community.

**What it does in this project:** Stores all staff user accounts (loan officers, branch managers, tellers), issues JWT tokens when someone logs in, and lets our API Gateway verify every request without hitting a database.

**How login works in this project:**
```
User submits username + password to the web app
        │
        ▼
API Gateway exchanges credentials with Keycloak → receives a JWT token
        │
        ▼
JWT token is stored in the browser and sent with every subsequent API request
        │
        ▼
API Gateway verifies the token using Keycloak's public key → allows or blocks the request
```

Staff login uses the **Resource Owner Password Credentials (ROPC)** flow — the user submits credentials directly to our gateway, which exchanges them with Keycloak. This is appropriate for a closed internal staff portal. The RS256 JWT lets every service verify tokens independently using Keycloak's public JWKS endpoint — no database round-trip per request.

### KBZ Pay (direct API, not aggregator)
Myanmar's largest mobile wallet with deepest rural penetration. Using the direct merchant API rather than an aggregator (2C2P, Dinger) avoids aggregator fees and gives direct access to status webhooks and settlement reports. The trade-off is managing HMAC-SHA256 request signing directly (see `services/mobile-money/src/kbzpay/signature.ts`).

### Python for reporting
The Fineract REST API does not expose PAR calculations or time-series aggregations of the quality needed. Accurate financial figures require direct SQL against `m_loan_repayment_schedule` and `m_loan_transaction`. Python with SQLAlchemy async + asyncpg was chosen for readable async SQL; the reporting service is intentionally isolated from the Turborepo TypeScript pipeline.

### Turborepo + pnpm workspaces
All TypeScript services share `@mifos-x/shared-types` (Fineract DTOs, KBZ Pay payloads, auth types). Turborepo provides dependency-aware build ordering and parallel dev server startup with one command (`pnpm dev`).
