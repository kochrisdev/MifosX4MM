'use client';

import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatMMK, formatNumber, formatPercent } from '@/lib/format';
import { Users, Landmark, AlertTriangle, Banknote, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardStats();

  return (
    <main className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
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
        />

        <StatCard
          label="Active Loans"
          value={isLoading ? null : formatNumber(data?.activeLoans ?? 0)}
          icon={<Landmark size={20} className="text-indigo-600" />}
          iconBg="bg-indigo-50"
        />

        <StatCard
          label="Portfolio at Risk"
          value={isLoading ? null : formatPercent(data?.parRatio ?? 0)}
          icon={<AlertTriangle size={20} className={clsx(
            !isLoading && (data?.parRatio ?? 0) > 5 ? 'text-red-500' : 'text-amber-500'
          )} />}
          iconBg={clsx(!isLoading && (data?.parRatio ?? 0) > 5 ? 'bg-red-50' : 'bg-amber-50')}
          valueClass={clsx(
            !isLoading && (data?.parRatio ?? 0) > 5
              ? 'text-red-600'
              : !isLoading && (data?.parRatio ?? 0) > 2
              ? 'text-amber-600'
              : 'text-gray-900'
          )}
          subtext={isLoading ? undefined : `PAR30 · PAR0: ${formatPercent(data?.par0 ?? 0)}`}
        />

        <StatCard
          label="Collections Today"
          value={isLoading ? null : formatMMK(data?.collectionsToday ?? 0)}
          icon={<Banknote size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          subtext={
            isLoading
              ? undefined
              : `${formatPercent(data?.collectionRate ?? 0)} collection rate`
          }
        />
      </div>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  iconBg: string;
  valueClass?: string;
  subtext?: string;
}

function StatCard({ label, value, icon, iconBg, valueClass, subtext }: StatCardProps) {
  const isLoading = value === null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
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
          <p className={clsx('text-3xl font-semibold tracking-tight', valueClass ?? 'text-gray-900')}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
      )}
    </div>
  );
}
