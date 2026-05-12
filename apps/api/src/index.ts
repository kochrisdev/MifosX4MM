import Fastify from 'fastify';
import cors from '@fastify/cors';
import keycloakPlugin from './plugins/keycloak';
import { createFineractClient } from './fineract';
import { authRoutes } from './routes/auth';
import { clientRoutes } from './routes/clients';
import { loanRoutes } from './routes/loans';
import { paymentRoutes } from './routes/payments';
import { dashboardRoutes } from './routes/dashboard';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? '*' });
  await app.register(keycloakPlugin);

  const fineract = createFineractClient();
  const MOBILE_MONEY_URL = process.env.MOBILE_MONEY_SVC_URL ?? 'http://localhost:3003';
  const REPORTING_URL    = process.env.REPORTING_SVC_URL    ?? 'http://localhost:3005';

  app.get('/health', async () => ({ status: 'ok', service: 'api' }));

  // Public — login / refresh / logout
  await app.register(async (pub) => {
    await authRoutes(pub);
  }, { prefix: '/api/v1' });

  // Protected — valid Keycloak JWT required
  await app.register(async (protected_) => {
    protected_.addHook('onRequest', app.authenticate);
    await dashboardRoutes(protected_, fineract, REPORTING_URL);
    await clientRoutes(protected_, fineract);
    await loanRoutes(protected_, fineract);
    await paymentRoutes(protected_, fineract, MOBILE_MONEY_URL);
  }, { prefix: '/api/v1' });

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as any).status ?? err.statusCode ?? 500;
    app.log.error(err);
    return reply.status(status).send({ success: false, error: err.message });
  });

  await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
