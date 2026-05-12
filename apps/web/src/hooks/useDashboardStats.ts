import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardStats, ApiResponse } from '@mifos-x/shared-types';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
      if (!data.success || !data.data) throw new Error('Failed to load dashboard stats');
      return data.data;
    },
    refetchInterval: 60_000, // auto-refresh every minute
  });
}
