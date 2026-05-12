import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { api } from '../../src/lib/api';
import { fmt } from '../../src/lib/format';
import type { ApiResponse } from '@mifos-x/shared-types';

interface OverdueLoan {
  loanId: number;
  accountNo: string;
  clientName: string;
  totalOverdue: number;
  currency: string;
}

function useOverdueLoans() {
  return useQuery<OverdueLoan[]>({
    queryKey: ['collections', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OverdueLoan[]>>(
        `${process.env.EXPO_PUBLIC_REPORTING_URL ?? 'http://localhost:3005'}/reports/collections/overdue`,
        { params: { days_overdue: 1 } }
      );
      return data.data ?? [];
    },
    refetchInterval: 120_000,
  });
}

export default function CollectionsTab() {
  const { data: loans, isLoading, refetch, isRefetching } = useOverdueLoans();

  const totalOverdue = loans?.reduce((sum, l) => sum + l.totalOverdue, 0) ?? 0;

  return (
    <View style={s.root}>
      {/* Summary banner */}
      <View style={s.banner}>
        <Text style={s.bannerLabel}>Total Overdue</Text>
        <Text style={s.bannerValue}>{fmt.mmk(totalOverdue)}</Text>
        <Text style={s.bannerSub}>{loans?.length ?? 0} accounts</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => String(item.loanId)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push(`/loans/${item.loanId}`)}
              activeOpacity={0.7}
            >
              <AlertCircle size={20} color="#f59e0b" />
              <View style={s.rowBody}>
                <Text style={s.rowName}>{item.clientName}</Text>
                <Text style={s.rowSub}>#{item.accountNo}</Text>
              </View>
              <View style={s.rowRight}>
                <Text style={s.amount}>{fmt.mmk(item.totalOverdue)}</Text>
                <ChevronRight size={14} color="#cbd5e1" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <CheckCircle size={40} color="#10b981" />
              <Text style={s.emptyText}>No overdue accounts</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  banner: { backgroundColor: '#0c4a6e', padding: 20, paddingTop: 28 },
  bannerLabel: { color: '#7dd3fc', fontSize: 12, marginBottom: 4 },
  bannerValue: { color: '#fff', fontSize: 28, fontWeight: '700' },
  bannerSub: { color: '#93c5fd', fontSize: 12, marginTop: 4 },
  list: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, gap: 12,
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amount: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  emptyWrap: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: { color: '#64748b', fontSize: 15 },
});
