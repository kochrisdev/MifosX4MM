# Which Services Use Which Database

## Overview

This project runs two databases:

| Database | Engine | Port |
|---|---|---|
| `fineract_default` | MySQL | `3306` |
| `fineract_default` + `keycloak` | PostgreSQL | `5432` |

---

## Service by Service

### Apache Fineract
- **Database:** MySQL `fineract_default`
- **Access:** Read + Write (via JDBC / Liquibase)
- **What it stores:** All financial data — clients, loans, repayment schedules, transactions
- **Rule:** Never write to this database directly. Always go through Fineract's REST API at port `8080`.

---

### Reporting Service (`services/reporting`)
- **Database:** PostgreSQL `fineract_default`
- **Access:** Read only (raw SQL SELECT via SQLAlchemy)
- **What it reads:** Fineract's own tables — `m_loan`, `m_client`, `m_loan_repayment_schedule`, `m_loan_transaction`
- **Rule:** SELECT only. Never INSERT, UPDATE, or DELETE into Fineract's tables.

---

### Keycloak
- **Database:** PostgreSQL `keycloak`
- **Access:** Read + Write (managed automatically by Keycloak)
- **What it stores:** Users, roles, sessions, JWT tokens, login history
- **Rule:** Never write to this database directly. Always go through Keycloak's API at port `8180`.

---

### API Gateway (`apps/api`)
- **Database:** None directly
- **How:** Calls Fineract REST API and Keycloak API only — never connects to any database itself

---

### Web App (`apps/web`)
- **Database:** None
- **How:** Calls the API Gateway only

---

### Mobile App (`apps/mobile`)
- **Database:** None
- **How:** Calls the API Gateway only

---

### Mobile Money Service (`services/mobile-money`)
- **Database:** None
- **How:** Calls KBZ Pay external API only

---

### KYC Service (`services/kyc`)
- **Database:** None
- **How:** Calls external KYC providers (Smile Identity / Onfido) only

---

## Visual Map

```
┌──────────────────────────────────────────────────────┐
│  MySQL (port 3306)                                   │
│  └── fineract_default                                │
│        ├── m_loan                                    │
│        ├── m_client                                  │
│        ├── m_loan_repayment_schedule                 │
│        └── m_loan_transaction                        │
│                    ▲                                 │
│            JDBC  (read + write)                      │
│          Apache Fineract (port 8080)                 │
│                    ▲                                 │
│              REST API only                           │
│            API Gateway (port 3001)                   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  PostgreSQL (port 5432)                              │
│  ├── fineract_default  ← Reporting reads here        │
│  └── keycloak          ← Keycloak reads/writes here  │
│           ▲                       ▲                  │
│    SQL SELECT only          JDBC (read + write)      │
│   Reporting Service          Keycloak (port 8180)    │
│     (port 3005)                    ▲                 │
│           ▲                  API call only           │
│     API Gateway              API Gateway             │
└──────────────────────────────────────────────────────┘
```

---

## Quick Reference Table

| Service | MySQL | PostgreSQL | External API |
|---|---|---|---|
| Apache Fineract | Read + Write | — | — |
| Reporting Service | — | Read only | — |
| Keycloak | — | Read + Write | — |
| API Gateway | — | — | Fineract + Keycloak |
| Web App | — | — | API Gateway |
| Mobile App | — | — | API Gateway |
| Mobile Money | — | — | KBZ Pay |
| KYC Service | — | — | Smile Identity / Onfido |

---

## The Golden Rules

1. **Never write directly to MySQL** — all writes go through Fineract's REST API
2. **Never write directly to PostgreSQL `keycloak`** — all auth writes go through Keycloak's API
3. **Reading from PostgreSQL `fineract_default` is allowed** — this is what the reporting service does
4. **The API Gateway never touches a database directly** — it is a pass-through layer only
