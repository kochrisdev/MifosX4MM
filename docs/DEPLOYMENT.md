# VPS Deployment Guide

This guide walks through deploying **Mifos X for MM** on a Linux VPS using Docker Compose, a reverse proxy (Nginx), and TLS. It assumes a single-server setup suitable for staging or a small production pilot.

For local development, see [DEVELOPMENT.md](DEVELOPMENT.md).

---

## What you are deploying

| Component | Port (internal) | Expose publicly? |
|---|---|---|
| Web portal (Next.js) | 3000 | Yes — staff UI |
| API gateway (Fastify) | 3001 | Yes — REST API |
| Mobile money (KBZ Pay webhooks) | 3003 | Yes — webhook path only |
| KYC service | 3004 | No |
| Reporting service | 3005 | Optional (if web uses it directly) |
| Apache Fineract | 8080 | No (internal only) |
| Keycloak | 8080 (mapped to 8180 on host) | Yes — admin console; OIDC if needed |
| MySQL / PostgreSQL | 3306 / 5432 | **Never** |

All application containers talk to each other on the Docker network `mifos_net`. Only the reverse proxy should face the internet.

---

## VPS requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB+ SSD |
| OS | Ubuntu 22.04 or 24.04 LTS | Same |

Fineract’s first boot runs Liquibase migrations against MySQL and can take **2–5 minutes**. Keycloak realm import on first boot takes about **60 seconds**. Plan for ~10 GB of Docker images plus database growth.

---

## 1. Prepare the server

### Create a deploy user (optional but recommended)

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### Update packages and set timezone

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Yangon   # adjust to your region
```

### Install Docker Engine and Compose plugin

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in so the docker group applies
```

Verify:

```bash
docker --version
docker compose version
```

### Firewall

Allow SSH, HTTP, and HTTPS only. Do **not** open database ports.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 2. Clone the project

```bash
cd ~
git clone https://github.com/kochrisdev/MifosX4MM.git
cd MifosX4MM
```

Use your fork or private remote if applicable.

---

## 3. Configure environment

### Copy and edit `.env`

```bash
cp .env.example .env
nano .env
```

Use strong, unique values for every password and secret. Example production-oriented values (replace domains and secrets):

```bash
# Fineract — API talks to Fineract inside Docker; keep internal hostname in compose overrides if needed
FINERACT_URL=http://fineract:8080/fineract-provider/api/v1
FINERACT_TENANT_ID=default
FINERACT_USERNAME=mifos
FINERACT_PASSWORD=<strong-fineract-password>

# Keycloak — MUST match the public URL users/tokens see (see section 5)
KEYCLOAK_URL=https://auth.yourdomain.com
KEYCLOAK_REALM=mifos
KEYCLOAK_CLIENT_ID=mifos-api
KEYCLOAK_CLIENT_SECRET=<match-realm-mifos.json-or-update-in-keycloak>
KEYCLOAK_STAFF_CLIENT_ID=mifos-staff

# KBZ Pay — production credentials and public callback URL
KBZPAY_APP_ID=<from-kbz-bank>
KBZPAY_MERCHANT_CODE=<from-kbz-bank>
KBZPAY_SIGN_KEY=<from-kbz-bank>
KBZPAY_BASE_URL=https://api.kbzpay.com/payment/gateway/prod
KBZPAY_CALLBACK_URL=https://pay.yourdomain.com/webhooks/kbzpay

KYC_PROVIDER=stub

REPORTING_DB_URL=postgresql://mifos:<postgres-password>@postgres:5432/fineract_default

API_PORT=3001
JWT_SECRET=<long-random-string>
REPORTING_SVC_URL=http://reporting:3005
MOBILE_MONEY_SVC_URL=http://mobile-money:3003
KYC_SVC_URL=http://kyc:3004

# Baked into the web image at build time — use your public API URL
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_REPORTING_URL=https://api.yourdomain.com

# Restrict browser origins in production
CORS_ORIGIN=https://app.yourdomain.com
```

> **Important:** `NEXT_PUBLIC_*` variables are embedded when the `web` image is **built**, not at container runtime. After changing them, rebuild the web service (see section 6).

### Update Keycloak realm for your domain

Before first production boot, edit [`infra/keycloak/realm-mifos.json`](../infra/keycloak/realm-mifos.json) and add your staff portal URL to the `mifos-staff` client:

