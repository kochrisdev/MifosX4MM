'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useLoans } from '@/hooks/useLoans';
import { loanStatusBadge } from '@/components/ui/Badge';
import { formatMMK } from '@/lib/format';
import { Search, ChevronRight, AlertCircle } from 'lucide-react';

export default function LoansPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const onSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__loanSearchTimer);
    (window as any).__loanSearchTimer = setTimeout(() => setDebouncedSearch(v), 300);
  }, []);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLoans(debouncedSearch);

  const loans = data?.pages.flatMap((p) => p.pageItems) ?? [];
  const total  = data?.pages[0]?.totalFilteredRecords ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Workspace / Loans</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Loans</h1>
      </div>

      {/* Card with search + table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
        {/* Search bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input
              type="text"
              placeholder="Search by account number…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px',
                border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
                fontSize: 13, background: 'var(--surface-2)', color: 'var(--ink)',
                outline: 'none', fontFamily: 'var(--sans)', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.background = 'var(--surface)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
            {isLoading ? 'Loading…' : `${total.toLocaleString()} loan${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 100px 32px', padding: '8px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)' }}>
          {['Client / Account', 'Product', 'Outstanding', 'Status', ''].map((col, i) => (
            <span key={col + i} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col}</span>
          ))}
        </div>

        {/* Rows */}
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: 140, background: 'var(--border-2)', borderRadius: 3, marginBottom: 5 }} />
                  <div style={{ height: 11, width: 80, background: 'var(--border-2)', borderRadius: 3 }} />
                </div>
                <div style={{ height: 13, width: 80, background: 'var(--border-2)', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        ) : loans.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{debouncedSearch ? `No loans matching "${debouncedSearch}"` : 'No loans found'}</p>
          </div>
        ) : (
          <div>
            {loans.map((loan) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 100px 32px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-2)', textDecoration: 'none', color: 'inherit' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Client / Account */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{loan.clientName}</p>
                    {loan.inArrears && (
                      <AlertCircle size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>{loan.accountNo}</p>
                </div>
                {/* Product */}
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loan.productName}</p>
                {/* Outstanding */}
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                  {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                </p>
                {/* Status */}
                {loanStatusBadge(loan.status.id)}
                {/* Arrow */}
                <ChevronRight size={14} style={{ color: 'var(--ink-4)' }} />
              </Link>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-2)', textAlign: 'center' }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--teal)', background: 'none', border: 'none', cursor: isFetchingNextPage ? 'not-allowed' : 'pointer', opacity: isFetchingNextPage ? 0.55 : 1 }}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
