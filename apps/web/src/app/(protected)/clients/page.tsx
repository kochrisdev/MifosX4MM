'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useClients } from '@/hooks/useClients';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

function clientStatusVariant(statusId: number) {
  if (statusId === 300) return 'ok';
  if (statusId === 100) return 'draft';
  if ([400, 600].includes(statusId)) return 'error';
  return 'draft';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const onSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(v), 300);
  }, []);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useClients(debouncedSearch);

  const clients = data?.pages.flatMap((p) => p.pageItems) ?? [];
  const total   = data?.pages[0]?.totalFilteredRecords ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Workspace / Clients</p>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Clients</h1>
        </div>
        <Link href="/clients/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 32, padding: '0 12px',
          borderRadius: 'var(--r-btn)', fontSize: 13, fontWeight: 600,
          color: '#fff', background: 'var(--teal)', textDecoration: 'none',
        }}>
          <UserPlus size={14} />
          New Client
        </Link>
      </div>

      {/* Search + table card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
        {/* Search bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', strokeWidth: 2 }} />
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-input)',
                fontSize: 13,
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                outline: 'none',
                fontFamily: 'var(--sans)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.background = 'var(--surface)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
            {isLoading ? 'Loading…' : `${total.toLocaleString()} client${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 140px 100px 32px',
          padding: '8px 16px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border-2)',
        }}>
          {['Client', 'Office', 'Phone', 'Status', ''].map((col, i) => (
            <span key={col + i} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col}</span>
          ))}
        </div>

        {/* Rows */}
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-2)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: 140, background: 'var(--border-2)', borderRadius: 3, marginBottom: 5 }} />
                  <div style={{ height: 11, width: 80, background: 'var(--border-2)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{debouncedSearch ? `No clients matching "${debouncedSearch}"` : 'No clients yet'}</p>
          </div>
        ) : (
          <div>
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 100px 32px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-2)', textDecoration: 'none', color: 'inherit', transition: 'background 100ms' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Client name + account */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--ink)', color: '#fff',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11.5, fontWeight: 600, flexShrink: 0,
                  }}>
                    {initials(c.displayName)}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{c.displayName}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>{c.accountNo}</p>
                  </div>
                </div>
                {/* Office */}
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.officeName}</p>
                {/* Phone */}
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>{c.mobileNo || '—'}</p>
                {/* Status badge */}
                <div><Badge label={c.status.value} variant={clientStatusVariant(c.status.id) as any} /></div>
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