```json
"redirectUris": [
  "http://localhost:3000/*",
  "https://app.yourdomain.com/*"
],
"webOrigins": [
  "http://localhost:3000",
  "https://app.yourdomain.com"
]
```

Change default user passwords in the realm file or force password change on first login via the Keycloak admin console.

---

## 4. Harden `docker-compose.yml` for production

The repository’s [`docker-compose.yml`](../docker-compose.yml) is oriented toward local development. On a VPS, apply these changes (keep a backup or use a `docker-compose.override.yml`):

### 4.1 Remove public database ports

Delete or comment out the `ports` mappings for `postgres` and `mysql` so they are reachable only inside `mifos_net`:

```yaml
# postgres:
#   ports:
#     - "5432:5432"
# mysql:
#   ports:
#     - "3306:3306"
```

### 4.2 Change default database passwords

Update `POSTGRES_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and every `password` reference in Fineract, Keycloak, and reporting environment blocks to match your `.env` values.

### 4.3 Run Keycloak in production mode

Replace the dev command:

```yaml
# Development (do not use on VPS)
# command: start-dev --import-realm

# Production
command: start --import-realm
environment:
  KC_DB: postgres
  KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
  KC_DB_USERNAME: mifos
  KC_DB_PASSWORD: <postgres-password>
  KEYCLOAK_ADMIN: admin
  KEYCLOAK_ADMIN_PASSWORD: <strong-admin-password>
  KC_HOSTNAME: auth.yourdomain.com
  KC_PROXY: edge
  KC_HTTP_ENABLED: "true"
  KC_HOSTNAME_STRICT: "false"
```

`--import-realm` only imports when the realm does not already exist. To re-import after editing `realm-mifos.json`, you must reset the Keycloak database volume (see [Troubleshooting](#troubleshooting)).

### 4.4 Bind app ports to localhost (recommended)

So only Nginx on the host can reach them:

```yaml
web:
  ports:
    - "127.0.0.1:3000:3000"
api:
  ports:
    - "127.0.0.1:3001:3001"
mobile-money:
  ports:
    - "127.0.0.1:3003:3003"
keycloak:
  ports:
    - "127.0.0.1:8180:8080"
```

Fineract can stay internal-only (remove its `ports` section) if nothing outside Docker needs direct access.

### 4.5 Build the web app with the public API URL

Either set the build arg in `docker-compose.yml`:

```yaml
web:
  build:
    context: .
    dockerfile: infra/docker/Dockerfile.web
    args:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
```

Or pass it at build time:

```bash
docker compose build --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com web
```

Ensure `api` service `environment` includes `KEYCLOAK_URL` from `.env` (public issuer URL) and does **not** override it with `http://keycloak:8080` unless Keycloak is configured to issue tokens with that internal issuer (not typical behind TLS).

---

## 5. Reverse proxy and TLS (Nginx + Certbot)

Example hostnames:

| Hostname | Backend |
|---|---|
| `app.yourdomain.com` | `http://127.0.0.1:3000` (web) |
| `api.yourdomain.com` | `http://127.0.0.1:3001` (api) |
| `pay.yourdomain.com` | `http://127.0.0.1:3003` (mobile-money — KBZ callbacks) |
| `auth.yourdomain.com` | `http://127.0.0.1:8180` (keycloak) |

Install Nginx and Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/mifos`:

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name pay.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name auth.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8180;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and obtain certificates:

```bash
sudo ln -s /etc/nginx/sites-available/mifos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d pay.yourdomain.com -d auth.yourdomain.com
```

Point DNS **A records** for all four hostnames to your VPS public IP before running Certbot.

### JWT issuer alignment

The API gateway verifies JWTs with issuer:

`{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}`

That value must match the `iss` claim on tokens Keycloak issues. With `KC_HOSTNAME=auth.yourdomain.com` and `KC_PROXY=edge`, set:

```bash
KEYCLOAK_URL=https://auth.yourdomain.com
```

in `.env` so login, JWKS fetch, and verification all use the same public base URL.

---

## 6. Build and start the stack

From the project root:

```bash
docker compose build
docker compose up -d
```

Watch startup (especially Fineract):

```bash
docker compose ps
docker compose logs -f fineract
# Wait until you see Fineract application started
docker compose logs -f keycloak api web
```

### Health checks

```bash
curl -s https://api.yourdomain.com/health
curl -s https://auth.yourdomain.com/realms/mifos/.well-known/openid-configuration | head
```

### First login

Open `https://app.yourdomain.com`, sign in with a realm user (default seed users are in [README.md](../README.md#default-login-credentials)), and change passwords immediately.

