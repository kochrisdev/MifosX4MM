'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useLoans } from '@/hooks/useLoans';
import { Badge, loanStatusBadge } from '@/components/ui/Badge';
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
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by account number…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} loan${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-50">
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
          <div className="py-16 text-center text-gray-400 text-sm">
            {debouncedSearch ? `No loans matching "${debouncedSearch}"` : 'No loans found'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {loans.map((loan) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{loan.clientName}</p>
                    {loan.inArrears && (
                      <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{loan.accountNo} · {loan.productName}</p>
                </div>

                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                  </p>
                  <p className="text-xs text-gray-400">outstanding</p>
                </div>

                {loanStatusBadge(loan.status.id)}

                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-400 transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

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
