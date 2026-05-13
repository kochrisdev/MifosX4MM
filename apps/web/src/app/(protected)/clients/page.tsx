'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useClients } from '@/hooks/useClients';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import clsx from 'clsx';

function clientStatusVariant(statusId: number) {
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

  const clients = data?.pages.flatMap((p) => p.pageItems) ?? [];
  const total   = data?.pages[0]?.totalFilteredRecords ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition whitespace-nowrap"
        >
          <UserPlus size={15} />
          New Client
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} client${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-50">
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
          <div className="py-16 text-center text-gray-400 text-sm">
            {debouncedSearch ? `No clients matching "${debouncedSearch}"` : 'No clients yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                {/* Avatar */}
                <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0', avatarColor(c.id))}>
                  {initials(c.displayName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.displayName}</p>
                  <p className="text-xs text-gray-400">
                    {c.accountNo} · {c.officeName}
                  </p>
                </div>

                {/* Mobile */}
                {c.mobileNo && (
                  <p className="hidden sm:block text-sm text-gray-500">{c.mobileNo}</p>
                )}

                {/* Status */}
                <Badge
                  label={c.status.value}
                  variant={clientStatusVariant(c.status.id) as any}
                />

                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-400 transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium py-1 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
