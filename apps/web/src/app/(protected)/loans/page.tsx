'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useLoans } from '@/hooks/useLoans';
import { loanStatusBadge } from '@/components/ui/Badge';
import { formatMMK } from '@/lib/format';
import { Search, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

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
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Search by account number…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)] bg-white font-sans"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <p className="text-sm text-[var(--text-2)] font-sans">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} loan${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : loans.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-3)] text-sm font-sans">
            {debouncedSearch ? `No loans matching "${debouncedSearch}"` : 'No loans found'}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {loans.map((loan) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                className={clsx(
                  'flex items-center gap-4 px-5 py-4 hover:bg-[var(--page-bg)] transition-colors group',
                  loan.inArrears && 'border-l-2 border-[var(--danger)]'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-1)] font-sans truncate">{loan.clientName}</p>
                  <p className="font-mono text-xs text-[var(--text-2)]">{loan.accountNo} · {loan.productName}</p>
                </div>

                <div className="hidden sm:block text-right">
                  <p className="font-mono text-sm font-semibold text-[var(--text-1)]">
                    {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                  </p>
                  <p className="text-xs text-[var(--text-2)] font-sans">outstanding</p>
                </div>

                {loanStatusBadge(loan.status.id)}

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
