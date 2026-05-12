-- Create databases for Keycloak and Fineract tenants
CREATE DATABASE keycloak;
CREATE DATABASE mifostenant_default;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO mifos;
GRANT ALL PRIVILEGES ON DATABASE mifostenant_default TO mifos;
