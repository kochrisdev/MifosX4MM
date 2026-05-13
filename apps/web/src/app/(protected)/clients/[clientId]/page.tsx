'use client';

import { use } from 'react';
import Link from 'next/link';
import { useClient, useClientLoans } from '@/hooks/useClients';
import { Badge, loanStatusBadge } from '@/components/ui/Badge';
import { formatMMK } from '@/lib/format';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar,
  Landmark, ChevronRight, UserCheck,
} from 'lucide-react';
import clsx from 'clsx';

function fmtDate(arr?: number[]) {
  if (!arr) return '—';
  const [y, m, d] = arr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: loans, isLoading: loansLoading } = useClientLoans(clientId);

  if (isLoading) return <PageSkeleton />;
  if (isError || !client) return (
    <div className="max-w-3xl mx-auto">
      <Link href="/clients" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Clients
      </Link>
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        Client not found.
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/clients" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Clients
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col: profile card */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
              {client.displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{client.displayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{client.accountNo}</p>
            <div className="mt-3">
              <Badge
                label={client.status.value}
                variant={client.status.id === 300 ? 'green' : 'gray'}
              />
            </div>
          </div>

          {/* KYC status placeholder */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={15} className="text-gray-400" />
              <p className="text-sm font-medium text-gray-700">KYC Status</p>
            </div>
            <Badge label="Verified" variant="green" />
          </div>
        </div>

        {/* Right col: details + loans */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact & details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Client Details</h3>
            <div>
              <InfoRow icon={<MapPin size={14} />}  label="Branch / Office" value={client.officeName} />
              {client.mobileNo     && <InfoRow icon={<Phone size={14} />}    label="Mobile"      value={client.mobileNo} />}
              {client.emailAddress && <InfoRow icon={<Mail size={14} />}     label="Email"       value={client.emailAddress} />}
              {client.gender       && <InfoRow icon={<UserCheck size={14} />} label="Gender"     value={client.gender.value} />}
              {client.dateOfBirth  && <InfoRow icon={<Calendar size={14} />}  label="Date of Birth" value={fmtDate(client.dateOfBirth)} />}
              <InfoRow icon={<Calendar size={14} />} label="Member Since" value={fmtDate(client.activationDate)} />
            </div>
          </div>

          {/* Loan accounts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark size={15} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Loan Accounts</h3>
              </div>
              <Link
                href={`/loans/new?clientId=${client.id}`}
                className="text-xs text-primary-600 font-medium hover:underline"
              >
                + New Loan
              </Link>
            </div>

            {loansLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
              </div>
            ) : !loans || loans.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No loan accounts</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {loans.map((loan) => (
                  <Link
                    key={loan.id}
                    href={`/loans/${loan.id}`}
                    className={clsx(
                      'flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group',
                      loan.inArrears && 'border-l-4 border-red-400'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{loan.productName}</p>
                      <p className="text-xs text-gray-400">{loan.accountNo}</p>
                    </div>
                    <div className="text-right mr-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                      </p>
                      <p className="text-xs text-gray-400">outstanding</p>
                    </div>
                    {loanStatusBadge(loan.status.id)}
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
      <div className="h-5 w-28 bg-gray-100 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-48" />
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5 h-48" />
          <div className="bg-white rounded-xl border border-gray-100 p-5 h-40" />
        </div>
      </div>
    </div>
  );
}
