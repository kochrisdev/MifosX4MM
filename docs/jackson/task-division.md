# MifosX4MM — Task Division Plan

> **Project:** MifosX4MM — Myanmar Microfinance Platform  
> **Sprint goal:** Resolve all bugs so both mobile and web run end-to-end without errors  
> **After this sprint:** AWS service integration (S3, SES, Secrets Manager, CloudWatch, RDS)  
> **Date:** June 15, 2026 · **Last updated:** June 17, 2026
>
> **Sprint progress:** 8/20 bugs resolved. Android dev environment set up. **Login confirmed working end-to-end** ✅. jackson folder moved to `MifosX4MM/docs/jackson/`. CLAUDE.md updated to auto-update docs after every fix. 7 bugs remain for Jackson, 5 for Merlin.
>
> **📁 This folder moved to:** `MifosX4MM/docs/jackson/` (was `Desktop/mifox/jackson/`)

---

## Team

| Developer | Role | Ownership |
|-----------|------|-----------|
| **Jackson** (DEV006) · jackson@tamarind.tech | Mobile Lead | Expo/React Native · API Gateway · Reporting Service · Shared Types · KBZ Pay |
| **Merlin** · merlin@tamarind.tech | Web Lead | Next.js 14 Staff Portal · Web Hooks · Web Pages |

---

## Table of Contents

