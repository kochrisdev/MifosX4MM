import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { FineractClient, PaginatedResponse, ApiResponse } from '@mifos-x/shared-types';

const PAGE_SIZE = 20;

export function useClients(search?: string) {
  return useInfiniteQuery<PaginatedResponse<FineractClient>>({
    queryKey: ['clients', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, unknown> = {
        offset: (pageParam as number) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (search && search.length >= 2) params.displayName = search;
      const { data } = await api.get<ApiResponse<PaginatedResponse<FineractClient>>>('/clients', { params });
      return data.data!;
    },
    getNextPageParam: (last, pages) =>
      last.total > pages.length * PAGE_SIZE ? pages.length : undefined,
  });
}

export function useClient(clientId: string) {
  return useQuery<FineractClient>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FineractClient>>(`/clients/${clientId}`);
      return data.data!;
    },
  });
}
