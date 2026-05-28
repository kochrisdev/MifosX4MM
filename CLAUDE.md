# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Start all apps/services with hot reload (requires .env)
pnpm dev

# Start a single workspace package
pnpm --filter @mifos-x/api dev
pnpm --filter @mifos-x/web dev
pnpm --filter @mifos-x/mobile dev
pnpm --filter @mifos-x/mobile-money dev
pnpm --filter @mifos-x/kyc dev

# Reporting service (Python — not part of Turborepo)
cd services/reporting
python -m venv .venv && .venv\Scripts\activate   # or: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3005

# Build all packages
pnpm build

# Build a specific package (shared-types must be built before dependents)
pnpm --filter @mifos-x/shared-types build
pnpm --filter @mifos-x/api build
pnpm --filter @mifos-x/web build

# Lint and test (run across all packages via Turborepo)
pnpm lint
pnpm test

# Run tests for a single service (vitest — only kyc and mobile-money have test suites)
pnpm --filter @mifos-x/kyc test
pnpm --filter @mifos-x/mobile-money test

# Run a single test file
pnpm --filter @mifos-x/kyc exec vitest run src/path/to/file.test.ts

# Docker infrastructure
pnpm docker:up     # starts all containers (Fineract takes ~2-3 min on first boot)
pnpm docker:down   # stop, preserving data volumes
docker compose down -v   # stop and wipe all data (forces Fineract re-migration)

# Alternate compose files
docker compose -f docker-compose-nginx.yml up -d   # with Nginx reverse proxy
docker compose -f docker-compose.ip.yml up -d      # VPS deployment (public IP, no 127.0.0.1 binding)

# Seed Fineract with initial data
pnpm seed

# Tail logs
docker compose logs -f api
docker compose logs -f fineract
docker compose logs -f keycloak
```

## Architecture

This is a **Turborepo + pnpm** monorepo. The TypeScript services (`apps/`, `services/mobile-money/`, `services/kyc/`) all share `packages/shared-types` which must be built before anything that imports it.

### Service topology

```
Clients (web :3000, mobile)
    │  JWT RS256
    ▼
API Gateway — apps/api (Fastify :3001)
    ├── /auth        → Keycloak :8180 (ROPC login/refresh)
    ├── /clients     → Fineract :8080
    ├── /loans       → Fineract :8080
    ├── /payments    → Mobile Money service :3003 → KBZ Pay (external)
    └── /dashboard   → Reporting service :3005
                     (also aggregates from Fineract)

Fineract (Java/Spring Boot :8080)  — never forked, treated as a black box
    └── MySQL :3306  (fineract_tenants + fineract_default)

Keycloak :8180
    └── PostgreSQL :5432  (keycloak database)

Reporting (Python FastAPI :3005)
    └── PostgreSQL :5432  (fineract_default — read queries via asyncpg)

KYC service (Fastify :3004)  — pluggable provider pattern
Mobile Money (Fastify :3003) — KBZ Pay HMAC-SHA256 signed API
```

### API Gateway (`apps/api`)

All routes live under `/api/v1`. Auth routes (login/refresh/logout) are public; all other routes require a valid Keycloak JWT verified by the `authenticate` hook registered in `plugins/keycloak.ts`. The gateway proxies to Fineract using Basic auth (`FINERACT_USERNAME`/`FINERACT_PASSWORD`) — the JWT is only used between clients and the gateway.

All responses use `ApiResponse<T>` from `@mifos-x/shared-types`: `{ success: boolean; data?: T; error?: string; meta?: Record<string, unknown> }`. Errors return `{ success: false, error: message }` via a centralized Fastify error handler.

Every service exposes a `/health` endpoint useful for debugging connectivity.

**Route protection patterns:**
```typescript
// Any authenticated user
{ preHandler: [app.authenticate] }

