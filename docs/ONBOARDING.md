# Onboarding Guide — First Week

This guide walks you through becoming productive on MifosX4MM in four days. The [development guide](DEVELOPMENT.md) covers *how* to run the system; this covers *what to do* once it's running, in the right order to build a complete mental model.

Read [docs/DOMAIN.md](DOMAIN.md) first if you haven't — it explains the microfinance business context that makes the code make sense.

---

## Day 1 — Get it running, explore the product

### Step 1: Start everything

```bash
pnpm install
cp .env.example .env
pnpm docker:up
```

Wait until Fineract is ready — this takes 2–3 minutes on first boot:

```bash
docker compose logs -f fineract | grep "Started FineractApplication"
# You should see: Started FineractApplication in XX.XXX seconds
```

Then start all services with hot reload:

```bash
pnpm dev
```

### Step 2: Load test data

In a new terminal:

```bash
pnpm seed
# Creates: 10 clients, 10 loan accounts (8 active/disbursed, 2 pending approval), 
#          2 repayments per active loan
```

### Step 3: Explore the web portal

Open **http://localhost:3000** and log in as `admin / Admin@1234`.

Work through each of these deliberately — don't just click through:

**Dashboard**
- What does each number mean? Cross-reference with [docs/DOMAIN.md](DOMAIN.md) glossary.
- `PAR30` is the headline risk metric. `Collection rate` is the daily operational KPI.
- These numbers come from the reporting service querying PostgreSQL directly — not from Fineract REST.

**Clients list**
- See the 10 seeded clients (Myanmar names: Aung Kyaw, Ma Aye Myat, etc.)
- Click into one client. Note the `accountNo` format and status.

**Loans list**
- 8 loans should show as Active (status 300), 2 as Pending/Submitted.
- Click into an active loan. Read the repayment schedule — notice `duedate`, `completed_derived`, `principal_amount`.
- The 2 repayments seeded per loan will show in the transactions list.

### Step 4: Explore Keycloak

Open **http://localhost:8180/admin** (admin / admin).

- Navigate to the `mifos` realm.
- Under **Clients**: see `mifos-api` (confidential service account), `mifos-staff` (public, used for web/mobile login), `mifos-mobile`.
- Under **Realm roles**: see the five roles (`super_admin`, `branch_manager`, `loan_officer`, `teller`, `customer`).
- Under **Users**: see the two seed users (`admin`, `loan.officer`) and their assigned roles.

### Step 5: Hit the API directly

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@1234"}' \
  | jq -r '.data.accessToken')

# Inspect the JWT (paste into https://jwt.io to read claims)
echo $TOKEN

# Call the dashboard
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/dashboard/stats | jq

# List clients
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/clients?pageSize=5" | jq
```

---

## Day 2 — Trace code for three features you just used

Pick three features from Day 1 and trace each from the browser click to the database query. Open the files as you read.

### Trace 1: Login

```
apps/web/src/app/login/page.tsx          — form submit calls login()
  ↓
apps/web/src/lib/api.ts                  — login() POSTs to /api/v1/auth/login
  ↓                                        stores accessToken in localStorage + cookie
apps/api/src/routes/auth.ts              — handler POSTs ROPC grant to Keycloak
  ↓
Keycloak :8180                           — issues RS256 JWT
  ↑
apps/api/src/plugins/keycloak.ts         — app.authenticate hook: verifies JWT via JWKS
                                           maps Keycloak claims → AuthUser { id, username, roles }
```

Key insight: the JWT is verified on every request by fetching Keycloak's public key from its JWKS endpoint (`/realms/mifos/protocol/openid-connect/certs`). The key is cached for 10 minutes.

### Trace 2: Dashboard stats

```
apps/web/src/hooks/useDashboardStats.ts  — useQuery hitting /api/v1/dashboard/stats
  ↓                                        refetchInterval: 60s (auto-refreshes every minute)
apps/api/src/routes/dashboard.ts         — fans out in parallel to reporting service
  ↓
services/reporting/routers/portfolio.py  — CTE query on m_loan + m_loan_repayment_schedule
services/reporting/routers/collections.py— SUM on m_loan_transaction WHERE date = TODAY
  ↓
