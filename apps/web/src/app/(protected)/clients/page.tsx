'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useClients } from '@/hooks/useClients';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import clsx from 'clsx';

type StatusVariant = 'green' | 'red' | 'gray';

function clientStatusVariant(statusId: number): StatusVariant {
  if (statusId === 300) return 'green';
  if (statusId === 100) return 'gray';
  if ([400, 600].includes(statusId)) return 'red';
  return 'gray';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function avatarColor(id: number) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
  ];
  return colors[id % colors.length];
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

  const clients = data?.pages.flatMap((p) => p.items) ?? [];
  const total   = data?.pages[0]?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)] bg-white font-sans"
          />
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition whitespace-nowrap font-display bg-[var(--gold)] hover:bg-[#b8890f] text-[#1b2030] font-semibold"
        >
          <UserPlus size={15} />
          New Client
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-sm text-[var(--text-2)] font-sans">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} client${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-3)] text-sm font-sans">
            {debouncedSearch ? `No clients matching "${debouncedSearch}"` : 'No clients yet'}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--page-bg)] transition-colors group"
              >
                {/* Avatar */}
                <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0', avatarColor(c.id))}>
                  {initials(c.displayName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-1)] font-sans truncate">{c.displayName}</p>
                  <p className="font-mono text-xs text-[var(--text-2)]">
                    {c.accountNo} · {c.officeName}
                  </p>
                </div>

                {/* Mobile */}
                {c.mobileNo && (
                  <p className="hidden sm:block text-sm text-[var(--text-2)] font-sans">{c.mobileNo}</p>
                )}

                {/* Status */}
                <Badge
                  label={c.status.value}
                  variant={clientStatusVariant(c.status.id)}
                />

                <ChevronRight size={15} className="text-[var(--text-3)] group-hover:text-[var(--gold)] transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full text-sm text-[var(--gold)] hover:text-[#b8890f] font-medium py-1 disabled:opacity-50 font-display transition"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
