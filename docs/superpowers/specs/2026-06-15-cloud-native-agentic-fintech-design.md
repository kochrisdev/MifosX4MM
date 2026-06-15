# MifosX4MM — Cloud Native · Agentic · FinTech Architecture

> **AWS Cloud Native (AWS) + Agentic Software Development (Anthropic) + Domain Knowledge & Industry Processes (FinTech)**
>
> This document is the single authoritative reference for understanding what MifosX4MM is, what it can do today, where it hurts, and where it goes next. It is written for engineers, product owners, and technical stakeholders who need the full picture in one place.

---

## Table of Contents

1. [What This Platform Does](#1-what-this-platform-does)
2. [Understanding the Lending System](#2-understanding-the-lending-system)
3. [Core Capabilities (Today)](#3-core-capabilities-today)
4. [What Works Well — The Good](#4-what-works-well--the-good)
5. [What Hurts — The Pain Points](#5-what-hurts--the-pain-points)
6. [Current Architecture — Reference Breakdown](#6-current-architecture--reference-breakdown)
7. [Target Architecture: Cloud Native on AWS](#7-target-architecture-cloud-native-on-aws)
8. [Agentic AI Layer (Anthropic)](#8-agentic-ai-layer-anthropic)
9. [FinTech Domain Architecture](#9-fintech-domain-architecture)
10. [Modular Extension Framework](#10-modular-extension-framework)
11. [Standards & Conventions](#11-standards--conventions)
12. [Migration Roadmap](#12-migration-roadmap)

---

## 1. What This Platform Does

MifosX4MM is the operational software layer for a **Myanmar Microfinance Institution (MFI)**. It sits on top of Apache Fineract — an open-source core banking engine — and adds a modern stack of frontends, integrations, and reporting that Fineract alone cannot provide.

**Who uses it:**

| Role | Tool | Daily Mission |
|---|---|---|
| Loan Officer | Mobile App (Expo) | Field visits — register clients, collect repayments, submit KYC docs |
| Branch Manager | Web Portal (Next.js) | Approve loans, monitor PAR, track daily collections |
| Teller | Web Portal | Accept cash repayments at the branch counter |
| Super Admin | Web Portal | Full system access, configuration |

**What the platform solves that Fineract alone cannot:**

- Modern browser/mobile UX tailored to MFI field operations
- Real-time PAR reporting (Fineract batch jobs are too slow)
- KBZ Pay mobile money integration for digital loan repayments in Myanmar
- Pluggable KYC identity verification (NRC document scanning)
- Role-based access control layered over Keycloak
- A single API surface that abstracts Fineract complexity from frontends

---

## 2. Understanding the Lending System

### 2.1 The MFI Model

A Microfinance Institution extends small loans — typically **100,000 to 5,000,000 MMK** — to individuals and small businesses that lack access to conventional banking. Loans are relationship-based: a loan officer knows the borrower personally, visits their home or business, and assesses creditworthiness through observation rather than credit scores.

This model demands:
- **Mobile-first field tooling** — officers are not at desks
- **Offline-tolerant design** — rural Myanmar has inconsistent connectivity
- **Simple approval workflows** — credit decisions must be fast and auditable
- **Low-cost digital payments** — KBZ Pay eliminates cash handling risk

### 2.2 The Loan Lifecycle

Every major system capability maps to a step in this lifecycle:

```
                      LOAN LIFECYCLE
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. REGISTER CLIENT          POST /api/v1/clients               │
│     ↓ (NRC + selfie)                                           │
│  2. KYC SUBMISSION           POST /kyc/submit                   │
│     ↓ (stub → Smile Identity → Onfido)                         │
│  3. KYC APPROVED             webhook → status: approved         │
│     ↓                                                           │
│  4. LOAN APPLICATION         (via Fineract directly, today)     │
│     ↓ [status 100: Submitted]                                   │
│  5. CREDIT REVIEW            Branch Manager reviews             │
│     ↓                                                           │
│  6. APPROVE / REJECT         POST /loans/:id/actions            │
│     ↓ [status 200: Approved]                                    │
│  7. DISBURSE FUNDS           POST /loans/:id/actions            │
│     ↓ [status 300: Active]                                      │
│     → Fineract generates repayment schedule                     │
│                                                                 │
│  8. MONTHLY REPAYMENTS (repeat until closed)                    │
│     a. Cash → POST /loans/:id/repayments                        │
│     b. KBZ Pay → POST /payments/initiate                        │
│              → KBZ Pay deep link → user pays                   │
│              → webhook → Fineract repayment posted              │
│     ↓                                                           │
│  9. LOAN CLOSED              Fineract auto-closes [status 600]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Fineract loan status codes:**

| Code | Meaning | What happens |
|---|---|---|
| 100 | Submitted | Loan application received, awaiting review |
| 200 | Approved | Credit committee approved; funds not yet released |
| 300 | Active | Disbursed; repayment schedule running |
| 400 | Withdrawn | Client withdrew before disbursement |
| 500 | Rejected | Credit committee rejected |
| 600 | Closed | All installments paid; loan complete |

### 2.3 Key FinTech Metrics

These numbers drive every decision in an MFI and are shown on the dashboard:

| Metric | Formula | Warning Threshold | How We Calculate |
|---|---|---|---|
| **PAR0** | Loans with any overdue installment / total portfolio | > 10% | SQL CTE on `m_loan_repayment_schedule` |
| **PAR30** | Loans with oldest overdue ≥ 30 days / total portfolio | > 5% | Same CTE, 30-day filter |
| **PAR90** | Loans with oldest overdue ≥ 90 days / total portfolio | > 2% | Same CTE, 90-day filter |
| **Collection Rate** | MMK collected today / MMK scheduled today | < 85% triggers review | Reporting service `/collections/today` |
| **Outstanding Portfolio** | Sum of all active loan principal + interest owed | — | SQL: `m_loan.outstanding_derived` |

**Why PAR is calculated via direct SQL (not Fineract REST):** Fineract's `inArrears` flag is only updated by a nightly batch job. Querying `m_loan_repayment_schedule` with a CTE gives real-time values — critical for morning branch reviews.

### 2.4 Myanmar Context

- **Currency:** Myanmar Kyat (MMK). KBZ Pay API uses **pyas** (MMK × 100), so 500,000 MMK = `50000000` in API calls.
- **Identity:** NRC (National Registration Card) is the primary KYC document. Format: `12/KAMANA(N)123456`.
- **Payment rail:** KBZ Pay is Myanmar's dominant mobile wallet with the deepest rural penetration. We integrate via direct merchant API (not aggregator) for lower fees.
- **Connectivity:** Rural areas have intermittent 3G/4G; the mobile app needs graceful offline handling.

---

## 3. Core Capabilities (Today)

### What the platform CAN do today

| Capability | Interface | Status |
|---|---|---|
| Client registration & management | Web + Mobile | ✅ Working |
| KYC document submission | Mobile → KYC service | ✅ Working (stub auto-approves) |
| Loan listing, detail, repayment schedule | Web + Mobile | ✅ Working |
| Loan approval & disbursement | Web (branch_manager role) | ✅ Working |
| Cash repayment recording | Web + Mobile | ✅ Working (mobile has error-handling bug) |
| KBZ Pay payment initiation | Mobile | ✅ Initiation works |
| KBZ Pay webhook verification | Mobile Money service | ✅ Signature verified |
| KBZ Pay repayment → Fineract | Mobile Money service | ❌ NOT implemented (TODO) |
| Dashboard KPIs (PAR, collections) | Web | ✅ Working (real-time SQL) |
| Portfolio reports | Web | ✅ Working |
| Role-based access control | All | ✅ Working |
| Multi-role support (5 roles) | Keycloak | ✅ Configured |
| Docker single-command dev environment | Local | ✅ Working |

### What is NOT yet implemented

| Feature | Where referenced | Gap |
|---|---|---|
| Real KYC providers (Smile Identity, Onfido) | `.env` comments, `resolveProvider()` | No provider file exists |
| KBZ Pay webhook → Fineract repayment | `routes.ts:32` | TODO left in code |
| Loan application creation route | Docs mention it | No API gateway route |
| Customer self-service mobile | Keycloak `customer` role | No screens |
| Documents page | Web sidebar | "Coming soon" placeholder |
| Settings page | Web sidebar | "Coming soon" placeholder |
| Idempotent payment processing | Needed for production | Not implemented |

---

## 4. What Works Well — The Good

These patterns are solid and should be **preserved and extended** in the redesign:

### Architecture
- **BFF pattern (Fastify gateway)** — The Fastify API gateway as a Backend-for-Frontend cleanly separates Fineract complexity from clients. This is exactly right for this use case.
- **Pluggable KYC provider interface** — `KycProvider` interface + `resolveProvider()` factory is a textbook provider pattern. Adding Smile Identity or Onfido is just implementing the interface.
- **Shared types package** — `@mifos-x/shared-types` prevents type drift between services. This is the right call in a monorepo with 5+ TypeScript consumers.
- **Real-time PAR via direct SQL** — Bypassing Fineract's batch-dependent `inArrears` flag and computing PAR from `m_loan_repayment_schedule` directly is the correct architectural choice for MFI operations.
- **Apache Fineract as an unmodified engine** — Treating Fineract as a black-box service accessed only via REST API means Fineract Docker image upgrades are safe. Never fork it.

### Security
- **JWKS-backed JWT verification** — RS256 asymmetric tokens, keys auto-cached from Keycloak's JWKS endpoint. Correct — no symmetric secret to leak.
- **HMAC-SHA256 with `crypto.timingSafeEqual`** — Timing-safe KBZ Pay webhook verification prevents timing oracle attacks. The right approach.
- **Role-based decorators** — `app.authenticate` + `app.authorize([roles])` as Fastify decorators is clean and reusable.

### Developer Experience
- **Turborepo + pnpm workspaces** — Dependency-aware parallel builds. `pnpm dev` starts all services in one command.
- **Docker-first development** — Single `docker compose up` brings up the entire stack including Fineract, Keycloak, both databases, and auto-imports the Keycloak realm. This is excellent.
- **Comprehensive documentation** — 11 docs, 4,400+ lines covering domain context, architecture, API reference, development guide, deployment, contributing guide, and system audit. This is a rare strength.
- **Myanmar domain modeling** — NRC format, pyas/MMK conversion, KBZ Pay direct API (not aggregator) — all correct market-specific decisions.

### FinTech
- **Event-driven payment webhook** — HMAC-signed server-to-server webhook from KBZ Pay is the right pattern for reliable payment confirmation.
- **Fineract loan lifecycle modeling** — The status codes (100/200/300/400/500/600) map cleanly to the business lifecycle.

---

## 5. What Hurts — The Pain Points

These are categorized by severity. They inform the redesign priorities.

### 🔴 Critical — Security & Data Integrity

| # | Issue | Location | Impact |
|---|---|---|---|
| P1 | **SQL injection** via `sqlSearch` string concatenation | `apps/api/src/routes/loans.ts:15` | Database compromise |
| P2 | **Zero authentication** on KYC, Reporting, Mobile Money services | All 3 internal services | Any caller can access financial data or trigger payments |
| P3 | **KBZ Pay webhook → Fineract repayment never fires** | `mobile-money/routes.ts:32` | Payments confirmed to users but NOT recorded in banking system |
| P4 | **Duplicate repayments** — no idempotency on payment status endpoint | `routes/payments.ts:42` | Double-booking in Fineract |
| P5 | **Default credentials** everywhere | `.env`, `docker-compose.yml` | Trivial compromise in any non-local environment |
| P6 | **No try/catch on mobile repayment** | `mobile/loans/[loanId].tsx:148` | User shown "success" when repayment actually failed |

### 🟠 High — Architecture & Reliability

| # | Issue | Impact |
|---|---|---|
| A1 | **In-memory KYC store** — data lost on container restart | All KYC submissions wiped on deploy |
| A2 | **No request validation** (no Zod/Joi schemas) | Malformed data reaches Fineract unvalidated |
| A3 | **No rate limiting** on login | Brute force auth attacks possible |
| A4 | **CORS wildcard default** (`*`) | Exposes API to any origin |
| A5 | **No Docker health checks** on Fineract, Keycloak, API, Web | Startup race conditions in compose |
| A6 | **Bare `fetch()` with no `.ok` check** in web pages | Collections and Reports pages crash silently if reporting service is down |
| A7 | **No observability** — no structured logging, traces, or metrics | Zero visibility into production behavior |
| A8 | **Wrong date format** sent to Fineract in payments route | Repayment transactions post with wrong date |
| A9 | **Mobile KBZ Pay polling** has no error exit | Polls forever on failure |

### 🟡 Structural — Developer Experience & Maintainability

| # | Issue | Impact |
|---|---|---|
| S1 | **Mixed Python + TypeScript** — two separate build pipelines | Doubled CI/CD complexity, two dependency managers |
| S2 | **Reporting service queries Fineract DB directly** | Tight coupling to Fineract schema; breaks if Fineract changes its MySQL schema |
| S3 | **No tests on API gateway or web portal** — only KYC + mobile-money have Vitest | Regressions on refactoring go undetected |
| S4 | **Monolithic API gateway** — all routes in one process | Will become a god file as routes grow; no fault isolation between domains |
| S5 | **Mobile app screens incomplete** | App cannot ship to app stores as-is |
| S6 | **Fineract 3-5 minute cold boot** | Slow development feedback cycles |
| S7 | **Seed script hardcoded to `localhost`** | Fails when run inside Docker network |
| S8 | **`DashboardStats` type mismatch** between shared-types and API response | TypeScript reports no error but runtime shape is wrong |
| S9 | **KYC status hardcoded to "Verified"** in client detail page | Misleading UI; not connected to real data |
| S10 | **`(window as any).__searchTimer` global** | Breaks SSR, is a code smell, should use `useRef` |

### Structural Anti-Patterns to Remove

- **Python isolated service** in a TypeScript monorepo — creates two worlds that can't share types, tests, or CI configuration. Replace with TypeScript or treat it as a fully independent deployable with its own repo.
- **Direct Fineract DB access from Reporting** — creates a hidden dependency on Fineract's internal MySQL schema. The correct long-term approach is Fineract's Data Datahub / Change Data Capture to a dedicated analytics store.
- **No internal service auth** — services must verify JWT or use service-to-service mTLS; currently any process on the Docker network can hit KYC/Reporting/Mobile-Money endpoints.

---

## 6. Current Architecture — Reference Breakdown

Use this as the reference baseline when designing new modules.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CURRENT ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐   ┌──────────────────────────────────────────────┐ │
│  │  Next.js Web    │   │        Expo React Native Mobile App          │ │
│  │  Staff Portal   │   │        Field Loan Officers                   │ │
│  │  :3000          │   │                                              │ │
│  └────────┬────────┘   └───────────────────┬──────────────────────────┘ │
│           │                                │                            │
│           │  JWT Bearer (RS256 / Keycloak) │                            │
│           └──────────────┬─────────────────┘                            │
│                          ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │              FASTIFY API GATEWAY  :3001                           │  │
│  │  plugins/keycloak.ts  →  JWKS verify  →  app.authenticate        │  │
│  │  routes/auth.ts       →  Keycloak ROPC login/refresh             │  │
│  │  routes/clients.ts    →  Fineract /clients proxy                 │  │
│  │  routes/loans.ts      →  Fineract /loans proxy (SQL INJECTION)   │  │
│  │  routes/payments.ts   →  KBZ Pay initiate + status (NO IDEMPOT)  │  │
│  │  routes/dashboard.ts  →  Reporting service proxy                 │  │
│  └──────┬──────────┬──────────────────────┬────────────────┬────────┘  │
│         │          │                      │                │            │
│   ┌─────▼──────┐ ┌─▼──────────┐  ┌──────▼───────┐ ┌──────▼──────┐   │
│   │  Fineract  │ │  Keycloak  │  │  Reporting   │ │ Mobile-     │   │
│   │  :8080     │ │  :8180     │  │  :3005       │ │ Money :3003 │   │
│   │ Core bank  │ │ Auth / IAM │  │  FastAPI     │ │ Fastify     │   │
│   │ (Java)     │ │ (Quarkus)  │  │  (Python)    │ │ KBZ Pay     │   │
│   └─────┬──────┘ └─────┬──────┘  └──────┬───────┘ └──────┬──────┘   │
│         │              │                 │                │            │
│   ┌─────▼──────┐ ┌─────▼──────┐  ┌──────▼───────┐ ┌──────▼──────┐   │
│   │  MySQL 8   │ │ PostgreSQL │  │ PostgreSQL   │ │  KBZ Pay    │   │
│   │  :3306     │ │  :5432     │  │ (same :5432) │ │  (external) │   │
│   │ Fineract   │ │ Keycloak   │  │ Direct SQL   │ │             │   │
│   │ tenants    │ │ realm      │  │ on Fineract  │ │             │   │
│   └────────────┘ └────────────┘  │ tables(!)    │ └─────────────┘   │
│                                  └──────────────┘                    │
│                                                                       │
│   ┌──────────────────────┐   ┌────────────────────────────────────┐  │
│   │  KYC Service :3004   │   │  @mifos-x/shared-types             │  │
│   │  Fastify             │   │  TypeScript interfaces              │  │
│   │  NO AUTH (!)         │   │  Used by all TS services           │  │
│   │  In-memory store (!) │   └────────────────────────────────────┘  │
│   └──────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────-┘
```

### Service Inventory

| Service | Framework | Language | Port | Test Coverage | Production-Ready |
|---|---|---|---|---|---|
| API Gateway | Fastify 4 | TypeScript | 3001 | ❌ None | ❌ Bugs |
| Web Portal | Next.js 14 | TypeScript | 3000 | ❌ None | ❌ Bugs |
| Mobile App | Expo + RN | TypeScript | (Expo) | ❌ None | ❌ Incomplete |
| KYC Service | Fastify 4 | TypeScript | 3004 | ✅ Vitest | ❌ No auth |
| Mobile Money | Fastify 4 | TypeScript | 3003 | ✅ Vitest | ❌ Webhook broken |
| Reporting | FastAPI | Python | 3005 | ❌ None | ❌ No auth |
| Fineract | Spring Boot | Java | 8080 | (external) | ⚠️ Default creds |
| Keycloak | Quarkus | Java | 8180 | (external) | ⚠️ Default creds |

---

## 7. Target Architecture: Cloud Native on AWS

The target architecture moves from Docker Compose on a VPS to a fully managed, event-driven, serverless-first AWS deployment. **Fineract remains containerized** — it is too complex to replace and runs correctly on ECS Fargate.

### 7.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      TARGET AWS ARCHITECTURE                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐     ┌─────────────────────────────────────┐    │
│  │  CloudFront + S3    │     │  AWS Amplify / App Runner           │    │
│  │  Next.js (SSG/ISR)  │     │  OR CloudFront + Next.js on ECS    │    │
│  │  Staff Portal       │     │                                     │    │
│  └──────────┬──────────┘     └──────────────────────────────────-─┘    │
│             │                                                            │
│             │  HTTPS                                                     │
│             ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │           AWS API GATEWAY (HTTP API)                            │    │
│  │           + WAF (OWASP rules, rate limiting)                    │    │
│  │           + Cognito Authorizer OR Keycloak JWT Authorizer       │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │                                                            │
│     ┌───────┼────────────────────────────────────────────────────┐      │
│     │       │        AWS Lambda Functions (per domain)           │      │
│     │  ┌────▼──────────────────────────────────────────────────┐ │      │
│     │  │  auth-lambda        clients-lambda      loans-lambda  │ │      │
│     │  │  payments-lambda    dashboard-lambda    admin-lambda   │ │      │
│     │  └────┬──────────────────────────────────────────────────┘ │      │
│     │       │                                                     │      │
│     └───────┼─────────────────────────────────────────────────────┘      │
│             │                                                            │
│   ┌─────────┼────────────────────────────────────────────────────────┐  │
│   │         │          CORE SERVICES (ECS Fargate)                   │  │
│   │  ┌──────▼──────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│   │  │  Fineract   │  │  Keycloak    │  │  KYC Service         │   │  │
│   │  │  ECS Fargate│  │  ECS Fargate │  │  ECS Fargate         │   │  │
│   │  │  ALB target │  │  OR Cognito  │  │  + Postgres (RDS)    │   │  │
│   │  └──────┬──────┘  └──────────────┘  └──────────────────────┘   │  │
│   └─────────┼──────────────────────────────────────────────────────-┘  │
│             │                                                            │
│   ┌─────────┼────────────────────────────────────────────────────────┐  │
│   │         │          DATA LAYER                                    │  │
│   │  ┌──────▼──────────┐  ┌────────────────┐  ┌──────────────────┐ │  │
│   │  │ Aurora MySQL     │  │ Aurora         │  │   S3             │ │  │
│   │  │ Serverless v2   │  │ PostgreSQL     │  │  KYC Documents   │ │  │
│   │  │ (Fineract data) │  │ Serverless v2  │  │  Audit Logs      │ │  │
│   │  └─────────────────┘  │ (reporting,kyc)│  └──────────────────┘ │  │
│   │                       └────────────────┘                        │  │
│   └────────────────────────────────────────────────────────────────-┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                  EVENT BUS (EventBridge)                        │   │
│   │  loan.approved → step function                                  │   │
│   │  loan.disbursed → notification                                  │   │
│   │  payment.kbzpay.received → repayment-lambda → Fineract         │   │
│   │  kyc.approved → loan eligibility update                        │   │
│   │  payment.failed → retry queue (SQS)                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │               OBSERVABILITY LAYER                               │   │
│   │  CloudWatch Logs · X-Ray Traces · CloudWatch Metrics           │   │
│   │  OpenTelemetry SDK in every Lambda/service                      │   │
│   │  Grafana (managed) for dashboards                               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 AWS Service Mapping

| Current Component | AWS Target | Rationale |
|---|---|---|
| Docker Compose | ECS Fargate + ALB | Managed containers, no EC2 management |
| Fastify API routes | AWS Lambda (per domain group) | Serverless scaling, fault isolation per route group |
| Next.js web portal | AWS Amplify OR App Runner | Managed Next.js hosting with SSR |
| Expo mobile app | No change | Connects to AWS API Gateway endpoint |
| Fineract (Java) | ECS Fargate + ALB | Cannot serverless-ify; keep containerized |
| Keycloak (Java) | ECS Fargate OR Amazon Cognito | Cognito is simpler to operate; Keycloak if ROPC flow required |
| MySQL (Fineract DB) | Amazon Aurora MySQL Serverless v2 | Auto-scaling, managed backups, PITR |
| PostgreSQL (Keycloak + Reporting) | Amazon Aurora PostgreSQL Serverless v2 | Same benefits; separate cluster |
| KYC service (in-memory) | ECS Fargate + Aurora PostgreSQL | Persistent, restartable |
| Mobile Money service | AWS Lambda + SQS + EventBridge | Event-driven payment flows; idempotent |
| Reporting service (Python) | AWS Lambda (Python runtime) OR TypeScript rewrite | Keep Python if team is comfortable; Lambda removes the server |
| Docker build | GitHub Actions → ECR → ECS deploy | Standard CI/CD |
| `.env` secrets | AWS Secrets Manager + Parameter Store | Rotate without code changes |
| `docker compose` config | AWS CDK (TypeScript) | Infrastructure as Code, version-controlled |
| Nginx reverse proxy | AWS ALB + CloudFront | Managed, auto-scaled |

### 7.3 Lambda Domain Decomposition

Instead of one monolithic Fastify gateway, split into Lambda functions grouped by domain:

```
aws-lambda/
├── auth/            # login, refresh, logout, /me  (Keycloak ROPC proxy)
├── clients/         # CRUD clients (Fineract proxy)
├── loans/           # List, detail, approve, disburse, repayment
├── payments/        # KBZ Pay initiate, status, webhook handler
├── kyc/             # Submit, status, webhook
├── dashboard/       # Stats aggregation (calls Reporting)
├── reporting/       # Portfolio, collections, disbursements reports
└── admin/           # User management, office config
```

Each Lambda:
- Has its own IAM role (least privilege)
- Reads secrets from AWS Secrets Manager (not environment variables)
- Emits structured JSON logs to CloudWatch
- Emits X-Ray traces for every external call (Fineract, Keycloak)
- Validates input with Zod before touching any backend

### 7.4 Event-Driven Payment Flow (Replacing the Broken Webhook)

The current KBZ Pay → Fineract repayment flow is broken (C5 in the audit). The AWS architecture fixes this with an idempotent, event-driven design:

```
KBZ Pay sends webhook
    ↓
API Gateway → payments/webhook Lambda
    ↓
1. Verify HMAC-SHA256 signature
2. Check SQS deduplication ID (idempotency — prevents double-post)
3. Publish event: payment.kbzpay.received → EventBridge
4. Return 200 immediately to KBZ Pay (webhook must respond fast)

EventBridge rule: payment.kbzpay.received
    ↓
SQS FIFO queue (per loanId — preserves order)
    ↓
repayment-processor Lambda
    ↓
1. Read idempotency key from DynamoDB (orderId → posted: bool)
2. If already posted: skip (idempotent)
3. POST to Fineract: /loans/{loanId}/transactions?command=repayment
4. Mark orderId as posted in DynamoDB
5. Publish: payment.confirmed → EventBridge
    ↓
notification Lambda → push notification to mobile app
```

### 7.5 Loan Workflow as Step Functions

Replace ad-hoc API calls with an explicit AWS Step Functions state machine for the loan lifecycle:

```
                 LOAN APPROVAL STEP FUNCTION
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [SubmitApplication] → [KYCCheck]                   │
│      ↓ KYC approved                                 │
│  [PendingReview] ← wait for branch manager input    │
│      ↓ approved                    ↓ rejected       │
│  [DisburseFunds]              [NotifyRejection]     │
│      ↓                                              │
│  [ActiveRepayment] ← monthly installment events     │
│      ↓ all installments paid                        │
│  [CloseLoan] → [ArchiveRecords]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.6 Infrastructure as Code (AWS CDK)

All AWS resources are defined in TypeScript CDK — version-controlled alongside the application code:

```
infra/
├── bin/
│   └── mifos-stack.ts            # CDK app entry point
├── lib/
│   ├── stacks/
│   │   ├── database-stack.ts     # Aurora clusters, SGs, subnet groups
│   │   ├── fineract-stack.ts     # ECS cluster, task def, ALB, Fineract
│   │   ├── keycloak-stack.ts     # ECS cluster, task def, ALB, Keycloak
│   │   ├── lambda-stack.ts       # All Lambda functions, API Gateway
│   │   ├── eventbus-stack.ts     # EventBridge, SQS, SNS
│   │   └── observability-stack.ts # CloudWatch, X-Ray, alarms
│   └── constructs/
│       ├── MifosLambda.ts        # Reusable Lambda construct (logging, X-Ray, secrets)
│       └── FineractCluster.ts    # Reusable Fineract ECS construct
└── config/
    ├── dev.json
    └── prod.json
```

### 7.7 CI/CD Pipeline

```
GitHub Push → main branch
    ↓
GitHub Actions:
  1. pnpm install + turbo build
  2. pnpm test (all workspaces)
  3. Docker build + push to ECR (Fineract wrapper, Keycloak config)
  4. cdk deploy --require-approval never (Lambda ZIP auto-deployed)
  5. Run smoke tests against staging endpoint
  6. Slack notification: deploy result

GitHub Push → dev branch
    → Same pipeline to staging environment
```

### 7.8 Secrets Management

Replace all `.env` hardcoded values:

| Secret | AWS Target | Rotation |
|---|---|---|
| Fineract username/password | Secrets Manager | Manual (Fineract admin) |
| Keycloak client secret | Secrets Manager | Auto-rotate 90 days |
| KBZ Pay app ID, merchant code, sign key | Secrets Manager | Manual (per KBZ agreement) |
| DB credentials | Secrets Manager + RDS integration | Auto-rotate 30 days |
| JWT signing key | Secrets Manager | Manual (with key rollover logic) |
| API URLs, non-secret config | Parameter Store (SecureString) | N/A |

---

## 8. Agentic AI Layer (Anthropic)

The Anthropic Claude API enables a layer of intelligent agents that augment the MFI's operations. These are not chatbots — they are purpose-built agents that read financial data, reason about risk, and take defined actions.

### 8.1 Agent Architecture Pattern

All agents follow the same pattern:

```
Trigger (event / API call / schedule)
    ↓
Agent Lambda
    ↓
Tool calls:
  - read_loan_portfolio() → Aurora SQL
  - read_client_history() → Fineract API
  - read_kyc_status() → KYC service
  - read_payment_history() → Aurora SQL
    ↓
Claude API (claude-sonnet-4-6 or claude-haiku-4-5 for cost-sensitive tasks)
    ↓
Structured output (validated JSON schema)
    ↓
Action: write to DB / call Fineract API / send notification / return to UI
```

**Cost control:** Use `claude-haiku-4-5` for high-frequency tasks (fraud screening every payment), `claude-sonnet-4-6` for complex analysis (credit committee summaries), `claude-opus-4-8` for rare high-stakes decisions only.

**All agents use prompt caching** to reduce cost on repeated system prompts (e.g., the full loan policy document passed as context).

### 8.2 Agent Catalogue

#### Agent 1: Credit Score Agent

**Trigger:** Loan application submitted (Step Functions → EventBridge)
**Purpose:** Generates an AI credit recommendation to help branch managers make faster, more consistent credit decisions.

**Inputs:**
- Client's repayment history on previous loans (SQL)
- NRC and KYC verification result
- Loan amount vs. income estimate
- Portfolio-level PAR for this loan officer's portfolio (context)

**Output (structured JSON):**
```json
{
  "recommendation": "approve" | "review" | "decline",
  "confidence": 0.87,
  "score": 72,
  "key_factors": [
    "3 previous loans, all repaid on time",
    "Loan-to-income ratio within policy (42%)",
    "KYC approved via NRC"
  ],
  "risk_flags": [],
  "suggested_amount": 500000,
  "suggested_term_months": 12
}
```

**How it's shown:** In the web portal's loan application review page, the branch manager sees the AI recommendation alongside the application. The manager always makes the final decision — the agent advises, never decides.

#### Agent 2: KYC Document Intelligence Agent

**Trigger:** KYC document submitted via mobile app
**Purpose:** Extracts structured data from NRC card photos, reducing manual data entry and improving verification speed.

**Inputs:** Base64-encoded NRC front + back image
**Tools:** Claude's vision capability (multimodal input)

**Output:**
```json
{
  "extracted_nrc_number": "12/KAMANA(N)123456",
  "extracted_name": "Aung Aung",
  "extracted_dob": "1990-03-15",
  "extraction_confidence": 0.94,
  "image_quality": "good" | "blurry" | "partial",
  "suggested_action": "auto_verify" | "manual_review"
}
```

**Cost note:** This is image processing — use `claude-haiku-4-5` for the extraction pass, `claude-sonnet-4-6` only if the haiku pass flags for manual review.

#### Agent 3: Collections Intelligence Agent

**Trigger:** Daily 6:00 AM schedule (EventBridge cron)
**Purpose:** Identifies which overdue loans are most at risk of default and suggests the best collection strategy for each.

**Inputs:**
- All loans with overdue installments (SQL)
- Each borrower's repayment history
- Days since last contact (if tracked)
- Payment method preferences

**Output (per overdue loan):**
```json
{
  "loan_id": 1234,
  "priority": "urgent" | "high" | "medium",
  "days_overdue": 45,
  "suggested_action": "phone_call" | "field_visit" | "restructure",
  "suggested_message": "Ko Aung Aung, your 45,000 MMK installment is 45 days overdue...",
  "escalate_to_manager": true,
  "default_risk_score": 0.73
}
```

**Delivery:** Daily briefing report auto-generated and pushed to the branch manager's dashboard each morning.

#### Agent 4: Fraud Detection Agent

**Trigger:** Every repayment transaction (EventBridge: payment.confirmed)
**Purpose:** Flags suspicious patterns that may indicate teller fraud, duplicate client accounts, or payment manipulation.

**Patterns detected:**
- Same client registered multiple times with slightly different NRC numbers
- Repayment recorded by teller immediately before or after own login/logout
- Repayment amount exactly matches upcoming installment but from unusual channel
- Loan approved and disbursed within unusually short time window

**Output:**
```json
{
  "alert_level": "none" | "low" | "medium" | "high",
  "flag_reason": "...",
  "evidence": [...],
  "recommended_action": "monitor" | "review" | "freeze"
}
```

**High alerts** are immediately surfaced on the branch manager's dashboard and trigger an email to the super admin.

#### Agent 5: Portfolio Q&A Agent (Natural Language Reporting)

**Trigger:** User query in the web portal's Reports page
**Purpose:** Lets branch managers ask questions about their portfolio in plain language without needing to understand SQL or report filters.

**Example queries:**
- "Which loan officer has the worst PAR30 this month?"
- "How many loans in Mandalay branch are over 90 days overdue?"
- "What was the total collected via KBZ Pay last week?"
- "Show me all clients who have repaid on time for 2+ years"

**Architecture:**
```
User types question
    ↓
portfolio-qa Lambda
    ↓
Claude → generates SQL query (tool: execute_read_query)
    ↓
Aurora PostgreSQL (read replica)
    ↓
Claude → formats result as natural language + table
    ↓
Web portal renders response
```

**Safety:** The agent has read-only database access. It cannot write or execute DDL.

#### Agent 6: Loan Officer Field Assistant

**Trigger:** Loan officer opens client profile in mobile app
**Purpose:** AI copilot that helps field officers during client visits.

**Capabilities:**
- Summarize client's loan history in 2 sentences (no screen squinting at tables)
- Warn if client has a co-borrower relationship with another client in arrears
- Suggest whether to initiate KBZ Pay or record cash based on client's history
- Draft a repayment reminder message in Myanmar language (Burmese) for WhatsApp

**Delivery:** "AI Summary" card at the top of the client detail screen in the mobile app, loaded asynchronously after the main data.

### 8.3 Anthropic API Configuration

```typescript
// lib/anthropic.ts — shared config for all agents
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // from Secrets Manager
});

// Use prompt caching for shared system context (loan policy, glossary)
export const SYSTEM_CONTEXT = {
  type: 'text' as const,
  text: loadLoanPolicyDocument(), // ~8,000 tokens, cached for 5 minutes
  cache_control: { type: 'ephemeral' as const },
};

// Model selection by task complexity
export const MODELS = {
  fast: 'claude-haiku-4-5-20251001',    // High-frequency: fraud check, KYC extraction
  balanced: 'claude-sonnet-4-6',         // Standard: credit score, collections
  powerful: 'claude-opus-4-8',           // Complex: multi-portfolio analysis
} as const;
```

---

## 9. FinTech Domain Architecture

### 9.1 Domain-Driven Module Boundaries

The platform is organized around five core FinTech domains. Each domain owns its data, its API routes, and its events:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       FINTECH DOMAIN MAP                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   IDENTITY   │  │   CREDIT     │  │   PAYMENTS   │              │
│  │   DOMAIN     │  │   DOMAIN     │  │   DOMAIN     │              │
│  │              │  │              │  │              │              │
│  │ - Client reg │  │ - Loan apps  │  │ - KBZ Pay    │              │
│  │ - KYC verify │  │ - Approvals  │  │ - Cash       │              │
│  │ - NRC check  │  │ - Disbursal  │  │ - Webhooks   │              │
│  │ - Dedup      │  │ - Repayment  │  │ - Idempotent │              │
│  │              │  │   schedule   │  │   processing │              │
│  │ Owned by:    │  │              │  │              │              │
│  │ KYC service  │  │ Owned by:    │  │ Owned by:    │              │
│  │ + Fineract   │  │ Fineract     │  │ Mobile Money │              │
│  │              │  │ + loans-λ    │  │ + payments-λ │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────────────────────────┐            │
│  │  REPORTING   │  │         RISK & COMPLIANCE         │            │
│  │  DOMAIN      │  │            DOMAIN                 │            │
│  │              │  │                                   │            │
│  │ - PAR calcs  │  │ - Fraud detection (AI)            │            │
│  │ - Collections│  │ - Regulatory reporting            │            │
│  │ - Portfolios │  │ - Audit trail                     │            │
│  │ - AI Q&A     │  │ - Credit scoring (AI)             │            │
│  │              │  │ - Collections intelligence (AI)   │            │
│  │ Owned by:    │  │                                   │            │
│  │ Reporting svc│  │ Owned by: agents-λ + EventBridge  │            │
│  │ + dashboard-λ│  └───────────────────────────────────┘           │
│  └──────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.2 Event Catalogue

All domain events are published to EventBridge. This is the contract between domains:

| Event Name | Source Domain | Consumers |
|---|---|---|
| `client.registered` | Identity | Risk (fraud check), Credit |
| `kyc.submitted` | Identity | Identity (KYC processing) |
| `kyc.approved` | Identity | Credit (loan eligibility) |
| `kyc.rejected` | Identity | Identity (notify loan officer) |
| `loan.submitted` | Credit | Risk (credit score agent) |
| `loan.approved` | Credit | Credit (disbursal workflow), Reporting |
| `loan.disbursed` | Credit | Payments (activate schedule), Reporting |
| `loan.closed` | Credit | Reporting, Risk |
| `payment.kbzpay.initiated` | Payments | Payments (status polling) |
| `payment.kbzpay.received` | Payments | Payments (Fineract repayment) |
| `payment.confirmed` | Payments | Risk (fraud check), Reporting |
| `payment.failed` | Payments | Payments (retry), Identity (notify) |
| `repayment.overdue` | Credit | Risk (collections agent) |
| `fraud.flagged` | Risk | Identity (notify super_admin) |

### 9.3 Audit Trail

Every financial action must be auditable for regulatory compliance:

```sql
-- All events written to this table (append-only, never updated)
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type   TEXT NOT NULL,         -- 'loan.approved', 'payment.confirmed', etc.
  actor_id     UUID NOT NULL,         -- Keycloak user ID
  actor_role   TEXT NOT NULL,         -- 'branch_manager', 'teller', etc.
  entity_type  TEXT NOT NULL,         -- 'loan', 'client', 'payment'
  entity_id    TEXT NOT NULL,         -- Fineract loan ID, etc.
  payload      JSONB NOT NULL,        -- Full event payload
  ip_address   INET,
  user_agent   TEXT
);

-- Immutable: no UPDATE or DELETE permissions on this table
-- Retained for 7 years (Myanmar FRD requirement)
```

### 9.4 Multi-Tenancy Design

The current system hardcodes `Fineract-Platform-TenantId: default`. For a SaaS MFI platform serving multiple institutions:

```
Tenant isolation strategy:
- URL-based: api.mifos.com/{tenant-slug}/v1/...
- JWT claim: custom claim `tenant_id` in Keycloak token
- Database: Fineract supports multi-tenancy natively (tenants table in fineract_tenants DB)
- AWS: tenant ID used as partition key in DynamoDB idempotency table
- Reporting: each tenant has schema-isolated tables in Aurora
```

### 9.5 Regulatory Compliance (Myanmar FRD)

| Requirement | Implementation |
|---|---|
| Customer identity verification | KYC service (NRC + selfie) |
| Transaction records | Fineract + audit_log table |
| Data retention (7 years) | S3 Glacier for archived data, Aurora PITR |
| Sensitive data encryption | Aurora encrypted at rest (AES-256), TLS in transit |
| Access logging | CloudTrail + CloudWatch Logs |
| Segregation of duties | Role-based access (teller ≠ approver) |

---

## 10. Modular Extension Framework

The platform is designed so that each domain can be extended independently. Here is how to add new capabilities to each module:

### 10.1 Adding a New KYC Provider

The provider interface is already correct. To add Smile Identity:

```
services/kyc/src/providers/
├── stub.ts                     # existing
├── smile-identity.ts           # NEW: implement KycProvider
└── onfido.ts                   # NEW: implement KycProvider
```

Steps:
1. Create `smile-identity.ts` implementing `KycProvider` interface
2. Add `case 'smile_identity':` to `resolveProvider()` in `index.ts`
3. Add `SMILE_IDENTITY_PARTNER_ID` and `SMILE_IDENTITY_API_KEY` to Secrets Manager
4. Write Vitest tests for the new provider (mock the HTTP calls)
5. Set `KYC_PROVIDER=smile_identity` in Parameter Store for production

No other services change. The interface is the contract.

### 10.2 Adding a New Payment Rail

To add a second payment rail (e.g., Wave Money):

```
services/mobile-money/src/
├── kbzpay/                     # existing
│   ├── client.ts
│   └── signature.ts
└── wavemoney/                  # NEW
    ├── client.ts               # WaveMoneyClient class
    └── signature.ts            # Wave's signing algorithm
```

EventBridge events remain the same (`payment.*.initiated`, `payment.*.received`). The payment-processor Lambda dispatches to the right client based on `payment_method` in the event payload.

### 10.3 Adding a New AI Agent

Each agent is a standalone Lambda function with its own trigger, tools, and output schema:

```
lambda/agents/
├── credit-score/
│   ├── handler.ts              # Lambda entry point
│   ├── tools.ts                # Database queries as Claude tool definitions
│   ├── prompt.ts               # System prompt + task description
│   └── schema.ts               # Zod schema for output validation
```

Pattern for every agent:
```typescript
export const handler = async (event: EventBridgeEvent) => {
  const tools = defineTools(db);        // SQL queries as tool definitions
  const result = await anthropic.messages.create({
    model: MODELS.balanced,
    system: [SYSTEM_CONTEXT, { type: 'text', text: agentSystemPrompt }],
    messages: [{ role: 'user', content: buildTaskMessage(event) }],
    tools,
    max_tokens: 1024,
  });
  const output = parseWithZod(result, outputSchema);
  await publishResult(output);          // EventBridge or DB write
};
```

### 10.4 Adding New Report Types

Reporting is additive: add a new router in `services/reporting/routers/` (Python) or a new Lambda function with the corresponding SQL query.

For the AI-powered Portfolio Q&A agent, the architecture is self-extending: the agent generates SQL from natural language, so new report types emerge from the data that's already there.

### 10.5 Adding a New User Role

1. Add the role to `infra/keycloak/realm-mifos.json` → `roles.realm` array
2. Add it to the `UserRole` union in `packages/shared-types/src/index.ts`
3. Apply `app.authorize(['new_role'])` to the routes that role can access
4. Assign the role to users in the Keycloak admin console

No database migrations needed — roles live entirely in Keycloak.

---

## 11. Standards & Conventions

### 11.1 API Conventions

- All API routes: `/{domain}/v1/{resource}`
- All responses: `ApiResponse<T>` wrapper from `@mifos-x/shared-types`
- Pagination: `{ items, total, page, pageSize }` for all list endpoints
- Dates: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`) in all API requests/responses; convert to Fineract format (`dd MMMM yyyy`) inside the lambda, never in the client
- Amounts: **Always MMK** in API requests/responses; convert to pyas inside the Mobile Money lambda before calling KBZ Pay
- Errors: `{ success: false, error: { code, message } }` — never expose stack traces

### 11.2 Input Validation (Zod)

Every Lambda that accepts user input must validate with Zod before touching any backend:

```typescript
import { z } from 'zod';

const RepaymentSchema = z.object({
  loanId: z.number().int().positive(),
  amount: z.number().positive().max(50_000_000), // 500K MMK max single repayment
  transactionDate: z.string().date(),
  paymentTypeId: z.number().int().optional(),
  note: z.string().max(500).optional(),
});

export const handler = async (event) => {
  const body = RepaymentSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return { statusCode: 400, body: JSON.stringify(body.error) };
  // proceed with body.data — fully typed and validated
};
```

### 11.3 Idempotency Pattern

Every payment-related Lambda must be idempotent:

```typescript
// DynamoDB idempotency table: { pk: orderId, sk: 'repayment', processed: bool, result: ... }
async function processIfNotDuplicate(orderId: string, handler: () => Promise<void>) {
  const existing = await ddb.get({ TableName: 'idempotency', Key: { pk: orderId } });
  if (existing.Item?.processed) return; // duplicate — skip silently
  await handler();
  await ddb.put({ TableName: 'idempotency', Item: { pk: orderId, processed: true, ttl: +30days } });
}
```

### 11.4 Structured Logging

Every service emits structured JSON logs:

```typescript
const log = (level: 'info'|'warn'|'error', message: string, meta?: object) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'loans-lambda',
    traceId: process.env._X_AMZN_TRACE_ID,
    message,
    ...meta,
  }));
};
```

### 11.5 Internal Service Auth

All internal Lambda-to-Lambda or Lambda-to-service calls use one of:
- **IAM role** (AWS → AWS): Lambda invokes another Lambda via IAM
- **JWT forwarding**: Forward the user's JWT to internal services (Keycloak JWKS verifies)
- **Service account JWT**: For background jobs with no user JWT, use a Keycloak service account

Never call internal services without auth. Never use shared secrets passed as query params.

### 11.6 Testing Requirements

| Layer | Tool | Requirement |
|---|---|---|
| Lambda handlers | Vitest | Unit test every handler with mocked AWS SDK |
| Database queries | Vitest + testcontainers | Integration test SQL against real Aurora (local) |
| Zod schemas | Vitest | Test valid + invalid inputs for every schema |
| Agent prompts | Vitest | Snapshot test on structured outputs with fixture inputs |
| E2E | Playwright | Happy path for web portal (login → approve loan → disburse) |

---

## 12. Migration Roadmap

### Phase 1 — Harden the Current System (Weeks 1–4)

Fix the critical bugs before any migration work. The current system must be secure before it goes anywhere near AWS.

**Security (Week 1):**
- [ ] C1: Fix SQL injection in `loans.ts:15` (replace string concat with `displayName` param)
- [ ] C2: Add JWT auth to KYC service routes
- [ ] C3: Add JWT auth to Reporting service routes
- [ ] C4: Add JWT auth to Mobile Money routes
- [ ] C5: Complete KBZ Pay webhook → Fineract repayment flow
- [ ] C6: Add idempotency to payment status endpoint
- [ ] C7: Replace all default passwords and credentials

**Data integrity (Week 2):**
- [ ] C8: Add try/catch to mobile repayment
- [ ] H1: Persist KYC submissions to PostgreSQL (replace in-memory Map)
- [ ] H5: Fix date format in payments route
- [ ] H8/H9: Fix mobile KBZ Pay error handling and deep-link encoding

**Stability (Weeks 3–4):**
- [ ] H2: Implement Smile Identity KYC provider
- [ ] H3: Add loan ownership checks on repayment/retrieval routes
- [ ] H11: Add Docker health checks on all services
- [ ] H12/H13: Fix bare fetch error handling on web collections/reports pages
- [ ] M1–M13: Address all medium-priority issues

### Phase 2 — AWS Foundation (Weeks 5–8)

Set up the AWS infrastructure before migrating services:

- [ ] AWS CDK project setup in `infra/` — database stacks, networking, ECR
- [ ] Aurora MySQL Serverless v2 (Fineract) + Aurora PostgreSQL Serverless v2 (Keycloak, Reporting, KYC)
- [ ] Fineract on ECS Fargate + ALB (replace Docker Compose Fineract)
- [ ] Keycloak on ECS Fargate + ALB (or migrate to Amazon Cognito)
- [ ] GitHub Actions CI/CD: build → test → ECR push → ECS deploy
- [ ] Secrets Manager for all credentials (no more `.env` in prod)
- [ ] CloudWatch Logs + X-Ray tracing enabled on all services

### Phase 3 — Lambda Migration (Weeks 9–14)

Migrate the Fastify API gateway to domain-scoped Lambda functions:

- [ ] auth-lambda (Keycloak ROPC proxy)
- [ ] clients-lambda (Fineract clients proxy) + Zod validation
- [ ] loans-lambda (Fineract loans proxy) + Zod validation + ownership checks
- [ ] payments-lambda (KBZ Pay initiation) + idempotency
- [ ] dashboard-lambda (reporting aggregation)
- [ ] EventBridge + SQS setup for payment webhook flow
- [ ] repayment-processor-lambda (idempotent Fineract repayment posting)
- [ ] API Gateway HTTP API + WAF + Cognito/Keycloak authorizer
- [ ] CloudFront + Amplify for Next.js web portal

### Phase 4 — Agentic AI Layer (Weeks 15–20)

Add AI agents one at a time, starting with the highest-value use case:

- [ ] Credit Score Agent (first — highest ROI, helps loan officers immediately)
- [ ] KYC Document Intelligence Agent (second — reduces manual verification)
- [ ] Collections Intelligence Agent (third — improves PAR through proactive outreach)
- [ ] Portfolio Q&A Agent (fourth — adds self-service reporting)
- [ ] Fraud Detection Agent (fifth — ongoing monitoring)
- [ ] Loan Officer Field Assistant (sixth — mobile experience enhancement)

### Phase 5 — Mobile App Completion (Weeks 16–22, parallel)

- [ ] Complete missing Expo screens (new client registration flow, full KYC submission)
- [ ] Customer self-service module (loan balance, payment history, KBZ Pay payment)
- [ ] Push notifications (AWS SNS + Expo Push Notification service)
- [ ] Offline-first capability (SQLite + background sync for loan officer field use)
- [ ] App Store + Google Play submission

### Phase 6 — Multi-Tenancy & Scale (Weeks 22–30)

- [ ] Tenant isolation in all Lambda functions (JWT `tenant_id` claim)
- [ ] Fineract multi-tenancy activation (multiple tenant schemas)
- [ ] Tenant onboarding workflow (CDK stack per tenant OR shared with tenant partitioning)
- [ ] Performance baseline + load testing on Aurora + Lambda
- [ ] Cost optimization review (Lambda cold starts, Aurora scaling min/max)

---

## Appendix: Technology Reference

### Key AWS Services Used

| Service | Role in MifosX4MM |
|---|---|
| **AWS Lambda** | All API logic (replaces Fastify gateway) |
| **Amazon API Gateway HTTP API** | Public API endpoint, routing, throttling |
| **Amazon ECS Fargate** | Fineract + Keycloak (Java services, can't be Lambda) |
| **Amazon Aurora Serverless v2** | MySQL (Fineract) + PostgreSQL (Keycloak, Reporting, KYC) |
| **Amazon EventBridge** | Event bus between all domains |
| **Amazon SQS FIFO** | Reliable payment processing queue (per-loanId ordering) |
| **Amazon DynamoDB** | Idempotency table for payments |
| **Amazon S3** | KYC document storage, audit log archive |
| **Amazon CloudFront** | CDN for Next.js web portal |
| **AWS Amplify / App Runner** | Next.js SSR hosting |
| **Amazon Cognito** | Auth (alternative to Keycloak) |
| **AWS Secrets Manager** | All credentials, auto-rotation |
| **AWS Systems Manager Parameter Store** | Non-secret config (URLs, feature flags) |
| **AWS CloudWatch** | Logs, metrics, alarms |
| **AWS X-Ray** | Distributed tracing |
| **AWS WAF** | OWASP rules, rate limiting, DDoS protection |
| **AWS CDK** | Infrastructure as Code (TypeScript) |
| **AWS Step Functions** | Loan approval + disbursal workflow state machine |
| **Amazon SNS** | Push notifications to mobile app |
| **Amazon ECR** | Container image registry (Fineract, Keycloak) |

### Anthropic SDK Reference

```typescript
import Anthropic from '@anthropic-ai/sdk';

// Standard structured-output agent call with tool use
const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' }, // Cache large system context
    },
  ],
  messages: [{ role: 'user', content: userMessage }],
  tools: [
    {
      name: 'read_loan_portfolio',
      description: 'Read loan portfolio data from the database',
      input_schema: {
        type: 'object' as const,
        properties: {
          branch_id: { type: 'number' },
          status: { type: 'string', enum: ['active', 'overdue', 'closed'] },
        },
        required: ['branch_id'],
      },
    },
  ],
});
```

---

*Document authored: 2026-06-15*
*Next review: After Phase 1 hardening is complete*
*Owner: Engineering Lead, MifosX4MM*
