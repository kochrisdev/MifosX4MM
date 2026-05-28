'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatMMK } from '@/lib/format';
import { AlertTriangle, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface OverdueLoan {
  loanId: number;
  accountNo: string;
  clientName: string;
  mobileNo: string;
  currency: string;
  oldestOverdueDate: string;
  daysOverdue: number;
  totalOverdue: number;
}

interface CollectionsToday {
  scheduled: number;
  collected: number;
  collectionRate: number;
}

const REPORTING_URL = process.env.NEXT_PUBLIC_REPORTING_URL ?? 'http://localhost:3005';

function useCollectionsToday() {
  return useQuery<CollectionsToday>({
    queryKey: ['collections-today'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/collections/today`);
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

function useOverdueLoans(daysOverdue: number) {
  return useQuery<OverdueLoan[]>({
    queryKey: ['overdue-loans', daysOverdue],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/collections/overdue?days_overdue=${daysOverdue}&limit=100`);
      return r.json();
    },
  });
}

function daysOverdueBadge(days: number) {
  if (days >= 90) return <Badge label={`${days}d`} variant="error" />;
  if (days >= 30) return <Badge label={`${days}d`} variant="warn" />;
  return <Badge label={`${days}d`} variant="draft" />;
}

export default function CollectionsPage() {
  const [filter, setFilter] = useState(1);
  const [search, setSearch] = useState('');
  const { data: today, isLoading: todayLoading } = useCollectionsToday();
  const { data: overdue = [], isLoading: overdueLoading } = useOverdueLoans(filter);

  const filtered = search
    ? overdue.filter((l) =>
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.accountNo.includes(search)
      )
    : overdue;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Workspace / Collections</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Collections</h1>
      </div>

      {/* 3 KPI mini-cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Scheduled today', value: todayLoading ? null : formatMMK(today?.scheduled ?? 0), color: 'var(--ink)' },
          { label: 'Collected today', value: todayLoading ? null : formatMMK(today?.collected ?? 0), color: 'var(--green)' },
          { label: 'Collection rate', value: todayLoading ? null : `${today?.collectionRate ?? 0}%`, color: (today?.collectionRate ?? 0) < 80 ? 'var(--red)' : 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '14px 16px 16px', minHeight: 100 }}>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', margin: '0 0 8px' }}>{label}</p>
            {todayLoading ? (
              <div style={{ height: 28, width: 100, background: 'var(--border-2)', borderRadius: 4 }} />
            ) : (
              <p style={{ fontSize: 24, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Overdue loans card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
        {/* Card header with filter tabs + search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Overdue Loans</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {/* Tab filter */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--r-btn)', background: 'var(--surface)', padding: 2 }}>
              {([1, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: filter === d ? 600 : 500,
                    color: filter === d ? 'var(--ink)' : 'var(--ink-2)',
                    background: filter === d ? 'var(--surface-2)' : 'transparent',
                    border: filter === d ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  {d === 1 ? 'All' : `${d}+ days`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingLeft: 26, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
                  border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
                  fontSize: 12.5, background: 'var(--surface-2)', color: 'var(--ink)',
                  outline: 'none', fontFamily: 'var(--sans)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.background = 'var(--surface)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {overdueLoading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                <div style={{ flex: 1, height: 13, background: 'var(--border-2)', borderRadius: 3 }} />
                <div style={{ width: 80, height: 13, background: 'var(--border-2)', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>No overdue loans{filter > 1 ? ` past ${filter} days` : ''}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Client', 'Account', 'Mobile', 'Oldest due', 'Days overdue', 'Overdue amount', ''].map((col, i) => (
                    <th key={col + i} style={{
                      padding: '8px 14px',
                      textAlign: i >= 5 ? 'right' : i === 4 ? 'center' : 'left',
                      fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--border-2)',
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((loan) => (
                  <tr key={loan.loanId} style={{ borderBottom: '1px solid var(--border-2)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{loan.clientName}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{loan.accountNo}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-2)' }}>{loan.mobileNo || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-2)' }}>
                      {new Date(loan.oldestOverdueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{daysOverdueBadge(loan.daysOverdue)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}>{formatMMK(loan.totalOverdue)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <Link href={`/loans/${loan.loanId}`} style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--ink-4)', textDecoration: 'none' }}>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
