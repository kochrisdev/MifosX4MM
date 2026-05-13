import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LoanRepaymentSchedule {
  periods: RepaymentPeriod[];
  totalPrincipalDisbursed: { amount: number };
  totalOutstanding: { amount: number };
  totalRepayment: { amount: number };
}

export interface RepaymentPeriod {
  period: number;
  dueDate: number[];
  principalDue: number;
  interestDue: number;
  feeChargesDue: number;
  penaltyChargesDue: number;
  totalDueForPeriod: number;
  totalPaidForPeriod: number;
  totalOutstandingForPeriod: number;
  complete: boolean;
  obligationsMetOnDate?: number[];
}

export interface LoanDetail {
  id: number;
  accountNo: string;
  clientId: number;
  clientName: string;
  productName: string;
  loanProductId: number;
  status: { id: number; value: string };
  currency: { displaySymbol: string; code: string };
  principal: number;
  approvedPrincipal: number;
  netDisbursalAmount: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: { value: string };
  interestRatePerPeriod: number;
  annualInterestRate: number;
  approvedOnDate?: number[];
  disbursementDate?: number[];
  expectedMaturityDate?: number[];
  totalOutstanding: number;
  totalRepayment: number;
  inArrears: boolean;
  repaymentSchedule: LoanRepaymentSchedule;
  transactions: LoanTransaction[];
}

export interface LoanTransaction {
  id: number;
  type: { value: string };
  date: number[];
  amount: number;
  principalPortion: number;
  interestPortion: number;
  reversed: boolean;
}

export function useLoan(loanId: number | string) {
  return useQuery({
    queryKey: ['loan', loanId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: LoanDetail }>(`/loans/${loanId}`);
      return data.data;
    },
    enabled: !!loanId,
  });
}

export function useLoanAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      loanId,
      command,
      payload,
    }: {
      loanId: number | string;
      command: 'approve' | 'disburse' | 'reject' | 'undoapproval';
      payload?: Record<string, unknown>;
    }) => {
      const { data } = await api.post(
        `/loans/${loanId}/actions`,
        { command, ...payload }
      );
      return data;
    },
    onSuccess: (_data, { loanId }) => {
      qc.invalidateQueries({ queryKey: ['loan', loanId] });
      qc.invalidateQueries({ queryKey: ['client-loans'] });
    },
  });
}

export function usePostRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      loanId,
      amount,
      date,
      note,
    }: {
      loanId: number | string;
      amount: number;
      date: string;
      note?: string;
    }) => {
      const { data } = await api.post(`/loans/${loanId}/repayments`, { amount, date, note });
      return data;
    },
    onSuccess: (_data, { loanId }) => {
      qc.invalidateQueries({ queryKey: ['loan', loanId] });
      qc.invalidateQueries({ queryKey: ['client-loans'] });
    },
  });
}
