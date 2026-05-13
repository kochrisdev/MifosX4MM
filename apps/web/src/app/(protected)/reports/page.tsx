'use client';

import { useQuery } from '@tanstack/react-query';
import { formatMMK, formatPercent } from '@/lib/format';
import { BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const REPORTING_URL = process.env.NEXT_PUBLIC_REPORTING_URL ?? 'http://localhost:3005';

interface ProductRow {
  productName: string;
  loanCount: number;
  outstanding: number;
  overdue: number;
  parRatio: number;
}

interface Disbursement {
  period: string;
  loanCount: number;
  amount: number;
}

function usePortfolioByProduct() {
  return useQuery<ProductRow[]>({
    queryKey: ['portfolio-by-product'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/portfolio/by-product`);
      return r.json();
    },
  });
}

function useDisbursements(granularity: 'month' | 'week') {
  return useQuery<Disbursement[]>({
    queryKey: ['disbursements', granularity],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/portfolio/disbursements?granularity=${granularity}`);
      return r.json();
    },
  });
}

function useKycBreakdown() {
  return useQuery<Record<string, number>>({
    queryKey: ['kyc-breakdown'],
    queryFn: async () => {
      const r = await fetch(`${REPORTING_URL}/reports/kyc/status-breakdown`);
      return r.json();
    },
  });
}

export default function ReportsPage() {
  const { data: products = [], isLoading: prodLoading } = usePortfolioByProduct();
  const { data: disbursements = [], isLoading: disbLoading } = useDisbursements('month');
  const { data: kyc, isLoading: kycLoading } = useKycBreakdown();

  const maxDisbAmt = Math.max(...disbursements.map((d) => d.amount), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Portfolio by product */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Portfolio by Product</h2>
        </div>
        {prodLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No loan products with active loans</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Loans</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-right">Overdue</th>
                  <th className="px-4 py-3 text-right">PAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => (
                  <tr key={p.productName} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.productName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.loanCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatMMK(p.outstanding)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatMMK(p.overdue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={clsx(
                        'font-semibold',
                        p.parRatio > 10 ? 'text-red-600' : p.parRatio > 5 ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        {formatPercent(p.parRatio)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Disbursements trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Disbursements (12 months)</h2>
          </div>
          {disbLoading ? (
            <div className="h-40 bg-gray-50 rounded animate-pulse" />
          ) : disbursements.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No disbursement data</div>
          ) : (
            <div className="space-y-2">
              {disbursements.slice(-12).map((d) => {
                const pct = (d.amount / maxDisbAmt) * 100;
                const label = new Date(d.period).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                return (
                  <div key={d.period} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-12 text-right">{label}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatMMK(d.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KYC breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">KYC Status Breakdown</h2>
          </div>
          {kycLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map((i) => <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(kyc ?? {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</span>
                  <span className="text-sm font-semibold text-gray-900">{(count as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
