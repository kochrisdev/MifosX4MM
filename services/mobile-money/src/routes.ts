import type { FastifyInstance } from 'fastify';
import type { KbzPayOrderParams, KbzPayCallbackPayload } from '@mifos-x/shared-types';
import { KbzPayClient } from './kbzpay/client';

export async function registerRoutes(app: FastifyInstance, kbzPay: KbzPayClient) {
  // Initiate a KBZ Pay payment (called by API gateway when recording a repayment)
  app.post<{ Body: KbzPayOrderParams }>('/payments/kbzpay/initiate', async (req, reply) => {
    const prepay = await kbzPay.createOrder(req.body);
    return reply.send({ success: true, data: prepay });
  });

  // Query payment status by merchant order ID
  app.get<{ Params: { orderId: string } }>(
    '/payments/kbzpay/status/:orderId',
    async (req, reply) => {
      const status = await kbzPay.queryOrder(req.params.orderId);
      return reply.send({ success: true, data: status });
    }
  );

  // KBZ Pay server-to-server callback
  app.post<{ Body: KbzPayCallbackPayload }>('/webhooks/kbzpay', async (req, reply) => {
    const result = kbzPay.parseCallback(req.body);

    if (!result.valid) {
      app.log.warn({ orderId: result.orderId }, 'KBZ Pay callback signature mismatch');
      return reply.status(400).send({ return_code: 'FAIL', return_msg: 'invalid signature' });
    }

    if (result.success) {
      app.log.info({ orderId: result.orderId }, 'KBZ Pay payment confirmed');
      // TODO: emit event to API gateway to post repayment to Fineract
      // e.g. publish to internal message bus or call Fineract directly
    }

    // KBZ Pay expects this exact acknowledgement
    return reply.send({ return_code: 'SUCCESS', return_msg: 'OK' });
  });
}