---

## 7. KBZ Pay on a VPS

1. Register production merchant credentials with KBZ Bank.
2. Set `KBZPAY_BASE_URL` to the production gateway URL they provide.
3. Set `KBZPAY_CALLBACK_URL` to `https://pay.yourdomain.com/webhooks/kbzpay` (must be **HTTPS** and reachable from KBZ’s servers).
4. Confirm the webhook route responds:

```bash
curl -i -X POST https://pay.yourdomain.com/webhooks/kbzpay \
  -H "Content-Type: application/json" \
  -d '{}'
```

A non-2xx response is expected for invalid payloads; the important part is that the request reaches the service (not connection refused or 502).

---

## 8. Operations

### Start / stop

```bash
docker compose up -d          # start
docker compose down           # stop (keeps volumes)
docker compose down -v        # stop and DELETE all data — destructive
```

### View logs

```bash
docker compose logs -f api
docker compose logs -f fineract
docker compose logs -f keycloak
```

### Updates (new code release)

```bash
git pull
docker compose build
docker compose up -d
```

If `NEXT_PUBLIC_API_URL` or realm JSON changed, rebuild `web` and/or reset Keycloak data as needed.

### Backups

Back up Docker volumes regularly:

```bash
docker run --rm -v mifosx4mm_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres-$(date +%F).tar.gz -C /data .
docker run --rm -v mifosx4mm_mysql_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/mysql-$(date +%F).tar.gz -C /data .
```

Volume names may differ; list them with `docker volume ls`.

Store backups off-server (object storage or another machine).

### Auto-start on reboot

```bash
sudo systemctl enable docker
```

Containers started with `docker compose up -d` restart according to each service’s `restart` policy if you add one, for example:

```yaml
restart: unless-stopped
```

to each service in compose for production.

---

## 9. Security checklist

- [ ] Replace all default passwords (Postgres, MySQL, Keycloak admin, Fineract, seed users).
- [ ] Do not expose ports 3306, 5432, or 8080 (Fineract) to the internet.
- [ ] Use TLS on all public hostnames.
- [ ] Set `CORS_ORIGIN` to your real web origin only.
- [ ] Set a strong `JWT_SECRET` and unique `KEYCLOAK_CLIENT_SECRET`.
- [ ] Restrict Keycloak admin console access (VPN, IP allowlist, or strong password + 2FA if enabled).
- [ ] Keep the OS and Docker images updated (`apt upgrade`, periodic `docker compose pull` where images are not built locally).
- [ ] Store `.env` only on the server with permissions `chmod 600 .env`.

---

## 10. Optional: systemd service

To manage the stack with systemd, create `/etc/systemd/system/mifos.service`:

```ini
[Unit]
Description=Mifos X for MM Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/deploy/MifosX4MM
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mifos
sudo systemctl start mifos
```

Adjust `WorkingDirectory` to your clone path.

---

## Troubleshooting

### API returns 401 on every protected route after login

JWT issuer mismatch. Ensure `KEYCLOAK_URL` in `.env` equals the token `iss` claim prefix (without `/protocol/...`). Decode a token at [jwt.io](https://jwt.io) and compare.

### Web app calls wrong API host

Rebuild the web image after changing `NEXT_PUBLIC_API_URL`:

```bash
docker compose build --no-cache web
docker compose up -d web
```

### Keycloak realm not updated

`--import-realm` does not overwrite an existing realm. To re-import:

```bash
docker compose down
docker volume rm mifosx4mm_keycloak_data   # confirm name with docker volume ls
docker compose up -d
```

This wipes Keycloak data; back up first.

### Fineract not ready / API errors

Fineract migrations take several minutes on first run:

```bash
docker compose logs fineract | grep -i started
```

### Certbot fails

Confirm DNS A records point to this server and port 80 is open before requesting certificates.

### Out of memory

Fineract and MySQL together often need more than 4 GB RAM. Upgrade the VPS or add swap temporarily:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Related documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components and data flows |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local dev and environment variables |
| [API.md](API.md) | HTTP API reference |
