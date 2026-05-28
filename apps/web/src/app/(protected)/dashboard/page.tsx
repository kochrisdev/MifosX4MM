'use client';

import { useState, useEffect } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatMMK, formatNumber, formatPercent } from '@/lib/format';
import { Users, AlertTriangle, BarChart3, CreditCard, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface KpiCardProps {
  label: string;
  value: string | null;
  subtext?: string;
  risk?: boolean;
  href?: string;
}

function KpiCard({ label, value, subtext, risk, href }: KpiCardProps) {
  const card = (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-card)',
      padding: '14px 16px 16px',
      minHeight: 118,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', margin: 0 }}>{label}</p>
      {value === null ? (
        <div style={{ height: 34, width: 80, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <p style={{
          fontSize: 28, fontWeight: 600, color: risk ? 'var(--amber)' : 'var(--ink)',
          letterSpacing: '-0.02em', lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums', margin: 0,
        }}>{value}</p>
      )}
      {subtext && <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 'auto', margin: 0 }}>{subtext}</p>}
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>;
  return card;
}

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardStats();
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }));
  }, []);

  return (
    <div style={{ maxWidth: 1480, margin: '0 auto' }}>

      {/* 1. Page header */}
      <div style={{ marginBottom: 18 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', margin: 0 }}>
            Workspace / Dashboard
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 2px rgba(47,143,95,0.18)', display: 'inline-block' }} />
            {today}
          </div>
        </div>
        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>
            Dashboard
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 500, color: 'var(--ink)', background: 'var(--surface)', cursor: isFetching ? 'not-allowed' : 'pointer', opacity: isFetching ? 0.55 : 1 }}
            >
              <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
            <Link href="/clients/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 12px', borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--teal)', textDecoration: 'none' }}>
              + New Client
            </Link>
          </div>
        </div>
      </div>

      {/* 2. KPI grid */}
      {isError && (
        <div style={{ padding: '8px 12px', background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--r-btn)', fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>
          Failed to load stats: {(error as Error)?.message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Active Clients"
          value={isLoading ? null : formatNumber(data?.activeClients ?? 0)}
          href="/clients"
        />
        <KpiCard
          label="Active Loans"
          value={isLoading ? null : formatNumber(data?.activeLoans ?? 0)}
          href="/loans"
        />
        <KpiCard
          label="Portfolio at Risk (PAR30)"
          value={isLoading ? null : formatPercent(data?.parRatio ?? 0)}
          subtext={isLoading ? undefined : `PAR0: ${formatPercent(data?.par0 ?? 0)} · PAR90: ${formatPercent(data?.par90 ?? 0)}`}
          risk
          href="/reports"
        />
        <KpiCard
          label="Collections today"
          value={isLoading ? null : formatMMK(data?.collectionsToday ?? 0)}
          subtext={isLoading ? undefined : `${formatPercent(data?.collectionRate ?? 0)} collection rate`}
          href="/collections"
        />
      </div>

      {/* 3. Two-up row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Portfolio Trend card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Portfolio Trend</h2>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>Outstanding vs. overdue, last 30 days</p>
            </div>
          </div>
          {/* Chart meta */}
          <div style={{ display: 'flex', gap: 24, padding: '14px 18px 8px' }}>
            {[
              { label: 'Outstanding', value: isLoading ? '—' : formatMMK(data?.totalOutstanding ?? 0), color: 'var(--teal)' },
              { label: 'Overdue', value: isLoading ? '—' : formatMMK(data?.totalOverdue ?? 0), color: 'var(--amber)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{value}</p>
              </div>
            ))}
          </div>
          {/* Empty chart placeholder */}
          <div style={{ margin: '0 18px 18px', height: 160, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 }}>Portfolio chart — connect reporting service to populate</p>
          </div>
        </div>

        {/* Quick Actions panel */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Quick Actions</h2>
          </div>
          <div style={{ padding: '8px' }}>
            {/* Primary action */}
            <Link href="/clients/new" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 10px',
              borderRadius: 'var(--r-btn)',
              background: 'var(--teal)',
              color: '#fff',
              textDecoration: 'none',
              marginBottom: 4,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Users size={14} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>New Client</p>
                <p style={{ fontSize: 11.5, opacity: 0.8, margin: 0 }}>Register a new borrower</p>
              </div>
            </Link>
            {/* Secondary actions */}
            {[
              { href: '/collections', label: 'View Collections', sub: 'Daily repayments', icon: <CreditCard size={14} /> },
              { href: '/collections', label: 'Overdue Loans', sub: 'PAR & arrears', icon: <AlertTriangle size={14} /> },
              { href: '/reports', label: 'Reports', sub: 'Portfolio analytics', icon: <BarChart3 size={14} /> },
            ].map(({ href, label, sub, icon }) => (
              <Link key={label} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px',
                borderRadius: 'var(--r-btn)',
                textDecoration: 'none',
                color: 'var(--ink)',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--ink-2)' }}>
                  {icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Portfolio overview */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', marginBottom: 12 }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Portfolio Overview</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '18px' }}>
          {/* Outstanding */}
          <div style={{ paddingRight: 24 }}>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Outstanding</p>
            {isLoading
              ? <div style={{ height: 28, width: 120, background: 'var(--border-2)', borderRadius: 4 }} />
              : <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{formatMMK(data?.totalOutstanding ?? 0)}</p>
            }
          </div>
          {/* Overdue */}
          <div style={{ paddingLeft: 24, paddingRight: 24, borderLeft: '1px solid var(--border-2)' }}>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Overdue</p>
            {isLoading
              ? <div style={{ height: 28, width: 80, background: 'var(--border-2)', borderRadius: 4 }} />
              : <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--amber)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{formatMMK(data?.totalOverdue ?? 0)}</p>
            }
          </div>
          {/* Composition */}
          <div style={{ paddingLeft: 24, borderLeft: '1px solid var(--border-2)' }}>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Composition</p>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--border-2)', overflow: 'hidden', marginBottom: 8 }}>
              {!isLoading && (data?.totalOutstanding ?? 0) > 0 && (
                <div style={{
                  height: '100%',
                  width: `${Math.max(0, 100 - ((data!.totalOverdue / data!.totalOutstanding) * 100))}%`,
                  background: 'var(--teal)',
                }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--teal)', display: 'inline-block' }} /> On track
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--amber)', display: 'inline-block' }} /> Overdue
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recent activity */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Recent Activity</h2>
          <Link href="/clients" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--teal)', textDecoration: 'none' }}>View all →</Link>
        </div>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 120px 100px 120px', padding: '8px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)' }}>
          {['Date', 'Client', 'Type', 'Officer', 'Status', 'Amount'].map((col, i) => (
            <span key={col} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i === 5 ? 'right' : 'left' }}>{col}</span>
          ))}
        </div>
        {/* Empty state */}
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>No recent activity</p>
          <Link href="/clients" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--teal)', textDecoration: 'none' }}>View clients →</Link>
        </div>
      </div>

    </div>
  );
}
