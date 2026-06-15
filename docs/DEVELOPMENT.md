# Development Guide

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker Desktop | 4.x+ | Run Fineract, MySQL, PostgreSQL, Keycloak |
| Node.js | 20+ | All TypeScript services |
| pnpm | 9+ | Monorepo package manager |
| Python | 3.12+ | Reporting service |
| Expo CLI | latest | Mobile app development |

Install pnpm if you don't have it:
```bash
npm install -g pnpm@9
```

---

## Initial Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Create environment file
cp .env.example .env

# 3. Start infrastructure containers
pnpm docker:up
# First boot takes ~2-3 minutes:
#   - PostgreSQL creates: fineract_default (reporting), keycloak (auth)
#   - MySQL creates: fineract_tenants + fineract_default (Fineract's core banking data)
#   - Fineract runs its Liquibase migrations against MySQL
#   - Keycloak imports the mifos realm and seed users

# 4. Verify everything is up
curl http://localhost:8080/fineract-provider/api/v1/audits   # Fineract health
curl http://localhost:8180/realms/mifos/.well-known/openid-configuration  # Keycloak OIDC

# 5. Start all apps and services in dev mode (hot reload)
pnpm dev
```

---

## Running Individual Services

```bash
# API gateway only
pnpm --filter @mifos-x/api dev

# Web portal only
pnpm --filter @mifos-x/web dev

# Mobile app
pnpm --filter @mifos-x/mobile dev        # starts Expo dev server

# KBZ Pay service
pnpm --filter @mifos-x/mobile-money dev

# KYC service
pnpm --filter @mifos-x/kyc dev

# Reporting service (Python)
cd services/reporting
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3005
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

### Fineract

| Variable | Default | Description |
|---|---|---|
| `FINERACT_URL` | `http://localhost:8080/fineract-provider/api/v1` | Fineract base URL |
| `FINERACT_TENANT_ID` | `default` | Tenant identifier |
| `FINERACT_USERNAME` | `mifos` | Basic auth username |
| `FINERACT_PASSWORD` | `password` | Basic auth password |

### Keycloak

| Variable | Default | Description |
|---|---|---|
| `KEYCLOAK_URL` | `http://localhost:8180` | Keycloak base URL |
| `KEYCLOAK_REALM` | `mifos` | Realm name |
| `KEYCLOAK_CLIENT_ID` | `mifos-api` | Confidential client (service account) |
| `KEYCLOAK_CLIENT_SECRET` | `changeme-api-secret` | Match value in realm JSON |
| `KEYCLOAK_STAFF_CLIENT_ID` | `mifos-staff` | Public client used for ROPC login |

### KBZ Pay

| Variable | Description |
|---|---|
| `KBZPAY_APP_ID` | Merchant App ID — obtain from KBZ Bank |
| `KBZPAY_MERCHANT_CODE` | Merchant Code |
| `KBZPAY_SIGN_KEY` | HMAC-SHA256 signing key |
| `KBZPAY_BASE_URL` | UAT: `https://api.kbzpay.com/payment/gateway/uat` |
| `KBZPAY_CALLBACK_URL` | Public HTTPS URL for KBZ Pay to send payment notifications |

