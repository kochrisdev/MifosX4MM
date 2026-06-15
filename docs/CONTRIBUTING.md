# Contributing & Feature Development

This guide covers how to add features to MifosX4MM, the code patterns the project follows, and the known issues to be aware of.

---

## Adding a new API route (full pattern)

All new features follow the same chain: shared types → API gateway route → React Query hook → UI component.

**Example: adding `GET /api/v1/loans/:loanId/documents`**

### 1. Add types to shared-types

```typescript
// packages/shared-types/src/index.ts
export interface LoanDocument {
  id: number
  name: string
  type: string
  uploadedAt: string
  url: string
}
```

Then rebuild so other packages can import the new type:

```bash
pnpm --filter @mifos-x/shared-types build
```

### 2. Add the gateway route

```typescript
// apps/api/src/routes/loans.ts  (add alongside existing loan routes)
app.get<{ Params: { loanId: string } }>(
  '/loans/:loanId/documents',
  { preHandler: [app.authenticate] },
  async (req, reply) => {
    const { data } = await fineract.get(`/loans/${req.params.loanId}/documents`)
    return reply.send({ success: true, data: data.pageItems ?? [] })
  }
)
```

All routes live under `/api/v1` (prefix registered in `apps/api/src/index.ts`). No new registration needed for routes added to existing route files.

### 3. Add the React Query hook

```typescript
// apps/web/src/hooks/useLoanDocuments.ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { LoanDocument } from '@mifos-x/shared-types'

export function useLoanDocuments(loanId: number) {
  return useQuery({
    queryKey: ['loans', loanId, 'documents'],
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: LoanDocument[] }>(
        `/loans/${loanId}/documents`
      )
      return data.data
    },
  })
}
```

Use `useInfiniteQuery` for paginated lists, `useQuery` for single resources or fixed-size collections.

### 4. Use the hook in the page component

```tsx
// apps/web/src/app/(protected)/loans/[loanId]/page.tsx  (example)
const { data: documents, isLoading } = useLoanDocuments(Number(params.loanId))
```

---

## Code patterns to follow

### API responses

Every response uses `ApiResponse<T>` from `@mifos-x/shared-types`:

```typescript
// Success
reply.send({ success: true, data: result })

// Error (handled automatically by Fastify's error handler in apps/api/src/index.ts)
throw new Error('Loan not found')  // → { success: false, error: 'Loan not found' }
```

Never return a bare object. Never return `{ data: ... }` without the `success` key.

### Route protection

```typescript
// Any authenticated user
{ preHandler: [app.authenticate] }

// Restricted to specific roles
{ preHandler: [app.authenticate, app.authorize(['branch_manager', 'super_admin'])] }
```

Role names match the Keycloak realm roles in `infra/keycloak/realm-mifos.json`: `super_admin`, `branch_manager`, `loan_officer`, `teller`, `customer`.

### Token refresh

The Axios interceptor in `apps/web/src/lib/api.ts` and `apps/mobile/src/lib/api.ts` handles 401 responses automatically — it refreshes the token and retries the original request once. Do not add 401 handling inside individual hooks or components.

### Fineract proxy pattern

The gateway always adds:
- `Authorization: Basic mifos:password` (from env vars)
- `Fineract-Platform-TenantId: default` (from env var)

These are set on the shared axios instance in `apps/api/src/fineract.ts`. Never hardcode credentials in route handlers.

---

## Adding a KYC provider

1. Create `services/kyc/src/providers/yourProvider.ts` implementing the `KycProvider` interface from `services/kyc/src/provider.ts`:
   ```typescript
   export class YourProvider implements KycProvider {
     readonly name = 'your_provider'
     async submit(req: KycVerificationRequest): Promise<KycSubmission> { ... }
     async getStatus(submissionId: string): Promise<KycSubmission> { ... }
     async handleWebhook(payload: unknown): Promise<KycWebhookPayload> { ... }
     async getStats(): Promise<KycStats> { ... }
   }
   ```

2. Add the env vars your provider needs to `.env.example` with comments.

