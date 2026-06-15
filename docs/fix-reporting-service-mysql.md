# Fix: Reporting Service Database Wiring

## The Problem

When you opened `http://localhost:3000`, the dashboard showed no data. The API logs showed:

```
"portfolio summary fetch failed"
"collections today fetch failed"
```

And the reporting service container (`mifosx4mm-reporting-1`) was throwing:

```
sqlalchemy.exc.ProgrammingError: UndefinedTableError: relation "m_loan_transaction" does not exist
```

---

## Root Cause

The project uses **two separate databases**:

| Database   | Engine       | Port | Used by                        |
|------------|--------------|------|--------------------------------|
| `fineract_default` | **MySQL**    | 3306 | Apache Fineract (all loan data) |
| `fineract_default` | **PostgreSQL** | 5432 | Keycloak (auth) + Reporting     |

The problem: Fineract writes all its tables (`m_loan`, `m_loan_transaction`, `m_loan_repayment_schedule`, etc.) into **MySQL**. But the reporting service was configured to connect to **PostgreSQL** — where those tables simply do not exist.

```
Reporting Service
      │
      │  REPORTING_DB_URL = postgresql://...   ← WRONG
      ▼
  PostgreSQL
  ├── keycloak        (exists)
  └── fineract_default
        └── (empty — no Fineract tables here)  ← tables missing → 500 error

  MySQL
  └── fineract_default
        ├── m_loan                              ← actual data is here
        ├── m_loan_transaction
        ├── m_loan_repayment_schedule
        └── ... (500+ Fineract tables)
```

---

## Files Changed

### 1. `docker-compose.yml` — Point reporting at MySQL

**Before:**
```yaml
reporting:
  environment:
    REPORTING_DB_URL: postgresql://mifos:password@postgres:5432/fineract_default
```

**After:**
```yaml
reporting:
  environment:
    REPORTING_DB_URL: mysql://root:password@mysql:3306/fineract_default
```

---

### 2. `services/reporting/requirements.txt` — Swap database driver

**Before:**
```
asyncpg>=0.30.0
```

**After:**
```
aiomysql>=0.2.0
```

`asyncpg` is a PostgreSQL-only async driver. `aiomysql` is its MySQL equivalent.

---

### 3. `services/reporting/db.py` — Handle MySQL connection URL

**Before:**
```python
_raw_url = os.getenv(
    "REPORTING_DB_URL",
    "postgresql://mifos:password@postgres:5432/fineract_default",
)
ASYNC_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
```

**After:**
```python
_raw_url = os.getenv(
    "REPORTING_DB_URL",
    "mysql://root:password@mysql:3306/fineract_default",
)

if _raw_url.startswith("mysql://"):
    ASYNC_URL = _raw_url.replace("mysql://", "mysql+aiomysql://", 1)
elif _raw_url.startswith("postgresql://"):
    ASYNC_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_URL = _raw_url
```

SQLAlchemy requires the async driver to be specified in the URL scheme (`mysql+aiomysql://` not just `mysql://`). The `if/elif` block handles both engines so the code stays flexible.

---

### 4. `services/reporting/routers/portfolio.py` — Fix PostgreSQL-only SQL

#### Fix 1: Date subtraction in the overdue CTE

PostgreSQL allows subtracting two `DATE` values with `-` to get an integer (days).  
MySQL does **not** — it returns `NULL` or a wrong result.

**Before:**
```sql
CURRENT_DATE - MIN(duedate) AS days_in_arrears
```

**After:**
```sql
DATEDIFF(CURRENT_DATE, MIN(duedate)) AS days_in_arrears
```

`DATEDIFF(date1, date2)` returns `date1 - date2` in days and works in both MySQL and MariaDB.

---

#### Fix 2: `DATE_TRUNC` in the disbursements chart query

`DATE_TRUNC` is a PostgreSQL function. MySQL does not have it.

**Before:**
```python
trunc = {"day": "day", "week": "week", "month": "month"}[granularity]

sql = text(f"""
    SELECT
        DATE_TRUNC('{trunc}', transaction_date) AS period,
        ...
    GROUP BY DATE_TRUNC('{trunc}', transaction_date)
""")
```

**After:**
```python
trunc_expr = {
    "day":   "DATE(transaction_date)",
    "week":  "DATE(DATE_SUB(transaction_date, INTERVAL WEEKDAY(transaction_date) DAY))",
    "month": "DATE_SUB(transaction_date, INTERVAL DAY(transaction_date)-1 DAY)",
}[granularity]

sql = text(f"""
    SELECT
        {trunc_expr} AS period,
        ...
    GROUP BY {trunc_expr}
""")
```

How each MySQL expression works:

| Granularity | Expression | Example input | Output |
|---|---|---|---|
| `day` | `DATE(transaction_date)` | `2026-06-04 10:30` | `2026-06-04` |
| `week` | `DATE_SUB(..., INTERVAL WEEKDAY(...) DAY)` | `2026-06-04` (Thursday = day 3) | `2026-06-01` (Monday) |
| `month` | `DATE_SUB(..., INTERVAL DAY(...)-1 DAY)` | `2026-06-04` (day 4) | `2026-06-01` |

---

### 5. `services/reporting/routers/collections.py` — Fix date subtraction

Same `CURRENT_DATE - date` issue in the overdue accounts query.

**Before:**
```sql
(CURRENT_DATE - MIN(lrs.duedate))  AS days_overdue
...
HAVING (CURRENT_DATE - MIN(lrs.duedate)) >= :days_overdue
```

**After:**
```sql
DATEDIFF(CURRENT_DATE, MIN(lrs.duedate))  AS days_overdue
...
HAVING DATEDIFF(CURRENT_DATE, MIN(lrs.duedate)) >= :days_overdue
```

---

## How to Apply the Fix

The fix requires rebuilding the reporting container (to install `aiomysql` in place of `asyncpg`):

```bash
docker compose up -d --build reporting
```

No other containers need to be restarted.

---

## Verification

After rebuilding, hit the reporting service directly:

```bash
curl http://localhost:3005/reports/portfolio/summary
```

Expected response:
```json
{
  "activeLoans": 12,
  "activeClients": 6,
  "totalDisbursed": 10100000.0,
  "totalOutstanding": 9415438.0,
  "totalOverdue": 0.0,
  "par0": 0.0,
  "par30": 0.0,
  "par90": 0.0,
  "currency": "MMK"
}
```

The dashboard at `http://localhost:3000` now shows live loan portfolio data.
