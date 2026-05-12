import type { FastifyInstance } from 'fastify';
import type { AxiosInstance } from 'axios';
import type { FineractClient, PaginatedResponse } from '@mifos-x/shared-types';

export async function clientRoutes(app: FastifyInstance, fineract: AxiosInstance) {
  app.get<{ Querystring: { page?: number; pageSize?: number; search?: string } }>(
    '/clients',
    async (req, reply) => {
      const { page = 0, pageSize = 20, search } = req.query;
      const params: Record<string, unknown> = { offset: page * pageSize, limit: pageSize };
      if (search) params['displayName'] = search;

      const { data } = await fineract.get('/clients', { params });
      const result: PaginatedResponse<FineractClient> = {
        items: data.pageItems,
        total: data.totalFilteredRecords,
        page,
        pageSize,
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
