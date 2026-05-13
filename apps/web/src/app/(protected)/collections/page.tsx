'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatMMK } from '@/lib/format';
import { AlertTriangle, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import clsx from 'clsx';

interface OverdueLoan {
  loanId: number;
  accountNo: string;
  clientName: string;
  mobileNo: string;
  currency: string;
  oldestOverdueDate: string;
  daysOverdue: number;
  totalOverdue: number;
}

interface CollectionsToday {
  scheduled: number;
  collected: number;
  collectionRate: number;
}

const REPORTING_URL = process.env.NEXT_PUBLIC_REPORTING_URL ?? 'http://localhost:3005';

function useCollectionsToday() {
  return useQuery<CollectionsToday>({
    queryKey: ['collections-today'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/collections/today`);
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

function useOverdueLoans(daysOverdue: number) {
  return useQuery<OverdueLoan[]>({
    queryKey: ['overdue-loans', daysOverdue],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/collections/overdue?days_overdue=${daysOverdue}&limit=100`);
      return r.json();
    },
  });
}

function daysOverdueBadge(days: number) {
  if (days >= 90) return <Badge label={`${days}d`} variant="red" />;
  if (days >= 30) return <Badge label={`${days}d`} variant="amber" />;
  return <Badge label={`${days}d`} variant="gray" />;
}

export default function CollectionsPage() {
  const [filter, setFilter] = useState(1);
  const [search, setSearch] = useState('');
  const { data: today, isLoading: todayLoading } = useCollectionsToday();
  const { data: overdue = [], isLoading: overdueLoading } = useOverdueLoans(filter);

  const filtered = search
    ? overdue.filter((l) =>
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.accountNo.includes(search)
      )
    : overdue;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Today's summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Scheduled Today',
            value: todayLoading ? null : formatMMK(today?.scheduled ?? 0),
            color: 'text-gray-900',
          },
          {
            label: 'Collected Today',
            value: todayLoading ? null : formatMMK(today?.collected ?? 0),
            color: 'text-emerald-600',
          },
          {
            label: 'Collection Rate',
            value: todayLoading ? null : `${today?.collectionRate ?? 0}%`,
            color: (today?.collectionRate ?? 0) < 80 ? 'text-red-600' : 'text-emerald-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            {todayLoading ? (
              <div className="h-7 w-28 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className={clsx('text-2xl font-semibold', color)}>{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Overdue table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-700">Overdue Loans</h3>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            {/* Days filter */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {[1, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className={clsx(
                    'px-3 py-1.5 font-medium transition',
                    filter === d
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {d === 1 ? 'All' : `${d}+ days`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {overdueLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 h-4 bg-gray-100 rounded" />
                <div className="h-4 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No overdue loans {filter > 1 ? `past ${filter} days` : ''}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Mobile</th>
                  <th className="px-4 py-3 text-center">Oldest Due</th>
                  <th className="px-4 py-3 text-center">Days Overdue</th>
                  <th className="px-4 py-3 text-right">Overdue Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((loan) => (
                  <tr key={loan.loanId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{loan.clientName}</td>
                    <td className="px-4 py-3 text-gray-500">{loan.accountNo}</td>
                    <td className="px-4 py-3 text-gray-500">{loan.mobileNo || '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {new Date(loan.oldestOverdueDate).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">{daysOverdueBadge(loan.daysOverdue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatMMK(loan.totalOverdue)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/loans/${loan.loanId}`}
                        className="flex items-center justify-end text-gray-300 hover:text-primary-600 transition"
                      >
                        <ChevronRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
