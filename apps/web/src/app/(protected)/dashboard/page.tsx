'use client';

import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatMMK, formatNumber, formatPercent } from '@/lib/format';
import { Users, Landmark, AlertTriangle, Banknote, RefreshCw, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardStats();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          Failed to load stats: {(error as Error).message}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Active Clients"
          value={isLoading ? null : formatNumber(data?.activeClients ?? 0)}
          icon={<Users size={20} className="text-primary-600" />}
          iconBg="bg-primary-50"
          href="/clients"
        />
        <StatCard
          label="Active Loans"
          value={isLoading ? null : formatNumber(data?.activeLoans ?? 0)}
          icon={<Landmark size={20} className="text-indigo-600" />}
          iconBg="bg-indigo-50"
          href="/loans"
        />
        <StatCard
          label="Portfolio at Risk (PAR30)"
          value={isLoading ? null : formatPercent(data?.parRatio ?? 0)}
          icon={<AlertTriangle size={20} className={clsx(
            !isLoading && (data?.parRatio ?? 0) > 5 ? 'text-red-500' : 'text-amber-500'
          )} />}
          iconBg={clsx(!isLoading && (data?.parRatio ?? 0) > 5 ? 'bg-red-50' : 'bg-amber-50')}
          valueClass={clsx(
            !isLoading && (data?.parRatio ?? 0) > 5 ? 'text-red-600'
              : !isLoading && (data?.parRatio ?? 0) > 2 ? 'text-amber-600'
              : 'text-gray-900'
          )}
          subtext={isLoading ? undefined : `PAR0: ${formatPercent(data?.par0 ?? 0)}  ·  PAR90: ${formatPercent(data?.par90 ?? 0)}`}
          href="/reports"
        />
        <StatCard
          label="Collections Today"
          value={isLoading ? null : formatMMK(data?.collectionsToday ?? 0)}
          icon={<Banknote size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          subtext={isLoading ? undefined : `${formatPercent(data?.collectionRate ?? 0)} collection rate`}
          href="/collections"
        />
      </div>

      {/* Portfolio overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-700">Portfolio Overview</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total Outstanding', value: isLoading ? null : formatMMK(data?.totalOutstanding ?? 0), color: 'text-gray-900' },
              { label: 'Total Overdue',     value: isLoading ? null : formatMMK(data?.totalOverdue ?? 0),     color: 'text-red-600'  },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                {isLoading
                  ? <div className="h-5 w-28 bg-gray-100 rounded animate-pulse" />
                  : <span className={clsx('text-sm font-semibold', color)}>{value}</span>
                }
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Client',       href: '/clients/new',    color: 'bg-primary-50 text-primary-700 hover:bg-primary-100' },
              { label: 'View Collections', href: '/collections',    color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
              { label: 'Overdue Loans',    href: '/collections',    color: 'bg-red-50 text-red-700 hover:bg-red-100' },
              { label: 'Reports',          href: '/reports',        color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
            ].map(({ label, href, color }) => (
              <Link
                key={label}
                href={href}
                className={clsx('flex items-center justify-center px-3 py-3 rounded-lg text-sm font-medium transition-colors', color)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  iconBg: string;
  valueClass?: string;
  subtext?: string;
  href?: string;
}

function StatCard({ label, value, icon, iconBg, valueClass, subtext, href }: StatCardProps) {
  const isLoading = value === null;
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={clsx('p-2 rounded-lg', iconBg)}>{icon}</span>
      </div>
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-28 bg-gray-100 rounded-md" />
          <div className="h-4 w-20 bg-gray-100 rounded-md" />
        </div>
      ) : (
        <div>
          <p className={clsx('text-3xl font-semibold tracking-tight', valueClass ?? 'text-gray-900')}>{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