PostgreSQL :5432 (fineract_default)      — raw SQL, no Fineract REST involved
```

Key insight: the reporting service reads the same Fineract schema tables but via asyncpg directly to PostgreSQL — bypassing Fineract REST for accuracy and performance.

### Trace 3: Loan list

```
apps/web/src/hooks/useLoans.ts           — useInfiniteQuery (offset pagination, 25/page)
  ↓
apps/api/src/routes/loans.ts             — GET /loans → Fineract /loans with pagination
  ↓
apps/api/src/fineract.ts                 — axios client with Basic auth + tenant header
  ↓
Fineract :8080                           — returns paginated loan list
  ↓
apps/api/src/routes/loans.ts             — maps Fineract response to clean shape
```

Key insight: the gateway normalises Fineract's verbose responses. Never call Fineract directly from the frontend — always go through the gateway.

---

## Day 3 — Read the key design documents in order

Work through these in sequence. Each one builds on the previous.

1. **`packages/shared-types/src/index.ts`** — Full read. These types (`FineractClient`, `FineractLoanAccount`, `KbzPayOrderParams`, `AuthUser`, `ApiResponse<T>`, etc.) appear in every service. You need to know them.

2. **`docs/ARCHITECTURE.md`** — Focus on:
   - The PAR CTE SQL query — understand the `WITH overdue_schedule AS (...)` logic
   - The service communication diagram — memorise which service calls which
   - The auth flowchart — especially the JWKS cache

3. **`infra/keycloak/realm-mifos.json`** — Skim for:
   - The three OAuth clients and their `publicClient` / `directAccessGrantsEnabled` settings
   - The `roles.realm` array (the five role names)
   - Access token lifetime (`accessTokenLifespan`: 900 seconds = 15 min)

4. **`scripts/seed-fineract.ts`** — Read fully. It shows exactly how Fineract's REST API works: create client → create loan → approve → disburse → post repayments. This is the manual version of what users do through the UI.

5. **`services/mobile-money/src/kbzpay/signature.ts`** — Read the signing algorithm. Understand: sort keys alphabetically, concatenate `key=value` pairs, append `&key={signKey}`, SHA256 uppercase. This is critical to get right — a wrong signature breaks payments silently.

---

## Day 4+ — Make your first contribution

Read **[docs/CONTRIBUTING.md](CONTRIBUTING.md)** for:
- The full pattern for adding a new API route (types → gateway → hook → UI)
- How to add a KYC provider or report endpoint
- Testing approach (which services have tests, how to run them)
- Known tech debt to avoid making worse

A good first contribution is adding one of the missing pieces called out in CONTRIBUTING.md's Known Issues section.

---

## Reference: who owns what

| Area | Primary files |
|---|---|
| Auth & JWT verification | `apps/api/src/plugins/keycloak.ts`, `infra/keycloak/realm-mifos.json` |
| All Fineract calls | `apps/api/src/routes/`, `apps/api/src/fineract.ts` |
| Web portal UI | `apps/web/src/app/`, `apps/web/src/hooks/`, `apps/web/src/components/` |
| Mobile app | `apps/mobile/app/`, `apps/mobile/src/context/AuthContext.tsx` |
| KBZ Pay signing & client | `services/mobile-money/src/kbzpay/` |
| KYC provider abstraction | `services/kyc/src/provider.ts`, `services/kyc/src/providers/` |
| Portfolio & collections SQL | `services/reporting/routers/` |
| All shared TypeScript types | `packages/shared-types/src/index.ts` |
| Docker & infrastructure | `docker-compose.yml`, `infra/` |
| Keycloak realm config | `infra/keycloak/realm-mifos.json` |

---

## What "success looks like" after week one

By the end of your first week, you should be able to:

- [ ] Start the full stack from scratch (`pnpm docker:up && pnpm dev && pnpm seed`)
- [ ] Log in as both `admin` and `loan.officer` and explain what each can and can't do
- [ ] Explain what PAR30 is and why it comes from direct SQL rather than Fineract REST
- [ ] Trace a KBZ Pay payment from `POST /payments/initiate` all the way to the Fineract repayment
- [ ] Add a simple new API route following the pattern in `docs/CONTRIBUTING.md`
- [ ] Explain the Keycloak ROPC flow and what the JWKS cache does