3. Add a `case` in `resolveProvider()` in `services/kyc/src/index.ts`:
   ```typescript
   case 'your_provider': return new YourProvider()
   ```

4. Document the new env vars in `docs/DEVELOPMENT.md` under the KYC section.

5. Set `KYC_PROVIDER=your_provider` in `.env` and restart the KYC service.

---

## Adding a reporting endpoint

1. Add the SQL query and FastAPI route to the relevant router in `services/reporting/routers/` (or create a new router file):
   ```python
   @router.get("/collections/by-officer")
   async def collections_by_officer(db: AsyncSession = Depends(get_db)):
       result = await db.execute(text("""
           SELECT ...
       """))
       return result.mappings().all()
   ```

2. If creating a new router file, register it in `services/reporting/main.py`:
   ```python
   from routers import your_router
   app.include_router(your_router.router, prefix="/reports/your-area")
   ```

3. Add the endpoint to `docs/API.md`.

4. If the gateway should expose this data, add a call in `apps/api/src/routes/dashboard.ts` or a new route file.

---

## Testing

Only `services/kyc` and `services/mobile-money` have Vitest test suites. Web, mobile, and the API gateway do not yet have tests.

```bash
# Run all tests
pnpm test

# Run tests for a specific service
pnpm --filter @mifos-x/kyc test
pnpm --filter @mifos-x/mobile-money test

# Run a single test file
pnpm --filter @mifos-x/mobile-money exec vitest run src/kbzpay/signature.test.ts
```

**Always run the KBZ Pay signature tests when touching `services/mobile-money/src/kbzpay/signature.ts`** — a wrong signature breaks payments silently with no error from KBZ Pay.

When adding new features to `services/kyc` or `services/mobile-money`, add a test alongside the implementation. For new routes in `apps/api`, manual testing with curl (see `docs/DEVELOPMENT.md`) is the current approach.

---

## Known issues & tech debt

Be aware of these before making changes. Do not make them worse.

### 1. SQL injection in loan search

**File**: `apps/api/src/routes/loans.ts` around the `sqlSearch` parameter.

The search string is directly interpolated into a Fineract query parameter that Fineract passes to its own SQL layer. This is a known vulnerability. The fix is to validate/sanitize the search string before passing it through. Do not add any other directly-interpolated query parameters anywhere in the codebase.

### 2. KBZ Pay webhook does not auto-post repayment

**File**: `services/mobile-money/src/routes.ts` — the `POST /webhooks/kbzpay` handler.

The webhook receives and verifies KBZ Pay's server-to-server payment notification, but does not currently post the repayment back to Fineract. Repayment posting only happens when the mobile client polls `GET /api/v1/payments/status/:orderId`. This means if the client never polls (app crash, network loss after payment), the repayment is not recorded. The correct fix is to emit an event from the webhook handler to the API gateway to post the repayment — see the TODO comment in the webhook handler.

### 3. `strict: false` in web tsconfig

**File**: `apps/web/tsconfig.json`

The web app runs with TypeScript strict mode disabled. All backend services use `strict: true`. Do not relax this further. When working in `apps/web`, fix any type errors you encounter rather than suppressing them.

### 4. No test coverage for apps/api, apps/web, apps/mobile

Tests exist only in `services/kyc` and `services/mobile-money`. Adding Vitest to `apps/api` is the highest-value next testing investment — the gateway routes are the critical path for everything.

### 5. Loan application creation not exposed via gateway

Creating a loan application (the first step before approval) must currently be done by calling Fineract directly. There is no `POST /api/v1/loans` route in the gateway. This is a known gap — the web portal would need this for a complete loan origination workflow.

---

## Documentation

When making changes, update the relevant docs:

| Change | Doc to update |
|---|---|
| New API route | `docs/API.md` |
| New env var | `docs/DEVELOPMENT.md` (env vars table) + `.env.example` |
| New service or port | `docs/DEVELOPMENT.md` (port reference) + `README.md` |
| New KYC provider | `docs/DEVELOPMENT.md` (KYC section) + `README.md` (KYC table) |
| Architectural decision | `docs/ARCHITECTURE.md` or `docs/DOMAIN.md` |
