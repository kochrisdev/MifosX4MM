import type { FastifyInstance } from 'fastify';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

export async function dashboardRoutes(
  app: FastifyInstance,
  _fineract: AxiosInstance,   // reserved for future Fineract-only stats
  reportingSvcUrl: string
) {
  app.get('/dashboard/stats', async (_req, reply) => {
    // Both queries hit the Fineract PostgreSQL DB via the reporting service —
    // avoids spinning up two separate Fineract REST call chains.
    const [portfolioRes, collectionsRes] = await Promise.allSettled([
      axios.get(`${reportingSvcUrl}/reports/portfolio/summary`),
      axios.get(`${reportingSvcUrl}/reports/collections/today`),
    ]);

    const portfolio   = portfolioRes.status   === 'fulfilled' ? portfolioRes.value.data   : null;
    const collections = collectionsRes.status === 'fulfilled' ? collectionsRes.value.data : null;

    if (portfolioRes.status === 'rejected') {
      app.log.warn({ reason: portfolioRes.reason?.message }, 'portfolio summary fetch failed');
    }
    if (collectionsRes.status === 'rejected') {
      app.log.warn({ reason: collectionsRes.reason?.message }, 'collections today fetch failed');
    }

    return reply.send({
      success: true,
      data: {
        activeClients:    portfolio?.activeClients    ?? 0,
        activeLoans:      portfolio?.activeLoans      ?? 0,
        parRatio:         portfolio?.par30            ?? 0,   // web dashboard shows PAR30
        par0:             portfolio?.par0             ?? 0,
        par30:            portfolio?.par30            ?? 0,
        par90:            portfolio?.par90            ?? 0,
        totalOutstanding: portfolio?.totalOutstanding ?? 0,
        totalOverdue:     portfolio?.totalOverdue     ?? 0,
        collectionsToday: collections?.collected      ?? 0,
        collectionRate:   collections?.collectionRate ?? 0,
      },
    });
  });
}
