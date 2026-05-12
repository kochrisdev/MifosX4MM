import type { FastifyInstance } from 'fastify';
import type { AxiosInstance } from 'axios';
import type { FineractLoanAccount, FineractLoanRepayment } from '@mifos-x/shared-types';

export async function loanRoutes(app: FastifyInstance, fineract: AxiosInstance) {
  app.get<{ Params: { clientId: string } }>(
    '/clients/:clientId/loans',
    async (req, reply) => {
      const { data } = await fineract.get(`/clients/${req.params.clientId}/accounts`);
      return reply.send({ success: true, data: data.loanAccounts ?? [] });
    }
  );

  app.get<{ Params: { loanId: string } }>('/loans/:loanId', async (req, reply) => {
    const { data } = await fineract.get(`/loans/${req.params.loanId}`, {
      params: { associations: 'repaymentSchedule,transactions' },
    });
    return reply.send({ success: true, data });
  });

  app.post<{ Params: { loanId: string }; Body: Omit<FineractLoanRepayment, 'loanId'> }>(
    '/loans/:loanId/repayments',
    async (req, reply) => {
      const { data } = await fineract.post(
        `/loans/${req.params.loanId}/transactions?command=repayment`,
        req.body
      );
      return reply.status(201).send({ success: true, data });
    }
  );

  // Approve/disburse/reject — branch_manager or super_admin only
  app.post<{ Params: { loanId: string }; Body: { command: 'approve' | 'disburse' | 'reject'; note?: string } }>(
    '/loans/:loanId/actions',
    {
      onRequest: [app.authorize(['branch_manager', 'super_admin'])],
    },
    async (req, reply) => {
      const { command, ...body } = req.body;
      const { data } = await fineract.post(`/loans/${req.params.loanId}?command=${command}`, body);
      return reply.send({ success: true, data });
    }
  );
}
