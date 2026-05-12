import type { FastifyInstance } from 'fastify';
import axios from 'axios';
import type { TokenPair } from '@mifos-x/shared-types';

interface LoginBody { username: string; password: string }
interface RefreshBody { refreshToken: string }

function keycloakTokenUrl() {
  return `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
}

function keycloakLogoutUrl() {
  return `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout`;
}

export async function authRoutes(app: FastifyInstance) {
  // Login — Resource Owner Password Credentials (staff-only, not for public flows)
  app.post<{ Body: LoginBody }>('/auth/login', async (req, reply) => {
    const { username, password } = req.body;

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.KEYCLOAK_STAFF_CLIENT_ID ?? 'mifos-staff',
      username,
      password,
      scope: 'openid profile email',
    });

    const { data } = await axios.post(keycloakTokenUrl(), params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokens: TokenPair = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };

    return reply.send({ success: true, data: tokens });
  });

  // Refresh access token
  app.post<{ Body: RefreshBody }>('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KEYCLOAK_STAFF_CLIENT_ID ?? 'mifos-staff',
      refresh_token: refreshToken,
    });

    const { data } = await axios.post(keycloakTokenUrl(), params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokens: TokenPair = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };

    return reply.send({ success: true, data: tokens });
  });

  // Logout — revokes the refresh token on Keycloak
  app.post<{ Body: RefreshBody }>('/auth/logout', async (req, reply) => {
    const { refreshToken } = req.body;

    const params = new URLSearchParams({
      client_id: process.env.KEYCLOAK_STAFF_CLIENT_ID ?? 'mifos-staff',
      refresh_token: refreshToken,
    });

    await axios.post(keycloakLogoutUrl(), params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return reply.send({ success: true });
  });

  // Current user — validates token and returns user info
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    return reply.send({ success: true, data: req.user });
  });
}
