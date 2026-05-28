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

function fmtDate(arr?: number[]) {
  if (!arr) return '—';
  const [y, m, d] = arr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: loans, isLoading: loansLoading } = useClientLoans(clientId);

  if (isLoading) return <PageSkeleton />;

  if (isError || !client) return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={13} /> Clients
      </Link>
      <div style={{ padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--r-btn)', fontSize: 13, color: 'var(--red)' }}>
        Client not found.
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Back link */}
      <Link href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={13} /> Clients
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Profile card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '24px 16px', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--teal)', color: '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 18, fontWeight: 700,
              margin: '0 auto 10px',
            }}>
              {client.displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>{client.displayName}</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>{client.accountNo}</p>
            <Badge label={client.status.value} variant={client.status.id === 300 ? 'ok' : 'draft'} />
          </div>

          {/* KYC card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <UserCheck size={13} style={{ color: 'var(--ink-3)' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>KYC Status</p>
            </div>
            <Badge label="Verified" variant="ok" />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Client details card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Client Details</h3>
            </div>
            <div style={{ padding: '4px 18px 8px' }}>
              {([
                { icon: <MapPin size={13} />, label: 'Branch / Office', value: client.officeName },
                client.mobileNo && { icon: <Phone size={13} />, label: 'Mobile', value: client.mobileNo },
                client.emailAddress && { icon: <Mail size={13} />, label: 'Email', value: client.emailAddress },
                client.gender && { icon: <UserCheck size={13} />, label: 'Gender', value: client.gender.value },
                client.dateOfBirth && { icon: <Calendar size={13} />, label: 'Date of Birth', value: fmtDate(client.dateOfBirth) },
                { icon: <Calendar size={13} />, label: 'Member Since', value: fmtDate(client.activationDate) },
              ] as Array<{ icon: React.ReactNode; label: string; value: string } | false>)
                .filter((row): row is { icon: React.ReactNode; label: string; value: string } => Boolean(row))
                .map((row) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
                    <span style={{ color: 'var(--ink-3)', marginTop: 1, flexShrink: 0 }}>{row.icon}</span>
                    <div>
                      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 2px' }}>{row.label}</p>
                      <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>{row.value}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Loan accounts card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Landmark size={14} style={{ color: 'var(--ink-3)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em', margin: 0 }}>Loan Accounts</h3>
              </div>
              <Link href={`/loans/new?clientId=${client.id}`} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--teal)', textDecoration: 'none' }}>
                + Apply for loan
              </Link>
            </div>

            {loansLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ height: 52, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 8 }} />
                ))}
              </div>
            ) : !loans || loans.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No loan accounts</p>
              </div>
            ) : (
              <div>
                {loans.map((loan: any) => (
                  <Link
                    key={loan.id}
                    href={`/loans/${loan.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--border-2)',
                      textDecoration: 'none', color: 'inherit',
                      borderLeft: loan.inArrears ? '3px solid var(--amber)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{loan.productName}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>{loan.accountNo}</p>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                        {loan.currency.displaySymbol} {formatMMK(loan.totalOutstanding)}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>outstanding</p>
                    </div>
                    {loanStatusBadge(loan.status.id)}
                    <ChevronRight size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
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
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ height: 14, width: 80, background: 'var(--border-2)', borderRadius: 3, marginBottom: 14 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', height: 180 }} />
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', height: 80 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', height: 200 }} />
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', height: 160 }} />
        </div>
      </div>
    </div>
  );
}