// Restricted to specific roles
{ preHandler: [app.authenticate, app.authorize(['branch_manager', 'super_admin'])] }
```

Roles: `super_admin`, `branch_manager`, `loan_officer`, `teller`, `customer` (matches `infra/keycloak/realm-mifos.json`).

### Web app (`apps/web`)

Next.js 14 App Router. Authenticated routes live under `src/app/(protected)/`. `src/middleware.ts` guards SSR by checking the `accessToken` cookie.

Token storage uses a **cookie + localStorage hybrid**: the API client (`src/lib/api.ts`) holds tokens in localStorage for client-side requests and mirrors `accessToken` to a cookie for SSR middleware. On 401, an Axios interceptor auto-refreshes using the stored refresh token and retries once (`_retry` flag prevents loops). The `NEXT_PUBLIC_API_URL` env var points the client at the API gateway.

`apps/web` has `strict: false` in its tsconfig — backend services use `strict: true`. Path alias `@/*` maps to `src/*` (configured in `tsconfig.json`).

### Shared types (`packages/shared-types`)

All TypeScript interfaces shared across workspaces live here: Fineract entities, KBZ Pay payloads, KYC types, `ApiResponse<T>`, `PaginatedResponse<T>`, `AuthUser`, `TokenPair`. Import as `@mifos-x/shared-types`.

### Mobile app (`apps/mobile`)

Expo (SDK 51) + Expo Router for file-based routing. `src/context/AuthContext.tsx` manages auth state and redirects. Tokens are stored in AsyncStorage (no SSR). Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not `localhost`) when testing on a physical device.

### Reporting service (`services/reporting`)

Queries PostgreSQL (`fineract_default`) **directly via asyncpg** — never via Fineract REST. This is intentional: Fineract's `inArrears` flag only updates after a batch job; the SQL queries in `routers/portfolio.py` give real-time PAR figures using a CTE on `m_loan_repayment_schedule`. Key Fineract status codes used in SQL: `m_loan.loan_status_id = 300` (Active), `m_loan_transaction.transaction_type_enum = 2` (Repayment).

### KYC provider pattern

`services/kyc/src/provider.ts` defines the `KycProvider` interface. `resolveProvider()` in `services/kyc/src/index.ts` switches on the `KYC_PROVIDER` env var. To add a new provider: implement `KycProvider` in `services/kyc/src/providers/`, add a `case` in `resolveProvider()`. Only `stub` is currently implemented.

### Database split

- **MySQL** — Fineract's native database (`fineract_tenants`, `fineract_default`). Fineract runs its own Liquibase migrations; never touch this schema directly.
- **PostgreSQL** — Keycloak auth data + `fineract_default` (a separate database for the reporting service to query via asyncpg). `infra/postgres/init.sql` creates the keycloak database; `infra/mysql/init.sql` creates the Fineract databases.

### Keycloak realm

`infra/keycloak/realm-mifos.json` is auto-imported on first boot only. If you change it, run `docker compose down -v && docker compose up -d` to force re-import.

## Known issues — do not repeat these patterns

1. **SQL injection** — `apps/api/src/routes/loans.ts`: the `sqlSearch` param is directly interpolated into a Fineract query string. Do not add further string interpolation in query parameters.
2. **KBZ webhook does not post repayment** — `services/mobile-money/src/routes.ts` webhook handler logs the payment but does not call Fineract. Repayment posting relies on client polling `GET /payments/status/:orderId`. This is a known gap.
3. **`strict: false` in web** — `apps/web/tsconfig.json` has strict mode disabled. Do not disable it in other packages; fix type errors rather than suppressing them in `apps/web`.
4. **No loan creation route in gateway** — There is no `POST /api/v1/loans` route. Loan applications must currently be created via Fineract directly.

## Key environment variables

Copy `.env.example` to `.env`. KBZ Pay credentials (`KBZPAY_APP_ID`, `KBZPAY_MERCHANT_CODE`, `KBZPAY_SIGN_KEY`) must be obtained from KBZ Bank. For local callback testing, use ngrok to expose port 3003 and set `KBZPAY_CALLBACK_URL`.

Set `KYC_PROVIDER=stub` for local development; `smile_identity` and `onfido` are the other recognized values.

## Nginx domains (production)

`infra/nginx/mifos` configures four vhosts proxying to local ports:

| Domain | Proxied to |
|--------|-----------|
| `app.mifosx.com` | `:3000` (web) |
| `api.mifosx.com` | `:3001` (API gateway) |
| `pay.mifosx.com` | `:3003` (mobile money) |
| `auth.mifosx.com` | `:8180` (Keycloak) |

## Documentation

| Doc | Contents |
|-----|----------|
| `docs/ARCHITECTURE.md` | Mermaid data-flow diagrams, DB schema, PAR SQL, auth architecture |
| `docs/API.md` | Full request/response reference for all services |
| `docs/DEVELOPMENT.md` | Env vars, Docker, troubleshooting, common workflows |
| `docs/DEPLOYMENT.md` | VPS deployment with Nginx and TLS |
| `docs/KEYCLOAK_HTTP_ROLLBACK.md` | Steps to roll Keycloak back to HTTP if HTTPS breaks |

## Ports

| Port | Service |
|------|---------|
| 3000 | Web portal (Next.js) |
| 3001 | API gateway (Fastify) |
| 3003 | Mobile Money (Fastify) |
| 3004 | KYC service (Fastify) |
| 3005 | Reporting (FastAPI) |
| 3306 | MySQL (Fineract) |
| 5432 | PostgreSQL (Keycloak + reporting) |
| 8080 | Apache Fineract |
| 8180 | Keycloak |
