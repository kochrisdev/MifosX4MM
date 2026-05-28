# Keycloak HTTP / HTTPS rollback note

This repo was updated so the local VPS stack can serve Keycloak over plain HTTP instead of forcing HTTPS.

## What changed

### Docker Compose
The Keycloak service in [docker-compose.yml](../docker-compose.yml) now uses:

```yaml
command: start-dev --import-realm
```

This makes Keycloak start in development mode, which allows HTTP access on port `8080` without the production HTTPS enforcement.

### Realm import
The imported realm file already allows HTTP:

```json
"sslRequired": "none"
```

in [infra/keycloak/realm-mifos.json](../infra/keycloak/realm-mifos.json).

### Live server state
The running Keycloak container also had its built-in `master` realm SSL setting changed from `external` to `none` using `kcadm.sh`.

That change lives in Keycloak’s database volume, not in Git.

## Current HTTP configuration

These values are the ones that keep the stack on plain HTTP:

- [docker-compose.yml](../docker-compose.yml): `command: start-dev --import-realm`
- [docker-compose.yml](../docker-compose.yml): `KC_HTTP_ENABLED=true`
- [docker-compose.yml](../docker-compose.yml): `KC_HOSTNAME_URL=http://178.105.62.27:8180`
- [docker-compose.yml](../docker-compose.yml): `KC_HOSTNAME_STRICT=false`
- [infra/keycloak/realm-mifos.json](../infra/keycloak/realm-mifos.json): `sslRequired=none`
- [.env](../.env): `KEYCLOAK_URL=http://178.105.62.27:8180`

## How to change back later

If you want to restore the stricter production-style setup later, update these pieces together:

1. Change the Keycloak command in [docker-compose.yml](../docker-compose.yml) from `start-dev --import-realm` back to `start --import-realm`.
2. Replace the HTTP hostname with your public HTTPS hostname, for example `KC_HOSTNAME=https://auth.yourdomain.com` or the equivalent full URL you want Keycloak to advertise.
3. Set the app and API environment values in [.env](../.env) back to the HTTPS Keycloak URL.
4. Update client redirect URIs and web origins in [infra/keycloak/realm-mifos.json](../infra/keycloak/realm-mifos.json) to match the HTTPS frontend URL.
5. Change the Keycloak master realm SSL requirement back if needed:

```bash
docker exec -it mifosx4mm-keycloak-1 /opt/keycloak/bin/kcadm.sh \
  config credentials --server http://localhost:8080 --realm master --user admin --password <admin-password>

docker exec -it mifosx4mm-keycloak-1 /opt/keycloak/bin/kcadm.sh \
  update realms/master -s sslRequired=external
```

If you want the realm import to be applied again after editing [infra/keycloak/realm-mifos.json](../infra/keycloak/realm-mifos.json), you may also need to reset the Keycloak database volume, because `--import-realm` only imports a realm the first time it sees it.

## Rollback checklist

- Revert the compose command to production mode.
- Switch `KEYCLOAK_URL` and any client URLs back to HTTPS.
- Restore any HTTPS redirect URIs and web origins.
- Set the master realm `sslRequired` value back to `external` or your preferred policy.
- Restart the stack and verify the Keycloak login page loads on HTTPS.
