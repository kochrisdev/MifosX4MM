import Fastify from 'fastify';
import type { KycProvider } from './provider';
import { StubKycProvider } from './providers/stub';
import { registerRoutes } from './routes';

const app = Fastify({ logger: true });

function resolveProvider(): KycProvider {
  switch (process.env.KYC_PROVIDER) {
    case 'stub':
    default:
      app.log.info('Using stub KYC provider — swap KYC_PROVIDER env var to use a real provider');
      return new StubKycProvider();
  }
}

const provider = resolveProvider();
registerRoutes(app, provider);

app.get('/health', async () => ({ status: 'ok', service: 'kyc', provider: provider.name }));

app.listen({ port: Number(process.env.PORT ?? 3004), host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
