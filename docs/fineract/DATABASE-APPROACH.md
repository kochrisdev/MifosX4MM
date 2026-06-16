# Database Approach — MySQL vs PostgreSQL

## The Question

Should we keep Fineract on MySQL or switch it to PostgreSQL?
And why should we NOT use synchronization between the two?

---

## Answer: Switch to PostgreSQL

**Switch Fineract to PostgreSQL. It is the better approach for this project.**

---

## Why PostgreSQL over MySQL

### 1. The Reporting Code is Already Written for PostgreSQL

The reporting service SQL uses PostgreSQL-specific syntax:
- `DATE_TRUNC` for date grouping
- `BOOLEAN` for BIT columns
- Date subtraction (`CURRENT_DATE - duedate`)

It was written expecting PostgreSQL. Keeping MySQL means rewriting all of that SQL.

### 2. One Database Instead of Two

```
MySQL approach:        Fineract → MySQL  +  Reporting → PostgreSQL   (2 databases)
PostgreSQL approach:   Fineract → PostgreSQL  ←→  Reporting          (1 database)
```

Less infrastructure. Less to manage. Less to break.

### 3. PostgreSQL is Better for Reporting

Complex analytics queries — PAR calculations, CTEs, window functions — run better
on PostgreSQL. MySQL was not designed for this kind of analytical workload.

---

## The Reading and Writing Rule

This is the most important rule to understand before touching any database in this project:

```
READING data  →  you write raw SQL SELECT directly      ✅
WRITING data  →  you call Fineract's API, Fineract writes for you  ✅
```

### Visual

```
Your Code
   │
   ├── Want to READ?  ──────────────────→  SELECT * FROM m_loan ...
   │                                       (direct SQL, always fine)
   │
   └── Want to WRITE? ──→  Fineract API  ──→  Fineract runs INSERT/UPDATE
                           POST /loans        (you never write this SQL yourself)
```

### Real Examples

| What you want to do | How to do it |
|---|---|
| Show all active loans | `SELECT * FROM m_loan WHERE loan_status_id = 300` |
| Create a new loan | `POST http://fineract:8080/.../loans` |
| Show today's repayments | `SELECT * FROM m_loan_transaction WHERE transaction_date = TODAY` |
| Record a repayment | `POST http://fineract:8080/.../loans/:id/transactions` |

You read yourself. You write through the API. That is the whole rule.

---

## Why NOT Synchronization

### 1. Data is Never Truly Real-Time

```
Fineract writes to MySQL at    10:00:00
Sync runs at                   10:00:03  ← 3 second delay
Reporting reads PostgreSQL at  10:00:01  ← reads OLD data
```

For a microfinance app, a loan officer needs accurate data **right now** —
not 3 seconds ago. Overdue calculations and PAR reports must reflect the
current state of every loan.

### 2. Two Sources of Truth

```
MySQL says:       loan #123 outstanding = 500,000 MMK
PostgreSQL says:  loan #123 outstanding = 450,000 MMK  ← sync hasn't run yet
```

Which one is correct? This causes confusion, bugs, and distrust in the reports.
A microfinance institution cannot make decisions on data it cannot fully trust.

### 3. Extra Infrastructure to Maintain

Sync tools like Debezium need their own container, configuration, and monitoring.
When they break — and they will — your reports silently show wrong data without
any visible error.

### 4. More Failure Points

```
MySQL breaks?        →  app breaks               (visible error)
PostgreSQL breaks?   →  app breaks               (visible error)
Sync breaks?         →  app shows wrong data     (silent failure — worst kind)
```

A silent wrong result is far more dangerous than a visible crash.
At least a crash tells you something is wrong.

---

## Comparison Table

| | Switch to PostgreSQL | Keep MySQL + Sync |
|---|---|---|
| Complexity | Low | High |
| Real-time data | Yes | No (always a delay) |
| Reporting SQL | Works as-is | Needs rewriting |
| Infrastructure | 1 database | 2 databases + sync tool |
| Silent failure risk | Low | High |
| Recommended | **Yes** | No |

---

## Summary

Switch Fineract to use PostgreSQL as its database.
The reporting service already expects PostgreSQL.
Both services then share one database — Fineract writes, reporting reads.
No sync. No delay. No two sources of truth.
