import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FineractClient {
  id: number;
  accountNo: string;
  displayName: string;
  status: { id: number; value: string };
  officeId: number;
  officeName: string;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: number[];
  gender?: { value: string };
  activationDate?: number[];
  imagePresent?: boolean;
}

interface ClientsPage {
  totalFilteredRecords: number;
  pageItems: FineractClient[];
}

export function useClients(search = '') {
  return useInfiniteQuery<ClientsPage>({
    queryKey: ['clients', search],
    queryFn: async ({ pageParam = 0 }) => {
      const params: Record<string, unknown> = { offset: pageParam, limit: 25 };
      if (search) params.displayName = search;
      const { data } = await api.get<{ success: boolean; data: ClientsPage }>('/clients', { params });
      return data.data;
    },
    getNextPageParam: (last, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.pageItems.length, 0);
      return loaded < last.totalFilteredRecords ? loaded : undefined;
    },
    initialPageParam: 0,
  });
}

export function useClient(clientId: number | string) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: FineractClient }>(`/clients/${clientId}`);
      return data.data;
    },
    enabled: !!clientId,
  });
}

export function useClientLoans(clientId: number | string) {
  return useQuery({
    queryKey: ['client-loans', clientId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: { loanAccounts: LoanSummary[] } }>(
        `/clients/${clientId}/loans`
      );
      return data.data.loanAccounts ?? [];
    },
    enabled: !!clientId,
  });
}

export interface LoanSummary {
  id: number;
  accountNo: string;
  productName: string;
  status: { id: number; value: string };
  principalDisbursed: number;
  totalOutstanding: number;
  currency: { displaySymbol: string };
  inArrears: boolean;
  numberOfRepayments: number;
}
