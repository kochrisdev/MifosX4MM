import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import jwksRsa from 'jwks-rsa';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@mifos-x/shared-types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      preferred_username: string;
      email: string;
      realm_access: { roles: string[] };
      resource_access?: Record<string, { roles: string[] }>;
    };
    user: {
      id: string;
      username: string;
      email: string;
      roles: UserRole[];
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function keycloakPlugin(app: FastifyInstance) {
  const keycloakUrl = process.env.KEYCLOAK_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;

  const jwksClient = jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000, // 10 min
  });

  await app.register(fastifyJwt, {
    // complete: true makes @fastify/jwt pass { header, payload, signature }
    // to the secret callback, giving us access to the kid header for JWKS lookup
    decode: { complete: true },
    secret: async (_request: any, decodedToken: any) => {
      const kid = decodedToken?.header?.kid;
      if (!kid) throw new Error('JWT missing kid header');
      const key = await jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    },
    verify: {
      algorithms: ['RS256'],
      issuer: `${keycloakUrl}/realms/${realm}`,
    },
    // Map raw Keycloak claims to our AuthUser shape
    decoratorName: 'user',
    formatUser: (payload: any) => ({
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: (payload.realm_access?.roles ?? []) as UserRole[],
    }),
  } as any);

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  app.decorate(
    'authorize',
    (requiredRoles: UserRole[]) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await req.jwtVerify();
        } catch {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
        const userRoles = req.user.roles;
        const hasRole = requiredRoles.some((r) => userRoles.includes(r));
        if (!hasRole) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
      }
  );
});
