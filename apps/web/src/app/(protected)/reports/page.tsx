'use client';

import { useQuery } from '@tanstack/react-query';
import { formatMMK, formatPercent } from '@/lib/format';

const REPORTING_URL = process.env.NEXT_PUBLIC_REPORTING_URL ?? 'http://localhost:3005';

interface ProductRow {
  productName: string;
  loanCount: number;
  outstanding: number;
  overdue: number;
  parRatio: number;
}

interface Disbursement {
  period: string;
  loanCount: number;
  amount: number;
}

function usePortfolioByProduct() {
  return useQuery<ProductRow[]>({
    queryKey: ['portfolio-by-product'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/portfolio/by-product`);
      return r.json();
    },
  });
}

function useDisbursements(granularity: 'month' | 'week') {
  return useQuery<Disbursement[]>({
    queryKey: ['disbursements', granularity],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/portfolio/disbursements?granularity=${granularity}`);
      return r.json();
    },
  });
}

function useKycBreakdown() {
  return useQuery<Record<string, number>>({
    queryKey: ['kyc-breakdown'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/kyc/status-breakdown`);
      return r.json();
    },
  });
}

export default function ReportsPage() {
  const { data: products = [], isLoading: prodLoading } = usePortfolioByProduct();
  const { data: disbursements = [], isLoading: disbLoading } = useDisbursements('month');
  const { data: kyc, isLoading: kycLoading } = useKycBreakdown();

  const maxDisbAmt = Math.max(...disbursements.map((d) => d.amount), 1);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Workspace / Reports</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Reports</h1>
      </div>

      {/* Portfolio by product card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Portfolio by Product</h2>
        </div>
        {prodLoading ? (
          <div style={{ padding: 16 }}>
            {[1,2,3].map((i) => <div key={i} style={{ height: 40, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 8 }} />)}
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>No loan products with active loans</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {[['Product', 'left'], ['Loans', 'right'], ['Outstanding', 'right'], ['Overdue', 'right'], ['PAR', 'right']].map(([col, align]) => (
                    <th key={col} style={{ padding: '8px 14px', textAlign: align as any, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-2)' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.productName} style={{ borderBottom: '1px solid var(--border-2)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{p.productName}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{p.loanCount.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{formatMMK(p.outstanding)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--amber)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatMMK(p.overdue)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: p.parRatio > 10 ? 'var(--red)' : p.parRatio > 5 ? 'var(--amber)' : 'var(--green)',
                      }}>{formatPercent(p.parRatio)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2-column: disbursements + KYC */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Disbursements */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Disbursements (12 months)</h2>
          </div>
          <div style={{ padding: '14px 18px' }}>
            {disbLoading ? (
              <div style={{ height: 160, background: 'var(--surface-2)', borderRadius: 4 }} />
            ) : disbursements.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>No disbursement data</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {disbursements.slice(-12).map((d) => {
                  const pct = (d.amount / maxDisbAmt) * 100;
                  const label = new Date(d.period).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                  return (
                    <div key={d.period} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', width: 40, textAlign: 'right', fontFamily: 'var(--mono)', flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, height: 18, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-2)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', transition: 'width 500ms' }} />
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-2)', width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatMMK(d.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* KYC breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>KYC Status Breakdown</h2>
          </div>
          <div style={{ padding: '6px 18px 14px' }}>
            {kycLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
                {[1,2,3,4,5].map((i) => <div key={i} style={{ height: 36, background: 'var(--surface-2)', borderRadius: 4 }} />)}
              </div>
            ) : (
              <div>
                {Object.entries(kyc ?? {}).map(([status, count]) => (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)' }}>{(count as number).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
