# Service Deep Dive

This document explains every service in the MifosX4MM platform in detail — what it does, how it's structured, what each file is for, and how data flows through it. Written for someone new to the codebase.

Read `docs/DOMAIN.md` first to understand the business context before diving into the code here.

---

## Table of Contents

1. [Shared Types — `packages/shared-types`](#1-shared-types)
2. [API Gateway — `apps/api`](#2-api-gateway)
3. [Web App — `apps/web`](#3-web-app)
4. [Mobile App — `apps/mobile`](#4-mobile-app)
5. [Mobile Money Service — `services/mobile-money`](#5-mobile-money-service)
6. [KYC Service — `services/kyc`](#6-kyc-service)
7. [Reporting Service — `services/reporting`](#7-reporting-service)
8. [Apache Fineract](#8-apache-fineract)
9. [Keycloak](#9-keycloak)
10. [Turborepo + pnpm Workspaces](#10-turborepo--pnpm-workspaces)

---

## 1. Shared Types

**Location:** `packages/shared-types/src/index.ts`
**Purpose:** A single source of truth for all TypeScript types shared across every service.

### Why it exists

Without this package, every service would define its own version of "what does a loan look like?" and they'd slowly drift out of sync. This package defines everything once, and all other TypeScript services import from it using `@mifos-x/shared-types`.

### What's in it

| Type group | Key types | Used by |
|---|---|---|
| Fineract entities | `FineractClient`, `FineractLoanAccount`, `FineractLoanRepayment` | API gateway, web, mobile |
| KBZ Pay | `KbzPayOrderParams`, `KbzPayCallbackPayload`, `KbzPayStatusResponse` | Mobile money service, API gateway |
| KYC | `KycSubmission`, `KycVerificationRequest`, `KycWebhookPayload` | KYC service, API gateway |
| API responses | `ApiResponse<T>`, `PaginatedResponse<T>` | Every service |
| Auth | `AuthUser`, `TokenPair`, `UserRole` | Web, mobile, API gateway |
| Dashboard | `DashboardStats` | Web, API gateway |

### The `ApiResponse<T>` wrapper

Every endpoint in this platform returns data wrapped in this shape:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

So a successful loans response looks like `{ success: true, data: [...] }` and a failure looks like `{ success: false, error: "Unauthorized" }`. This consistency means the frontend always knows where to find the data.

### Important: must be built first

This package compiles TypeScript to JavaScript before other packages can import it. If you see import errors, run:
```bash
pnpm --filter @mifos-x/shared-types build
```

---

## 2. API Gateway

**Location:** `apps/api/src/`
**Framework:** Fastify (Node.js)
**Port:** 3001
**Purpose:** The single entry point for all client requests. Verifies identity, enforces permissions, and routes requests to the right backend service.

### Libraries

| Library | What it does |
|---|---|
| `fastify` | The web framework — fast HTTP server, like Express but with better TypeScript support |
| `@fastify/jwt` | Reads and verifies JWT tokens on incoming requests |
| `@fastify/cors` | Allows the web app (port 3000) to call this API (port 3001) from the browser |
| `jwks-rsa` | Fetches Keycloak's public keys to verify JWT signatures |
| `axios` | Makes HTTP calls to Fineract, Mobile Money service, and Reporting service |
| `nanoid` | Generates short unique IDs (used for KBZ Pay order IDs) |

### File by file

#### `index.ts` — the app entry point

This file wires everything together:

```typescript
// 1. Create the Fastify app
const app = Fastify({ logger: true });

// 2. Register the Keycloak JWT plugin (adds app.authenticate and app.authorize)
await app.register(keycloakPlugin);

// 3. Create a Fineract HTTP client
const fineract = createFineractClient();

// 4. Register PUBLIC routes (no login required)
await app.register(async (pub) => {
  await authRoutes(pub);          // /auth/login, /auth/refresh, /auth/logout
}, { prefix: '/api/v1' });

// 5. Register PROTECTED routes (JWT required on every request)
await app.register(async (protected_) => {
  protected_.addHook('onRequest', app.authenticate);  // <-- guards all routes below
  await dashboardRoutes(protected_, fineract, REPORTING_URL);
  await clientRoutes(protected_, fineract);
  await loanRoutes(protected_, fineract);
  await paymentRoutes(protected_, fineract, MOBILE_MONEY_URL);
}, { prefix: '/api/v1' });
```

The key pattern: routes inside the `protected_` block automatically require a valid JWT. Any request without one gets a 401 before it even reaches the route handler.

#### `fineract.ts` — the Fineract HTTP client

Creates a pre-configured Axios instance for calling Fineract:

```typescript
axios.create({
  baseURL: process.env.FINERACT_URL,
  auth: {
    username: process.env.FINERACT_USERNAME,
    password: process.env.FINERACT_PASSWORD,
  },
  headers: { 'Fineract-Platform-TenantId': 'default' },
});
```

Fineract uses HTTP Basic Auth (username + password), not JWTs. The gateway holds those credentials in environment variables so clients never see them. The interceptor at the bottom converts Fineract's error format into a clean Error object with the right HTTP status code.

#### `plugins/keycloak.ts` — JWT verification

This is how the gateway knows who you are on every request.

**Step 1 — Setup:** On startup, it fetches Keycloak's public keys from:
```
http://keycloak:8180/realms/mifos/protocol/openid-connect/certs
```
These keys are cached for 10 minutes so every request doesn't hit Keycloak.

**Step 2 — Verify:** When a request comes in with a `Bearer <token>` header, it:
1. Reads the `kid` (key ID) from the JWT header
2. Looks up the matching public key from the cache
3. Verifies the token's signature using RS256
4. Checks the token issuer and expiry

**Step 3 — Decorate:** If valid, it extracts user info from the token and makes it available as `req.user`:
```typescript
req.user = {
  id: payload.sub,           // Keycloak user ID
  username: payload.preferred_username,
  email: payload.email,
  roles: payload.realm_access.roles,  // ['loan_officer', ...]
}
```

**`app.authenticate`** — a hook that runs the above and returns 401 if it fails.

**`app.authorize(['branch_manager', 'super_admin'])`** — a hook that runs authenticate, then checks that the user's roles include at least one of the required roles. Returns 403 if not.

#### `routes/auth.ts` — login, refresh, logout

Three endpoints, all public (no JWT needed):

**`POST /api/v1/auth/login`**
Takes `{ username, password }`. Calls Keycloak's token endpoint with `grant_type=password`. Returns `{ accessToken, refreshToken, expiresIn }`.

**`POST /api/v1/auth/refresh`**
Takes `{ refreshToken }`. Exchanges it with Keycloak for a new access token. Used automatically by the frontend when a request returns 401.

**`POST /api/v1/auth/logout`**
Takes `{ refreshToken }`. Tells Keycloak to invalidate that refresh token. After this, the token can't be used to get new access tokens.

**`GET /api/v1/auth/me`** (protected)
Returns the current user's profile extracted from their JWT. The frontend calls this after login to know who logged in.

#### `routes/loans.ts` — loan operations

| Endpoint | What it does | Who can call |
|---|---|---|
| `GET /loans` | Paginated list of all loans, with optional search | Any authenticated user |
| `GET /clients/:clientId/loans` | All loans for one client | Any authenticated user |
| `GET /loans/:loanId` | Full loan detail including repayment schedule and transactions | Any authenticated user |
| `POST /loans/:loanId/repayments` | Record a cash repayment | Any authenticated user |
| `POST /loans/:loanId/actions` | Approve, disburse, or reject a loan | `branch_manager` or `super_admin` only |

The `actions` endpoint uses `app.authorize(['branch_manager', 'super_admin'])` so a loan officer can't approve their own loans.

**Known issue:** The `search` param on `GET /loans` directly interpolates into a SQL string (`l.account_no like '%${search}%'`). This is a SQL injection risk documented in `CLAUDE.md`.

#### `routes/clients.ts` — client (borrower) operations

| Endpoint | What it does |
|---|---|
| `GET /clients` | Paginated list, optional search by name |
| `GET /clients/:clientId` | Single client detail |
| `POST /clients` | Register a new borrower |
| `PUT /clients/:clientId` | Update borrower details |

All of these are thin wrappers — they just forward the request to Fineract and return the result.

#### `routes/payments.ts` — KBZ Pay mobile money

| Endpoint | What it does |
|---|---|
| `POST /payments/initiate` | Creates a KBZ Pay payment order, returns a `prepayId` the mobile app uses to open KBZ Pay |
| `GET /payments/status/:orderId` | Checks if a payment completed; if yes, posts the repayment to Fineract |

The flow: mobile app calls `/payments/initiate` → gateway calls Mobile Money service → Mobile Money service calls KBZ Pay API → returns `prepayId`. The app opens `kbzpay://pay?prepay_id=...`. Later, the app polls `/payments/status/:orderId` to confirm payment.

#### `routes/dashboard.ts` — stats aggregation

`GET /api/v1/dashboard/stats` calls the Reporting service for portfolio summary and today's collections **in parallel** using `Promise.allSettled`. If either call fails, it logs a warning and returns zeros for that section rather than failing the whole response.

---

## 3. Web App

**Location:** `apps/web/src/`
**Framework:** Next.js 14 (App Router)
**Port:** 3000
**Purpose:** The staff web portal used by branch managers, tellers, and loan officers at their desks.

### Libraries

| Library | What it does |
|---|---|
| `next` | React framework with server-side rendering and file-based routing |
| `@tanstack/react-query` | Manages server data fetching, caching, and background refresh |
| `axios` | Makes HTTP requests to the API gateway |
| `recharts` | Charting library for dashboard graphs |
| `lucide-react` | Icon library |
| `clsx` | Utility for conditionally applying CSS class names |

### How routing works (App Router)

Next.js 14 uses the filesystem as the router. The folder structure under `src/app/` maps directly to URLs:

```
src/app/
  login/            → /login
  (protected)/      → route group (no URL segment, just groups protected pages)
    dashboard/      → /dashboard
    loans/          → /loans
    loans/[loanId]/ → /loans/123
    clients/        → /clients
    collections/    → /collections
    reports/        → /reports
```

The `(protected)` folder is a **route group** — the parentheses mean it doesn't appear in the URL, it just lets you share a layout among pages that need auth.

### File by file

#### `middleware.ts` — SSR route protection

```typescript
export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
```

This runs on the **server** before any page renders. If there's no `accessToken` cookie, it redirects to `/login` immediately — the user never sees the protected page. This prevents a flash of content before the client-side auth check kicks in.

#### `lib/api.ts` — the API client

This is the central HTTP client for all API calls from the web app. Two important things happen here:

**Request interceptor** — adds the JWT to every request:
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Response interceptor** — handles expired tokens automatically:
```typescript
api.interceptors.response.use(null, async (err) => {
  if (err.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;  // prevents infinite loop
    // get a new access token using the refresh token
    const { data } = await axios.post('/auth/refresh', { refreshToken });
    localStorage.setItem('accessToken', data.data.accessToken);
    // retry the original failed request with the new token
    return api(originalRequest);
  }
});
```

This means access tokens expire silently — the user never sees a login prompt mid-session as long as the refresh token is still valid.

**Token storage — hybrid approach:**
- `localStorage` — for client-side requests (JavaScript can read it)
- Cookie (`accessToken`) — for server-side rendering (Next.js middleware can read cookies but not localStorage)

Both are kept in sync on login.

#### `hooks/useLoans.ts` — data fetching for loans

Uses **React Query** (`useInfiniteQuery`) for the loans list. React Query is a library that manages:
- When to fetch data
- How long to keep it cached
- When to refresh it in the background
- How to show loading/error states

`useInfiniteQuery` specifically supports "load more" pagination — each page load appends to the previous results rather than replacing them.

```typescript
export function useLoans(search = '') {
  return useInfiniteQuery({
    queryKey: ['loans', search],     // cache key — different search = different cache
    queryFn: async ({ pageParam = 0 }) => {
      const { data } = await api.get('/loans', { params: { offset: pageParam, limit: 25 } });
      return data.data;
    },
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.pageItems.length, 0);
      return loaded < last.totalFilteredRecords ? loaded : undefined;  // undefined = no more pages
    },
  });
}
```

Other hooks in this file:
- `useLoan(loanId)` — fetches a single loan's full detail
- `useLoanAction()` — mutation for approve/disburse/reject
- `usePostRepayment()` — mutation for recording a cash repayment

**Mutations** (`useMutation`) are React Query's way of handling write operations (POST/PUT). After a successful mutation, they call `queryClient.invalidateQueries(...)` to tell React Query to re-fetch the affected data so the screen updates automatically.

#### `hooks/useDashboardStats.ts`

```typescript
return useQuery({
  queryKey: ['dashboard', 'stats'],
  queryFn: async () => { /* calls GET /dashboard/stats */ },
  refetchInterval: 60_000,   // auto-refresh every 60 seconds
});
```

The `refetchInterval` means the dashboard numbers update automatically without the user needing to refresh the page.

#### `app/(protected)/dashboard/page.tsx`

The dashboard page. Shows four stat cards (active clients, active loans, PAR30, collections today) and a portfolio overview panel. Uses the `useDashboardStats` hook.

The PAR30 card changes color based on value:
- Grey if PAR30 < 2% (healthy)
- Amber if PAR30 2–5% (watch)
- Red if PAR30 > 5% (action needed)

#### `app/(protected)/loans/page.tsx`

The loans list page. Search input with 300ms debounce (waits for the user to stop typing before making an API call). Uses `useInfiniteQuery` with a "Load more" button at the bottom. Shows a skeleton loader (grey animated boxes) while data is loading.

---

## 4. Mobile App

**Location:** `apps/mobile/`
**Framework:** Expo (React Native) with Expo Router
**Purpose:** The field app used by loan officers on their phones — registering clients, viewing loans, and collecting repayments.

### Libraries

| Library | What it does |
|---|---|
| `expo` | Toolchain for building React Native apps |
| `expo-router` | File-based routing for React Native (same concept as Next.js but for mobile) |
| `@react-native-async-storage/async-storage` | Mobile equivalent of `localStorage` — persists data across app restarts |
| `@tanstack/react-query` | Same data-fetching library as the web app |
| `axios` | Same HTTP client as the web app |

### Key difference from the web app

The web app uses `localStorage` and cookies to store tokens. React Native doesn't have either. Instead it uses **AsyncStorage** — an async key-value store that persists to the device's storage. Everything else (the auth flow, React Query, the API client) works the same way.

Also: when testing on a real phone, `localhost` doesn't work — the phone and your computer are different devices on the same network. You must set `EXPO_PUBLIC_API_URL` to your machine's LAN IP address (e.g., `http://192.168.1.100:3001`).

### File by file

#### `app/_layout.tsx` — root layout and navigation guard

This is the equivalent of `middleware.ts` in the web app, but for mobile. The `NavigationGuard` component watches the auth state and redirects:

```typescript
useEffect(() => {
  if (isLoading) return;
  const inAuth = segments[0] === '(auth)';
  if (!user && !inAuth) router.replace('/(auth)/login');   // not logged in → login screen
  if (user && inAuth) router.replace('/(tabs)');           // logged in → main tabs
}, [user, isLoading, segments]);
```

Routes are organized into two groups:
- `(auth)/` — login screen (no auth needed)
- `(tabs)/` — the main tab bar screens (auth required)

#### `src/context/AuthContext.tsx` — auth state

Provides `user`, `isLoading`, `login()`, and `logout()` to the entire app via React Context. On app startup, it calls `getStoredUser()` to check if there's a saved token and restore the session.

#### `src/lib/api.ts` — the API client

Same pattern as the web app but using AsyncStorage:

```typescript
// Read token from AsyncStorage before every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

The 401 auto-refresh logic is identical to the web app.

#### `src/hooks/useLoans.ts`

Similar to the web version. Includes:
- `useClientLoans(clientId)` — loans for a specific client
- `useLoan(loanId)` — single loan detail
- `usePostRepayment()` — record a cash repayment
- `useInitiateKbzPayment()` — start a KBZ Pay mobile payment

The KBZ Pay mutation returns a `prepayId`. The app then opens the KBZ Pay app via a deep link: `kbzpay://pay?prepay_id=<prepayId>`.

---

## 5. Mobile Money Service

**Location:** `services/mobile-money/src/`
**Framework:** Fastify (Node.js)
**Port:** 3003
**Purpose:** Handles all communication with the KBZ Pay API. Isolates KBZ Pay-specific logic so the API gateway doesn't need to know about HMAC signing or KBZ Pay's API format.

### Why a separate service?

KBZ Pay has a specific request signing algorithm (HMAC-SHA256). If the API gateway called KBZ Pay directly, it would mix payment-provider logic into the gateway. Keeping it separate means:
1. The KBZ Pay credentials (`KBZPAY_SIGN_KEY`) are isolated to this service
2. If KBZ Pay's API changes, only this service changes
3. A different payment provider (e.g., Wave Money) could be added as another service

### File by file

#### `kbzpay/signature.ts` — request signing

KBZ Pay requires every request to be "signed" to prove it came from a real merchant, not someone intercepting the API.

**How signing works:**
1. Take all request parameters (except `sign` itself)
2. Sort them alphabetically by key name
3. Join them as `key1=value1&key2=value2&...`
4. Append `&key=YOUR_SIGN_KEY`
5. Hash the whole string with SHA-256
6. Convert to uppercase hex

```typescript
export function buildSignature(params: Record<string, string>, signKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const payload = `${sorted}&key=${signKey}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toUpperCase();
}
```

`verifySignature` does the same thing on incoming webhook callbacks and uses `crypto.timingSafeEqual` to compare — a timing-safe comparison that prevents timing attacks where an attacker could guess the signature character by character based on how long the comparison takes.

#### `kbzpay/client.ts` — the KBZ Pay API client

A class that wraps the two KBZ Pay API calls:

**`createOrder(params)`** — calls KBZ Pay's `/precreate` endpoint. Returns a `prepayId` which is the token the mobile app uses to open KBZ Pay.

**`queryOrder(orderId)`** — calls KBZ Pay's `/query` endpoint. Returns the payment status: pending / success / failed. Maps KBZ Pay's numeric status codes (`'0'`, `'1'`, `'2'`) to readable strings.

**`parseCallback(payload)`** — validates an incoming webhook from KBZ Pay. KBZ Pay sends a signed POST request to our callback URL when a payment completes. This method verifies the signature and returns whether it's valid and whether the payment succeeded.

#### `routes.ts` — the three endpoints

| Endpoint | Called by | What it does |
|---|---|---|
| `POST /payments/kbzpay/initiate` | API gateway | Creates a KBZ Pay order, returns `prepayId` |
| `GET /payments/kbzpay/status/:orderId` | API gateway | Checks payment status |
| `POST /webhooks/kbzpay` | KBZ Pay servers | Receives payment confirmation |

**Known gap:** The webhook handler (`POST /webhooks/kbzpay`) logs the payment confirmation but does **not** post the repayment to Fineract. The repayment only gets posted when the client polls `GET /payments/status/:orderId` and the gateway sees a `success` status. This is a documented known issue in `CLAUDE.md`.

#### `index.ts` — entry point

Creates the `KbzPayClient` with credentials from environment variables and registers the routes. The credentials (`KBZPAY_APP_ID`, `KBZPAY_MERCHANT_CODE`, `KBZPAY_SIGN_KEY`) come from KBZ Bank and must be kept secret.

---

## 6. KYC Service

**Location:** `services/kyc/src/`
**Framework:** Fastify (Node.js)
**Port:** 3004
**Purpose:** Verifies borrower identity documents (NRC scan + selfie) before a loan can be approved. Uses a pluggable provider pattern so the actual verification provider can be swapped without changing routes.

### The provider pattern

The KYC service doesn't do the verification itself — it delegates to a **provider**. The provider interface (`provider.ts`) defines what every provider must implement:

```typescript
interface KycProvider {
  readonly name: string;
  submit(request: KycVerificationRequest): Promise<KycSubmission>;
  getStatus(submissionId: string): Promise<KycSubmission>;
  handleWebhook(payload: unknown): Promise<KycWebhookPayload>;
  getStats(): Promise<KycStats>;
}
```

The `KYC_PROVIDER` environment variable selects which provider to use. The `resolveProvider()` function in `index.ts` reads this variable and returns the right class:

```typescript
function resolveProvider(): KycProvider {
  switch (process.env.KYC_PROVIDER) {
    case 'stub':
    default:
      return new StubKycProvider();
    // future: case 'smile_identity': return new SmileIdentityProvider();
    // future: case 'onfido': return new OnfidoProvider();
  }
}
```

To add a new provider: create a new class in `providers/` that implements `KycProvider`, add a `case` here. The routes don't change at all.

### File by file

#### `routes.ts` — four endpoints

| Endpoint | What it does |
|---|---|
| `POST /kyc/submit` | Submit a new verification (sends document images + personal info to the provider) |
| `GET /kyc/status/:submissionId` | Check the status of a previous submission |
| `GET /kyc/stats` | Count of submissions by status (used by Reporting service) |
| `POST /webhooks/kyc` | Receives async results from a real provider (Smile Identity, Onfido) |

All routes delegate to `provider.<method>()` — the route code itself is clean and provider-agnostic.

#### `providers/stub.ts` — the fake provider for development

In development (`KYC_PROVIDER=stub`), no real verification happens. The stub:

1. On `submit()`: creates a fake submission, stores it in memory (`Map`), and after 2 seconds automatically changes the status to `approved` using `setTimeout`
2. On `getStatus()`: looks up the submission from the in-memory map
3. On `getStats()`: counts submissions by status from the map

```typescript
setTimeout(() => {
  store.set(submissionId, { ...entry, status: 'approved' });
}, 2000);
```

This simulates the async nature of real KYC — you submit, wait, then the status changes. In production, the status change would come via the `POST /webhooks/kyc` endpoint from the real provider.

**Important:** The in-memory store is wiped every time the service restarts. This is fine for development but would not work in production (real providers save state in their own systems and call the webhook).

---

## 7. Reporting Service

**Location:** `services/reporting/`
**Framework:** FastAPI (Python)
**Port:** 3005
**Purpose:** Calculates real-time financial metrics (PAR, collection rate) by querying the Fineract PostgreSQL database directly with raw SQL.

### Why Python and why direct SQL?

Fineract's REST API exposes an `inArrears` flag, but it only updates after a scheduled batch job runs — not in real time. Accurate PAR figures require querying `m_loan_repayment_schedule` directly and computing the math from raw installment data. Python with SQLAlchemy async was chosen for readable async SQL.

### Libraries

| Library | What it does |
|---|---|
| `fastapi` | Python web framework — routes and request handling |
| `uvicorn` | The ASGI server that runs FastAPI |
| `asyncpg` | Fast async PostgreSQL driver |
| `sqlalchemy[asyncio]` | Manages database connections and runs SQL queries |
| `httpx` | Async HTTP client for calling the KYC service |

### File by file

#### `db.py` — database connection pool

Connects to `fineract_default` PostgreSQL database. Keeps 5 connections open at all times (`pool_size=5`), allows up to 10 overflow connections under load. `pool_pre_ping=True` checks connections are still alive before using them.

`get_session()` is an async context manager — it grabs a connection from the pool for one request and releases it back when done.

#### `main.py` — app entry point

Creates the FastAPI app, registers three route groups, and adds a startup health check that runs `SELECT 1` against the database to verify connectivity.

#### `routers/portfolio.py` — loan portfolio reports

**`GET /reports/portfolio/summary`** — the most important endpoint. Returns PAR0, PAR30, PAR90, total outstanding, total overdue, active loan count. Uses a CTE (Common Table Expression) called `overdue_schedule` that finds all unpaid overdue installments and computes days past due and overdue amount for each loan. The main query joins active loans against this CTE to compute PAR ratios.

**`GET /reports/portfolio/by-product`** — same logic but grouped by loan product name. Shows which product types have the most overdue loans.

**`GET /reports/portfolio/disbursements`** — time-series of disbursement amounts by day/week/month. Used to draw disbursement trend charts. Defaults to last 12 months.

#### `routers/collections.py` — daily collection tracking

**`GET /reports/collections/today`** — runs two queries: (1) sum of all repayments received today, (2) sum of all installments due today that haven't been paid. Returns `collected`, `scheduled`, and `collectionRate` (percentage).

**`GET /reports/collections/overdue`** — list of every loan with overdue installments, sorted by how many days overdue. Shows borrower name, phone number, days overdue, and total amount owed. Branch managers use this for follow-up calls. Supports filtering by branch and pagination.

#### `routers/kyc_summary.py` — KYC stats

**`GET /reports/kyc/status-breakdown`** — calls the KYC service (`GET /kyc/stats`) using `httpx` and returns the counts. If the KYC service is unreachable, returns all zeros silently rather than crashing.

### Why the SQL is complex

Each installment row in `m_loan_repayment_schedule` has separate columns for principal, interest, fees, and penalties — and each has an `amount` (originally owed) and various `_completed_derived`, `_writtenoff_derived`, `_waived_derived` columns (what's been paid/written off). To get the true outstanding overdue amount you subtract all of them:

```
overdue = (principal_amount - principal_completed - principal_writtenoff)
        + (interest_amount  - interest_completed  - interest_waived - interest_writtenoff)
        + (fee_amount       - fee_completed       - fee_waived      - fee_writtenoff)
        + (penalty_amount   - penalty_completed   - penalty_waived  - penalty_writtenoff)
```

That's the long `SUM(COALESCE(...))` block repeated throughout the SQL — it's the actual financial math needed for an accurate overdue figure.

---

## How all services connect

```
Browser / Mobile App
       │
       ├─── Login ─────────────────────────► Keycloak :8180
       │                                        (stores users in PostgreSQL)
       │                                        returns JWT token
       │
       │    JWT on every request
       ▼
  API Gateway :3001
       │
       ├─── /clients, /loans ──────────────► Fineract :8080 ──► MySQL :3306
       │                                       (core banking engine)
       │
       ├─── /payments/initiate ────────────► Mobile Money :3003
       │                                          │
       │                                          └──► KBZ Pay API (external)
       │
       ├─── /dashboard/stats ─────────────► Reporting :3005
       │                                          │
       │                                          └──► PostgreSQL :5432/fineract_default
       │                                               (direct SQL on Fineract tables)
       │
       └─── KYC routes ────────────────────► KYC :3004
                                                  │
                                                  └──► Stub (dev) or Smile Identity / Onfido (prod)
```

Every arrow in this diagram represents an HTTP call. No service talks to another service's database directly — except the Reporting service, which queries PostgreSQL directly because Fineract's REST API doesn't expose the real-time figures needed.

---

## 8. Apache Fineract

**What it is:** An open-source core banking system maintained by the Apache Software Foundation. Used by microfinance institutions in 40+ countries. It runs as a pre-built Java/Spring Boot Docker image — we never touch its source code.

**Port:** 8080
**Database:** MySQL (`fineract_default` and `fineract_tenants`)

### Why it exists in this project

Writing core banking logic from scratch is years of work and full of financial math edge cases:
- How do you calculate declining-balance interest month by month?
- What happens if a borrower pays half an installment?
- How do you handle fees, penalties, and write-offs?
- How do you track a loan through every stage of its life?

Fineract already solves all of this correctly. Our job is to build a modern interface on top of it, not rebuild the banking engine.

### How we interact with it

We call Fineract's REST API using HTTP Basic Auth (username + password in the request header). The Fineract client is created in `apps/api/src/fineract.ts`:

```typescript
axios.create({
  baseURL: process.env.FINERACT_URL,   // http://fineract:8080/fineract-provider/api/v1
  auth: {
    username: process.env.FINERACT_USERNAME,
    password: process.env.FINERACT_PASSWORD,
  },
  headers: { 'Fineract-Platform-TenantId': 'default' },
});
```

The `Fineract-Platform-TenantId` header tells Fineract which tenant's data to use. This project uses one tenant called `default`.

### Key Fineract concepts

#### Tenants
Fineract is multi-tenant — one Fineract instance can serve multiple MFIs. The `fineract_tenants` MySQL database holds the tenant registry. Each tenant has its own separate `fineract_default` database. In this project there is only one tenant: `default`.

#### Loan status lifecycle

Every loan has a `loan_status_id` in the `m_loan` table. The value tells you what stage the loan is at:

| Status code | Meaning | What triggers it |
|---|---|---|
| `100` | Submitted / Pending approval | Loan application created |
| `200` | Approved | Branch manager calls `?command=approve` |
| `300` | Active | Branch manager calls `?command=disburse` — money sent to borrower |
| `400` | Withdrawn | Borrower cancels before disbursement |
| `500` | Rejected | Branch manager calls `?command=reject` |
| `600` | Closed | All installments paid — Fineract auto-closes |

#### Key database tables

You'll see these table names throughout the codebase and especially in the Reporting service SQL:

| Table | What it stores |
|---|---|
| `m_client` | Borrower profiles — name, NRC, phone, office (branch) |
| `m_loan` | One row per loan — status, principal, interest rate, disbursement date |
| `m_product_loan` | Loan product templates (e.g., "6-month agricultural loan at 18% p.a.") |
| `m_loan_repayment_schedule` | One row per installment per loan — principal + interest due, due date, completion status |
| `m_loan_transaction` | Every financial event — disbursements (`type=1`), repayments (`type=2`), reversals |
| `m_office` | Branches / offices that clients and loans belong to |

#### Transaction type codes
When querying `m_loan_transaction`, the `transaction_type_enum` column tells you what kind of event it is:
- `1` = Disbursement (money out to borrower)
- `2` = Repayment (money in from borrower)
- `5` = Waived interest
- `9` = Write-off

#### How the repayment schedule works

When a loan is disbursed, Fineract automatically generates the full repayment schedule in `m_loan_repayment_schedule`. For a 6-month loan, it creates 6 rows — one per monthly installment. Each row has:
- `duedate` — when the payment is due
- `principal_amount` — how much principal is due this period
- `interest_amount` — how much interest is due this period
- `completed_derived` — boolean: has this installment been fully paid?
- `obligations_met_on_date` — the date it was completed (null if still outstanding)

When a repayment comes in, Fineract applies it to the oldest outstanding installment first, updating the `_completed_derived` columns.

#### Why the Reporting service bypasses Fineract's REST API

Fineract has an `inArrears` flag on loans, but it only updates when a scheduled batch job runs (usually overnight). For real-time PAR figures, you need to query `m_loan_repayment_schedule` directly and compute overdue amounts yourself — which is exactly what `services/reporting/routers/portfolio.py` does.

### First boot behavior

On first start, Fineract runs **Liquibase database migrations** — it creates all its tables and populates reference data. This takes 2-3 minutes. You'll see log output in `docker compose logs -f fineract`. Wait until you see "Started App" before running `pnpm seed`.

### The seed script

`scripts/seed-fineract.ts` creates initial data via the Fineract API:
- An office (branch)
- A loan product template
- Some sample clients and loans

Run it once after first boot: `pnpm seed`

---

## 9. Keycloak

**What it is:** An open-source Identity and Access Management (IAM) system. Manages who can log in, what they're allowed to do, and issues the JWT tokens that prove identity on every API request.

**Port:** 8180
**Database:** PostgreSQL (`keycloak` database)
**Config file:** `infra/keycloak/realm-mifos.json`

### Core concepts

#### Realm
A realm is an isolated namespace inside Keycloak. It has its own users, roles, and clients. This project uses a realm called `mifos`. The realm config is in `infra/keycloak/realm-mifos.json` and is auto-imported when Keycloak starts for the first time.

**Important:** If you change `realm-mifos.json`, the change won't take effect automatically because Keycloak only imports it on first boot. To re-import: `docker compose down -v && docker compose up -d` (this wipes all data).

#### Clients
A "client" in Keycloak is an application that is allowed to request tokens. This project has three:

| Client ID | What it represents | Type |
|---|---|---|
| `mifos-staff` | The web portal (`apps/web`) and API gateway login | Public (no secret needed) |
| `mifos-mobile` | The mobile app (`apps/mobile`) | Public |
| `mifos-api` | The API gateway itself (service-to-service) | Confidential (has a secret) |

**Public vs confidential clients:** A public client is one that runs on a device the user controls (a browser, a phone). It can't keep secrets because anyone could read the source code. A confidential client runs on a server we control, so it can have a secret.

#### Roles
Roles define what a user is allowed to do. They live in the realm and are attached to users. The five roles in this project:

| Role | Who has it | What they can do |
|---|---|---|
| `super_admin` | System administrators | Everything |
| `branch_manager` | Branch managers | Approve/disburse loans, view all reports |
| `loan_officer` | Field staff | Register clients, record repayments |
| `teller` | Counter staff | Record cash repayments only |
| `customer` | Borrowers | Not implemented yet |

#### Default users (for development)
From `infra/keycloak/realm-mifos.json`:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@1234` | `super_admin` |
| `loan.officer` | `Officer@1234` | `loan_officer` |

#### Token settings
From `realm-mifos.json`:
- `accessTokenLifespan: 900` — access tokens expire after **15 minutes**
- `ssoSessionMaxLifespan: 36000` — the session (refresh token) lasts **10 hours**

After 15 minutes, the frontend automatically uses the refresh token to get a new access token (handled by the Axios interceptor in `lib/api.ts`). After 10 hours the user must log in again.

### How login works step by step

```
1. User types username + password in the web app login form

2. Web app → POST /api/v1/auth/login { username, password }

3. API gateway → POST http://keycloak:8180/realms/mifos/protocol/openid-connect/token
   with body:
     grant_type=password
     client_id=mifos-staff
     username=<username>
     password=<password>
     scope=openid profile email

4. Keycloak verifies the credentials against its PostgreSQL database
   Returns: { access_token, refresh_token, expires_in }

5. API gateway returns { accessToken, refreshToken, expiresIn } to the web app

6. Web app stores accessToken in localStorage AND as a cookie
   (localStorage = client-side JS reads it; cookie = SSR middleware reads it)

7. Every future API request includes: Authorization: Bearer <accessToken>

8. API gateway verifies the token using Keycloak's public keys
   (fetched from http://keycloak:8180/realms/mifos/protocol/openid-connect/certs)

9. If valid, the user's roles are extracted from the token and req.user is set
```

### What's inside a JWT token

A JWT has three parts separated by dots: `header.payload.signature`. The payload (middle part) contains the user's claims. For this project, the payload looks like:

```json
{
  "sub": "abc-123-uuid",
  "preferred_username": "admin",
  "email": "admin@mifos.local",
  "realm_access": {
    "roles": ["super_admin", "offline_access", "default-roles-mifos"]
  },
  "iss": "http://keycloak:8180/realms/mifos",
  "exp": 1234567890,
  "iat": 1234567000
}
```

The `keycloak.ts` plugin extracts `sub` (user ID), `preferred_username`, `email`, and `realm_access.roles` from this. The `exp` field is the expiry timestamp — `@fastify/jwt` automatically rejects tokens past this time.

### How token verification works (no database roundtrip)

Keycloak signs tokens with a **private key** that only Keycloak knows. It publishes the matching **public key** at:
```
http://keycloak:8180/realms/mifos/protocol/openid-connect/certs
```

The API gateway fetches this public key once and caches it for 10 minutes. To verify a token it just runs the math: if the signature on the token matches what the public key produces, the token is genuine. No database call needed — cryptography proves it.

This is why every service can verify tokens independently without calling Keycloak on every request.

### Security settings in the realm

From `realm-mifos.json`:
- `bruteForceProtected: true` — Keycloak locks accounts after repeated failed login attempts
- `registrationAllowed: false` — users cannot self-register; an admin must create accounts
- `sslRequired: external` — HTTPS is required for external access (relaxed for localhost development)

---

## 10. Turborepo + pnpm Workspaces

**What it is:** The build system and package manager setup that lets multiple apps and services live in one repository and share code between them.

### The problem it solves

This project has 6 Node.js services/apps that all need to share the same TypeScript types (`@mifos-x/shared-types`). Without a monorepo setup you'd have two bad options:
1. Copy the types into each service — they drift out of sync immediately
2. Publish `shared-types` to npm — huge overhead for an internal package

A monorepo keeps everything in one repo with a single `node_modules`. Services reference each other as local packages.

### pnpm Workspaces — the package manager layer

**pnpm** is an alternative to npm/yarn. It's faster and uses less disk space because it stores packages once globally and hard-links them into projects.

**Workspaces** tell pnpm "these folders are all packages in this project." Defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'       # apps/api, apps/web, apps/mobile
  - 'services/*'   # services/mobile-money, services/kyc, services/reporting (Python — not managed by pnpm)
  - 'packages/*'   # packages/shared-types
```

With this, any package can depend on another local package using `workspace:*`:

```json
// apps/api/package.json
{
  "dependencies": {
    "@mifos-x/shared-types": "workspace:*"
  }
}
```

pnpm resolves `workspace:*` to the local `packages/shared-types` folder — no npm publish needed. When you run `pnpm install` from the root, it installs dependencies for **all** workspaces at once.

#### Useful pnpm commands

```bash
# Run a command in one specific package
pnpm --filter @mifos-x/api dev
pnpm --filter @mifos-x/web build
pnpm --filter @mifos-x/kyc test

# Run across all packages (Turborepo handles the order)
pnpm dev
pnpm build
pnpm test
```

### Turborepo — the task runner layer

**Turborepo** sits on top of pnpm workspaces and makes running tasks across multiple packages fast and smart. Configured in `turbo.json`:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

#### What `dependsOn: ["^build"]` means

The `^` means "the `build` task of all dependencies must finish first." So when you run `pnpm build`:

1. Turborepo looks at what each package depends on
2. `apps/api` depends on `@mifos-x/shared-types` → it builds `shared-types` first
3. Only after `shared-types` is built does it build `apps/api`, `apps/web`, etc.
4. Packages with no dependencies on each other build **in parallel**

Without this, you'd sometimes get TypeScript errors because `shared-types` wasn't built yet when `apps/api` tried to import from it.

#### Caching

Turborepo caches task outputs. If you run `pnpm build` twice and nothing changed, the second run is instant — it just replays the cached output. The cache key is based on:
- The source files in that package
- The environment variables
- The task configuration

`dev` has `cache: false` because dev servers run forever (they're `persistent: true`) and shouldn't be cached.

`outputs` tells Turborepo which folders to cache — `.next/**` for the Next.js build, `dist/**` for TypeScript compilation output.

#### The TUI

`"ui": "tui"` in `turbo.json` enables the **Terminal UI** — when you run `pnpm dev`, Turborepo shows a live dashboard in your terminal with one panel per service, each streaming its own logs. Press `q` to quit all services at once.

### The overall repo structure

```
MifosX4MM/
├── apps/
│   ├── api/          Node.js API Gateway (Fastify)
│   ├── web/          Web portal (Next.js)
│   └── mobile/       Mobile app (Expo/React Native)
│
├── services/
│   ├── mobile-money/ KBZ Pay integration (Node.js/Fastify)
│   ├── kyc/          KYC verification (Node.js/Fastify)
│   └── reporting/    Financial reports (Python/FastAPI — NOT managed by Turborepo)
│
├── packages/
│   └── shared-types/ TypeScript types shared across all Node.js services
│
├── infra/
│   ├── keycloak/     Keycloak realm configuration
│   ├── mysql/        MySQL init SQL
│   └── postgres/     PostgreSQL init SQL
│
├── scripts/
│   └── seed-fineract.ts  Loads initial data into Fineract
│
├── docker-compose.yml    Defines all containers
├── turbo.json            Turborepo task configuration
├── pnpm-workspace.yaml   Workspace package paths
└── package.json          Root scripts and dev dependencies
```

### Why the reporting service is separate

The Python reporting service (`services/reporting/`) is listed in `pnpm-workspace.yaml` but pnpm doesn't actually manage it — it has no `package.json`. It lives there for organizational consistency but is a completely separate Python project. It must be started manually:

```bash
cd services/reporting
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3005
```

It is not started by `pnpm dev` and is not part of the Turborepo build pipeline.
