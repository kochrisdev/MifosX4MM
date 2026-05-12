import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { FineractLoanAccount, ApiResponse } from '@mifos-x/shared-types';

export function useClientLoans(clientId: string) {
  return useQuery<FineractLoanAccount[]>({
    queryKey: ['loans', 'client', clientId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FineractLoanAccount[]>>(
        `/clients/${clientId}/loans`
      );
      return data.data ?? [];
    },
    enabled: !!clientId,
  });
}

export function useLoan(loanId: string) {
  return useQuery<FineractLoanAccount>({
    queryKey: ['loan', loanId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FineractLoanAccount>>(`/loans/${loanId}`);
      return data.data!;
    },
  });
}

export interface RepaymentParams {
  loanId: string;
  amount: number;
  note?: string;
}

export function usePostRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, amount, note }: RepaymentParams) => {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      const { data } = await api.post(`/loans/${loanId}/repayments`, {
        dateFormat: 'yyyy/MM/dd',
        locale: 'en',
        transactionDate: today,
        transactionAmount: amount,
        note,
      });
      return data;
    },
    onSuccess: (_data, { loanId }) => {
      qc.invalidateQueries({ queryKey: ['loan', loanId] });
    },
  });
}

export interface KbzPayInitResult {
  prepayId: string;
  orderId: string;
  expireTime: number;
}

export function useInitiateKbzPayment() {
  return useMutation({
    mutationFn: async ({
      loanId,
      amount,
      customerName,
      customerPhone,
    }: {
      loanId: number;
      amount: number;
      customerName: string;
      customerPhone: string;
    }): Promise<KbzPayInitResult> => {
      const { data } = await api.post<ApiResponse<KbzPayInitResult>>('/payments/initiate', {
        loanId,
        amount,
        customerName,
        customerPhone,
      });
      return data.data!;
    },
  });
}