> For local testing of callbacks, use [ngrok](https://ngrok.com/): `ngrok http 3003` and set `KBZPAY_CALLBACK_URL=https://<ngrok-id>.ngrok.io/webhooks/kbzpay`

### KYC

| Variable | Default | Description |
|---|---|---|
| `KYC_PROVIDER` | `stub` | Active provider: `stub`, `smile_identity`, `onfido` |

### Service URLs

| Variable | Default | Description |
|---|---|---|
| `MOBILE_MONEY_SVC_URL` | `http://localhost:3003` | Internal URL for the mobile-money service |
| `KYC_SVC_URL` | `http://localhost:3004` | Internal URL for the KYC service |
| `REPORTING_SVC_URL` | `http://localhost:3005` | Internal URL for the reporting service |
| `API_PORT` | `3001` | API gateway listen port |

### Mobile App

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3001` | Set to your machine's LAN IP on device |
| `EXPO_PUBLIC_REPORTING_URL` | `http://localhost:3005` | Reporting service URL |

---

## Mobile App — Physical Device

The mobile app needs to reach the API gateway over your local network.

```bash
# Find your LAN IP
ipconfig      # Windows
ifconfig      # macOS/Linux

# Set in .env (or export before running Expo)
EXPO_PUBLIC_API_URL=http://192.168.1.x:3001
EXPO_PUBLIC_REPORTING_URL=http://192.168.1.x:3005
```

Then scan the QR code in Expo Go on your device.

---

## Building

```bash
# Build all packages and apps
pnpm build

# Build a specific workspace
pnpm --filter @mifos-x/shared-types build
pnpm --filter @mifos-x/api build
pnpm --filter @mifos-x/web build
```

---

## Docker (full stack)

```bash
# Build all Docker images and start
docker compose up --build

# Stop everything (preserves data volumes)
docker compose down

# Stop and wipe all data (fresh Fineract + Keycloak DB)
docker compose down -v
```

> **First run note**: Fineract takes 2-3 minutes to apply all Liquibase migrations. The API gateway will retry if Fineract is not ready. Keycloak imports the `mifos` realm on first boot only — if you need to re-import, run `docker compose down -v` and restart.

---

## Useful Commands

### Reset Fineract + databases (keep code changes)
```bash
docker compose down -v && docker compose up -d postgres mysql
# wait ~10 s for both databases to be healthy
docker compose up -d fineract keycloak
```

### Tail logs from a specific service
```bash
docker compose logs -f api
docker compose logs -f fineract
docker compose logs -f keycloak
```

### Connect to PostgreSQL directly
```bash
docker compose exec postgres psql -U mifos -d fineract_default
```

### Connect to MySQL directly
```bash
docker compose exec mysql mysql -u root -ppassword fineract_tenants
```

### Useful Fineract SQL queries
```sql
-- Count active loans by product
SELECT p.name, COUNT(*) FROM m_loan l
JOIN m_product_loan p ON l.product_id = p.id
WHERE l.loan_status_id = 300
GROUP BY p.name;

-- Overdue installments today
SELECT l.account_no, lrs.duedate, lrs.principal_amount
FROM m_loan_repayment_schedule lrs
JOIN m_loan l ON l.id = lrs.loan_id
WHERE lrs.duedate < CURRENT_DATE AND lrs.completed_derived = false
ORDER BY lrs.duedate;
```

---

## Common Workflows

### Create and disburse a loan (via API)

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@1234"}' \
  | jq -r '.data.accessToken')

# Create client
curl -s -X POST http://localhost:3001/api/v1/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firstname":"Aye","lastname":"Myat","officeId":1,"active":true,"activationDate":"2026-05-12","dateFormat":"yyyy-MM-dd","locale":"en"}'

# Create loan application, approve, disburse — via Fineract directly or API routes
```

### Test KBZ Pay signature

```bash
cd services/mobile-money
npx tsx -e "
import { buildSignature } from './src/kbzpay/signature';
const params = { appid: 'test', merch_code: 'M001', amount: '500000' };
console.log(buildSignature(params, 'my-sign-key'));
"
```

### Swap KYC provider

1. Set `KYC_PROVIDER=smile_identity` in `.env`
2. Set `SMILE_IDENTITY_PARTNER_ID` and `SMILE_IDENTITY_API_KEY`
3. Create `services/kyc/src/providers/smileIdentity.ts` implementing `KycProvider`
4. Add `case 'smile_identity': return new SmileIdentityProvider();` in `resolveProvider()`
5. Restart the KYC service

---

## Port Reference

| Port | Service |
|---|---|
| 3000 | Web portal (Next.js) |
| 3001 | API gateway (Fastify) |
| 3003 | Mobile money service |
| 3004 | KYC service |
| 3005 | Reporting service (FastAPI) |
| 3306 | MySQL (Fineract's database) |
| 5432 | PostgreSQL (Keycloak + reporting) |
| 8080 | Apache Fineract |
| 8180 | Keycloak |

---

## Troubleshooting

### Keycloak realm not imported
The `--import-realm` flag only imports if the realm doesn't already exist. If you changed `realm-mifos.json`, you must wipe the Keycloak database:
```bash
docker compose down -v
docker compose up -d
```

### Fineract returns 401 on all requests
Fineract uses Basic auth + tenant header. Verify:
```bash
curl -u mifos:password \
  -H 'Fineract-Platform-TenantId: default' \
  http://localhost:8080/fineract-provider/api/v1/clients
```

### Reporting service returns empty data
Fineract must have completed its Liquibase migrations before the reporting service can query the schema. Check:
```bash
docker compose logs fineract | grep "Started FineractApplication"
```

### Mobile app can't reach the API on a physical device
Use your machine's LAN IP, not `localhost`. Localhost resolves to the device itself on mobile.

### KBZ Pay callback not received locally
KBZ Pay cannot POST to `localhost`. Use ngrok to expose port 3003 over a public HTTPS URL:
```bash
ngrok http 3003
# Copy the https URL and set KBZPAY_CALLBACK_URL=https://<id>.ngrok.io/webhooks/kbzpay
```
