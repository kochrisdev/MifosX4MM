# Jackson's Complete Bug-Fix Guide
## MifosX4MM — Beginner-Friendly Walkthrough

> **Who this is for:** Jackson (DEV006) — beginner developer working on the MifosX4MM Myanmar Microfinance Platform.
>
> **Last updated:** June 17, 2026
>
> **Progress summary:** BUG-01 through BUG-05 (your critical bugs) are now ✅ FIXED. **Login is now working end-to-end** ✅. Your remaining work is BUG-08, BUG-09, BUG-10, BUG-11, BUG-14, BUG-15, BUG-18.
>
> **Dev environment note:** Android SDK, emulator (AVD "pixel"), and the three helper scripts are set up. Backend is running. Login confirmed working with auto-filled credentials. See `docs/jackson/what-ive-fixed.md` for full details.
>
> **📁 This folder moved to:** `MifosX4MM/docs/jackson/` (was `Desktop/mifox/jackson/`)
>
> **What this document does:** For every bug you own, it explains in plain language:
> - 🔍 **What the error is** — what's actually broken and where
> - ❓ **Why you need to fix it** — what breaks if you leave it
> - 🛠️ **How to fix it** — step-by-step instructions with code you can copy
> - ✅ **How to check your fix worked** — what to look for after

---

## Before You Start — Understanding the Project Layout

Your project is a **monorepo** — one big folder that contains multiple smaller apps and services. Think of it like one house with several rooms.

```
MifosX4MM/
├── apps/
│   ├── api/          ← The API Gateway (the "front door" for all requests)
│   ├── web/          ← The website (Next.js — for office staff)
│   └── mobile/       ← The phone app (Expo/React Native — for field workers)
├── services/
│   ├── reporting/    ← Python service that reads data from the database
│   ├── mobile-money/ ← Handles KBZ Pay payments
│   └── kyc/          ← Handles identity verification
└── packages/
    └── shared-types/ ← TypeScript type definitions shared by everything
```

**The API Gateway** (`apps/api`) is the most important piece — both the website and the mobile app talk to it. If the API gateway doesn't start, **nothing works at all**.

---

## Your 12 Bugs — Quick Overview (Updated June 17)

| # | Bug ID | Status | What's broken in one sentence |
|---|--------|--------|-------------------------------|
| 1 | BUG-01 | ✅ **Done** | API route file — now exists and fully works |
| 2 | BUG-02 | ✅ **Done** | Keycloak JWT plugin — now exists and fully works |
| 3 | BUG-03 | ✅ **Done** | Database connection file — now exists |
| 4 | BUG-04 | ✅ **Done** | Portfolio report code — now exists |
| 5 | BUG-05 | ✅ **Done** | Collections report code — now exists |
| 6 | BUG-08 | 🟠 Fix now | A payment gets recorded twice in the database |
| 7 | BUG-09 | 🟠 Fix now | A status code means opposite things in different places |
| 8 | BUG-10 | 🟠 Fix now | A data type is wrong → date of birth crashes the app |
| 9 | BUG-11 | 🟠 Fix now | Important loan fields are missing from the type definition |
| 10 | BUG-14 | 🟠 Fix now | Cash repayment crashes silently — button gets stuck |
| 11 | BUG-15 | 🟠 Fix now | When your login expires, the app doesn't send you back to login |
| 12 | BUG-18 | 🟡 Fix after | The client list never loads more than 20 people |

---

## BUG-01 — The Loans Route File Is Missing ✅ DONE

> **June 17 update:** This bug is fixed. `apps/api/src/routes/loans.ts` now exists with all endpoints implemented. You do not need to do anything here. The guide below is kept for reference.

### 🔍 What is the error?

In `apps/api/src/index.ts` (the file that starts the API server), there is this line:

```ts
import loanRoutes from './routes/loans';
```

This line tells Node.js: *"go find the file `routes/loans.ts` and load it."*

**But that file does not exist.** It was never created.

When Node.js tries to start the server, it immediately hits this line, can't find the file, and crashes with an error like:

```
Error: Cannot find module './routes/loans'
```

The API server **never starts at all.**

### ❓ Why do you need to fix it?

This is the most critical bug in the entire project. Because the API server never starts:

- The **mobile app** cannot load any data (clients, loans, repayments)
- The **website** cannot load any data
- Nobody can log in
- Nothing works

Think of it like a restaurant kitchen that can't open because someone forgot to unlock the door. Nothing else matters until the door is open.

### 🛠️ How to fix it

**Step 1:** Create a new file at this exact path:
```
apps/api/src/routes/loans.ts
```

**Step 2:** Copy this code into the file:

