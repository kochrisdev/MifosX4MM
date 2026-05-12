import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { fmt } from '../../src/lib/format';
import { useAuth } from '../../src/context/AuthContext';
import type { ApiResponse, DashboardStats } from '@mifos-x/shared-types';

function useLoanOfficerStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
      return data.data!;
    },
    refetchInterval: 60_000,
  });
}

export default function HomeTab() {
  const { user, logout } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useLoanOfficerStats();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Greeting */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting()},</Text>
          <Text style={s.name}>{user?.username ?? '—'}</Text>
        </View>
        <Text onPress={logout} style={s.logout}>Sign out</Text>
      </View>

      {/* Date */}
      <Text style={s.today}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>

      {/* Stat cards */}
      <View style={s.cards}>
        <StatCard label="Active Clients" value={isLoading ? null : fmt.number(data?.activeClients ?? 0)} accent="#0284c7" />
        <StatCard label="Active Loans" value={isLoading ? null : fmt.number(data?.activeLoans ?? 0)} accent="#6366f1" />
      </View>
      <View style={s.cards}>
        <StatCard
          label="Portfolio at Risk"
          value={isLoading ? null : fmt.percent(data?.parRatio ?? 0)}
          accent={(data?.parRatio ?? 0) > 5 ? '#ef4444' : (data?.parRatio ?? 0) > 2 ? '#f59e0b' : '#10b981'}
        />
        <StatCard
          label="Collected Today"
          value={isLoading ? null : fmt.mmk(data?.collectionsToday ?? 0)}
          accent="#10b981"
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | null; accent: string }) {
  return (
    <View style={[s.card, { borderTopColor: accent }]}>
      <Text style={s.cardLabel}>{label}</Text>
      {value === null
        ? <View style={s.skeleton} />
        : <Text style={[s.cardValue, { color: accent }]}>{value}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  greeting: { fontSize: 14, color: '#64748b' },
  name: { fontSize: 22, fontWeight: '700', color: '#0c4a6e', marginTop: 2 },
  logout: { fontSize: 13, color: '#94a3b8', paddingTop: 4 },
  today: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  cards: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 8, elevation: 2,
  },
  cardLabel: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  cardValue: { fontSize: 22, fontWeight: '700' },
  skeleton: { height: 28, width: '70%', backgroundColor: '#f1f5f9', borderRadius: 6 },
});
