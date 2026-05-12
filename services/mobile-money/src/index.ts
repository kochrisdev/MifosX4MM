import Fastify from 'fastify';
import { KbzPayClient } from './kbzpay/client';
import { registerRoutes } from './routes';

const app = Fastify({ logger: true });

const kbzPay = new KbzPayClient({
  appId: process.env.KBZPAY_APP_ID!,
  merchantCode: process.env.KBZPAY_MERCHANT_CODE!,
  signKey: process.env.KBZPAY_SIGN_KEY!,
  baseUrl: process.env.KBZPAY_BASE_URL!,
  callbackUrl: process.env.KBZPAY_CALLBACK_URL!,
});

registerRoutes(app, kbzPay);

app.get('/health', async () => ({ status: 'ok', service: 'mobile-money' }));

app.listen({ port: Number(process.env.PORT ?? 3003), host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
