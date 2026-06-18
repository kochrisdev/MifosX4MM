# Migration Plan — Fineract MySQL to PostgreSQL

## Context

Fineract is currently configured to write to MySQL (port 3306). The reporting
service is already written for PostgreSQL and connects to `fineract_default` on
PostgreSQL (port 5432) — but that database is empty because Fineract never
writes there. This causes the dashboard to show no data.

The fix: switch Fineract to use PostgreSQL as its database engine. MySQL is
removed entirely. Both Fineract and the reporting service will share the same
PostgreSQL instance.

**Goal:** One database engine (PostgreSQL only), three databases inside it,
reporting works without any code changes.

```
After migration:
PostgreSQL (port 5432)
├── fineract_tenants  ← Fineract tenant registry
├── fineract_default  ← All loan/client data
└── keycloak          ← User auth (unchanged)
```

---

## Files to Change

### 1. `docker-compose.yml`

**Remove:**
- The entire `mysql` service block
- The `mysql_data` volume
- The `mysql_data` entry under top-level `volumes:`

**Update Fineract environment variables:**

| Env Var | Before | After |
|---|---|---|
| `FINERACT_DEFAULT_TENANTDB_HOSTNAME` | `mysql` | `postgres` |
| `FINERACT_DEFAULT_TENANTDB_PORT` | `3306` | `5432` |
| `FINERACT_DEFAULT_TENANTDB_UID` | `root` | `mifos` |
| `FINERACT_HIKARI_JDBC_URL` | `jdbc:mariadb://mysql:3306/fineract_tenants` | `jdbc:postgresql://postgres:5432/fineract_tenants` |
| `FINERACT_HIKARI_USERNAME` | `root` | `mifos` |
| `FINERACT_TENANTS_MASTER_JDBC_URL` | `jdbc:mariadb://mysql:3306/fineract_tenants` | `jdbc:postgresql://postgres:5432/fineract_tenants` |

**Add these new env vars to Fineract:**
```yaml
FINERACT_HIKARI_DRIVER_CLASS_NAME: org.postgresql.Driver
FINERACT_DEFAULT_TENANTDB_PROTOCOL: postgresql
```

**Update Fineract `depends_on`:**
```yaml
# Before
depends_on:
  mysql:
    condition: service_healthy

# After
depends_on:
  postgres:
    condition: service_healthy
```

---

### 2. `infra/postgres/init.sql`

Add `fineract_tenants` database creation alongside the existing `keycloak` database:

```sql
-- existing (keep this)
CREATE DATABASE keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO mifos;

-- add this
CREATE DATABASE fineract_tenants;
GRANT ALL PRIVILEGES ON DATABASE fineract_tenants TO mifos;
```

> `fineract_default` already exists — it is the default database created by the
> PostgreSQL service using `POSTGRES_DB: fineract_default`.

---

### 3. No Changes Needed

These files are already PostgreSQL-ready:

| File | Reason |
|---|---|
| `services/reporting/db.py` | Already uses `asyncpg` (PostgreSQL driver) |
| `services/reporting/requirements.txt` | Already has `asyncpg>=0.30.0` |
| `services/reporting/routers/portfolio.py` | Already uses PostgreSQL SQL (`DATE_TRUNC`, `BOOLEAN`) |
| `services/reporting/routers/collections.py` | Already uses PostgreSQL SQL |
| `scripts/seed-fineract.ts` | Uses Fineract REST API only — no direct DB connection |

---

## How to Apply

```bash
# 1. Bring everything down and remove old volumes (clears MySQL data)
docker compose down -v

# 2. Rebuild and start fresh
docker compose up -d

# 3. Wait ~60 seconds for Fineract to boot and run Liquibase migrations

# 4. Confirm fineract_tenants was created in PostgreSQL
docker exec mifosx4mm-postgres-1 psql -U mifos -d fineract_default -c "\l"

# 5. Confirm Fineract created its tables in PostgreSQL
docker exec mifosx4mm-postgres-1 psql -U mifos -d fineract_default -c "\dt m_*"

# 6. Seed test data via Fineract REST API
npx tsx scripts/seed-fineract.ts

# 7. Check reporting service returns live data
curl http://localhost:3005/reports/portfolio/summary

# 8. Open the dashboard
# http://localhost:3000 — should show active loans and clients
```

---

## Expected Result After Migration

Step 7 should return:
```json
{
  "activeLoans": 8,
  "activeClients": 8,
  "totalDisbursed": ...,
  "totalOutstanding": ...,
  "par0": 0.0,
  "par30": 0.0,
  "par90": 0.0,
  "currency": "MMK"
}
```

Step 8 — the dashboard at `http://localhost:3000` shows live loan portfolio data
instead of zeros.

---

## Summary

| | Before | After |
|---|---|---|
| Database engines | MySQL + PostgreSQL | PostgreSQL only |
| Total databases | 4 | 3 |
| MySQL | Running | Removed |
| Reporting works | No | Yes |
| Changes required | — | 2 files only |
