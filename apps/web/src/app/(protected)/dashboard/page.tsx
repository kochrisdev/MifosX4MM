'use client';

import { useState, useEffect } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatMMK, formatNumber, formatPercent } from '@/lib/format';
import { RefreshCw, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardStats();
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }));
  }, []);

  const parRatio = data?.parRatio ?? 0;
  const parValueClass = !isLoading && parRatio > 5
    ? 'text-[var(--danger)]'
    : !isLoading && parRatio > 2
      ? 'text-[var(--warning)]'
      : 'text-[var(--text-1)]';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-[var(--text-2)] font-sans">{today}</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-[var(--text-2)] hover:text-[var(--gold)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
          Failed to load stats: {(error as Error).message}
        </div>
      )}

      {/* Row 1 — Inline stat strip */}
      <div className="bg-white border border-[var(--border)] rounded-xl px-6 py-5">
        <div className="flex divide-x divide-[var(--border)]">

          {/* Active Loans */}
          <Link href="/loans" className="flex-1 flex flex-col gap-1 px-6 first:pl-0 last:pr-0 hover:opacity-80 transition-opacity">
            <span className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wide font-display">
              Active Loans
            </span>
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <span className="text-2xl font-semibold text-[var(--text-1)] font-mono mt-1">
                {formatNumber(data?.activeLoans ?? 0)}
              </span>
            )}
          </Link>

          {/* Active Clients */}
          <Link href="/clients" className="flex-1 flex flex-col gap-1 px-6 first:pl-0 last:pr-0 hover:opacity-80 transition-opacity">
            <span className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wide font-display">
              Active Clients
            </span>
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <span className="text-2xl font-semibold text-[var(--text-1)] font-mono mt-1">
                {formatNumber(data?.activeClients ?? 0)}
              </span>
            )}
          </Link>

          {/* PAR30 */}
          <Link href="/reports" className="flex-1 flex flex-col gap-1 px-6 first:pl-0 last:pr-0 hover:opacity-80 transition-opacity">
            <span className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wide font-display">
              PAR30
            </span>
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <span className={clsx('text-2xl font-semibold font-mono mt-1', parValueClass)}>
                {formatPercent(parRatio)}
              </span>
            )}
            {!isLoading && (
              <span className="text-xs text-[var(--text-3)] font-sans">
                PAR0: {formatPercent(data?.par0 ?? 0)} · PAR90: {formatPercent(data?.par90 ?? 0)}
              </span>
            )}
          </Link>

          {/* Collections Today */}
          <Link href="/collections" className="flex-1 flex flex-col gap-1 px-6 first:pl-0 last:pr-0 hover:opacity-80 transition-opacity">
            <span className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wide font-display">
              Collections Today
            </span>
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <span className="text-2xl font-semibold text-[var(--text-1)] font-mono mt-1">
                {formatMMK(data?.collectionsToday ?? 0)}
              </span>
            )}
            {!isLoading && (
              <span className="text-xs text-[var(--text-3)] font-sans">
                {formatPercent(data?.collectionRate ?? 0)} collection rate
              </span>
            )}
          </Link>

        </div>
      </div>

      {/* Row 2 — 2/3 + 1/3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">

        {/* Left: Portfolio Outstanding (col-span-2) */}
        <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-5">
          <h2 className="font-display font-semibold text-sm text-[var(--text-1)] mb-4">
            Portfolio Outstanding
          </h2>
          <div>
            {[
              {
                label: 'Total Outstanding',
                value: isLoading ? null : formatMMK(data?.totalOutstanding ?? 0),
                valueClass: 'text-[var(--text-1)]',
              },
              {
                label: 'Total Overdue',
                value: isLoading ? null : formatMMK(data?.totalOverdue ?? 0),
                valueClass: 'text-[var(--danger)]',
              },
            ].map(({ label, value, valueClass }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0"
              >
                <span className="text-sm text-[var(--text-2)] font-sans">{label}</span>
                {isLoading ? (
                  <div className="h-5 w-28 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <span className={clsx('font-mono text-sm font-semibold', valueClass)}>{value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Today's Actions (col-span-1) */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <h2 className="font-display font-semibold text-sm text-[var(--text-1)] mb-4">
            Today&apos;s Actions
          </h2>
          <div>
            {[
              { label: 'New Client',       href: '/clients/new' },
              { label: 'View Collections', href: '/collections' },
              { label: 'Overdue Loans',    href: '/collections' },
              { label: 'Reports',          href: '/reports' },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 group"
              >
                <span className="text-sm text-[var(--text-1)] font-sans">{label}</span>
                <ChevronRight
                  size={13}
                  className="text-[var(--text-3)] group-hover:text-[var(--gold)] transition-colors"
                />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