- [Division of Ownership](#division-of-ownership)
- [Master Task Table](#master-task-table)
- [Jackson's Task List](#jacksons-task-list)
- [Merlin's Task List](#merlins-task-list)
- [Coordination Points](#coordination-points)
- [Suggested 4-Day Schedule](#suggested-4-day-schedule)
- [After This Sprint — AWS Roadmap](#after-this-sprint--aws-roadmap)

---

## Division of Ownership

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│         JACKSON (Mobile)        │  │          MERLIN (Web)            │
├─────────────────────────────────┤  ├─────────────────────────────────┤
│ • Expo / React Native screens   │  │ • Next.js App Router pages       │
│ • Fastify API routes (loans,    │  │ • Web hooks: useClients,         │
│   payments)                     │  │   useLoans (both missing)        │
│ • FastAPI reporting service     │  │ • Fetch error handling           │
│   (db.py + 2 missing routers)   │  │ • Type mismatches in pages       │
│ • Shared TypeScript types       │  │ • UI stubs (Documents,           │
│ • KBZ Pay flow & idempotency    │  │   Settings, /loans/new)          │
└─────────────────────────────────┘  └─────────────────────────────────┘
             ↑ shared infrastructure owned by Jackson
               (API gateway, services) — notify Merlin before
               loans route and reporting service go live
```

---

## Master Task Table

> Fix in priority order: 🔴 P1 → 🟠 P2 → 🟡 P3 → 🟢 P4

| ID | Owner | Priority | Description | File(s) |
|----|-------|----------|-------------|---------|
| BUG-01 | **Jackson** | ✅ Done | `loans.ts` route — now exists with all 5 endpoints | `apps/api/src/routes/loans.ts` |
| BUG-02 | **Jackson** | ✅ Done | Keycloak JWT plugin — now exists, RS256 JWKS auth | `apps/api/src/plugins/keycloak.ts` |
| BUG-03 | **Jackson** | ✅ Done | `db.py` — now exists, MySQL + PostgreSQL dual support | `services/reporting/db.py` |
| BUG-04 | **Jackson** | ✅ Done | `portfolio.py` router — now exists, PAR0/PAR30/PAR90 | `services/reporting/routers/portfolio.py` |
| BUG-05 | **Jackson** | ✅ Done | `collections.py` router — now exists, today + overdue | `services/reporting/routers/collections.py` |
| BUG-06 | **Merlin** | ✅ Done | `useClients.ts` — now exists, infinite query + detail | `apps/web/src/hooks/useClients.ts` |
| BUG-07 | **Merlin** | ✅ Done | `useLoans.ts` — now exists, infinite query + mutations | `apps/web/src/hooks/useLoans.ts` |
| BUG-08 | **Jackson** | 🟠 P2 | Fix idempotency — duplicate Fineract repayment on every poll | `apps/api/src/routes/payments.ts` |
| BUG-09 | **Jackson** | 🟠 P2 | Fix KBZ Pay status code inconsistency across client + type | `services/mobile-money/src/kbzpay/client.ts` · `packages/shared-types/src/index.ts` |
| BUG-10 | **Jackson** | 🟠 P2 | Fix `FineractClient.dateOfBirth` type: `string` → `number[]` | `packages/shared-types/src/index.ts` |
| BUG-11 | **Jackson** | 🟠 P2 | Add missing fields to `FineractLoanAccount` | `packages/shared-types/src/index.ts` |
| BUG-12 | **Merlin** | 🟠 P2 | Fix loan detail page — wrong field names (depends on BUG-11) | `apps/web/src/app/(protected)/loans/[loanId]/page.tsx` |
| BUG-13 | **Merlin** | 🟠 P2 | Fix client detail page — missing fields + hardcoded KYC badge | `apps/web/src/app/(protected)/clients/[clientId]/page.tsx` |
| BUG-14 | **Jackson** | 🟠 P2 | Fix `handleCash()` — add try/catch, re-enable submit on error | `apps/mobile/app/loans/[loanId].tsx` |
| BUG-15 | **Jackson** | 🟠 P2 | Fix 401 interceptor — navigate to login on refresh failure | `apps/mobile/src/lib/api.ts` |
| BUG-16 | **Merlin** | 🟡 P3 | Fix `collections/page.tsx` — add `r.ok` check on fetch | `apps/web/src/app/(protected)/collections/page.tsx` |
| BUG-17 | **Merlin** | 🟡 P3 | Fix `reports/page.tsx` — add `r.ok` checks on all 3 fetches | `apps/web/src/app/(protected)/reports/page.tsx` |
| BUG-18 | **Jackson** | 🟡 P3 | Fix mobile pagination + `autoCapitalize` on search input | `apps/mobile/app/(tabs)/clients.tsx` · `apps/api/src/routes/clients.ts` |
| BUG-19 | **Merlin** | ✅ Done | Placeholder pages for `/documents` and `/settings` — both exist | `apps/web/src/app/(protected)/documents/page.tsx` · `settings/page.tsx` |
| BUG-20 | **Merlin** | 🟢 P4 | Create `/loans/new` page | `apps/web/src/app/(protected)/loans/new/page.tsx` |

---

## Jackson's Task List

### Phase 1 — Fix API server startup ✅ DONE

> ~~**Nothing can be tested until the API starts.**~~ Both files now exist. The API server can start.

#### BUG-01 · Create `apps/api/src/routes/loans.ts`

```ts
// Implement these endpoints:
// GET  /loans/:loanId              — fetch full loan detail from Fineract
// GET  /clients/:clientId/loans    — list all loans for a client
// POST /loans/:loanId/repayments   — post a repayment transaction
// POST /loans/:loanId/actions      — approve / disburse / reject
```

Use the existing `createFineractClient()` helper from `apps/api/src/fineract.ts`. Proxy each endpoint directly to the corresponding Fineract REST API.

#### BUG-02 · Create `apps/api/src/plugins/keycloak.ts`

Steps:
1. Fetch JWKS from `{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/certs`
2. Register `@fastify/jwt` with `algorithm: 'RS256'` and the JWKS public key
3. Expose `fastify.authenticate` as a `preHandler` hook that calls `request.jwtVerify()`
4. Decode payload into `request.user` matching `AuthUser` from `@mifos-x/shared-types`

---

### Phase 2 — Fix reporting service ✅ DONE

> ~~Reporting service crashes on startup → dashboard shows zeros.~~ All three files now exist (`db.py`, `portfolio.py`, `collections.py`). Dashboard should show real data once backend services are running.

#### BUG-03 · Create `services/reporting/db.py`

```python
# Point at MySQL (Fineract DB), NOT PostgreSQL
DATABASE_URL = os.environ["MYSQL_URL"]  # mysql+aiomysql://user:pass@host/fineract_tenants
```

Install: `pip install aiomysql`

#### BUG-04 · Create `services/reporting/routers/portfolio.py`

Endpoints needed:

| Endpoint | SQL target | Description |
|----------|-----------|-------------|
| `GET /reports/portfolio/summary` | `m_loan`, `m_loan_repayment_schedule` | Total outstanding, PAR30, active count |
| `GET /reports/portfolio/by-product` | `m_loan` JOIN `m_product_loan` | Outstanding grouped by product name |
| `GET /reports/portfolio/disbursements?months=12` | `m_loan_transaction` | Monthly disbursement totals |

#### BUG-05 · Create `services/reporting/routers/collections.py`

| Endpoint | SQL target | Description |
|----------|-----------|-------------|
| `GET /reports/collections/today` | `m_loan_transaction` | Sum of repayments where `transaction_date = today` |
| `GET /reports/collections/overdue` | `m_loan` JOIN `m_loan_repayment_schedule` | Loans with `duedate < today AND completed_derived = 0` |

---

### Phase 3 — Shared types + KBZ Pay `Day 2`

#### BUG-10 · Fix `FineractClient.dateOfBirth`

```ts
// Before:
dateOfBirth?: string;

// After:
dateOfBirth?: number[]; // [year, month, day]
```

> ⚠️ **Notify Merlin** after this change — web client detail page uses this field.

#### BUG-11 · Extend `FineractLoanAccount`

Add to `packages/shared-types/src/index.ts`:

```ts
inArrears: boolean;
repaymentSchedule?: {
  periods: Array<{
    period: number;
    dueDate: number[];
    principalDue: number;
    interestDue: number;
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    complete: boolean;
  }>;
};
transactions?: Array<{
  id: number;
  type: { value: string };
  date: number[];
  amount: number;
  outstandingLoanBalance: number;
}>;
// Add displaySymbol to currency:
currency: { code: string; name: string; decimalPlaces: number; displaySymbol: string; };
// Add totalRepayment to summary:
summary: { ..., totalRepayment: number; };
```

> ⚠️ **Notify Merlin** — Merlin's BUG-12 and BUG-13 fixes depend on this.

#### BUG-09 · Fix KBZ Pay status inconsistency

In `services/mobile-money/src/kbzpay/client.ts`:

```ts
// parseCallback() — change:
success: payload.status === '0'  // ❌ wrong
// to:
success: payload.status === '1'  // ✅ correct
```

In `packages/shared-types/src/index.ts`:

```ts
// Fix the comment on KbzPayCallbackPayload:
status: '0' | '1' | '2'; // 0=pending, 1=success, 2=failed
```

#### BUG-08 · Fix idempotency in `payments.ts`

Move the Fineract repayment post from the polling endpoint to the KBZ Pay webhook:

1. In `apps/api/src/routes/payments.ts` — **remove** the `fineract.post(...)` call from `GET /payments/status/:orderId`
2. In `services/mobile-money/src/routes.ts` — **add** the Fineract post inside the webhook handler where the `// TODO` comment is:

```ts
if (result.success) {
  await axios.post(`${process.env.API_GATEWAY_URL}/internal/payments/post-repayment`, {
    orderId: result.orderId,
  });
}
```

---

### Phase 4 — Mobile crashes `Day 2–3`

#### BUG-14 · Fix `handleCash()` — add try/catch

In `apps/mobile/app/loans/[loanId].tsx`:

```ts
const handleCash = async () => {
  setSubmitting(true);
  try {
    await postRepayment.mutateAsync({ loanId, amount, date, note });
    setSuccess(true);
  } catch (err) {
    Alert.alert('Repayment Failed', err instanceof Error ? err.message : 'Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

#### BUG-15 · Fix 401 interceptor navigation

In `apps/mobile/src/lib/api.ts`, after clearing tokens add:

```ts
import { router } from 'expo-router';

// Inside the refresh failure catch block:
router.replace('/(auth)/login');
```

#### BUG-18 · Fix mobile pagination + search

In `apps/mobile/app/(tabs)/clients.tsx`:

```ts
// Fix pagination params:
{ offset: pageParam * PAGE_SIZE, limit: PAGE_SIZE, displayName: search }

// Fix search input:
<TextInput autoCapitalize="none" ... />
```

---

## Merlin's Task List

### Phase 1 — Create missing hook files `Day 1`

> **These two files must be created first** — the web app fails to build without them.

#### BUG-06 · Create `apps/web/src/hooks/useClients.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FineractClient, FineractLoanAccount } from '@mifos-x/shared-types';

export const useClient = (clientId: number) =>
  useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.get<FineractClient>(`/clients/${clientId}`).then(r => r.data),
    staleTime: 30_000,
  });

export const useClientLoans = (clientId: number) =>
  useQuery({
    queryKey: ['client-loans', clientId],
    queryFn: () => api.get<FineractLoanAccount[]>(`/clients/${clientId}/loans`).then(r => r.data),
    staleTime: 30_000,
    enabled: !!clientId,
  });
```

#### BUG-07 · Create `apps/web/src/hooks/useLoans.ts`

```ts
export const useLoan = (loanId: number) => useQuery({ ... });
export const usePostRepayment = () => useMutation({ ... });
export const useLoanAction = () => useMutation({ ... });
```

---

### Phase 2 — Fix page type mismatches `Day 1–2`

> Wait for Jackson to complete **BUG-11** before finalising all field paths in BUG-12.

#### BUG-12 · Fix `loans/[loanId]/page.tsx`

```ts
// Corrections:
loan.productName          → loan.loanProductName
loan.totalOutstanding     → loan.summary.totalOutstanding
loan.totalRepayment       → loan.summary.totalRepayment
loan.disbursementDate     → loan.timeline.actualDisbursementDate
loan.repaymentSchedule.periods → loan.repaymentSchedule?.periods
```

#### BUG-13 · Fix `clients/[clientId]/page.tsx`

1. Remove or add `client.gender` and `client.activationDate` — verify with Jackson if Fineract returns them
2. Update `fmtDate(client.dateOfBirth)` after BUG-10 is merged (type changes from `string` → `number[]`)
3. Replace hardcoded KYC badge with real KYC status:

```ts
// Replace:
<Badge label="Verified" variant="green" />

// With:
const { data: kycStatus } = useKycStatus(client.externalId);
<Badge label={kycStatus?.status ?? 'Unknown'} variant={kycStatus?.status === 'approved' ? 'green' : 'amber'} />
```

---

### Phase 3 — Error handling `Day 2`

#### BUG-16 · Fix `collections/page.tsx`

```ts
const res = await fetch(`${API_URL}/collections`);
if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`);
const data = await res.json();
```

Add an error state in the JSX:

```tsx
if (error) return <div className="text-red-600">Failed to load collections. Please refresh.</div>;
```

#### BUG-17 · Fix `reports/page.tsx`

Apply the same `if (!res.ok) throw` pattern to all three `fetch()` calls. Add per-section error states so a failure in one chart doesn't blank out the whole reports page.

---

### Phase 4 — Stub pages `Day 3`

#### BUG-19 · Create placeholder pages

`apps/web/src/app/(protected)/documents/page.tsx` and `settings/page.tsx`:

```tsx
export default function DocumentsPage() {
  return (
    <div className="p-8 text-center text-gray-500">
      <h1 className="text-2xl font-semibold mb-2">Documents</h1>
      <p>Coming soon.</p>
    </div>
  );
}
```

#### BUG-20 · Create `/loans/new` page

`apps/web/src/app/(protected)/loans/new/page.tsx`:

- Read `clientId` from `searchParams`
- Fetch loan products: `GET /loanproducts`
- Form fields: product selector, principal amount, repayment count, start date
- Submit → `POST /clients/:clientId/loans`

---

## Coordination Points

These are the specific moments where Jackson's and Merlin's work intersects. **Sync before the dependent work begins.**

| Topic | Who → Who | Detail |
|-------|-----------|--------|
| **Loans route live** (BUG-01) | Jackson → Merlin | Once `loans.ts` exists and the API restarts, Merlin can test `useLoans.ts`. Share the exact endpoint shapes and response format |
| **Shared type changes** (BUG-10, BUG-11) | Jackson → Merlin | Run `pnpm build` in `packages/shared-types` after changes so TypeScript errors surface immediately. Merlin needs to update field paths in BUG-12 and BUG-13 |
| **Reporting service live** (BUG-03–05) | Jackson → Merlin | Once running, test dashboard and reports pages together on staging — they should both see real data |
| **Payments idempotency** (BUG-08) | Jackson → Merlin | The fix changes the behaviour of `GET /payments/status/:orderId`. Confirm the web loan detail page has no payment polling before Jackson merges |
| **Local startup order** | Both | MySQL → Keycloak → Fineract → reporting service → mobile-money service → API gateway → web / mobile. Update `DEVELOPMENT.md` after the sprint |

---

## Suggested 4-Day Schedule

| Day | Jackson | Merlin |
|-----|---------|--------|
| ~~**Day 1**~~ ✅ Done | ~~BUG-01 + BUG-02 → API starts. BUG-03 (db.py)~~ All done | ~~BUG-06 + BUG-07~~ Both done |
| ~~**Day 2**~~ ✅ Done | ~~BUG-04 + BUG-05~~ Done. BUG-10 + BUG-11 (shared types) **← START HERE** | BUG-12 + BUG-13 (wait for Jackson's type changes). BUG-16 + BUG-17 |
| **Now** | BUG-10 + BUG-11 → notify Merlin. Then BUG-09 + BUG-08 (KBZ + idempotency) | BUG-12 + BUG-13 (can start after BUG-11). BUG-16 + BUG-17. BUG-20 |
| **Next** | BUG-14 + BUG-15 + BUG-18 (mobile crashes + pagination) | Full end-to-end test of web portal |
| **After** | Cross-test: mobile repayment end-to-end, dashboard real data | Cross-test: web loan detail, reports, collections |

---

## After This Sprint — AWS Roadmap

> Detailed tickets to be created at the start of the AWS sprint.

| AWS Service | Owner | Purpose |
|-------------|-------|---------|
| **S3** | Jackson | Store KYC document images (replace base64). Loan agreement PDFs. Static asset CDN |
| **SES** | Merlin | Transactional email — loan approvals, repayment confirmations, overdue reminders |
| **Secrets Manager** | Jackson | Replace `.env` files for Keycloak credentials, Fineract Basic Auth, KBZ Pay `signKey` |
| **Cognito** _(optional)_ | Both | Evaluate replacing Keycloak — reduces infra ops overhead. Decision pending |
| **CloudWatch** | Jackson | Structured logging from Fastify + FastAPI. Metrics for API latency, error rate, KBZ Pay success rate |
| **RDS (MySQL)** | Both | Migrate Fineract MySQL from Docker to RDS — automated backups, multi-AZ, resolves the dual-database reporting problem |

---

*Last updated: June 17, 2026 · MifosX4MM Bug-Fix Sprint — Jackson × Merlin · 8/20 bugs done*
