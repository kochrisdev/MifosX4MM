'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
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
    <div className="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <span className="mt-0.5 text-[var(--text-3)]">{icon}</span>
      <div>
        <p className="text-xs text-[var(--text-2)] font-sans">{label}</p>
        <p className="text-sm text-[var(--text-1)] font-sans">{value}</p>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: loans, isLoading: loansLoading } = useClientLoans(clientId);

  if (isLoading) return <PageSkeleton />;
  if (isError || !client) return (
    <div className="max-w-3xl mx-auto">
      <Link href="/clients" className="flex items-center gap-1 text-[var(--text-2)] hover:text-[var(--text-1)] font-sans text-sm mb-4">
        <ArrowLeft size={14} /> Back to Clients
      </Link>
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        Client not found.
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/clients" className="flex items-center gap-1 text-[var(--text-2)] hover:text-[var(--text-1)] font-sans text-sm">
        <ArrowLeft size={14} /> Back to Clients
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col: profile card */}
        <div className="space-y-5">
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--sidebar)] flex items-center justify-center text-white text-lg font-bold font-mono mx-auto mb-3">
              {client.displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <h2 className="font-display font-semibold text-lg text-[var(--text-1)]">{client.displayName}</h2>
            <p className="font-mono text-xs text-[var(--text-2)] mt-0.5">{client.accountNo}</p>
            <div className="mt-3">
              <Badge
                label={client.status.value}
                variant={client.status.id === 300 ? 'green' : 'gray'}
              />
            </div>
          </div>

          {/* KYC status */}
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={15} className="text-[var(--text-3)]" />
              <p className="font-display text-sm font-medium text-[var(--text-1)]">KYC Status</p>
            </div>
            <Badge label="Verified" variant="green" />
          </div>
        </div>

        {/* Right col: details + loans */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact & details */}
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-[var(--text-1)] mb-3">Client Details</h3>
            <div>
              <InfoRow icon={<MapPin size={14} />}    label="Branch / Office"  value={client.officeName} />
              {client.mobileNo     && <InfoRow icon={<Phone size={14} />}      label="Mobile"           value={client.mobileNo} />}
              {client.emailAddress && <InfoRow icon={<Mail size={14} />}       label="Email"            value={client.emailAddress} />}
              {client.gender       && <InfoRow icon={<UserCheck size={14} />}  label="Gender"           value={client.gender.value} />}
              {client.dateOfBirth  && <InfoRow icon={<Calendar size={14} />}   label="Date of Birth"    value={fmtDate(client.dateOfBirth)} />}
              <InfoRow icon={<Calendar size={14} />} label="Member Since" value={fmtDate(client.activationDate)} />
            </div>
          </div>

          {/* Loan accounts */}
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark size={15} className="text-[var(--text-3)]" />
                <h3 className="font-display font-semibold text-sm text-[var(--text-1)]">Loan Accounts</h3>
              </div>
              <Link
                href={`/loans/new?clientId=${client.id}`}
                className="text-xs text-[var(--gold)] font-display hover:underline"
              >
                + New Loan
              </Link>
            </div>

            {loansLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-14 bg-[var(--page-bg)] rounded-lg animate-pulse" />)}
              </div>
            ) : !loans || loans.length === 0 ? (
              <div className="py-10 text-center text-[var(--text-3)] text-sm font-sans">No loan accounts</div>
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
                      <p className="font-sans text-sm font-medium text-[var(--text-1)]">{loan.productName}</p>
                      <p className="font-mono text-xs text-[var(--text-2)]">{loan.accountNo}</p>
                    </div>
                    <div className="text-right mr-3">
                      <p className="font-mono text-sm font-semibold text-[var(--text-1)]">
                        {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                      </p>
                      <p className="text-xs text-[var(--text-2)] font-sans">outstanding</p>
                    </div>
                    {loanStatusBadge(loan.status.id)}
                    <ChevronRight size={14} className="text-[var(--text-3)] group-hover:text-[var(--gold)] flex-shrink-0" />
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
      <div className="h-5 w-28 bg-[var(--border)] rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 h-48" />
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-[var(--border)] p-5 h-48" />
          <div className="bg-white rounded-xl border border-[var(--border)] p-5 h-40" />
        </div>
      </div>
    </div>
  );
}
