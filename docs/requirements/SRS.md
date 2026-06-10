# Software Requirements Specification
## MifosX4MM — Myanmar Microfinance Platform

**Version:** 1.0  
**Date:** 2026-05-26  
**Status:** Draft — scoped to current state + production-readiness gaps  

---

## 1. Introduction

### 1.1 Purpose

This document defines what MifosX4MM must do. It describes who uses the system, what they need to accomplish, and the quality standards the system must meet. It also identifies the gaps that must be closed before the platform can be deployed in a live production environment.

### 1.2 Scope

MifosX4MM is the operational software for staff at a Myanmar microfinance institution (MFI). It covers:

- Loan officer field tools (client registration, KYC, repayment collection via mobile app)
- Branch manager back-office tools (loan approval, portfolio monitoring, reporting via web portal)
- Teller counter tools (cash repayment recording via web portal)
- Integration with KBZ Pay (Myanmar's dominant mobile wallet) for digital repayment collection
- Integration with Apache Fineract as the underlying core banking engine

This document does **not** cover borrower-facing self-service, multi-branch network management, or SMS/push notification systems (see Section 7 — Out of Scope).

### 1.3 Intended Readers

| Reader | How to use this document |
|---|---|
| **Product stakeholders / management** | Sections 2–6 give a plain-language description of what the system does and what remains to be built |
| **New developers** | Read Section 2 for context, Section 4 for the precise functional scope, Section 6 for the prioritized build backlog |
| **QA / testers** | Section 4 provides testable functional requirements; the companion `USER_STORIES.md` provides acceptance criteria per feature |

### 1.4 System Summary

MifosX4MM is a modern interface layer built on top of Apache Fineract — an established open-source core banking engine used by MFIs in over 40 countries. The platform adds a web portal for desk staff, a React Native mobile app for field loan officers, real-time portfolio reporting, identity verification (KYC), and KBZ Pay mobile money integration. Staff authenticate through Keycloak (an enterprise identity provider) and interact with the system through a Fastify API gateway that mediates all communication with Fineract and downstream services.

---

## 2. System Overview

### 2.1 What MifosX4MM Is

A **staff-facing operational platform** that allows a Myanmar MFI to manage its entire loan portfolio from client registration to final repayment — without requiring staff to interact with Apache Fineract directly.

The platform provides:
- A **web portal** (browser-based) for branch managers and tellers working at a desk
- A **mobile app** (iOS and Android) for loan officers working in the field
- **Real-time PAR reporting** (Portfolio at Risk — the standard MFI health metric) calculated from direct database queries, bypassing Fineract's batch-job lag
- **KBZ Pay integration** so borrowers can pay loan installments via Myanmar's largest mobile wallet
- **Pluggable KYC** so identity verification can be switched between providers (stub in development; Smile Identity or Onfido in production) without changing other services

### 2.2 What MifosX4MM Is Not

- It is **not a core banking engine** — all loan math (amortization, interest accrual, GL accounting) is handled by Fineract
- It is **not a consumer-facing app** — borrowers do not log in; they interact with a loan officer who uses the platform on their behalf
- It is **not a multi-institution SaaS platform** — it is designed for deployment at a single MFI

### 2.3 Myanmar Context

| Concept | Explanation |
|---|---|
| **MMK (Myanmar Kyat)** | The currency. Loan amounts displayed as MMK (e.g., 500,000 MMK). Loan sizes typically range from 100,000 to 5,000,000 MMK. |
| **Pyas** | The sub-unit used by KBZ Pay: 1 MMK = 100 pyas. A 500,000 MMK repayment is sent to KBZ Pay as `50,000,000`. The gateway converts automatically. |
| **KBZ Pay** | Myanmar's dominant mobile wallet, operated by KBZ Bank. Borrowers pay installments by opening the KBZ Pay app via a deep link. |
| **NRC (National Registration Card)** | Myanmar's national identity document. The primary document used for KYC verification. Format: `township-code/town-type(card-type)serial`, e.g., `12/KAMANA(N)123456`. |

---

## 3. Actors & Roles

All roles are defined in Keycloak and enforced by the API gateway. A user can hold exactly one role.

| Role | Who they are | What they can do | What they cannot do |
|---|---|---|---|
| `super_admin` | System administrator | Everything — full access to all features and configuration | — |
| `branch_manager` | Office-based manager overseeing a portfolio of 50–200 active loans | All loan officer capabilities, plus: approve/reject/disburse loans, view dashboard and reports | — |
| `loan_officer` | Field staff visiting borrowers | Register clients, submit KYC, initiate KBZ Pay payments, record cash repayments | Approve or disburse loans |
| `teller` | Counter staff at the branch office | Record cash repayments only | Approve loans, create clients, access reports |
| `customer` | Borrower | *(Reserved for future borrower self-service — not implemented in this version)* | Everything currently |

### Typical Daily Workflows

**Branch manager morning:**
1. Check dashboard — PAR30, collection rate, active loans
2. Review submitted loan applications → approve or reject
3. Disburse approved loans when funds are available
4. Review the overdue list → follow up with delinquent borrowers

**Loan officer morning:**
1. Check loans due today
2. Visit borrowers — collect cash or initiate KBZ Pay
3. Record cash repayments through the mobile app
4. Register any new clients encountered in the field

**Teller shift:**
1. Accept cash from walk-in borrowers at the counter
2. Record repayments against their loan accounts

---

## 4. Functional Requirements

Requirements are grouped by domain area. Each requirement is numbered for traceability to user stories in `USER_STORIES.md`.

### FR-AUTH: Authentication & Authorization

| ID | Requirement |
|---|---|
| FR-AUTH-1 | Staff must be able to log in using a username and password. The system exchanges credentials with Keycloak via the Resource Owner Password Credentials (ROPC) flow and returns a JWT access token and a refresh token. |
| FR-AUTH-2 | The system must automatically refresh an expired access token using the stored refresh token, without requiring the user to log in again. |
| FR-AUTH-3 | Staff must be able to log out. The system must revoke the refresh token on Keycloak so the session cannot be reused. |
| FR-AUTH-4 | All API routes except login and token refresh must require a valid JWT. The gateway verifies the token signature against Keycloak's public JWKS endpoint. |
| FR-AUTH-5 | Role-restricted routes must reject requests from users without the required role, returning a 403 Forbidden response. |
| FR-AUTH-6 | The system must expose a `/auth/me` endpoint that returns the authenticated user's profile and role, for use by the web and mobile frontends. |

### FR-CLIENT: Client Registration & Management

| ID | Requirement |
|---|---|
| FR-CLIENT-1 | Loan officers and branch managers must be able to register a new borrower client with their personal details (name, date of birth, mobile number, address). |
| FR-CLIENT-2 | Any authenticated staff member must be able to list all clients, with pagination and optional search by name. |
| FR-CLIENT-3 | Any authenticated staff member must be able to view a client's full profile. |
| FR-CLIENT-4 | Any authenticated staff member must be able to view a list of a client's loan accounts. |
| FR-CLIENT-5 | Loan officers and branch managers must be able to update a client's details. |

### FR-KYC: Identity Verification

| ID | Requirement |
|---|---|
| FR-KYC-1 | Loan officers must be able to submit a client's NRC number and identity documents (NRC scan + selfie) to the KYC service for automated verification. |
| FR-KYC-2 | The system must return the current verification status of a KYC submission (pending, approved, rejected). |
| FR-KYC-3 | The KYC service must receive asynchronous webhook callbacks from the verification provider and update the submission status accordingly. |
| FR-KYC-4 | KYC verification must be approved before a loan can be disbursed. |
| FR-KYC-5 | The system must support switching KYC providers via an environment variable (`KYC_PROVIDER`) without code changes to other services. |

### FR-LOAN: Loan Lifecycle

| ID | Requirement | Note |
|---|---|---|
| FR-LOAN-1 | Loan officers must be able to submit a loan application for a registered, KYC-verified client, specifying the requested amount and loan term. | **GAP — not yet implemented** |
| FR-LOAN-2 | Any authenticated staff member must be able to list all loans, with pagination and optional search by account number. | Implemented |
| FR-LOAN-3 | Any authenticated staff member must be able to view a loan's full details, including its repayment schedule and transaction history. | Implemented |
| FR-LOAN-4 | Branch managers must be able to approve a submitted loan application. The loan moves to Approved status (Fineract status 200). | Implemented |
| FR-LOAN-5 | Branch managers must be able to reject a loan application with an optional note. | Implemented |
| FR-LOAN-6 | Branch managers must be able to disburse an approved loan. This triggers Fineract to generate the repayment schedule. | Implemented |
| FR-LOAN-7 | Loan officers and tellers must be able to post a cash repayment against an active loan. | Implemented |

### FR-PAY: KBZ Pay Mobile Payments

| ID | Requirement | Note |
|---|---|---|
| FR-PAY-1 | Loan officers must be able to initiate a KBZ Pay repayment for a specific loan and amount. The system returns a `prepayId` that the borrower uses to complete payment in their KBZ Pay app. | Implemented |
| FR-PAY-2 | The system must allow polling the status of a KBZ Pay order. If the payment is confirmed, the repayment must be automatically posted to Fineract. | Partially implemented — polling works, but webhook auto-posting does not (see GAP-2) |
| FR-PAY-3 | The KBZ Pay webhook endpoint must verify the HMAC-SHA256 signature of every incoming notification before processing it. | Implemented |
| FR-PAY-4 | When the KBZ Pay webhook confirms a successful payment, the repayment must be automatically posted to Fineract without requiring client-side polling. | **GAP — not yet implemented** |
| FR-PAY-5 | All monetary amounts passed to KBZ Pay must be in pyas (MMK × 100). The gateway must convert from MMK before forwarding. | Implemented |

### FR-DASH: Dashboard & Portfolio Monitoring

| ID | Requirement |
|---|---|
| FR-DASH-1 | Branch managers must be able to view a dashboard showing PAR0, PAR30, and PAR90 figures — calculated in real time from the loan repayment schedule, not from Fineract's batch-updated flags. |
| FR-DASH-2 | The dashboard must show today's collection rate: the percentage of installments due today that have been paid. |
| FR-DASH-3 | The dashboard must show the total outstanding portfolio (principal + interest still owed) and total overdue amount. |
| FR-DASH-4 | The dashboard must show the current count of active loans and active clients. |

### FR-RPT: Reporting

| ID | Requirement |
|---|---|
| FR-RPT-1 | Branch managers must be able to view a portfolio summary report covering PAR tiers, total outstanding, and total overdue. |
| FR-RPT-2 | Branch managers must be able to view collections performance — amounts collected vs. scheduled — to monitor daily and historical performance. |
| FR-RPT-3 | Super admins must be able to view KYC statistics, including submission volume and approval/rejection rates. |

---

## 5. Non-Functional Requirements

### Security

| ID | Requirement | Current Status |
|---|---|---|
| NFR-SEC-1 | All API routes except `/auth/login` and `/auth/refresh` must require a valid RS256 JWT verified against Keycloak's JWKS endpoint. | Met |
| NFR-SEC-2 | KBZ Pay webhook requests must be rejected unless the HMAC-SHA256 signature matches — using the shared `KBZPAY_SIGN_KEY`. | Met |
| NFR-SEC-3 | Loan search query parameters must be sanitized or parameterized before being forwarded to Fineract to prevent SQL injection. | **Not met — see GAP-3** |
| NFR-SEC-4 | Fineract Basic auth credentials (`FINERACT_USERNAME`, `FINERACT_PASSWORD`) must be injected server-side by the gateway and never sent to or exposed in clients. | Met |

### Performance

| ID | Requirement |
|---|---|
| NFR-PERF-1 | API gateway responses should complete within 2 seconds under normal load, excluding Fineract cold-start latency on first boot. |
| NFR-PERF-2 | Dashboard stats may take up to 5 seconds on first request after Fineract cold start (2–3 minute migration on first boot is expected and documented). |

### Reliability

| ID | Requirement | Current Status |
|---|---|---|
| NFR-REL-1 | A confirmed KBZ Pay payment must not be silently discarded if the borrower's app closes before the mobile client polls for status. The webhook handler must be the authoritative repayment trigger. | **Not met — see GAP-2** |
| NFR-REL-2 | Cash repayment recording must be idempotent at the Fineract level — duplicate submissions must not result in double-posted repayments. | Delegated to Fineract |
| NFR-REL-3 | If the reporting service is unavailable, the dashboard must degrade gracefully — returning zero values rather than an error. | Met |

### Compliance

| ID | Requirement |
|---|---|
| NFR-COMP-1 | A loan must not be disbursable until the borrower's KYC verification has been approved. |
| NFR-COMP-2 | All monetary amounts transmitted to KBZ Pay must be in pyas (MMK × 100). |

### Testability

| ID | Requirement | Current Status |
|---|---|---|
| NFR-TEST-1 | The API gateway (`apps/api`) must have automated test coverage for all routes. | **Not met — see GAP-4** |
| NFR-TEST-2 | The KBZ Pay HMAC-SHA256 signature logic must have test coverage for both valid and tampered payloads. | Met (`services/mobile-money`) |
| NFR-TEST-3 | The KYC service must have test coverage for the provider interface and stub implementation. | Met (`services/kyc`) |

---

## 6. Known Gaps — Production Blockers

The following gaps must be resolved before the platform can be deployed in a live production environment. They are listed in priority order.

| ID | Gap | Impact if not fixed | Relevant code location |
|---|---|---|---|
| **GAP-1** | There is no `POST /api/v1/loans` route in the API gateway. Loan applications must currently be created by calling Fineract directly, which requires direct Fineract credentials. | Loan officers cannot originate loans through the app. The most important user flow is broken. | `apps/api/src/routes/loans.ts` |
| **GAP-2** | The KBZ Pay webhook handler receives payment notifications but does not automatically post the repayment to Fineract. Repayment only reaches Fineract if the mobile client polls `GET /payments/status/:orderId`. | If the borrower's app crashes or loses connectivity after paying, the repayment is never recorded — a financial integrity failure. | `services/mobile-money/src/routes.ts` |
| **GAP-3** | The loan search parameter (`sqlSearch`) is directly interpolated into a Fineract query string without sanitization, allowing SQL injection. | An attacker with a valid staff token could extract or corrupt data in the Fineract database. | `apps/api/src/routes/loans.ts` line 15 |
| **GAP-4** | There are no automated tests for `apps/api`, `apps/web`, or `apps/mobile`. Tests exist only for `services/kyc` and `services/mobile-money`. | Regressions in the critical gateway path go undetected until manual QA or production failure. | `apps/api/` |
| **GAP-5** | The KYC service is wired to the stub provider, which auto-approves all submissions after 2 seconds. No real identity verification provider (Smile Identity or Onfido) is integrated. | Borrower identity is not verified. Regulatory and fraud risk in production. | `services/kyc/src/index.ts` |

---

## 7. Out of Scope

The following are explicitly excluded from this version of the requirements:

| Feature | Notes |
|---|---|
| **Borrower self-service** | The `customer` role is defined in Keycloak but not implemented. A borrower-facing mobile experience is a future phase. |
| **Multi-branch support** | The system is designed for a single branch. Branch-level segmentation, inter-branch transfers, and consolidated multi-branch reporting are not in scope. |
| **Multi-currency** | MMK only. No USD, SGD, or other currency support. |
| **SMS / push notifications** | No notification system is in scope — no loan approval alerts, repayment reminders, or overdue notices. |
| **Loan restructuring / rescheduling** | Modifying loan terms mid-lifecycle (extending term, capitalizing arrears) is handled by Fineract internally and not exposed via the gateway. |
| **GL / accounting reconciliation** | Fineract manages its own general ledger. No external accounting system integration is in scope. |

---

## 8. Constraints & Assumptions

| Constraint / Assumption | Detail |
|---|---|
| **Fineract is a black box** | All interaction with Fineract is via its REST API only. No direct database writes. No schema changes. No forking the Fineract codebase. |
| **Single-tenant deployment** | The system runs against the Fineract `default` tenant. Multi-tenant operation is not supported. |
| **Myanmar-only** | Currency is MMK. Payment provider is KBZ Pay. Identity document is the NRC. No i18n or localisation framework is in scope. |
| **KBZ Pay credentials required** | UAT and production credentials (`KBZPAY_APP_ID`, `KBZPAY_MERCHANT_CODE`, `KBZPAY_SIGN_KEY`) must be obtained from KBZ Bank's Transaction Banking Department separately. |
| **Keycloak realm is imported once** | `infra/keycloak/realm-mifos.json` is auto-imported on first boot only. Any changes to the realm configuration require a full volume wipe (`docker compose down -v`) and restart. |
| **Fineract cold start** | On first boot, Fineract runs Liquibase schema migrations against MySQL. This takes 2–3 minutes. Services that depend on Fineract will be unavailable during this window. |
