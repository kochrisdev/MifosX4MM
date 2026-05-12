import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Phone, Calendar, ChevronRight, ShieldCheck, ShieldAlert, Clock } from 'lucide-react-native';
import { useClient } from '../../src/hooks/useClients';
import { useClientLoans } from '../../src/hooks/useLoans';
import { fmt } from '../../src/lib/format';
import type { FineractLoanAccount } from '@mifos-x/shared-types';

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Approved: '#6366f1',
  'Waiting for disbursement': '#f59e0b',
  Overpaid: '#0284c7',
  Closed: '#94a3b8',
};

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const navigation = useNavigation();
  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: loans, isLoading: loansLoading } = useClientLoans(clientId);

  useEffect(() => {
    if (client) navigation.setOptions({ title: client.displayName });
  }, [client]);

  if (clientLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#0284c7" />;
  }

  if (!client) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Client not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Client info card */}
      <View style={s.card}>
        <View style={s.avatarLarge}>
          <Text style={s.avatarText}>
            {client.firstname?.[0]}{client.lastname?.[0]}
          </Text>
        </View>
        <Text style={s.clientName}>{client.displayName}</Text>
        <Text style={s.accountNo}>Account #{client.accountNo}</Text>

        <View style={[s.statusBadge, { backgroundColor: client.active ? '#d1fae5' : '#fee2e2' }]}>
          <Text style={[s.statusText, { color: client.active ? '#065f46' : '#991b1b' }]}>
            {client.active ? 'Active' : 'Inactive'}
          </Text>
        </View>

        <View style={s.infoRows}>
          {client.mobileNo && (
            <InfoRow icon={<Phone size={14} color="#64748b" />} label={client.mobileNo} />
          )}
          {client.dateOfBirth && (
            <InfoRow icon={<Calendar size={14} color="#64748b" />} label={fmt.date(client.dateOfBirth)} />
          )}
          <InfoRow
            icon={<ShieldCheck size={14} color="#64748b" />}
            label={client.officeName}
          />
        </View>
      </View>

      {/* Loan accounts */}
      <Text style={s.sectionTitle}>Loan Accounts</Text>

      {loansLoading ? (
        <ActivityIndicator color="#0284c7" />
      ) : loans?.length === 0 ? (
        <Text style={s.empty}>No loan accounts</Text>
      ) : (
        loans?.map((loan) => <LoanRow key={loan.id} loan={loan} />)
      )}
    </ScrollView>
  );
}

function LoanRow({ loan }: { loan: FineractLoanAccount }) {
  const statusLabel = loan.status.value;
  const color = STATUS_COLORS[statusLabel] ?? '#94a3b8';
  const outstanding = loan.summary?.totalOutstanding ?? 0;

  return (
    <TouchableOpacity
      style={s.loanRow}
      onPress={() => router.push(`/loans/${loan.id}`)}
      activeOpacity={0.7}
    >
      <View style={s.loanBody}>
        <View style={s.loanHeader}>
          <Text style={s.loanProduct}>{loan.loanProductName}</Text>
          <View style={[s.loanBadge, { backgroundColor: color + '22' }]}>
            <Text style={[s.loanBadgeText, { color }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={s.loanAccount}>#{loan.accountNo}</Text>
        {outstanding > 0 && (
          <Text style={s.outstanding}>Outstanding: {fmt.mmk(outstanding)}</Text>
        )}
      </View>
      <ChevronRight size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={s.infoRow}>
      {icon}
      <Text style={s.infoLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#94a3b8' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  avatarLarge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#0284c7' },
  clientName: { fontSize: 20, fontWeight: '700', color: '#0c4a6e' },
  accountNo: { fontSize: 13, color: '#94a3b8', marginTop: 2, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 16 },
  statusText: { fontSize: 12, fontWeight: '600' },
  infoRows: { width: '100%', gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14, color: '#374151' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 16 },
  loanRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  loanBody: { flex: 1 },
  loanHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  loanProduct: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  loanBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  loanBadgeText: { fontSize: 11, fontWeight: '600' },
  loanAccount: { fontSize: 12, color: '#94a3b8' },
  outstanding: { fontSize: 13, color: '#ef4444', marginTop: 4, fontWeight: '500' },
});
