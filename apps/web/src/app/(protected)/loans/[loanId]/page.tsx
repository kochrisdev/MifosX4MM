'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useLoan, usePostRepayment, useLoanAction as useCreateLoanAction } from '@/hooks/useLoans';
import { Badge, loanStatusBadge } from '@/components/ui/Badge';
import { formatMMK, formatPercent } from '@/lib/format';
import {
  ArrowLeft, CheckCircle, XCircle, Banknote,
  Calendar, Send, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

function fmtDate(arr?: number[]) {
  if (!arr) return '—';
  const [y, m, d] = arr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function LoanDetailPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = use(params);
  const { data: loan, isLoading, isError } = useLoan(loanId);
  const loanAction = useCreateLoanAction();
  const postRepayment = usePostRepayment();

  const [showRepay, setShowRepay] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [repayNote, setRepayNote] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleAction(command: 'approve' | 'disburse' | 'reject') {
    setActionMsg(null);
    try {
      await loanAction.mutateAsync({
        loanId,
        command,
        payload: command === 'disburse'
          ? { actualDisbursementDate: new Date().toISOString().split('T')[0] }
          : {},
      });
      setActionMsg({ type: 'ok', text: `Loan ${command}d successfully.` });
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.response?.data?.error ?? e.message });
    }
  }

  async function handleRepay() {
    if (!repayAmount || isNaN(Number(repayAmount))) return;
    setActionMsg(null);
    try {
      await postRepayment.mutateAsync({
        loanId,
        amount: Number(repayAmount),
        date: repayDate,
        note: repayNote || undefined,
      });
      setActionMsg({ type: 'ok', text: 'Repayment recorded.' });
      setShowRepay(false);
      setRepayAmount('');
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.response?.data?.error ?? e.message });
    }
  }

  if (isLoading) return <Skeleton />;
  if (isError || !loan) return (
    <div className="max-w-4xl mx-auto">
      <Link href="/loans" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back
      </Link>
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">Loan not found.</div>
    </div>
  );

  const statusId = loan.status.id;
  const canApprove   = statusId === 100;
  const canDisburse  = statusId === 200;
  const canRepay     = statusId === 300;
  const canReject    = [100, 200].includes(statusId);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href={`/clients/${loan.clientId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> {loan.clientName}
      </Link>

      {actionMsg && (
        <div className={clsx(
          'flex items-start gap-2 text-sm rounded-lg px-4 py-3 border',
          actionMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {actionMsg.type === 'ok' ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" /> : <XCircle size={15} className="mt-0.5 flex-shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Summary */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{loan.productName}</h2>
                <p className="text-xs text-gray-400">{loan.accountNo}</p>
              </div>
              {loanStatusBadge(statusId)}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Principal',    value: formatMMK(loan.principal) },
                { label: 'Outstanding',  value: formatMMK(loan.totalOutstanding) },
                { label: 'Repaid',       value: formatMMK(loan.totalRepayment) },
                { label: 'Interest Rate',value: formatPercent(loan.annualInterestRate) + ' p.a.' },
                { label: 'Disbursed',    value: fmtDate(loan.disbursementDate) },
                { label: 'Maturity',     value: fmtDate(loan.expectedMaturityDate) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {loan.inArrears && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> This loan is in arrears
              </div>
            )}
          </div>

          {/* Repayment schedule */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Repayment Schedule</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Due Date</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Interest</th>
                    <th className="px-4 py-3 text-right">Total Due</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(loan.repaymentSchedule?.periods ?? []).map((p) => (
                    <tr
                      key={p.period}
                      className={clsx(
                        p.complete ? 'bg-emerald-50/30' : ''
                      )}
                    >
                      <td className="px-4 py-3 text-gray-500">{p.period}</td>
                      <td className="px-4 py-3 text-gray-900">{fmtDate(p.dueDate)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatMMK(p.principalDue)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatMMK(p.interestDue)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMMK(p.totalDueForPeriod)}</td>
                      <td className="px-4 py-3 text-center">
                        {p.complete
                          ? <Badge label="Paid"    variant="green" />
                          : <Badge label="Pending" variant="gray"  />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction history */}
          {loan.transactions?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Transaction History</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loan.transactions.filter((t) => !t.reversed).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-gray-50">
                        {tx.type.value === 'Repayment'
                          ? <Banknote size={14} className="text-emerald-600" />
                          : <Send size={14} className="text-blue-600" />}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">{tx.type.value}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={11} /> {fmtDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{formatMMK(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          {/* Record repayment */}
          {canRepay && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Record Repayment</h3>
              {!showRepay ? (
                <button
                  onClick={() => setShowRepay(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                >
                  <Banknote size={15} /> Record Cash Payment
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Amount (MMK)</label>
                    <input
                      type="number"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Date</label>
                    <input
                      type="date"
                      value={repayDate}
                      onChange={(e) => setRepayDate(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Note (optional)</label>
                    <input
                      type="text"
                      value={repayNote}
                      onChange={(e) => setRepayNote(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Payment note…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRepay}
                      disabled={postRepayment.isPending}
                      className="flex-1 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {postRepayment.isPending ? 'Saving…' : 'Submit'}
                    </button>
                    <button
                      onClick={() => setShowRepay(false)}
                      className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loan workflow actions */}
          {(canApprove || canDisburse || canReject) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Loan Actions</h3>
              {canApprove && (
                <button
                  onClick={() => handleAction('approve')}
                  disabled={loanAction.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  <CheckCircle size={15} /> Approve Loan
                </button>
              )}
              {canDisburse && (
                <button
                  onClick={() => handleAction('disburse')}
                  disabled={loanAction.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  <Send size={15} /> Disburse Loan
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => handleAction('reject')}
                  disabled={loanAction.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                  <XCircle size={15} /> Reject Loan
                </button>
              )}
            </div>
          )}

          {/* Loan summary stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
            <div className="space-y-2">
              {[
                { label: 'Terms',        value: `${loan.numberOfRepayments} × ${loan.repaymentEvery} ${loan.repaymentFrequencyType?.value ?? ''}` },
                { label: 'Approved On',  value: fmtDate(loan.approvedOnDate) },
                { label: 'Disbursed',    value: fmtDate(loan.disbursementDate) },
                { label: 'Maturity',     value: fmtDate(loan.expectedMaturityDate) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse space-y-5">
      <div className="h-5 w-24 bg-gray-100 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="h-40 bg-white rounded-xl border border-gray-100" />
          <div className="h-72 bg-white rounded-xl border border-gray-100" />
        </div>
        <div className="h-64 bg-white rounded-xl border border-gray-100" />
      </div>
    </div>
  );
}
