import type { FastifyInstance } from 'fastify';
import type { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid';

interface InitiatePaymentBody {
  loanId: number;
  amount: number;
  customerName: string;
  customerPhone: string;
}

export async function paymentRoutes(
  app: FastifyInstance,
  fineract: AxiosInstance,
  mobileMoneySvcUrl: string
) {
  // Initiate KBZ Pay loan repayment
  app.post<{ Body: InitiatePaymentBody }>('/payments/initiate', async (req, reply) => {
    const { loanId, amount, customerName, customerPhone } = req.body;
    const orderId = `loan-${loanId}-${nanoid(8)}`;

    const { default: axios } = await import('axios');
    const response = await axios.post(`${mobileMoneySvcUrl}/payments/kbzpay/initiate`, {
      orderId,
      amount,
      currency: 'MMK',
      description: `Loan repayment for account #${loanId}`,
      customerName,
      customerPhone,
    });

    return reply.send({ success: true, data: response.data.data });
  });

  // Check payment status and optionally post repayment to Fineract
  app.get<{ Params: { orderId: string }; Querystring: { loanId: number } }>(
    '/payments/status/:orderId',
    async (req, reply) => {
      const { default: axios } = await import('axios');
      const { data } = await axios.get(`${mobileMoneySvcUrl}/payments/kbzpay/status/${req.params.orderId}`);

      if (data.data.status === 'success' && req.query.loanId) {
        // Post confirmed repayment to Fineract
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '/'); // dd MMM yyyy
        await fineract.post(
          `/loans/${req.query.loanId}/transactions?command=repayment`,
          {
            dateFormat: 'yyyy/MM/dd',
            locale: 'en',
            transactionDate: today,
            transactionAmount: data.data.amount / 100, // convert pyas to MMK
            note: `KBZ Pay orderId: ${req.params.orderId}`,
          }
        );
      }

      return reply.send({ success: true, data: data.data });
    }
  );
}
