# @mifos-x/shared-types

Shared TypeScript definitions for the MifosX4MM monorepo. This package contains plain interfaces and union types representing Fineract entities, KBZ Pay payloads, KYC shapes, API response wrappers, dashboard metrics, and authentication shapes used across `api`, `web`, `mobile`, and other services.

## Build

From the package directory run:

```bash
npm run build
```

Or from the monorepo root with pnpm:

```bash
pnpm --filter @mifos-x/shared-types run build
```

## Main exports

- `FineractClient`, `FineractLoanAccount`, `FineractSavingsAccount`, `FineractLoanRepayment`
- `KbzPayOrderParams`, `KbzPayPrepayResponse`, `KbzPayCallbackPayload`, `KbzPayStatusResponse`, `KbzPayStatus`
- `KycSubmission`, `KycVerificationRequest`, `KycWebhookPayload`, `KycStatus`, `KycDocumentType`
- `ApiResponse<T>`, `PaginatedResponse<T>`
- `DashboardStats`
- `AuthUser`, `TokenPair`, `UserRole`

## Usage example

```ts
import { FineractClient, ApiResponse } from "@mifos-x/shared-types";

const clientResp: ApiResponse<FineractClient> = {
  success: true,
  data: {
    id: 1,
    accountNo: "0001",
    firstname: "Jane",
    lastname: "Doe",
    displayName: "Jane Doe",
    active: true,
    officeId: 1,
    officeName: "Main",
    status: { id: 300, code: "active", value: "Active" },
  },
};
```

## Notes

- The package is types-only at runtime; ensure consumers import types and rebuild when you update `src/index.ts`.
- Add new exports to `src/index.ts` and run the build to publish the `.d.ts` artifacts used by other packages.

## Detailed Type Reference

This section explains every exported type and each field so consumers understand semantics, formats, and common usage patterns.

### `FineractClient`

- `id: number` — internal numeric ID of the client in Fineract.
- `accountNo: string` — human-friendly client account number (displayed in UI).
- `externalId?: string` — optional external identifier used by other systems to map this client.
- `firstname: string`, `lastname: string` — given and family names.
- `displayName: string` — full name or preferred display string.
- `mobileNo?: string` — E.164 or local mobile number; nullable when not available.
- `emailAddress?: string` — contact email; nullable.
- `dateOfBirth?: string` — ISO formatted date `yyyy-MM-dd`.
- `active: boolean` — whether client is active/eligible for new products.
- `officeId: number` — numeric id of the branch/office the client is assigned to.
- `officeName: string` — human-friendly office name.
- `status: { id: number; code: string; value: string }` — structured status object. `code` is a short machine-readable token (e.g., `active`, `closed`) and `value` is a display label.

### `FineractLoanAccount`

Represents a loan account summary returned from Fineract.

- `id`, `accountNo`, `externalId?` — similar to `FineractClient`.
- `clientId: number`, `clientName: string` — linking info to the owning client.
- `loanProductId`, `loanProductName` — product identifiers.
- `status: { id: number; code: string; value: string }` — loan lifecycle status (e.g., `submitted`, `approved`, `active`, `closed`).
- `principal: number` — original loan principal amount.
- `approvedPrincipal: number` — amount approved (may match `principal` or differ for sanctions).
- `currency: { code: string; name: string; decimalPlaces: number }` — currency metadata; amounts are expressed in major units (e.g., MMK) unless otherwise noted by consumer conventions.
- `numberOfRepayments: number` — total scheduled installments.
- `repaymentEvery: number` and `repaymentFrequencyType: { id: number; value: string }` — frequency interval and its type (e.g., monthly, weekly).
- `interestRatePerPeriod: number`, `annualInterestRate: number` — interest rates as decimals (e.g., `12.5` for 12.5%). Confirm conventions with backend.
- `timeline` — optional dates (ISO `yyyy-MM-dd`) for submission, approval, disbursement, and expected maturity.
- `summary` — runtime-calculated balances:
  - `principalDisbursed`, `principalOutstanding`, `interestCharged`, `interestOutstanding`, `totalOutstanding`, `totalOverdue` — monetary values representing state; check `currency.decimalPlaces` when formatting.

