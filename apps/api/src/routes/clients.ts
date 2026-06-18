import type { FastifyInstance } from 'fastify';
import type { AxiosInstance } from 'axios';
import type { FineractClient, PaginatedResponse } from '@mifos-x/shared-types';

export async function clientRoutes(app: FastifyInstance, fineract: AxiosInstance) {
  app.get<{ Querystring: { offset?: number; limit?: number; displayName?: string } }>(
    '/clients',
    async (req, reply) => {
      const { offset = 0, limit = 25, displayName } = req.query;
      const params: Record<string, unknown> = { offset, limit };
      if (displayName) params['displayName'] = displayName;

      const { data } = await fineract.get('/clients', { params });
      const result: PaginatedResponse<FineractClient> = {
        items: data.pageItems,
        total: data.totalFilteredRecords,
        page: Number(offset),
        pageSize: Number(limit),
      };
      return reply.send({ success: true, data: result });
    }
  );

  app.get<{ Params: { clientId: string } }>('/clients/:clientId', async (req, reply) => {
    const { data } = await fineract.get(`/clients/${req.params.clientId}`);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: Partial<FineractClient> }>('/clients', async (req, reply) => {
    const { data } = await fineract.post('/clients', req.body);
    return reply.status(201).send({ success: true, data });
  });

  app.put<{ Params: { clientId: string }; Body: Partial<FineractClient> }>(
    '/clients/:clientId',
    async (req, reply) => {
      const { data } = await fineract.put(`/clients/${req.params.clientId}`, req.body);
      return reply.send({ success: true, data });
    }
  );
}
