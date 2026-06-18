# Mobile App — Complete Technical Deep-Dive

> **Audience:** You, Jackson. You've seen the app running. This doc explains every file, every decision, every API call, every edge case — so you can navigate, modify, debug, and extend it confidently.

---

## Table of Contents

1. [What This App Is](#1-what-this-app-is)
2. [Folder Structure](#2-folder-structure)
3. [Environment Variables (.env)](#3-environment-variables-env)
4. [Navigation Architecture (Expo Router)](#4-navigation-architecture-expo-router)
5. [Authentication System](#5-authentication-system)
6. [The Axios API Client (src/lib/api.ts)](#6-the-axios-api-client-srclibapits)
7. [Screen-by-Screen Breakdown](#7-screen-by-screen-breakdown)
   - [Login Screen](#71-login-screen)
   - [Home / Dashboard Tab](#72-home--dashboard-tab)
   - [Clients Tab](#73-clients-tab)
   - [Collections Tab](#74-collections-tab)
   - [Client Detail Screen](#75-client-detail-screen)
   - [Loan Detail + Repayment Screen](#76-loan-detail--repayment-screen)
8. [All Hooks and What They Do](#8-all-hooks-and-what-they-do)
9. [KBZ Pay Integration — Full Flow](#9-kbz-pay-integration--full-flow)
10. [Formatting Utilities (src/lib/format.ts)](#10-formatting-utilities-srclibformatts)
11. [Styling System](#11-styling-system)
12. [React Query Strategy](#12-react-query-strategy)
13. [Known Bugs and Limitations](#13-known-bugs-and-limitations)
14. [How Data Flows End-to-End (Trace)](#14-how-data-flows-end-to-end-trace)

---

## 1. What This App Is

This is the **field operations mobile app** for MifosX4MM — a microfinance platform for Myanmar. It's built with **Expo + React Native**, so a single TypeScript codebase runs on both Android and iOS.

The primary user is a **loan officer** in the field. They use the app to:
- Check their portfolio stats (active clients, active loans, PAR, money collected today)
- Browse and search their client list
- See overdue repayments they need to collect today
- Record a repayment — either cash or via KBZ Pay (Myanmar's dominant mobile wallet)

The app is **read-only except for recording repayments**. It does not create loans or clients. That's done via the web staff portal (Next.js, port 3000).

**Technology stack:**
- Expo SDK (React Native runtime, dev server, build system)
- Expo Router (file-based navigation — think Next.js but for mobile)
- TanStack React Query (data fetching + caching)
- Axios (HTTP client)
- AsyncStorage (token persistence on device)
- TypeScript throughout

---

## 2. Folder Structure

```
apps/mobile/
├── app/                          # Expo Router pages (file = route)
│   ├── _layout.tsx               # Root layout: providers + navigation stack
│   ├── index.tsx                 # Root redirect (sends you to login or tabs)
│   ├── (auth)/                   # Route group — NOT a URL segment
│   │   └── login.tsx             # /login
│   ├── (tabs)/                   # Route group — NOT a URL segment
│   │   ├── _layout.tsx           # Tab bar definition (3 tabs)
│   │   ├── index.tsx             # /  (Home/Dashboard tab)
│   │   ├── clients.tsx           # /clients
│   │   └── collections.tsx       # /collections
│   ├── clients/
│   │   └── [clientId].tsx        # /clients/123 (dynamic route)
│   └── loans/
│       └── [loanId].tsx          # /loans/456 (dynamic route)
│
├── src/
│   ├── context/
│   │   └── AuthContext.tsx       # Auth state: user, login(), logout()
│   ├── hooks/
│   │   ├── useClients.ts         # Client list + single client queries
│   │   └── useLoans.ts           # Loan queries + repayment mutations
│   └── lib/
│       ├── api.ts                # Axios instance, token handling, refresh logic
│       └── format.ts             # Number/currency/date formatting helpers
│
├── .env                          # API URLs, dev credentials
├── tsconfig.json                 # TypeScript config (fixed — no more red error)
├── app.json                      # Expo project config
└── package.json
```

**Key mental model:** The `app/` folder IS the router. Every file in it is automatically a screen. The parenthesized folders `(auth)` and `(tabs)` are "route groups" — they group screens for layout purposes but don't appear in the URL.

---

## 3. Environment Variables (.env)

```env
EXPO_PUBLIC_API_URL=http://192.168.1.109:3001
EXPO_PUBLIC_REPORTING_URL=http://192.168.1.109:3005
EXPO_PUBLIC_DEV_USERNAME=loan.officer
EXPO_PUBLIC_DEV_PASSWORD=Officer@1234
```

**Why `192.168.1.109` and not `localhost`?**  
The Android emulator is its own virtual machine. When it makes a network request to `localhost`, it talks to *itself* — not your laptop. Your laptop's localhost is reachable from the emulator at `10.0.2.2`. But `192.168.1.109` is your laptop's LAN IP, which works from both the emulator AND a real physical device on the same WiFi.

> **If the API stops working:** Check `ipconfig` on Windows. If your laptop's IP changed (DHCP), update both values in `.env` and restart Expo.

**`EXPO_PUBLIC_` prefix:** Expo only exposes env vars to the app bundle if they start with `EXPO_PUBLIC_`. Variables without this prefix are invisible to the app code (server-side only). This is a security feature.

**`EXPO_PUBLIC_DEV_USERNAME` / `EXPO_PUBLIC_DEV_PASSWORD`:** These auto-fill the login form when running in dev mode (`__DEV__ === true`). They're never included in production builds.

---

## 4. Navigation Architecture (Expo Router)

Expo Router is file-based navigation, similar to how Next.js works for websites. Files in `app/` become screens; folders become nested navigators.

### The Full Route Tree

```
app/_layout.tsx              ← Stack navigator (root of everything)
│
├── (auth)/login.tsx         ← Login screen (shown when not logged in)
│
├── (tabs)/_layout.tsx       ← Tab navigator (3-tab bar at bottom)
│   ├── (tabs)/index.tsx     ← Home tab
│   ├── (tabs)/clients.tsx   ← Clients tab
│   └── (tabs)/collections.tsx ← Collections tab
│
├── clients/[clientId].tsx   ← Client detail (pushed onto stack)
└── loans/[loanId].tsx       ← Loan detail (pushed onto stack)
```

### How NavigationGuard Works

Inside `app/_layout.tsx`, there's a `NavigationGuard` component. It runs after auth state loads:

```
User opens app
   ↓
AuthContext loads (checks AsyncStorage for stored token)
   ↓
isLoading = true  →  nothing renders yet (prevents flash)
   ↓
isLoading = false
   ├── user === null  →  router.replace('/(auth)/login')
   └── user !== null  →  router.replace('/(tabs)')
```

`router.replace()` is used instead of `router.push()` so the user can't press Back to get to the wrong screen.

### Dynamic Routes

`[clientId]` and `[loanId]` in square brackets are dynamic segments. When you navigate to `/clients/123`, Expo Router passes `{ clientId: "123" }` as route params.

Inside the screen, you access it like:
```typescript
const { clientId } = useLocalSearchParams<{ clientId: string }>();
```

### How Tab Navigation Works

`(tabs)/_layout.tsx` defines the tab bar:
- **Tab 1:** `index` → Home icon → label "Home"
- **Tab 2:** `clients` → Users icon → label "Clients"  
- **Tab 3:** `collections` → Banknote icon → label "Collections"

Active tab color: `#0284c7` (blue). Inactive: `#9ca3af` (grey).

When you tap a client in the Clients tab, it navigates to `/clients/[clientId]` — this pushes a new screen *on top of* the tab navigator (it's in the root Stack, not inside the tabs). So you see a Back button, not the tab bar.

---

## 5. Authentication System

Authentication touches four files. Here's how they all connect:

### File 1: `src/lib/api.ts` — Token Storage

```typescript
// Two tokens are stored in AsyncStorage (the device's key-value store):
AsyncStorage.setItem('accessToken', token)
AsyncStorage.setItem('refreshToken', token)
```

AsyncStorage persists across app restarts. Think of it as `localStorage` for React Native.

### File 2: `src/context/AuthContext.tsx` — Auth State

```typescript
// What it holds:
const [user, setUser] = useState<AuthUser | null>(null);
const [isLoading, setIsLoading] = useState(true);

// On app start, it tries to restore the session:
useEffect(() => {
  getStoredUser()       // checks AsyncStorage → calls /auth/me
    .then(setUser)      // sets user state if token is valid
    .finally(() => setIsLoading(false));
}, []);
```

`AuthUser` type (from `@mifos-x/shared-types`):
```typescript
{
  id: number;
  username: string;
  displayName: string;
  email: string;
  roles: string[];           // e.g., ["loan_officer"]
  officeId: number;
  officeName: string;
  accessToken: string;
  refreshToken: string;
}
```

### File 3: `src/lib/api.ts` — The Two Interceptors

**Request interceptor** (runs before every API call):
```
Every HTTP request
   ↓
Get accessToken from AsyncStorage
   ↓
Add header: Authorization: Bearer <token>
   ↓
Send request
```

**Response interceptor** (runs when a response comes back):
```
Response comes back
   ├── 200-399: pass through, return data
   └── 401 Unauthorized:
         ↓
         Get refreshToken from AsyncStorage
         ↓
         POST /auth/refresh  { refreshToken }
         ├── Success: store new accessToken, retry original request
         └── Failure: clear both tokens, navigate to login
```

This is called **silent token refresh** — the user never sees a login prompt if their access token expires mid-session, as long as the refresh token is still valid.

### File 4: `app/(auth)/login.tsx` — The Login Screen

```
User types username + password → taps "Sign in"
   ↓
handleLogin() calls AuthContext.login(username, password)
   ↓
api.ts: POST /api/v1/auth/login { username, password }
   ↓
API Gateway (Fastify) receives this:
   → Forwards to Keycloak: POST /realms/mifos/protocol/openid-connect/token
     { grant_type: "password", client_id: "mifos-gateway", username, password }
   ← Keycloak returns: { access_token, refresh_token }
   → API Gateway calls Fineract: GET /fineract-provider/api/v1/users?username=...
   ← Gets user profile
   → Returns to mobile: { accessToken, refreshToken, ...userProfile }
   ↓
Mobile stores both tokens in AsyncStorage
   ↓
Calls GET /api/v1/auth/me  (to get full user object)
   ↓
Sets user state in AuthContext
   ↓
NavigationGuard sees user !== null → router.replace('/(tabs)')
```

**Dev mode auto-fill:** In `__DEV__` mode, the username and password fields initialize from the env vars:
```typescript
const [username, setUsername] = useState(
  __DEV__ ? (process.env.EXPO_PUBLIC_DEV_USERNAME ?? '') : ''
);
```
So in development, you open the app and just tap "Sign in" — no typing needed.

---

## 6. The Axios API Client (src/lib/api.ts)

This file is the single HTTP client for the entire app. Every API call goes through here.

```typescript
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
export const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 20_000,    // 20 second timeout — important for slow Myanmar networks
});
```

**Base URL:** `http://192.168.1.109:3001/api/v1`  
Every hook call like `api.get('/clients')` becomes `GET http://192.168.1.109:3001/api/v1/clients`

**Functions exported:**

| Function | What it does |
|---|---|
| `login(username, password)` | POST /auth/login → stores tokens → GET /auth/me → returns AuthUser |
| `logout()` | POST /auth/logout → clears AsyncStorage tokens |
| `getStoredUser()` | Reads token from AsyncStorage → GET /auth/me → returns AuthUser or null |

**Error handling:** All errors bubble up as Axios errors. The response interceptor catches 401s. Everything else (404, 500, network error) throws and is caught by React Query's `isError` state, which the screens display as error messages.

---

## 7. Screen-by-Screen Breakdown

### 7.1 Login Screen

**File:** `app/(auth)/login.tsx`  
**Route:** Shown when `user === null`

**What you see:** White card on light blue background. "Mifos X" title, "Field Operations" subtitle. Username + password fields. "Sign in" button.

**What happens technically:**
1. Username/password fields controlled by `useState`
2. Tap "Sign in" → `handleLogin()` → `setLoading(true)` → calls `AuthContext.login()`
3. Button shows `<ActivityIndicator>` (spinner) while loading
4. On error: "Invalid username or password" in red appears below the fields
5. On success: AuthContext sets user → NavigationGuard fires → navigate to tabs

**Styles:** Uses `StyleSheet.create()` (React Native's equivalent of CSS modules). Key colors: `#0284c7` (button blue), `#0c4a6e` (dark navy for logo), `#f0f9ff` (light blue background).

---

### 7.2 Home / Dashboard Tab

**File:** `app/(tabs)/index.tsx`  
**Route:** `/` (first tab)

**What you see:** Greeting (changes based on time of day), loan officer's name + date, 4 stat cards.

**The 4 stat cards:**

| Card | API Field | Color Logic |
|---|---|---|
| Active Clients | `stats.activeClients` | Always blue |
| Active Loans | `stats.activeLoans` | Always blue |
| Portfolio at Risk | `stats.par` | Green <2%, Amber 2-5%, Red >5% |
| Collected Today | `stats.collectedToday` | Always blue |

**Data source:** `useLoanOfficerStats()` hook → `GET /api/v1/dashboard/stats`  
The API Gateway routes this to the Fastify dashboard service, which queries Fineract for real-time data.

**Auto-refresh:** `refetchInterval: 60_000` — re-fetches every 60 seconds automatically while the screen is focused.

**Pull-to-refresh:** The `ScrollView` has a `RefreshControl` attached. Pull down → triggers a manual refetch.

**Loading state:** Instead of a spinner, it shows skeleton placeholder cards (grey animated boxes) while data is loading. This feels faster to users.

**Time-based greeting:**
```typescript
const hour = new Date().getHours();
// 0-11  → "Good morning"
// 12-17 → "Good afternoon"  
// 18+   → "Good evening"
```

---

### 7.3 Clients Tab

**File:** `app/(tabs)/clients.tsx`  
**Route:** `/clients`

**What you see:** Search bar at top. Scrollable list of clients. Each row: colored circle with initials, full name, account number, office name.

**The search logic:**
```
User types in search bar
   ↓
If length >= 2 characters:
   → fires new query with displayName filter → GET /clients?displayName=<search>
If length < 2:
   → fires query with no filter → GET /clients (all clients)
```
The ≥2 character threshold prevents spamming the API on every keystroke.

**Infinite scroll:** Uses `useInfiniteQuery` (not regular `useQuery`). This is React Query's paginated query type.
```
First render → fetches page 0 (first 20 clients)
User scrolls to 40% from bottom (onEndReached threshold 0.4)
   → fetches page 1 (next 20 clients)
   → merges into list
User scrolls more → fetches page 2, etc.
```

**The `FlatList` component:** React Native's performant list renderer. It only renders items currently visible on screen, discarding off-screen items from the render tree. This is why it can handle 1000+ clients without performance issues.

**Avatar initials:** Generated by splitting the display name:
```typescript
// "Aung Myat Kyaw" → "AM"
name.split(' ').slice(0, 2).map(w => w[0]).join('')
```

**Navigation:** Tap any row → `router.push('/clients/' + client.id)` → Client Detail screen.

---

### 7.4 Collections Tab

**File:** `app/(tabs)/collections.tsx`  
**Route:** `/collections`

**What you see:** If no overdue loans — green checkmark, "No overdue accounts" message (you saw this). If there are overdue loans — a red banner showing total overdue amount + count, then a list of overdue loans.

**IMPORTANT — This tab calls a different service:**
```typescript
// NOT the API Gateway
// Calls the Python reporting service directly
const url = `${process.env.EXPO_PUBLIC_REPORTING_URL}/reports/collections/overdue?days_overdue=1`;
```

`EXPO_PUBLIC_REPORTING_URL` = `http://192.168.1.109:3005` (the Python FastAPI service, not port 3001).

**Why directly to reporting?**  
The reporting service has a pre-written SQL query that calculates overdue loans with amounts owed, days overdue, and client info all in one query. It's much faster than making multiple API Gateway calls to reconstruct this data.

**The `days_overdue=1` parameter:** Only returns loans that are at least 1 day overdue. Adjust this number to see loans overdue by more days (e.g., `?days_overdue=30` for PAR30 candidates).

**⚠️ Known Bug:** The reporting service reads from **PostgreSQL** `fineract_default` database, but all the actual loan data lives in **MySQL** `fineract_default`. The PostgreSQL database is currently empty. This is why you see "No overdue accounts" even if there are real overdue loans. **This is the dual-database bug.** See Section 13.

---

### 7.5 Client Detail Screen

**File:** `app/clients/[clientId].tsx`  
**Route:** `/clients/123`

**What you see:** Large colored circle with initials (bigger than in list). Client name, account number, active/inactive badge. Phone, date of birth, office. Then a list of all their loan accounts.

**Each loan row shows:**
- Product name (e.g., "Group Loan")
- Account number
- Status badge (color-coded — see below)
- Outstanding balance in MMK

**Loan status colors:**

| Status Code | Label | Badge Color |
|---|---|---|
| 100 | Submitted | Yellow |
| 200 | Approved | Blue |
| 300 | Active | Green |
| 400 | Withdrawn | Grey |
| 500 | Rejected | Red |
| 600 | Closed | Grey |

**Data fetched:**
- `useClient(clientId)` → `GET /api/v1/clients/:id` (client profile)
- `useClientLoans(clientId)` → `GET /api/v1/clients/:id/loans` (all loans for this client)

Both queries run in parallel (React Query runs independent queries simultaneously). The screen shows partial data while the other is loading.

**Navigation:** Tap any loan row → `router.push('/loans/' + loan.id)` → Loan Detail screen.

---

### 7.6 Loan Detail + Repayment Screen

**File:** `app/loans/[loanId].tsx`  
**Route:** `/loans/456`

This is the **most complex screen** in the app. It has two main parts: the loan info display, and the repayment modal.

#### Part A: Loan Info Display

**Dark blue summary card (top):**
- Principal amount (original loan)
- Outstanding balance (what's left to pay)
- If overdue: red "OVERDUE" badge + overdue amount
- Repayment frequency (e.g., "Weekly")
- Interest rate (e.g., "24.0% per annum")

**Timeline card:**
- Disbursement date (when loan was given out)
- Maturity date (when last payment is due)

**Upcoming installments:** Next 5 unpaid installments, each showing:
- Due date
- Amount due
- Status (Upcoming / Overdue)

**Sticky button at bottom:** "Record Repayment" — only visible if loan status is Active (300) or Approved (200). Closed, rejected, or withdrawn loans show no button.

**Data source:** `useLoan(loanId)` → `GET /api/v1/loans/:id`

#### Part B: Repayment Modal

The modal has **3 states** controlled by a state variable:

```
State 1: "entry"
   ↓ User enters amount, chooses Cash or KBZ Pay
   
State 2: "kbz_pending"  (only for KBZ Pay path)
   ↓ Shows "Waiting for payment..." with spinner
   ↓ Polls every 5 seconds
   
State 3: "success"
   ↓ Shows green checkmark + "Payment recorded"
```

**Cash repayment path:**
```
User types amount → taps "Confirm Cash"
   ↓
usePostRepayment mutation fires:
   POST /api/v1/loans/:id/repayments
   {
     dateFormat: "yyyy/MM/dd",
     locale: "en",
     transactionDate: "2026/06/17",   ← today's date, auto-generated
     transactionAmount: 50000,
     note: "optional text"
   }
   ↓
On success:
   → invalidate ['loan', loanId] query → screen auto-refetches updated balance
   → modal state = "success"
   ↓
Loan detail screen shows updated outstanding balance
```

**KBZ Pay path:**
```
User types amount → taps "Pay with KBZ Pay"
   ↓
useInitiateKbzPayment mutation fires:
   POST /api/v1/payments/initiate
   {
     loanId: 456,
     amount: 50000,          ← in MMK
     customerName: "Aung Myat",
     customerPhone: "09123456789"
   }
   ↓
API Gateway's KBZ Pay service:
   → converts to pyas: 50000 × 100 = 5,000,000 pyas
   → signs request with HMAC-SHA256
   → calls KBZ Pay merchant API
   ← returns: { prepayId: "kbz_abc123", orderId: "ord_xyz", expireTime: 300 }
   ↓
Mobile receives prepayId + orderId
   ↓
modal state = "kbz_pending"
   ↓
Linking.openURL("kbzpay://pay?prepay_id=kbz_abc123&merch_order_id=ord_xyz")
   ↓
KBZ Pay app opens on user's phone
   ↓
User authenticates in KBZ Pay + confirms payment
   ↓
User returns to the Mifos app (either manually or via deep link callback)
   ↓
Meanwhile: polling every 5 seconds:
   GET /api/v1/payments/status/ord_xyz
   ├── status: "PENDING" → keep polling
   ├── status: "SUCCESS":
   │     → POST /api/v1/loans/:id/repayments (same as cash)
   │     → modal state = "success"
   └── status: "FAILED" or "EXPIRED":
         → show error message, allow retry
```

**The `Linking.openURL` trick:** React Native's `Linking` module can open URLs, including deep links to other apps. `kbzpay://` is KBZ Pay's registered URL scheme. If KBZ Pay is not installed, this throws an error (which should be caught and shown as "KBZ Pay app not found").

---

## 8. All Hooks and What They Do

Hooks are reusable functions that wrap React Query queries and mutations.

### src/hooks/useClients.ts

#### `useClients(search?: string)`
```typescript
// What it does: fetches paginated client list
// Query key: ['clients', search]  ← changes with search term = refetches on search
// API call: GET /api/v1/clients?offset=0&limit=20[&displayName=<search>]
// Returns: React Query infinite query result
//   - data.pages[0].data = first 20 clients
//   - data.pages[1].data = next 20 clients, etc.
//   - fetchNextPage() = load more
//   - hasNextPage = boolean (more pages available?)
```

#### `useClient(clientId: string)`
```typescript
// What it does: fetches single client profile
// Query key: ['client', clientId]
// API call: GET /api/v1/clients/:id
// Enabled: only when clientId is truthy (prevents empty string calls)
// Returns: React Query query result with FineractClient object
```

### src/hooks/useLoans.ts

#### `useClientLoans(clientId: string)`
```typescript
// What it does: fetches all loans for a specific client
// Query key: ['loans', 'client', clientId]
// API call: GET /api/v1/clients/:id/loans
// Enabled: only when clientId is truthy
// Returns: FineractLoanAccount[] (array of all loan accounts)
```

#### `useLoan(loanId: string)`
```typescript
// What it does: fetches a single loan with full details
// Query key: ['loan', loanId]
// API call: GET /api/v1/loans/:id
// Returns: FineractLoanAccount (single loan with repayment schedule, etc.)
```

#### `usePostRepayment()`
```typescript
// What it does: sends a repayment to Fineract
// Type: useMutation (not useQuery — it changes data)
// API call: POST /api/v1/loans/:id/repayments
// Params: { loanId, amount, note? }
// On success: invalidates ['loan', loanId] query → screen auto-refreshes
// Note: Date format is "yyyy/MM/dd" (Fineract-specific requirement)
```

#### `useInitiateKbzPayment()`
```typescript
// What it does: initiates a KBZ Pay transaction
// Type: useMutation
// API call: POST /api/v1/payments/initiate
// Params: { loanId, amount, customerName, customerPhone }
// Returns: { prepayId, orderId, expireTime }
// Note: amount is in MMK; the gateway converts to pyas for KBZ Pay
```

### (Dashboard hook — inline in index.tsx)

The dashboard hook `useLoanOfficerStats()` is defined inline in `app/(tabs)/index.tsx`:
```typescript
// API call: GET /api/v1/dashboard/stats
// refetchInterval: 60_000  ← auto-refresh every 60 seconds
// Returns: { activeClients, activeLoans, par, collectedToday }
```

---

## 9. KBZ Pay Integration — Full Flow

KBZ Pay is Myanmar's largest mobile payment platform (similar to Alipay or GPay). The integration uses a deep-link pattern because KBZ Pay doesn't support in-app payment flows.

### The Three Systems Involved

```
Mobile App (React Native)
     ↕ HTTP
API Gateway (Fastify, port 3001)
     ↕ HTTPS + HMAC-SHA256
KBZ Pay Merchant API
```

### Amount Conversion: MMK → Pyas

KBZ Pay API requires amounts in **pyas** (smallest currency unit). Myanmar doesn't officially use pyas, but the API convention is: **1 MMK = 100 pyas**.

```
User enters: 50,000 MMK
Mobile sends to gateway: 50000
Gateway sends to KBZ Pay: 5,000,000 pyas
```

### HMAC-SHA256 Signing

Every request to KBZ Pay must be signed. The gateway:
1. Assembles the request payload
2. Creates HMAC-SHA256 signature: `HMAC_SHA256(secret_key, json_payload)`
3. Adds the signature to the request headers
4. KBZ Pay verifies the signature server-side

The mobile app never sees the secret key. Signing happens entirely in the API Gateway.

### Deep Link Flow

```
kbzpay://pay?prepay_id=ABC&merch_order_id=XYZ
         ↑
  This URL opens KBZ Pay app, pre-filled with payment details
```

After the user pays (or cancels) in KBZ Pay:
- KBZ Pay may redirect back to the Mifos app via a registered callback URL
- But the mobile app doesn't rely on this — it **polls** the gateway every 5 seconds regardless

### Polling

```typescript
const pollInterval = setInterval(async () => {
  const { data } = await api.get(`/payments/status/${orderId}`);
  if (data.data.status === 'SUCCESS') {
    clearInterval(pollInterval);
    // post repayment to Fineract
  } else if (data.data.status === 'FAILED' || data.data.status === 'EXPIRED') {
    clearInterval(pollInterval);
    // show error
  }
  // PENDING → do nothing, keep polling
}, 5000);
```

Polling stops when:
- Payment succeeds → posts to Fineract, shows success
- Payment fails/expires → shows error
- User closes the modal → polling should be cleaned up (verify this in the code)
- `expireTime` seconds have passed (KBZ Pay transactions expire, typically 5 minutes)

---

## 10. Formatting Utilities (src/lib/format.ts)

```typescript
export const fmt = {
  mmk: (n: number) => MMK.format(n),
  number: (n: number) => new Intl.NumberFormat('en-US').format(n),
  percent: (n: number, dp = 1) => `${n.toFixed(dp)}%`,
  date: (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
};
```

**`fmt.mmk(50000)`** → `"MMK 50,000"` (uses browser/native Intl API, no commas lost)  
**`fmt.number(6)`** → `"6"` (also handles large numbers: `fmt.number(1234567)` → `"1,234,567"`)  
**`fmt.percent(0.0, 1)`** → `"0.0%"` (default 1 decimal place; `fmt.percent(2.5, 2)` → `"2.50%"`)  
**`fmt.date("2026-06-17")`** → `"17 Jun 2026"` (en-GB format: day month year)

The currency formatter (`Intl.NumberFormat`) uses the device's locale engine, so it respects thousands separators correctly. Always use `fmt.mmk()` for money display — never manually format MMK values.

---

## 11. Styling System

React Native doesn't use CSS. Instead it uses `StyleSheet.create()` which produces a registry of style objects (similar concept, different implementation).

**Consistent color palette used throughout the app:**

```typescript
const BLUE = '#0284c7';        // Primary action color (buttons, active tabs, links)
const DARK_NAVY = '#0c4a6e';   // Page headers, loan summary card
const LIGHT_BLUE = '#f0f9ff';  // Screen backgrounds
const GREY_TEXT = '#64748b';   // Secondary text, labels
const DARK_TEXT = '#111827';   // Primary text
const BORDER = '#e5e7eb';      // Input borders, dividers
const ERROR_RED = '#dc2626';   // Error messages, overdue badges
const SUCCESS_GREEN = '#16a34a'; // Success states, PAR < 2%
const WARNING_AMBER = '#d97706'; // PAR 2-5%, warning states
```

**No design system library is used** — all styles are written by hand with `StyleSheet.create()`. This keeps the bundle small but means there's no Tailwind or Material UI to reference.

**Layout:** Uses React Native's Flexbox (same concept as CSS Flexbox, slightly different defaults: `flexDirection` defaults to `column` instead of `row`).

**Shadows:** iOS uses `shadowColor`/`shadowOpacity`/`shadowRadius`. Android uses `elevation`. Most cards set both:
```typescript
shadowColor: '#000',
shadowOpacity: 0.06,
shadowRadius: 12,
elevation: 3,
```

---

## 12. React Query Strategy

React Query manages all server state in the app. Here's how it's configured:

**Global config (in `app/_layout.tsx`):**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,        // on failure, retry once before showing error
      staleTime: 30_000,  // data considered fresh for 30 seconds
    },
  },
});
```

**What `staleTime: 30_000` means:** After fetching data, it won't refetch for 30 seconds, even if you navigate away and back. After 30 seconds, the next time the screen is focused, it silently refetches in the background.

**Query key convention:**
```
['clients', search]          → all clients, filtered by search
['client', clientId]         → single client by ID
['loans', 'client', clientId] → all loans for a client
['loan', loanId]             → single loan by ID
```

**Cache invalidation after mutations:**
When `usePostRepayment` succeeds, it calls:
```typescript
qc.invalidateQueries({ queryKey: ['loan', loanId] })
```
This marks that specific loan as stale → on next render, React Query silently refetches it → loan detail screen automatically shows updated balance without user doing anything.

**Infinite query pattern (clients list):**
```typescript
useInfiniteQuery({
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) =>
    lastPage.total > allPages.length * PAGE_SIZE
      ? allPages.length    // next page number
      : undefined,         // undefined = no more pages
})
```

---

## 13. Known Bugs and Limitations

### Bug 1: Collections Tab Always Shows Empty (CRITICAL)
**Symptom:** Collections tab shows "No overdue accounts" even when loans are overdue.  
**Root cause:** The Python reporting service reads from PostgreSQL `fineract_default` database. But Fineract writes all loan data to MySQL `fineract_default`. The PostgreSQL database is empty.  
**Impact:** Loan officers cannot see their daily collection list.  
**Fix options (decided separately):**
- Option A: Point reporting service at MySQL (~1 day work)
- Option B: Migrate Fineract to PostgreSQL (~2-3 days)
- Option C: Add CDC replication MySQL→PostgreSQL (complex, weeks)

### Bug 2: PAR Shows 0.0% on Dashboard
**Symptom:** Portfolio at Risk always shows 0.0%.  
**Root cause:** Same as Bug 1 — PAR is calculated by the Python reporting service, which reads from the empty PostgreSQL database.  
**Impact:** No risk visibility for management.

### Bug 3: API URL Breaks if Laptop IP Changes
**Symptom:** App suddenly can't connect to backend.  
**Root cause:** `.env` has hardcoded `192.168.1.109` — a DHCP IP that can change.  
**Fix:** Run `ipconfig` on Windows, check current IP, update `.env`, restart Expo.

### Bug 4: KBZ Pay Polling Cleanup
**Potential issue:** The KBZ Pay polling interval may not be cleaned up if the user closes the modal while payment is pending. This could cause an update on an unmounted component. Should add `clearInterval` in the modal's `useEffect` cleanup function.

### Limitation 1: Loan Officers Only
The mobile app only works for `loan_officer` role. `super_admin` and `branch_manager` should use the web staff portal.

### Limitation 2: No Offline Mode
The app requires network connectivity. There is no offline queue for repayments. If connection drops mid-repayment, the user must retry.

### Limitation 3: No Push Notifications
The app has no push notifications for overdue accounts or repayment reminders. Future feature.

---

## 14. How Data Flows End-to-End (Trace)

Here's a complete trace of what happens when a loan officer opens the app and records a cash repayment:

```
1. Loan officer opens app on Android emulator
      ↓
2. React Native runtime boots, Expo Router mounts app/_layout.tsx
      ↓
3. QueryClientProvider wraps everything (React Query context)
      ↓
4. AuthProvider mounts → getStoredUser() fires
      → AsyncStorage.getItem('accessToken') → returns stored token
      → GET http://192.168.1.109:3001/api/v1/auth/me
        (Axios request interceptor adds: Authorization: Bearer <token>)
      → Fastify API Gateway validates JWT against Keycloak JWKS endpoint
      → Returns user profile
      → AuthContext sets user state
      ↓
5. NavigationGuard fires: user !== null → router.replace('/(tabs)')
      ↓
6. Home tab mounts, useLoanOfficerStats() fires:
      → GET http://192.168.1.109:3001/api/v1/dashboard/stats
      → API Gateway queries Fineract
      ← Returns: { activeClients: 6, activeLoans: 6, par: 0.0, collectedToday: 0 }
      → React Query caches result for 30 seconds
      → Dashboard renders: 6 active clients, 6 active loans, 0.0% PAR, MMK 0 collected
      ↓
7. Loan officer taps "Clients" tab:
      → Clients tab mounts, useClients() fires:
      → GET http://192.168.1.109:3001/api/v1/clients?offset=0&limit=20
      → API Gateway proxies to Fineract
      ← Returns: { data: [client1, client2, ...], total: 6 }
      → FlatList renders 6 client rows
      ↓
8. Loan officer taps client "Daw Aye Aye Win":
      → router.push('/clients/42')
      → Client detail screen mounts
      → useClient('42') fires: GET /api/v1/clients/42
      → useClientLoans('42') fires: GET /api/v1/clients/42/loans
      (both run in parallel)
      ← Returns client profile + array of loan accounts
      → Screen renders profile + loan list (1 active loan shown)
      ↓
9. Loan officer taps the active loan:
      → router.push('/loans/789')
      → Loan detail screen mounts
      → useLoan('789') fires: GET /api/v1/loans/789
      ← Returns full loan details incl. repayment schedule
      → Screen renders: principal 500,000 MMK, outstanding 200,000 MMK
      → "Record Repayment" button is visible (loan is Active)
      ↓
10. Loan officer taps "Record Repayment":
      → Modal opens in "entry" state
      → Loan officer types 50,000 in amount field
      → Taps "Confirm Cash"
      ↓
11. usePostRepayment mutation fires:
      → POST http://192.168.1.109:3001/api/v1/loans/789/repayments
      {
        dateFormat: "yyyy/MM/dd",
        locale: "en",
        transactionDate: "2026/06/17",
        transactionAmount: 50000
      }
      ↓
12. API Gateway receives POST:
      → Validates JWT (loan officer has 'loan_officer' role → authorized)
      → Transforms request for Fineract format
      → POST to Fineract: /fineract-provider/api/v1/loans/789/transactions?command=repayment
      ← Fineract records repayment in MySQL, returns transaction ID
      ← API Gateway returns success to mobile
      ↓
13. usePostRepayment.onSuccess fires:
      → queryClient.invalidateQueries({ queryKey: ['loan', '789'] })
      → React Query marks loan 789 as stale
      → Silently refetches GET /api/v1/loans/789 in background
      → modal state = "success"
      → Green checkmark + "Payment recorded" shown
      ↓
14. User dismisses modal:
      → Loan detail screen has already re-rendered with updated balance
      → Outstanding balance now shows 150,000 MMK (was 200,000)
```

---

## Quick Reference: All API Calls Made by the Mobile App

| Hook / Function | Method | Endpoint | Service |
|---|---|---|---|
| `login()` | POST | `/api/v1/auth/login` | API Gateway → Keycloak |
| `logout()` | POST | `/api/v1/auth/logout` | API Gateway → Keycloak |
| `getStoredUser()` | GET | `/api/v1/auth/me` | API Gateway → Fineract |
| Token refresh | POST | `/api/v1/auth/refresh` | API Gateway → Keycloak |
| `useLoanOfficerStats` | GET | `/api/v1/dashboard/stats` | API Gateway → Fineract |
| `useClients` | GET | `/api/v1/clients` | API Gateway → Fineract |
| `useClient` | GET | `/api/v1/clients/:id` | API Gateway → Fineract |
| `useClientLoans` | GET | `/api/v1/clients/:id/loans` | API Gateway → Fineract |
| `useLoan` | GET | `/api/v1/loans/:id` | API Gateway → Fineract |
| `usePostRepayment` | POST | `/api/v1/loans/:id/repayments` | API Gateway → Fineract |
| `useInitiateKbzPayment` | POST | `/api/v1/payments/initiate` | API Gateway → KBZ Pay |
| KBZ status polling | GET | `/api/v1/payments/status/:orderId` | API Gateway → KBZ Pay |
| Collections overdue | GET | `/reports/collections/overdue` | **Reporting service directly** (port 3005) |

---

*Document created: 2026-06-17 | Author: Claude (via Cowork) | Part of MifosX4MM technical documentation*
