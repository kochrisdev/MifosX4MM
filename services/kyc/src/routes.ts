import type { FastifyInstance } from 'fastify';
import type { KycVerificationRequest } from '@mifos-x/shared-types';
import type { KycProvider } from './provider';

export async function registerRoutes(app: FastifyInstance, provider: KycProvider) {
  app.post<{ Body: KycVerificationRequest }>('/kyc/submit', async (req, reply) => {
    const submission = await provider.submit(req.body);
    return reply.status(201).send({ success: true, data: submission });
  });

  app.get<{ Params: { submissionId: string } }>(
    '/kyc/status/:submissionId',
    async (req, reply) => {
      const submission = await provider.getStatus(req.params.submissionId);
      return reply.send({ success: true, data: submission });
    }
  );

  // Aggregate counts — consumed by the reporting service
  app.get('/kyc/stats', async (_req, reply) => {
    const stats = await provider.getStats();
    return reply.send({ success: true, data: stats });
  });

  // Generic webhook endpoint — routed to the active provider
  app.post('/webhooks/kyc', async (req, reply) => {
    const result = await provider.handleWebhook(req.body);
    app.log.info({ submissionId: result.submissionId, status: result.status }, 'KYC webhook received');
    return reply.send({ success: true });
  });
}