```typescript
import type { FastifyInstance } from 'fastify';
import { createFineractClient } from '../fineract';

export default async function loanRoutes(app: FastifyInstance) {

  // ── GET a single loan's full details ────────────────────────────────────────
  // When someone opens a loan page, this is called
  app.get<{ Params: { loanId: string } }>(
    '/loans/:loanId',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const fineract = createFineractClient();
      const { data } = await fineract.get(
        `/loans/${req.params.loanId}?associations=repaymentSchedule,transactions`
      );
      return reply.send({ success: true, data });
    }
  );

  // ── GET all loans for a specific client ─────────────────────────────────────
  // When someone opens a client's profile page, this lists their loans
  app.get<{ Params: { clientId: string } }>(
    '/clients/:clientId/loans',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const fineract = createFineractClient();
      const { data } = await fineract.get(
        `/clients/${req.params.clientId}/loans`
      );
      return reply.send({ success: true, data });
    }
  );

  // ── POST a repayment on a loan ───────────────────────────────────────────────
  // When a field worker records that a borrower paid money
  app.post<{ Params: { loanId: string }; Body: Record<string, unknown> }>(
    '/loans/:loanId/repayments',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const fineract = createFineractClient();
      const { data } = await fineract.post(
        `/loans/${req.params.loanId}/transactions?command=repayment`,
        req.body
      );
      return reply.send({ success: true, data });
    }
  );

  // ── POST a loan action (approve / disburse / reject) ────────────────────────
  // Used by branch managers to move a loan through its lifecycle
  app.post<{
    Params: { loanId: string };
    Querystring: { command: string };
    Body: Record<string, unknown>;
  }>(
    '/loans/:loanId/actions',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const fineract = createFineractClient();
      const { data } = await fineract.post(
        `/loans/${req.params.loanId}/transactions?command=${req.query.command}`,
        req.body
      );
      return reply.send({ success: true, data });
    }
  );
}
```

**Step 3:** Save the file.

**Step 4:** Try starting the API server:
```bash
cd apps/api
pnpm dev
```

### ✅ How to check your fix worked

After running `pnpm dev`, you should see a message like:
```
Server listening at http://0.0.0.0:3001
```

If you still see `Cannot find module`, double-check that the file is named exactly `loans.ts` (not `loan.ts` or `Loans.ts`) and is in the `routes/` folder.

---

## BUG-02 — The Keycloak Security Plugin Is Missing ✅ DONE

> **June 17 update:** This bug is fixed. `apps/api/src/plugins/keycloak.ts` now exists with full RS256 JWT verification. You do not need to do anything here. The guide below is kept for reference.

### 🔍 What is the error?

**What is Keycloak?** Keycloak is a separate service that handles user logins and security. When a user logs in, Keycloak gives them a special encrypted token (called a JWT — JSON Web Token). Every time the app makes an API call, it sends this token to prove "I'm a logged-in user."

The API server needs to be able to **read and verify** these tokens. It does this through a "plugin" — a small piece of code that plugs into the Fastify server.

In `apps/api/src/index.ts`:

```ts
import keycloakPlugin from './plugins/keycloak';
```

The file `apps/api/src/plugins/keycloak.ts` **does not exist.**

Same problem as BUG-01 — the server crashes before it even starts.

### ❓ Why do you need to fix it?

Without this plugin:

1. The API server can't start (crash on import)
2. Even if it could start — every protected route uses `app.authenticate` which this plugin creates. Without it, all authenticated routes would throw "app.authenticate is not a function"
3. Nobody can be logged in → nothing works

### 🛠️ How to fix it

**Step 1:** First install the required package. Run this in your terminal from the `apps/api` folder:

```bash
cd apps/api
pnpm add @fastify/jwt
```

**Step 2:** Create a new file at:
```
apps/api/src/plugins/keycloak.ts
```

**Step 3:** Paste this code:

```typescript
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import axios from 'axios';

// This plugin does three things:
// 1. Connects to Keycloak to get the public key used to verify tokens
// 2. Registers the JWT verifier with that key
// 3. Creates the `app.authenticate` helper used by protected routes

async function keycloakPlugin(app: FastifyInstance) {
  const KEYCLOAK_URL = process.env.KEYCLOAK_URL!;   // e.g. http://localhost:8080
  const REALM = process.env.KEYCLOAK_REALM!;         // e.g. mifos

  // Step 1: Ask Keycloak for its public key
  // The JWKS endpoint is a standard URL that returns the public keys
  const jwksUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`;

  let publicKey: string;
  try {
    const { data } = await axios.get(jwksUrl);
    // Keycloak returns keys in a format called JWKS
    // We just pass the whole object to @fastify/jwt and it handles the rest
    publicKey = data;
  } catch (err) {
    app.log.error('Failed to fetch Keycloak public key. Is Keycloak running?');
    throw err;
  }

  // Step 2: Register the JWT plugin with Keycloak's public key
  await app.register(jwt, {
    secret: { public: publicKey },
    verify: { algorithms: ['RS256'] },
  });

  // Step 3: Create the `app.authenticate` decorator
  // Protected routes call this to check the token before running
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
}