### `FineractSavingsAccount`

- `id`, `accountNo`, `clientId`, `clientName` — identifiers.
- `savingsProductId`, `savingsProductName` — product info.
- `status` — account status object.
- `currency` — currency metadata.
- `accountBalance: number` — full ledger balance.
- `availableBalance: number` — available amount for withdrawal (may differ due to holds or pending transactions).

### `FineractLoanRepayment`

Used by APIs that create repayment transactions.

- `loanId: number` — target loan account id.
- `dateFormat: string`, `locale: string` — client formatting hints often required by Fineract endpoints (e.g., `dd MMMM yyyy` / `en`), mirror values used in API clients.
- `transactionDate: string` — ISO date string for the transaction.
- `transactionAmount: number` — amount to post.
- `paymentTypeId?: number` — numeric id mapping to a payment method (cash, transfer).
- `note?: string` — optional narration.
- `externalId?: string` — optional id for idempotency or cross-system mapping.

### KBZ Pay types (`KbzPay*`)

- `KbzPayStatus` — union: `'pending' | 'success' | 'failed' | 'expired'` — normalized status used across services.
- `KbzPayOrderParams` — parameters for creating a prepay/order request. `amount` is in the smallest currency unit (pyas) — integer. `currency` is `MMK`. `callbackUrl` and `returnUrl` are endpoints KBZ will use to notify or redirect users.
- `KbzPayPrepayResponse` — server-provided prepay identifier and expiry timestamp (unix epoch seconds).
- `KbzPayCallbackPayload` — shape sent by KBZ to the callback endpoint. Fields such as `amount` and `timestamp` are strings per provider spec; always validate `sign` server-side before trusting payload.
- `KbzPayStatusResponse` — normalized internal response when querying payment status.

### KYC types (`Kyc*`)

- `KycStatus` — lifecycle of a KYC submission: `'pending' | 'processing' | 'approved' | 'rejected' | 'manual_review'`.
- `KycDocumentType` — allowed document types; extend carefully if supporting new documents.
- `KycSubmission` — represents a stored submission record. `clientRef` maps to a `FineractClient.externalId` where possible.
- `KycVerificationRequest` — payload sent to a provider: images must be Base64-encoded strings; `dateOfBirth` uses `yyyy-MM-dd`.
- `KycWebhookPayload` — provider-to-system webhook; always validate `providerRef` and look up `submissionId`.

### API envelope types

- `ApiResponse<T>` — top-level envelope used by many APIs:
  - `success: boolean` — whether request succeeded.
  - `data?: T` — payload when `success` is `true`.
  - `error?: string` — human-friendly error message when `success` is `false`.
  - `meta?: Record<string, unknown>` — extensible metadata (e.g., warnings, deprecation info).
- `PaginatedResponse<T>` — standard pagination structure:
  - `items: T[]`, `total: number`, `page: number`, `pageSize: number`.

### `DashboardStats`

- Aggregated portfolio and collections metrics used by reporting/dashboard screens:
  - `activeClients`, `activeLoans` — counts.
  - `parRatio`, `par0`, `par30`, `par90` — portfolio-at-risk metrics; `par30` is generally the headline PAR used in UI.
  - `totalOutstanding`, `totalOverdue` — currency amounts.
  - `collectionsToday`, `collectionRate` — daily collections and percentage rate.

### Auth types

- `UserRole` — union of allowed roles: `'super_admin' | 'branch_manager' | 'loan_officer' | 'teller' | 'customer'`.
- `AuthUser` — authenticated user profile: `id` (string), `username`, `email`, `roles: UserRole[]`, optional `officeId` and `officeName` for staff scoped to branches.
- `TokenPair` — `accessToken`, `refreshToken` and `expiresIn` (seconds until expiration).

---

If you want, I can also generate a compact markdown file `TYPE_REFERENCE.md` with this section split into per-type files for quick linking from the docs.
