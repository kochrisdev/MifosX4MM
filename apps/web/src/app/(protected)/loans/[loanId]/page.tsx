'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useLoan, usePostRepayment, useLoanAction as useCreateLoanAction } from '@/hooks/useLoans';
import { Badge, loanStatusBadge } from '@/components/ui/Badge';
import { formatMMK, formatPercent } from '@/lib/format';
import {
  ArrowLeft, CheckCircle, XCircle, Banknote,
  Send, AlertCircle,
} from 'lucide-react';

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
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link href="/loans" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={13} /> Back
      </Link>
      <div style={{ padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--r-btn)', fontSize: 13, color: 'var(--red)' }}>
        Loan not found.
      </div>
    </div>
  );

  const statusId = loan.status.id;
  const canApprove   = statusId === 100;
  const canDisburse  = statusId === 200;
  const canRepay     = statusId === 300;
  const canReject    = [100, 200].includes(statusId);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link href={`/clients/${loan.clientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={13} /> {loan.clientName}
      </Link>

      {actionMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 14,
          background: actionMsg.type === 'ok' ? 'var(--green-50)' : 'var(--red-50)',
          border: `1px solid ${actionMsg.type === 'ok' ? 'var(--green)' : 'var(--red)'}`,
          borderRadius: 'var(--r-btn)',
          fontSize: 13,
          color: actionMsg.type === 'ok' ? 'var(--green)' : 'var(--red)',
        }}>
          {actionMsg.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {actionMsg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div>
          {/* Loan summary card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>{loan.productName}</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, fontFamily: 'var(--mono)' }}>{loan.accountNo}</p>
              </div>
              {loanStatusBadge(statusId)}
            </div>
            {/* 3-column grid of stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Principal', value: formatMMK(loan.principal) },
                { label: 'Outstanding', value: formatMMK(loan.totalOutstanding) },
                { label: 'Repaid', value: formatMMK(loan.totalRepayment) },
                { label: 'Interest Rate', value: formatPercent(loan.annualInterestRate) + ' p.a.' },
                { label: 'Disbursed', value: fmtDate(loan.disbursementDate) },
                { label: 'Maturity', value: fmtDate(loan.expectedMaturityDate) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 3px' }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
            {/* Arrears warning */}
            {loan.inArrears && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '8px 10px', background: 'var(--amber-50)', border: '1px solid var(--amber)', borderRadius: 'var(--r-btn)', fontSize: 12.5, color: 'var(--amber)' }}>
                <AlertCircle size={13} /> This loan is in arrears
              </div>
            )}
          </div>

          {/* Repayment schedule card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Repayment Schedule</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['#', 'Due Date', 'Principal', 'Interest', 'Total Due', 'Status'].map((col, i) => (
                      <th key={col} style={{ padding: '8px 14px', textAlign: i >= 2 && i < 5 ? 'right' : i === 5 ? 'center' : 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-2)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(loan.repaymentSchedule?.periods ?? []).map((p: any) => (
                    <tr key={p.period} style={{ background: p.complete ? 'rgba(230,242,236,0.4)' : 'transparent', borderBottom: '1px solid var(--border-2)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{p.period}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--ink)' }}>{fmtDate(p.dueDate)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatMMK(p.principalDue)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatMMK(p.interestDue)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatMMK(p.totalDueForPeriod)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {p.complete ? <Badge label="Paid" variant="ok" /> : <Badge label="Pending" variant="draft" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction history */}
          {loan.transactions?.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Transaction History</h3>
              </div>
              <div>
                {loan.transactions.filter((t: any) => !t.reversed).map((tx: any) => (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid var(--border-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 6, background: tx.type.value === 'Repayment' ? 'var(--teal-50)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {tx.type.value === 'Repayment'
                          ? <Banknote size={14} style={{ color: 'var(--teal)' }} />
                          : <Send size={14} style={{ color: 'var(--ink-3)' }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 1px' }}>{tx.type.value}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>{fmtDate(tx.date)}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{formatMMK(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Actions panel */}
        <div>
          {/* Record Repayment */}
          {canRepay && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '16px', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Record Repayment</h3>
              {!showRepay ? (
                <button
                  onClick={() => setShowRepay(true)}
                  style={{ width: '100%', height: 34, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--sans)' }}
                >
                  <Banknote size={14} /> Record Cash Payment
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Amount (MMK)', type: 'number', value: repayAmount, onChange: (e: any) => setRepayAmount(e.target.value), placeholder: '0' },
                    { label: 'Date', type: 'date', value: repayDate, onChange: (e: any) => setRepayDate(e.target.value), placeholder: '' },
                    { label: 'Note (optional)', type: 'text', value: repayNote, onChange: (e: any) => setRepayNote(e.target.value), placeholder: 'Payment note…' },
                  ].map(({ label, type, value, onChange, placeholder }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</label>
                      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-input)', fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--sans)', outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleRepay}
                      disabled={postRepayment.isPending}
                      style={{ flex: 1, height: 32, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, cursor: postRepayment.isPending ? 'not-allowed' : 'pointer', opacity: postRepayment.isPending ? 0.55 : 1, fontFamily: 'var(--sans)' }}
                    >
                      {postRepayment.isPending ? 'Saving…' : 'Submit'}
                    </button>
                    <button
                      onClick={() => setShowRepay(false)}
                      style={{ height: 32, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-btn)', fontSize: 13, color: 'var(--ink-2)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loan Actions */}
          {(canApprove || canDisburse || canReject) && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '16px', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Loan Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canApprove && (
                  <button onClick={() => handleAction('approve')} disabled={loanAction.isPending}
                    style={{ width: '100%', height: 34, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, cursor: loanAction.isPending ? 'not-allowed' : 'pointer', opacity: loanAction.isPending ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--sans)' }}>
                    <CheckCircle size={14} /> Approve Loan
                  </button>
                )}
                {canDisburse && (
                  <button onClick={() => handleAction('disburse')} disabled={loanAction.isPending}
                    style={{ width: '100%', height: 34, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, cursor: loanAction.isPending ? 'not-allowed' : 'pointer', opacity: loanAction.isPending ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--sans)' }}>
                    <Send size={14} /> Disburse Loan
                  </button>
                )}
                {canReject && (
                  <button onClick={() => handleAction('reject')} disabled={loanAction.isPending}
                    style={{ width: '100%', height: 34, background: 'var(--surface)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, cursor: loanAction.isPending ? 'not-allowed' : 'pointer', opacity: loanAction.isPending ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--sans)' }}>
                    <XCircle size={14} /> Reject Loan
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Summary stats */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Summary</h3>
            {[
              { label: 'Terms', value: `${loan.numberOfRepayments} × ${loan.repaymentEvery} ${loan.repaymentFrequencyType?.value ?? ''}` },
              { label: 'Approved on', value: fmtDate(loan.approvedOnDate) },
              { label: 'Disbursed', value: fmtDate(loan.disbursementDate) },
              { label: 'Maturity', value: fmtDate(loan.expectedMaturityDate) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ height: 14, width: 80, background: 'var(--border-2)', borderRadius: 3, marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <div style={{ height: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', marginBottom: 12 }} />
          <div style={{ height: 280, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)' }} />
        </div>
        <div style={{ height: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)' }} />
      </div>
    </div>
  );
}