// fp() = fastify-plugin, makes the decorator available app-wide
export default fp(keycloakPlugin);
```

**Step 4:** Make sure your `.env` file in `apps/api/` has these values:

```env
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mifos
```

### ✅ How to check your fix worked

Start the API server. You should see it start without errors. Test the login endpoint:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

If you get back a token, the Keycloak plugin is working.

---

## BUG-03 — The Reporting Service Database File Is Missing ✅ DONE

> **June 17 update:** This bug is fixed. `services/reporting/db.py` now exists. The implementation auto-detects MySQL vs PostgreSQL URLs and applies the correct async driver. You do not need to do anything here.

### 🔍 What is the error?

The **Reporting Service** is a Python app (in `services/reporting/`) that reads data directly from the Fineract database and calculates statistics like:
- How many active loans are there?
- How much money was collected today?
- What is the PAR (Portfolio at Risk) rate?

The reporting service has a file called `main.py` that tries to import a database connection:

```python
from db import engine
```

But the file `db.py` **does not exist.** So Python crashes immediately with:

```
ModuleNotFoundError: No module named 'db'
```

### ❓ Why do you need to fix it?

The reporting service crashes on startup. Because of this:

- The **dashboard** on both web and mobile shows all zeros (0 active loans, 0 collections, 0% PAR)
- The **reports page** on the website shows no charts
- The **collections screen** on mobile shows no overdue loans

This makes the app look completely broken to users even though the loan data is actually there in the database.

### 🛠️ How to fix it

**Important context first:** The reporting service was originally designed to use **PostgreSQL** as its database. But Fineract (the core banking engine) uses **MySQL**. The PostgreSQL database is empty — all the real data is in MySQL. The fastest fix is to point the reporting service directly at MySQL.

**Step 1:** Install the Python MySQL driver. From `services/reporting/`:

```bash
pip install aiomysql
```

**Step 2:** Create the file `services/reporting/db.py`:

```python
"""
Database connection for the Reporting Service.
Connects to the Fineract MySQL database (MariaDB).
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Read the MySQL connection URL from environment variables
# Format: mysql+aiomysql://username:password@hostname:port/database_name
# Example: mysql+aiomysql://root:password@localhost:3306/fineract_default
DATABASE_URL = os.environ.get(
    "MYSQL_URL",
    "mysql+aiomysql://root:password@localhost:3306/fineract_default"
)

# Create the database engine
# pool_pre_ping=True means: test the connection before each use (prevents stale connections)
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,  # Set to True if you want to see all SQL queries in the logs
)

# Create a factory for database sessions
# A "session" is like opening a conversation with the database
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# This function is used by FastAPI routes to get a database session
# Usage: async def my_route(db: AsyncSession = Depends(get_db)):
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

**Step 3:** Add to your `.env` file in `services/reporting/`:

```env
MYSQL_URL=mysql+aiomysql://root:yourpassword@localhost:3306/fineract_default
```

> **Note:** Replace `yourpassword` with the actual Fineract MySQL password. Check the `docker-compose.yml` file in the project root for the correct values.

### ✅ How to check your fix worked

Start the reporting service:
```bash
cd services/reporting
uvicorn main:app --reload --port 3005
```

You should see:
```
INFO: Application startup complete.
```

Without any `ModuleNotFoundError`. If you see a database connection error instead, double-check your MySQL password and that MySQL is running.

---

## BUG-04 — Portfolio Report Router Is Missing ✅ DONE

> **June 17 update:** This bug is fixed. `services/reporting/routers/portfolio.py` now exists with `GET /summary`, `GET /by-product`, and `GET /disbursements` fully implemented using direct Fineract MySQL SQL queries. You do not need to do anything here.

### 🔍 What is the error?

In `services/reporting/main.py`, the app tries to import:

```python
from routers import portfolio
```

The file `services/reporting/routers/portfolio.py` **does not exist.**

This causes the same `ModuleNotFoundError` crash as BUG-03. The API gateway calls the reporting service for portfolio statistics and gets an error → returns zeros to the dashboard.

### ❓ Why do you need to fix it?

Without portfolio data:
- The dashboard shows **0 active loans**, **0% PAR**, **MMK 0 outstanding**
- The **Reports page** on the website shows empty charts
- Management has no visibility into the loan portfolio

### 🛠️ How to fix it

Create `services/reporting/routers/portfolio.py`:

```python
"""
Portfolio reporting endpoints.
These query the Fineract MySQL database directly to get portfolio statistics.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/reports/portfolio", tags=["Portfolio"])


@router.get("/summary")
async def get_portfolio_summary(db: AsyncSession = Depends(get_db)):
    """
    Returns the key numbers shown on the dashboard:
    - How many loans are active
    - Total outstanding (how much is owed)
    - PAR30 (Portfolio at Risk — % of loans overdue 30+ days)
    """
    # Count active loans (status_id = 300 means "Active" in Fineract)
    result = await db.execute(text("""
        SELECT
            COUNT(id)                          AS active_loans,
            COALESCE(SUM(principal_outstanding_derived), 0) AS total_outstanding
        FROM m_loan
        WHERE loan_status_id = 300
    """))
    row = result.mappings().first()

    # Calculate PAR30: loans overdue by 30 or more days
    par_result = await db.execute(text("""
        SELECT COUNT(DISTINCT l.id) AS par30_count
        FROM m_loan l
        JOIN m_loan_repayment_schedule s ON s.loan_id = l.id
        WHERE l.loan_status_id = 300
          AND s.duedate < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND s.completed_derived = 0
    """))
    par_row = par_result.mappings().first()

    active_loans = row["active_loans"] or 0
    par30_count  = par_row["par30_count"] or 0
    par_ratio    = round((par30_count / active_loans) * 100, 2) if active_loans > 0 else 0.0

    return {
        "success": True,
        "data": {
            "activeLoans":      active_loans,
            "totalOutstanding": float(row["total_outstanding"] or 0),
            "parRatio":         par_ratio,
        }
    }


@router.get("/by-product")
async def get_portfolio_by_product(db: AsyncSession = Depends(get_db)):
    """
    Breaks down the loan portfolio by product type.
    Example: Personal Loans MMK 50M, Agricultural Loans MMK 30M
    """
    result = await db.execute(text("""
        SELECT
            p.name                                          AS product_name,
            COUNT(l.id)                                     AS loan_count,
            COALESCE(SUM(l.principal_outstanding_derived), 0) AS outstanding
        FROM m_loan l
        JOIN m_product_loan p ON p.id = l.product_id
        WHERE l.loan_status_id = 300
        GROUP BY p.name
        ORDER BY outstanding DESC
    """))
    rows = result.mappings().all()

    return {
        "success": True,
        "data": [
            {
                "productName": r["product_name"],
                "loanCount":   r["loan_count"],
                "outstanding": float(r["outstanding"]),
            }
            for r in rows
        ]
    }


