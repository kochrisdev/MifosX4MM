# User Stories — MifosX4MM

**Version:** 1.0  
**Date:** 2026-05-26  
**Companion document:** `docs/requirements/SRS.md`  

Stories are organized by epic. Each story ID is stable and can be used as a ticket reference.

**Acceptance criteria format:**
- Simple CRUD operations → **bullet-point checklist**
- Complex flows (payments, KYC, loan state transitions) → **Given / When / Then**

---

## Epic Index

| Epic | Title | Primary Actor |
|---|---|---|
| [E1](#e1-authentication--session) | Authentication & Session | All roles |
| [E2](#e2-client-registration--management) | Client Registration & Management | Loan Officer, Branch Manager |
| [E3](#e3-kyc-submission--verification) | KYC Submission & Verification | Loan Officer |
| [E4](#e4-loan-origination) | Loan Origination | Loan Officer (submit), Branch Manager (approve / disburse) |
| [E5](#e5-repayment-collection--cash) | Repayment Collection — Cash | Loan Officer, Teller |
| [E6](#e6-repayment-collection--kbz-pay) | Repayment Collection — KBZ Pay | Loan Officer |
| [E7](#e7-portfolio-monitoring--dashboard) | Portfolio Monitoring & Dashboard | Branch Manager |
| [E8](#e8-reporting) | Reporting | Branch Manager, Super Admin |
| [E9](#e9-production-readiness--gap-closure) | Production-Readiness (Gap Closure) | Dev team |

---

## E1: Authentication & Session

### [E1-S1] Log in to the platform

**As a** staff member,  
**I want** to log in with my username and password,  
**So that** I can access the features my role permits.

**Acceptance Criteria:**
- System accepts username + password via `POST /api/v1/auth/login`
- On success, returns an access token and a refresh token
- On invalid credentials, returns a clear error (not a 500)
- Tokens are stored by the web/mobile client for subsequent requests

**SRS refs:** FR-AUTH-1

---

### [E1-S2] Stay logged in during a field visit

**As a** staff member,  
**I want** my session to be automatically refreshed when my access token expires,  
**So that** I am not logged out mid-visit while working in the field.

**Acceptance Criteria:**
- When an API request returns 401, the client automatically calls `POST /api/v1/auth/refresh` with the stored refresh token
- If refresh succeeds, the original request is retried transparently — no user action required
- If refresh fails (expired or revoked token), the user is redirected to the login screen
- The retry only happens once per request (no infinite loop)

**SRS refs:** FR-AUTH-2

---

### [E1-S3] Log out and revoke session

**As a** staff member,  
**I want** to log out and have my session fully revoked,  
**So that** my credentials cannot be reused if my device is lost or shared.

**Acceptance Criteria:**
- Calling `POST /api/v1/auth/logout` with the refresh token revokes it on Keycloak
- After logout, using the refresh token to generate a new access token fails
- Client clears stored tokens on successful logout

**SRS refs:** FR-AUTH-3

---

### [E1-S4] View my own profile and role

**As a** staff member,  
**I want** to retrieve my authenticated profile and role,  
**So that** the frontend can show role-appropriate navigation and features.

**Acceptance Criteria:**
- `GET /api/v1/auth/me` (requires valid JWT) returns the user's username, email, and roles array
- Returns 401 if called without a token

**SRS refs:** FR-AUTH-4, FR-AUTH-6

---

## E2: Client Registration & Management

### [E2-S1] Register a new borrower client

**As a** loan officer,  
**I want** to register a new client with their personal details,  
**So that** I can begin a loan application on their behalf.

**Acceptance Criteria:**
- `POST /api/v1/clients` accepts at minimum: first name, last name, date of birth, mobile number
- On success, returns the new client record including the Fineract-assigned client ID
- Returns a validation error if required fields are missing
- Only `loan_officer`, `branch_manager`, and `super_admin` can create clients

**SRS refs:** FR-CLIENT-1

---

### [E2-S2] Search and list clients

**As a** staff member,  
**I want** to search for clients by name and browse the full client list,  
**So that** I can quickly find the right borrower record.

**Acceptance Criteria:**
- `GET /api/v1/clients` returns a paginated list (default page size: 20)
- Optional `search` query param filters by display name
- Response includes total record count for pagination UI
- Any authenticated user can access this endpoint

**SRS refs:** FR-CLIENT-2

---

### [E2-S3] View a client's full profile

**As a** staff member,  
**I want** to view all details on a specific client's record,  
**So that** I can understand their identity and contact information before processing a loan.

**Acceptance Criteria:**
- `GET /api/v1/clients/:clientId` returns the full Fineract client object
- Returns 404 if client ID does not exist
- Any authenticated user can access this endpoint

**SRS refs:** FR-CLIENT-3

---

### [E2-S4] View a client's loan accounts

**As a** staff member,  
**I want** to see all loan accounts linked to a client,  
**So that** I can review their borrowing history before making a credit decision.

**Acceptance Criteria:**
- `GET /api/v1/clients/:clientId/loans` returns a list of all loan accounts for that client
- Each item includes loan ID, account number, status, outstanding balance
- Any authenticated user can access this endpoint

**SRS refs:** FR-CLIENT-4

---

### [E2-S5] Update a client's details

**As a** loan officer,  
**I want** to update a client's contact information,  
**So that** records stay accurate as borrowers change address or phone number.

**Acceptance Criteria:**
- `PUT /api/v1/clients/:clientId` accepts a partial update body
- Returns the updated client record on success
- Only `loan_officer`, `branch_manager`, and `super_admin` can update clients

**SRS refs:** FR-CLIENT-5

---

## E3: KYC Submission & Verification

### [E3-S1] Submit a client's identity documents for verification

**As a** loan officer,  
**I want** to submit a client's NRC number and identity documents to the KYC service,  
**So that** their identity is verified before the loan is approved.

**Acceptance Criteria:**

Given I am authenticated as a `loan_officer`,  
When I submit a KYC request with a valid client ID, NRC number (`documentType: "nrc"`), and document files,  
Then the KYC service creates a submission record with status `pending`,  
And returns a submission ID I can use to poll for the result.

Given the submitted documents are invalid or unreadable,  
When the KYC provider processes the request,  
Then the submission status is updated to `rejected` with a reason code,  
And the loan cannot proceed to disbursement.

**SRS refs:** FR-KYC-1, FR-KYC-4

---

### [E3-S2] Check KYC verification status

**As a** loan officer,  
**I want** to check whether a client's KYC verification has been approved or rejected,  
**So that** I know whether to proceed with the loan application.

**Acceptance Criteria:**

Given I have a valid submission ID from a previous KYC submission,  
When I request the status for that submission ID,  
Then the system returns one of: `pending`, `approved`, or `rejected`,  
And if `rejected`, returns a human-readable reason.

Given the submission does not exist or belongs to another branch,  
When I request its status,  
Then the system returns a 404 or 403 error.

**SRS refs:** FR-KYC-2

---

### [E3-S3] Receive KYC webhook and update status automatically

**As the** system,  
**I want** to receive asynchronous callbacks from the KYC provider and update the submission status,  
**So that** loan officers see current verification results without needing to manually trigger a status check.

**Acceptance Criteria:**

Given the KYC provider sends a webhook callback to the KYC service,  
When the payload signature is valid,  
Then the submission status is updated to `approved` or `rejected` accordingly.

Given the KYC provider sends a webhook with an invalid or missing signature,  
When the KYC service receives it,  
Then the request is rejected with 401 and the status is not updated.

**SRS refs:** FR-KYC-3

---

## E4: Loan Origination

> **Note:** E4-S1 (loan application submission) is a known gap — `POST /api/v1/loans` does not yet exist in the gateway. See also E9-S1.

### [E4-S1] Submit a loan application *(GAP — not yet implemented)*

**As a** loan officer,  
**I want** to submit a loan application for a KYC-verified client through the app,  
**So that** a branch manager can review and approve it without anyone needing direct Fineract access.

**Acceptance Criteria:**

Given I am authenticated as a `loan_officer`,  
When I submit a loan application with a valid client ID, requested amount (MMK), loan term, and product ID,  
Then the application is created in Fineract with status 100 (Submitted),  
And I receive a confirmation response with the new loan ID and account number.

Given the client's KYC has not been approved,  
When I attempt to submit a loan application,  
Then the system rejects the request with a clear error indicating KYC is required.

Given the submitted amount or term is outside the allowed range for the product,  
When I submit the application,  
Then the system returns a validation error before forwarding to Fineract.

**SRS refs:** FR-LOAN-1

---

### [E4-S2] View all loan applications

**As a** branch manager,  
**I want** to view all loans in the system, filterable by status,  
**So that** I can find submitted applications that need review.

**Acceptance Criteria:**
- `GET /api/v1/loans` returns a paginated list of loan accounts
- Optional `search` query param searches by account number
- Response includes loan ID, client name, status, outstanding amount, and next payment date
- Any authenticated user can access the list

**SRS refs:** FR-LOAN-2

---

### [E4-S3] Approve a loan application

**As a** branch manager,  
**I want** to approve a submitted loan application,  
**So that** the loan can proceed to disbursement.

**Acceptance Criteria:**

Given I am authenticated as a `branch_manager` or `super_admin`,  
When I send `POST /api/v1/loans/:loanId/actions` with `{ command: "approve" }`,  
Then Fineract moves the loan to status 200 (Approved),  
And the response confirms the new status.

Given I am authenticated as a `loan_officer` or `teller`,  
When I attempt to approve a loan,  
Then the system returns 403 Forbidden.

Given the loan is not in Submitted status (100),  
When I attempt to approve it,  
Then Fineract returns an error and the gateway surfaces it to the client.

**SRS refs:** FR-LOAN-4, NFR-SEC-1

---

### [E4-S4] Reject a loan application

**As a** branch manager,  
**I want** to reject a loan application with an optional note,  
**So that** the loan officer can inform the client of the decision.

**Acceptance Criteria:**

Given I am authenticated as a `branch_manager` or `super_admin`,  
When I send `POST /api/v1/loans/:loanId/actions` with `{ command: "reject", note: "..." }`,  
Then Fineract moves the loan to status 500 (Rejected),  
And the note is stored against the loan record.

Given I am not a branch manager or super admin,  
When I attempt to reject a loan,  
Then the system returns 403 Forbidden.

**SRS refs:** FR-LOAN-5

---

### [E4-S5] Disburse an approved loan

**As a** branch manager,  
**I want** to disburse an approved loan,  
**So that** funds are released to the borrower and a repayment schedule is automatically generated.

**Acceptance Criteria:**

Given I am authenticated as a `branch_manager` or `super_admin`,  
When I send `POST /api/v1/loans/:loanId/actions` with `{ command: "disburse" }`,  
Then Fineract moves the loan to status 300 (Active),  
And Fineract automatically generates the repayment schedule.

Given the loan is not in Approved status (200),  
When I attempt to disburse,  
Then Fineract returns an error and the gateway surfaces it clearly.

Given the client's KYC is not approved,  
When I attempt to disburse,  
Then the system rejects the request before forwarding to Fineract.

**SRS refs:** FR-LOAN-6, FR-KYC-4

---

## E5: Repayment Collection — Cash

### [E5-S1] Record a cash repayment (loan officer in the field)

**As a** loan officer,  
**I want** to post a cash repayment against a borrower's loan,  
**So that** the installment is marked as paid in the system immediately.

**Acceptance Criteria:**
- `POST /api/v1/loans/:loanId/repayments` accepts transaction date, amount (MMK), and payment type
- On success, returns the posted transaction record from Fineract
- Accessible to `loan_officer`, `teller`, `branch_manager`, and `super_admin`
- Returns an error if the loan is not in Active status (300)

**SRS refs:** FR-LOAN-7

---

### [E5-S2] Record a cash repayment (teller at the counter)

**As a** teller,  
**I want** to record a cash repayment from a walk-in borrower,  
**So that** counter payments are captured in the system.

**Acceptance Criteria:**
- Same endpoint as E5-S1 (`POST /api/v1/loans/:loanId/repayments`)
- Teller role has access
- The teller must locate the correct loan account (by account number or client name) before posting
- A teller cannot approve loans, create clients, or access reports

**SRS refs:** FR-LOAN-7

---

### [E5-S3] View a loan's repayment schedule

**As a** staff member,  
**I want** to view the full repayment schedule for a loan,  
**So that** I know which installments have been paid and which are still due.

**Acceptance Criteria:**
- `GET /api/v1/loans/:loanId` returns repayment schedule (installments) and transaction history
- Each installment shows: due date, principal due, interest due, whether completed
- Any authenticated user can view any loan's schedule
- Returns 404 if loan does not exist

**SRS refs:** FR-LOAN-3

---

## E6: Repayment Collection — KBZ Pay

### [E6-S1] Initiate a KBZ Pay payment

**As a** loan officer,  
**I want** to initiate a KBZ Pay mobile payment for a borrower's loan installment,  
**So that** the borrower can pay digitally without handling cash.

**Acceptance Criteria:**

Given I am authenticated and provide a valid loan ID, amount (MMK), borrower name, and borrower phone,  
When I call `POST /api/v1/payments/initiate`,  
Then the system forwards the request to the mobile money service, which calls KBZ Pay's `/precreate` endpoint,  
And the system returns a `prepayId` and a KBZ Pay deep link (`kbzpay://pay?prepay_id=...`).

Given the amount provided is zero or negative,  
When I submit the initiation request,  
Then the system returns a validation error before calling KBZ Pay.

Given KBZ Pay returns an error during precreation,  
When the mobile money service receives it,  
Then the error is propagated to the caller with a human-readable message.

**SRS refs:** FR-PAY-1, FR-PAY-5

---

### [E6-S2] Check KBZ Pay payment status

**As a** loan officer,  
**I want** to check whether a KBZ Pay payment was completed,  
**So that** I can confirm the repayment before leaving the borrower's location.

**Acceptance Criteria:**

Given I have a valid `orderId` from a previous payment initiation,  
When I call `GET /api/v1/payments/status/:orderId?loanId=:loanId`,  
Then the system returns the payment status: `pending`, `success`, or `failed`.

Given the payment status is `success` and a `loanId` is provided,  
When the gateway receives the confirmed status,  
Then it automatically posts the repayment to Fineract (converting pyas to MMK),  
And the response confirms both the payment status and the Fineract transaction.

**SRS refs:** FR-PAY-2

---

### [E6-S3] Auto-post repayment on KBZ Pay webhook *(GAP — not yet implemented)*

**As the** system,  
**I want** to automatically post a confirmed KBZ Pay repayment to Fineract when the webhook is received,  
**So that** repayments are never lost even if the borrower's app crashes or the loan officer loses connectivity.

**Acceptance Criteria:**

Given KBZ Pay sends a webhook callback to `POST /webhooks/kbzpay` on the mobile money service,  
When the HMAC-SHA256 signature is valid and the payment status is `success`,  
Then the mobile money service emits a repayment event to the API gateway,  
And the gateway posts the repayment to Fineract using the stored `loanId` and confirmed amount.

Given the HMAC-SHA256 signature does not match,  
When the webhook is received,  
Then the request is rejected with 401 and no repayment is posted.

Given the Fineract repayment POST fails (e.g., Fineract is temporarily unavailable),  
When the webhook handler processes the event,  
Then the failure is logged with the full payload so it can be retried,  
And the system does not silently discard the confirmed payment.

**SRS refs:** FR-PAY-3, FR-PAY-4, NFR-REL-1

---

## E7: Portfolio Monitoring & Dashboard

### [E7-S1] View PAR figures on the dashboard

**As a** branch manager,  
**I want** to see PAR0, PAR30, and PAR90 figures on the dashboard,  
**So that** I can immediately assess portfolio risk when I start my day.

**Acceptance Criteria:**
- `GET /api/v1/dashboard/stats` returns `par0`, `par30`, and `par90` as percentages
- PAR figures are calculated in real time from `m_loan_repayment_schedule` (not from Fineract's batch-updated `inArrears` flag)
- If the reporting service is unavailable, all PAR values default to 0 and the dashboard displays a degraded-data warning
- Requires `branch_manager` or `super_admin` role

**SRS refs:** FR-DASH-1, NFR-REL-3

---

### [E7-S2] View today's collection rate

**As a** branch manager,  
**I want** to see the percentage of today's due installments that have been paid,  
**So that** I can monitor daily collection performance in real time.

**Acceptance Criteria:**
- Dashboard response includes `collectionsToday` (MMK collected) and `collectionRate` (percentage, 0–100)
- Collection rate = (installments paid today / installments due today) × 100
- If no installments are due today, collection rate is shown as 100% or N/A (not 0%)

**SRS refs:** FR-DASH-2

---

### [E7-S3] View portfolio size and overdue exposure

**As a** branch manager,  
**I want** to see the total outstanding portfolio and total overdue amount on the dashboard,  
**So that** I understand the financial scale and risk exposure of the branch.

**Acceptance Criteria:**
- Dashboard response includes `totalOutstanding` (MMK) and `totalOverdue` (MMK)
- Values are displayed in MMK (not pyas)
- Values are real-time — not dependent on Fineract batch jobs

**SRS refs:** FR-DASH-3

---

### [E7-S4] View active loan and client counts

**As a** branch manager,  
**I want** to see the number of active loans and active clients on the dashboard,  
**So that** I know the current portfolio size at a glance.

**Acceptance Criteria:**
- Dashboard response includes `activeLoans` and `activeClients` as integer counts
- Counts reflect current Fineract state (status 300 for loans)

**SRS refs:** FR-DASH-4

---

## E8: Reporting

### [E8-S1] View portfolio summary report

**As a** branch manager,  
**I want** to view a summary report of the portfolio's financial health,  
**So that** I can prepare updates for management and identify trends over time.

**Acceptance Criteria:**
- Accessible at the reporting service (`GET /reports/portfolio/summary`)
- Returns: total outstanding (MMK), total overdue (MMK), PAR0, PAR30, PAR90
- Requires `branch_manager` or `super_admin` role (enforced at the gateway)
- If the reporting service is unavailable, the gateway returns a clear error rather than partial data

**SRS refs:** FR-RPT-1

---

### [E8-S2] View collections performance

**As a** branch manager,  
**I want** to view collection performance data,  
**So that** I can identify which loan officers are meeting their targets and which need support.

**Acceptance Criteria:**
- Returns collected amount vs. scheduled amount for today and recent periods
- Accessible at the reporting service (`GET /reports/collections/today` or equivalent)
- Figures are in MMK
- Requires `branch_manager` or `super_admin` role

**SRS refs:** FR-RPT-2

---

### [E8-S3] View KYC statistics

**As a** super admin,  
**I want** to view KYC submission volume and approval/rejection rates,  
**So that** I can monitor the verification pipeline and identify issues with the provider.

**Acceptance Criteria:**
- Returns: total submissions, approved count, rejected count, pending count
- Accessible at the KYC service (`GET /kyc/stats`)
- Requires `super_admin` role

**SRS refs:** FR-RPT-3

---

## E9: Production-Readiness (Gap Closure)

> These stories address the known gaps documented in SRS Section 6. They are developer-facing tasks but are written as stories to make acceptance testable.

### [E9-S1] Add loan application creation to the API gateway *(closes GAP-1)*

**As a** developer,  
**I want** a `POST /api/v1/loans` route in the gateway,  
**So that** loan officers can originate loans through the app without needing direct Fineract access.

**Acceptance Criteria:**

Given the route `POST /api/v1/loans` is implemented in `apps/api/src/routes/loans.ts`,  
When a `loan_officer` submits a valid loan application body (client ID, loan product ID, principal, term),  
Then the gateway forwards it to Fineract's `POST /loans` endpoint and returns the new loan record.

Given a user with `teller` role attempts to create a loan,  
When the request reaches the gateway,  
Then the gateway returns 403 Forbidden before forwarding to Fineract.

Given the Fineract request fails validation (e.g., invalid product ID),  
When the gateway receives the error,  
Then it returns the Fineract error message to the caller with an appropriate HTTP status code.

**SRS refs:** FR-LOAN-1

---

### [E9-S2] Auto-post KBZ Pay webhook repayment to Fineract *(closes GAP-2)*

**As the** system,  
**I want** the KBZ Pay webhook handler to automatically post a confirmed repayment to Fineract,  
**So that** repayments are recorded even when the mobile client never polls.

**Acceptance Criteria:**

Given the KBZ Pay webhook handler in `services/mobile-money/src/routes.ts` receives a signed `success` callback,  
When the HMAC-SHA256 signature is verified,  
Then the handler calls the API gateway (or Fineract directly) to post the repayment with the correct loanId and amount (converted from pyas to MMK).

Given Fineract is temporarily unavailable when the webhook is received,  
When the repayment POST fails,  
Then the error is logged with the full webhook payload for manual recovery — the event is not silently dropped.

Given the webhook has already been processed (duplicate delivery),  
When the handler receives it again,  
Then the repayment is not double-posted (idempotency check by `orderId`).

**SRS refs:** FR-PAY-4, NFR-REL-1

---

### [E9-S3] Sanitize loan search parameter to prevent SQL injection *(closes GAP-3)*

**As the** system,  
**I want** the `search` query parameter in `GET /api/v1/loans` to be sanitized before being forwarded to Fineract,  
**So that** an authenticated user cannot use it to inject arbitrary SQL.

**Acceptance Criteria:**

Given the route handler in `apps/api/src/routes/loans.ts` line 15,  
When a `search` param is provided,  
Then it is validated to contain only alphanumeric characters, spaces, and hyphens before being interpolated into the `sqlSearch` value,  
And any disallowed characters cause the request to return 400 Bad Request.

Given a valid alphanumeric search string,  
When the request is forwarded to Fineract,  
Then the behaviour is identical to the current implementation (loan account number search still works).

**SRS refs:** NFR-SEC-3

---

### [E9-S4] Add Vitest test suite for the API gateway *(closes GAP-4)*

**As a** developer,  
**I want** a Vitest test suite covering all routes in `apps/api`,  
**So that** regressions are caught automatically before deployment.

**Acceptance Criteria:**

Given a test suite exists in `apps/api/src/__tests__/`,  
When `pnpm --filter @mifos-x/api test` is run,  
Then all tests pass against a mocked Fineract and Keycloak.

Tests must cover:
- `POST /auth/login` — success, invalid credentials
- `GET /clients` — authenticated, unauthenticated
- `POST /clients` — success, missing fields
- `GET /loans` — authenticated, search param
- `POST /loans/:loanId/repayments` — success, loan not active
- `POST /loans/:loanId/actions` — approve/disburse with branch_manager, 403 with loan_officer
- `POST /payments/initiate` — success, zero amount
- `GET /dashboard/stats` — success, reporting service unavailable (graceful degradation)

**SRS refs:** NFR-TEST-1

---

### [E9-S5] Integrate a real KYC provider for production *(closes GAP-5)*

**As an** operator,  
**I want** to configure a real KYC provider (Smile Identity or Onfido) via the `KYC_PROVIDER` environment variable,  
**So that** borrower identity is actually verified before loans are disbursed.

**Acceptance Criteria:**

Given `KYC_PROVIDER=smile_identity` is set in `.env`,  
When the KYC service starts,  
Then it resolves the Smile Identity provider and uses it for all submit, status, and webhook operations.

Given `KYC_PROVIDER=stub` is set (development default),  
When a KYC submission is made,  
Then the stub auto-approves after 2 seconds — existing behaviour unchanged.

Given `KYC_PROVIDER` is set to an unrecognised value,  
When the KYC service starts,  
Then it fails to start with a clear error message listing the valid options.

Given a real provider is active and a borrower's NRC is submitted,  
When the provider returns `approved`,  
Then the submission status in the KYC service is updated to `approved` and the loan can proceed to disbursement.

**SRS refs:** FR-KYC-5, GAP-5 in SRS

---

*End of user stories — v1.0*