@router.get("/disbursements")
async def get_disbursements(months: int = 12, db: AsyncSession = Depends(get_db)):
    """
    Returns monthly disbursement totals for the last N months.
    Used for the bar chart on the Reports page.
    """
    result = await db.execute(text("""
        SELECT
            DATE_FORMAT(t.transaction_date, '%Y-%m') AS month,
            COALESCE(SUM(t.amount), 0)              AS total_disbursed
        FROM m_loan_transaction t
        WHERE t.transaction_type_enum = 1          -- 1 = Disbursement in Fineract
          AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
          AND t.is_reversed = 0
        GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
        ORDER BY month ASC
    """), {"months": months})
    rows = result.mappings().all()

    return {
        "success": True,
        "data": [
            {"month": r["month"], "amount": float(r["total_disbursed"])}
            for r in rows
        ]
    }
```

### ✅ How to check your fix worked

After restarting the reporting service, visit:
```
http://localhost:3005/reports/portfolio/summary
```

You should get back JSON with real numbers instead of an error. If you see `0` for everything, check that Fineract is running and has data.

---

## BUG-05 — Collections Report Router Is Missing ✅ DONE

> **June 17 update:** This bug is fixed. `services/reporting/routers/collections.py` now exists with `GET /today` and `GET /overdue` endpoints. You do not need to do anything here.

### 🔍 What is the error?

Same as BUG-04. In `services/reporting/main.py`:

```python
from routers import collections
```

The file `services/reporting/routers/collections.py` **does not exist** → crash → zeros.

### ❓ Why do you need to fix it?

Without collections data:
- Dashboard shows **MMK 0 collected today**
- Mobile **Collections tab** shows no overdue borrowers
- Field workers have no list of who to visit for repayments

### 🛠️ How to fix it

Create `services/reporting/routers/collections.py`:

```python
"""
Collections reporting endpoints.
Shows money collected today and which loans are overdue.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/reports/collections", tags=["Collections"])


@router.get("/today")
async def get_collections_today(db: AsyncSession = Depends(get_db)):
    """
    How much money was collected (repaid) today.
    Shown on the dashboard as 'Collected Today'.
    """
    result = await db.execute(text("""
        SELECT COALESCE(SUM(t.amount), 0) AS collected_today
        FROM m_loan_transaction t
        WHERE t.transaction_type_enum = 2      -- 2 = Repayment in Fineract
          AND t.transaction_date = CURDATE()
          AND t.is_reversed = 0
    """))
    row = result.mappings().first()

    return {
        "success": True,
        "data": {
            "collectedToday": float(row["collected_today"] or 0)
        }
    }


@router.get("/overdue")
async def get_overdue_loans(db: AsyncSession = Depends(get_db)):
    """
    List of all loans that have missed at least one payment.
    Shown on the Collections tab in the mobile app.
    Each entry shows:
    - Client name and phone number (so the field worker can call them)
    - How many days they are overdue
    - How much they owe
    """
    result = await db.execute(text("""
        SELECT
            c.display_name                              AS client_name,
            c.mobile_no                                 AS phone,
            l.account_no                                AS loan_account,
            DATEDIFF(CURDATE(), MIN(s.duedate))         AS days_overdue,
            SUM(s.principal_amount - s.principal_completed_derived
                + s.interest_amount - s.interest_completed_derived) AS amount_overdue
        FROM m_loan l
        JOIN m_client c               ON c.id = l.client_id
        JOIN m_loan_repayment_schedule s ON s.loan_id = l.id
        WHERE l.loan_status_id = 300          -- Active loans only
          AND s.duedate < CURDATE()           -- Past due date
          AND s.completed_derived = 0         -- Not yet paid
        GROUP BY l.id, c.display_name, c.mobile_no, l.account_no
        ORDER BY days_overdue DESC
    """))
    rows = result.mappings().all()

    return {
        "success": True,
        "data": [
            {
                "clientName":   r["client_name"],
                "phone":        r["phone"],
                "loanAccount":  r["loan_account"],
                "daysOverdue":  r["days_overdue"],
                "amountOverdue": float(r["amount_overdue"] or 0),
            }
            for r in rows
        ]
    }
```

### ✅ How to check your fix worked

```bash
curl http://localhost:3005/reports/collections/today
```

Should return `{ "success": true, "data": { "collectedToday": 123456.00 } }` (or 0 if no payments today — that's fine, it means the code works but there's no data yet).

---

## BUG-08 — Repayments Are Being Recorded Twice (Idempotency Bug)

### 🔍 What is the error?

**First, understand the KBZ Pay payment flow:**

1. A borrower wants to pay via KBZ Pay (Myanmar mobile wallet)
2. The mobile app calls the API to create a KBZ Pay order → gets a `prepayId`
3. The app opens the KBZ Pay app on the phone with a deep link
4. The borrower pays inside the KBZ Pay app
5. To check if they paid, the mobile app **polls** (asks repeatedly every 5 seconds): *"Did the payment go through?"*
6. When the answer is "yes", the API records the repayment in Fineract (the loan database)

**The bug:** Step 6 runs **every time** the polling request returns "success" — not just once.

```
Poll 1 (5s): "paid?" → YES → Record in Fineract ← repayment #1 created
Poll 2 (10s): "paid?" → YES → Record in Fineract ← repayment #2 created (DUPLICATE!)
Poll 3 (15s): "paid?" → YES → Record in Fineract ← repayment #3 created (DUPLICATE!)
```

In `apps/api/src/routes/payments.ts`, the problem code looks like this:

```typescript
// GET /payments/status/:orderId
const status = await kbzPayClient.queryOrder(orderId);

if (status.status === 'success') {
  // ← THIS RUNS ON EVERY POLL THAT RETURNS SUCCESS
  await fineract.post(`/loans/${loanId}/transactions?command=repayment`, {
    transactionAmount: status.amount,
    // ...
  });
}
```

### ❓ Why do you need to fix it?

A borrower pays MMK 50,000 once. But the system records 6 repayments of MMK 50,000. The loan shows MMK 300,000 repaid — **completely wrong**. This is a financial data corruption bug.

### 🛠️ How to fix it

The cleanest fix is: **move the Fineract recording to the KBZ Pay webhook**, not the polling endpoint.

A **webhook** is a one-time notification that KBZ Pay sends to your server when a payment is confirmed. It fires exactly once. The polling endpoint should only *check status* — it should never write to the database.

**Step 1:** In `apps/api/src/routes/payments.ts`, find the status check handler and **remove** the Fineract post:

```typescript
// BEFORE (broken):
app.get('/payments/status/:orderId', async (req, reply) => {
  const status = await kbzPayClient.queryOrder(req.params.orderId);

  if (status.status === 'success') {
    // DELETE these lines — they cause duplicates:
    await fineract.post(`/loans/${loanId}/transactions?command=repayment`, { ... });
  }

  return reply.send({ success: true, data: status });
});

// AFTER (fixed):
app.get('/payments/status/:orderId', async (req, reply) => {
  const status = await kbzPayClient.queryOrder(req.params.orderId);
  // Just return the status — do NOT write to Fineract here
  return reply.send({ success: true, data: status });
});
```

**Step 2:** In `services/mobile-money/src/routes.ts`, find the webhook handler and **add** the Fineract recording there:

```typescript
// Find this section in the webhook handler:
if (result.success) {
  app.log.info({ orderId: result.orderId }, 'KBZ Pay payment confirmed');
  // TODO: emit event to API gateway to post repayment to Fineract
  // ← This TODO is the stub. Replace it with real code:
}

// Replace with:
if (result.success) {
  app.log.info({ orderId: result.orderId }, 'KBZ Pay payment confirmed');

  try {
    // Tell the API gateway to record this repayment in Fineract
    await axios.post(
      `${process.env.API_GATEWAY_URL}/internal/payments/post-repayment`,
      { orderId: result.orderId }
    );
    app.log.info({ orderId: result.orderId }, 'Repayment recorded in Fineract');
  } catch (err) {
    app.log.error({ orderId: result.orderId, err }, 'Failed to record repayment');
    // Still return SUCCESS to KBZ Pay so they don't retry
  }
}
```

> **Why is this safe?** KBZ Pay sends the webhook exactly **once** per confirmed payment. So the Fineract recording now also happens exactly once.

### ✅ How to check your fix worked

Test by initiating a payment, waiting for success, and checking that only **one** repayment transaction appears in Fineract for that loan — not multiple.

---

## BUG-09 — KBZ Pay Status Codes Mean Different Things in Different Places

### 🔍 What is the error?

KBZ Pay uses a numeric code to tell you whether a payment succeeded:
- `"1"` = Payment successful ✅
- `"0"` = Payment pending ⏳
- `"2"` = Payment failed ❌

There are three places in the code that deal with this status. Two of them have it **backwards**:

**Place 1: `queryOrder()` in `services/mobile-money/src/kbzpay/client.ts`**
```typescript
const statusMap = {
  '1': 'success',  // ✅ CORRECT
  '0': 'pending',  // ✅ CORRECT
  '2': 'failed',   // ✅ CORRECT
};
```

**Place 2: `parseCallback()` in the same file**
```typescript
// This is called when KBZ Pay sends a webhook
return {
  success: payload.status === '0',  // ❌ WRONG! '0' is pending, not success
};
```

**Place 3: The type comment in `packages/shared-types/src/index.ts`**
```typescript
status: '0' | '1' | '2'; // 0=success, 1=pending, 2=failed  ← ❌ WRONG comment!
```

### ❓ Why do you need to fix it?

When KBZ Pay sends a webhook saying "payment confirmed" (`status: "1"`), the `parseCallback()` function sees `status === '0'` is `false`, so it thinks the payment **failed** and does nothing. Real payments get ignored. Meanwhile, `status === '0'` (which means "pending") would be treated as success.

### 🛠️ How to fix it

**Fix 1:** In `services/mobile-money/src/kbzpay/client.ts`, find `parseCallback()`:

```typescript
// BEFORE (wrong):
success: payload.status === '0',

// AFTER (correct):
success: payload.status === '1',
```

**Fix 2:** In `packages/shared-types/src/index.ts`, find `KbzPayCallbackPayload`:

```typescript
// BEFORE (wrong comment):
status: '0' | '1' | '2'; // 0=success, 1=pending, 2=failed

// AFTER (correct comment):
status: '0' | '1' | '2'; // 0=pending, 1=success, 2=failed
```

### ✅ How to check your fix worked

After the fix, test a KBZ Pay payment end-to-end. The webhook should now correctly detect successful payments. In the logs you should see: `"KBZ Pay payment confirmed"` after a real payment goes through.

---

## BUG-10 — Date of Birth Has the Wrong Data Type

### 🔍 What is the error?

**Background — what is a "type" in TypeScript?**
TypeScript is a version of JavaScript that lets you specify what *kind* of data a variable holds. For example, `age: number` means age is a number. `name: string` means name is text. This helps catch mistakes before running the code.

In `packages/shared-types/src/index.ts`, the type definition says:

```typescript
interface FineractClient {
  dateOfBirth?: string;  // ← says it's text, like "1990-05-15"
}
```

But Fineract (the core banking system) actually sends `dateOfBirth` as an **array of three numbers**:

```json
{
  "dateOfBirth": [1990, 5, 15]
}
```

This means `[year, month, day]` = `[1990, 5, 15]` = May 15, 1990.

So the type says `string`, but the actual data is `number[]` (an array of numbers).

In the web client detail page, there's a function:

```typescript
const fmtDate = (arr?: number[]) => ...
```

But it's called with:
```typescript
fmtDate(client.dateOfBirth)  // TypeScript thinks dateOfBirth is a string!
```

This causes a **type mismatch error** and the date of birth either shows as garbage or crashes.

### ❓ Why do you need to fix it?

- The client detail page on the **website** shows a broken or missing date of birth
- TypeScript will show a type error that prevents the code from compiling correctly
- `fmtDate()` tries to do `arr[0]`, `arr[1]`, `arr[2]` on a string, which gives `undefined` for `[1]` and `[2]`

### 🛠️ How to fix it

**Fix 1:** In `packages/shared-types/src/index.ts`, change the type:

```typescript
// BEFORE (wrong):
interface FineractClient {
  dateOfBirth?: string; // yyyy-MM-dd
}

// AFTER (correct):
interface FineractClient {
  dateOfBirth?: number[]; // [year, month, day] — e.g. [1990, 5, 15]
}
```

**Fix 2:** In the web client detail page (`apps/web/src/app/(protected)/clients/[clientId]/page.tsx`), update `fmtDate` to handle the array properly:

```typescript
// Replace the existing fmtDate function with this:
const fmtDate = (arr?: number[]): string => {
  if (!arr || arr.length < 3) return '—';
  // arr[0] = year, arr[1] = month (1-12), arr[2] = day
  const date = new Date(arr[0], arr[1] - 1, arr[2]);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  // Example output: "15 May 1990"
};
```

**Fix 3:** In the mobile client detail page (`apps/mobile/app/clients/[clientId].tsx`), do the same:

```typescript
const fmtDate = (arr?: number[]): string => {
  if (!arr || arr.length < 3) return '—';
  const date = new Date(arr[0], arr[1] - 1, arr[2]);
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};
```

> ⚠️ **Tell Merlin** after you push this change. Merlin's web page also needs updating (BUG-13), and now the type is different.

### ✅ How to check your fix worked

Open a client's profile page. The date of birth should show as a readable date like "15 May 1990" instead of `undefined` or an error.

---

## BUG-11 — Loan Account Type Is Missing Many Fields

### 🔍 What is the error?

Similar to BUG-10, but for the loan data type.

In `packages/shared-types/src/index.ts`, `FineractLoanAccount` describes what a loan looks like. The web and mobile screens try to access several fields that are **missing from this type definition**.

For example, the mobile and web loan detail pages use `loan.inArrears` to show whether a loan is overdue. But `FineractLoanAccount` doesn't have an `inArrears` field — so TypeScript throws an error.

Here's the full list of missing fields:

| Field the UI uses | What it is |
|-------------------|-----------|
| `loan.inArrears` | Boolean — is this loan overdue? |
| `loan.repaymentSchedule.periods` | Array of installment dates and amounts |
| `loan.transactions` | Array of all transactions (disbursements, repayments) |
| `loan.summary.totalRepayment` | Total amount repaid so far |
| `loan.currency.displaySymbol` | The currency symbol to show (e.g. "K" for kyat) |

### ❓ Why do you need to fix it?

TypeScript will refuse to compile any file that accesses these fields until they're added to the type. The web loan detail page and mobile loan detail screen both use them — so those screens can't build.

### 🛠️ How to fix it

In `packages/shared-types/src/index.ts`, find `FineractLoanAccount` and extend it:

```typescript
export interface FineractLoanAccount {
  id: number;
  accountNo: string;
  // ... all existing fields stay the same ...

  // ── Add these missing fields ──────────────────────────────────────────────

  // Whether the loan has any overdue installments
  inArrears: boolean;

  // The full repayment schedule — each installment as a period
  repaymentSchedule?: {
    periods: Array<{
      period: number;           // Installment number (1, 2, 3...)
      dueDate: number[];        // [year, month, day]
      principalDue: number;     // Principal portion due this period
      interestDue: number;      // Interest portion due this period
      totalDue: number;         // Total due (principal + interest + fees)
      totalPaid: number;        // How much has been paid
      totalOutstanding: number; // Still owed for this period
      complete: boolean;        // Has this installment been fully paid?
    }>;
  };

  // All transactions on this loan (disbursements, repayments, etc.)
  transactions?: Array<{
    id: number;
    type: { value: string };        // e.g. "Repayment" or "Disbursement"
    date: number[];                 // [year, month, day]
    amount: number;
    outstandingLoanBalance: number; // Remaining balance after this transaction
  }>;

  // Update the existing currency field to add displaySymbol:
  currency: {
    code: string;           // e.g. "MMK"
    name: string;           // e.g. "Myanmar Kyat"
    decimalPlaces: number;  // e.g. 0
    displaySymbol: string;  // e.g. "K" — ADD THIS
  };

  // Update the existing summary field to add totalRepayment:
  summary: {
    principalDisbursed: number;
    principalOutstanding: number;
    interestCharged: number;
    interestOutstanding: number;
    totalOutstanding: number;
    totalOverdue: number;
    totalRepayment: number; // ADD THIS — total paid so far
  };
}
```

> ⚠️ **Tell Merlin** when this is done. Merlin's BUG-12 fix depends on these new field names.

### ✅ How to check your fix worked

Run `pnpm build` from the root of the project. The TypeScript compiler should no longer complain about missing fields on `FineractLoanAccount`.

---

## BUG-14 — Mobile Cash Repayment Crashes Silently (Button Gets Stuck)

### 🔍 What is the error?

When a field worker records a cash repayment on the mobile app, this function runs:

```typescript
const handleCash = async () => {
  setSubmitting(true);          // Disable the submit button (shows spinner)
  await postRepayment.mutateAsync({ loanId, amount, date, note });
  setSuccess(true);             // Show success state
  // ← There is NO try/catch here
};
```

**What is a try/catch?** It's how you handle errors in async code. Without it, if `postRepayment.mutateAsync` throws an error (network problem, server error, wrong amount, etc.), the error is **not caught**.

The result:
1. `setSubmitting(true)` runs → button is disabled ✅
2. The API call fails → error is thrown
3. Nothing catches the error → the function stops
4. `setSubmitting(false)` is **never called** → button stays disabled forever
5. The user cannot try again. The app appears frozen.
6. The user must close and reopen the app.

### ❓ Why do you need to fix it?

Field workers in the field (with poor network connections) will hit this constantly. Every network hiccup permanently breaks the repayment form. This is a critical UX and reliability issue for the core feature of the app.

### 🛠️ How to fix it

In `apps/mobile/app/loans/[loanId].tsx`, find `handleCash` and replace it:

```typescript
// BEFORE (broken — no error handling):
const handleCash = async () => {
  setSubmitting(true);
  await postRepayment.mutateAsync({ loanId, amount, date, note });
  setSuccess(true);
};

// AFTER (fixed — with try/catch/finally):
const handleCash = async () => {
  setSubmitting(true); // Disable button, show spinner

  try {
    // Try to submit the repayment
    await postRepayment.mutateAsync({ loanId, amount, date, note });

    // If we get here, it worked!
    setSuccess(true);

  } catch (err) {
    // Something went wrong — show a clear error message
    const message = err instanceof Error
      ? err.message
      : 'Something went wrong. Please check your connection and try again.';

    Alert.alert(
      'Repayment Failed',   // Title of the popup
      message,              // Description
      [{ text: 'OK' }]      // Button
    );

  } finally {
    // This ALWAYS runs, whether it succeeded or failed
    // Re-enable the submit button so the user can try again
    setSubmitting(false);
  }
};
```

**What `finally` does:** The `finally` block runs whether the code succeeded or failed. This guarantees `setSubmitting(false)` always executes — the button is always re-enabled.

### ✅ How to check your fix worked

1. Turn off your internet connection (airplane mode)
2. Open a loan and try to record a cash repayment
3. You should see an error popup (not a frozen button)
4. The submit button should re-enable after the popup closes
5. Turn internet back on and try again — the repayment should succeed

---

## BUG-15 — When Your Login Expires, the App Doesn't Go Back to Login Screen

### 🔍 What is the error?

**Background — how tokens work:**

When you log in, the server gives you two things:
1. An **access token** — short-lived (e.g. 15 minutes). Used for all API requests.
2. A **refresh token** — longer-lived (e.g. 7 days). Used to get a new access token when the old one expires.

When the access token expires, the app automatically tries to get a new one using the refresh token. This is called "silent refresh" — the user doesn't notice it happening.

But what if the **refresh token also expires** (or gets invalidated when you change your password)?

In `apps/mobile/src/lib/api.ts`, the code handles this:

```typescript
// When any API request fails with 401 (Unauthorized):
try {
  // Try to refresh the access token
  const { data } = await axios.post('/auth/refresh', { refreshToken });
  await storeTokens(data.accessToken, data.refreshToken);
  // ← If refresh succeeded, retry the original request

} catch (refreshError) {
  // Refresh also failed — the session is fully expired
  await clearTokens(); // Delete stored tokens

  throw refreshError; // ← JUST THROWS. Does not navigate to login screen!
}
```

The user is now on a screen with **no valid session** and no way to recover. The app doesn't redirect them to login — it just leaves them stranded.

### ❓ Why do you need to fix it?

After 7 days (or a forced logout), every API call the user makes will silently fail. The app shows loading spinners that never resolve. The user has no idea their session expired. They'd have to manually kill and reopen the app to get back to the login screen.

### 🛠️ How to fix it

In `apps/mobile/src/lib/api.ts`, update the refresh failure handler to navigate to login:

```typescript
// Add this import at the top of the file:
import { router } from 'expo-router';

// Find the catch block in the 401 interceptor and update it:

} catch (refreshError) {
  // Refresh failed — the session is completely expired
  // 1. Delete the stored tokens (they're no longer valid)
  await clearTokens();

  // 2. Send the user back to the login screen
  //    router.replace() goes to the screen AND removes the current
  //    screen from history (so pressing back doesn't return here)
  router.replace('/(auth)/login');

  // 3. Re-throw so any pending requests also fail cleanly
  throw refreshError;
}
```

**Why `router.replace()` instead of `router.push()`?**
- `router.push()` adds to the navigation history — user could press Back to return to the broken screen
- `router.replace()` replaces the current screen — there's no broken screen to go back to

### ✅ How to check your fix worked

To test this without waiting 7 days:
1. Log in to the mobile app
2. In Keycloak admin panel, go to Sessions and revoke the user's session
3. Try to use the app (tap any tab or load data)
4. The app should automatically redirect to the login screen within seconds

---

## BUG-18 — Client List Never Loads More Than the First 20 People

### 🔍 What is the error?

**Background — what is pagination?**

If you have 500 clients in the system, you don't want to load all 500 at once — that would be slow. Instead, you load 20 at a time (a "page"). When you scroll to the bottom, it loads the next 20. This is called **infinite scroll** or **pagination**.

There are two common ways to tell the server which page you want:

**Method A (offset/limit):**
- "Give me 20 items, skipping the first 40" → `offset=40&limit=20`
- This gives you items 41-60 (the 3rd page)

**Method B (page/pageSize):**
- "Give me page 3 with 20 items per page" → `page=3&pageSize=20`

**The bug:** The mobile app uses Method A (`offset/limit`) but the API gateway expects Method B (`page/pageSize`).

In `apps/mobile/app/(tabs)/clients.tsx`:
```typescript
// Mobile sends:
{ offset: pageParam * PAGE_SIZE, limit: PAGE_SIZE }
// For page 2 this is: { offset: 20, limit: 20 }
```

In `apps/api/src/routes/clients.ts`:
```typescript
// API reads:
const { page, pageSize } = req.query;
// But 'page' and 'pageSize' are undefined! It just uses defaults: page=0, pageSize=20
```

So every "load more" request gets the **same first 20 clients** back. The list never actually scrolls beyond the first page.

**Second bug in this file:** The search input has `autoCapitalize="words"`:

```tsx
<TextInput autoCapitalize="words" ... />
```

This makes the phone auto-capitalise every word the user types. If a client is named "ma hnin", typing "Ma Hnin" in the search box finds nothing because the database search is case-sensitive.

### ❓ Why do you need to fix it?

- Field workers with large client portfolios cannot see all their clients
- Searching for clients by name fails if the capitalisation doesn't exactly match

### 🛠️ How to fix it

**Fix 1 — Pagination in mobile `clients.tsx`:**

```typescript
// BEFORE (wrong params):
return api.get('/clients', {
  params: {
    offset: pageParam * PAGE_SIZE,
    limit: PAGE_SIZE,
    displayName: search || undefined,
  },
});

// AFTER (correct params):
return api.get('/clients', {
  params: {
    offset: pageParam * PAGE_SIZE,  // Keep using offset/limit
    limit: PAGE_SIZE,
    displayName: search || undefined,
  },
});
```

**Fix 2 — Also update the API gateway to accept `offset/limit`.**

In `apps/api/src/routes/clients.ts`, change how it reads pagination params:

```typescript
// BEFORE (reads page/pageSize):
const { page = 0, pageSize = 20 } = req.query as { page?: number; pageSize?: number };
const offset = page * pageSize;
const limit  = pageSize;

// AFTER (reads offset/limit directly):
const { offset = 0, limit = 20 } = req.query as { offset?: number; limit?: number };
```

Then pass them to Fineract:
```typescript
const { data } = await fineract.get('/clients', {
  params: { offset, limit, displayName }
});
```

**Fix 3 — Fix autoCapitalize on the search input:**

```tsx
// BEFORE:
<TextInput
  autoCapitalize="words"
  placeholder="Search clients..."
  ...
/>

// AFTER:
<TextInput
  autoCapitalize="none"
  placeholder="Search clients..."
  ...
/>
```

### ✅ How to check your fix worked

1. Open the Clients tab on the mobile app
2. Scroll to the very bottom of the first 20 clients
3. A loading spinner should appear, and the next 20 clients should load
4. Keep scrolling — you should be able to reach all clients in the system
5. Test search by typing a lowercase name — it should find clients correctly

---

## Summary — Your Remaining Fix Order (Updated June 17)

BUG-01 through BUG-05 are done. The first 5 critical blockers have been resolved. Here is your current task order:

```
✅ DONE — BUG-01  loans.ts route — file exists
✅ DONE — BUG-02  keycloak.ts plugin — file exists
✅ DONE — BUG-03  db.py — file exists
✅ DONE — BUG-04  portfolio.py — file exists
✅ DONE — BUG-05  collections.py — file exists

NEXT — Fix data types and KBZ Pay
├── BUG-10  Fix FineractClient.dateOfBirth: string → number[]
│           ⚠️ Tell Merlin after this!
├── BUG-11  Add missing fields to FineractLoanAccount
│           ⚠️ Tell Merlin after this!
├── BUG-09  Fix KBZ parseCallback: status '0' → status '1'
└── BUG-08  Fix idempotency: move Fineract post to webhook
    → Test: run pnpm build — no TypeScript errors

AFTER THAT — Fix mobile crashes
├── BUG-14  Add try/catch to handleCash()
├── BUG-15  Add router.replace() to 401 interceptor
└── BUG-18  Fix pagination params + autoCapitalize
    → Test: mobile app loads all clients, repayment errors show properly
```

See also: `jackson/what-ive-fixed.md` for the Android dev environment setup notes and full emulator workflow.

---

*Guide written by: Jackson (DEV006) · MifosX4MM Bug-Fix Sprint · June 15, 2026 · Updated June 17, 2026*
