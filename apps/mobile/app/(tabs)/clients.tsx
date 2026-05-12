import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, ListRenderItem,
} from 'react-native';
import { router } from 'expo-router';
import { Search, ChevronRight } from 'lucide-react-native';
import { useClients } from '../../src/hooks/useClients';
import type { FineractClient } from '@mifos-x/shared-types';

export default function ClientsTab() {
  const [search, setSearch] = useState('');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useClients(search);

  const clients = data?.pages.flatMap((p) => p.items) ?? [];

  const renderItem: ListRenderItem<FineractClient> = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={s.row}
        onPress={() => router.push(`/clients/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {item.firstname?.[0]}{item.lastname?.[0]}
          </Text>
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowName}>{item.displayName}</Text>
          <Text style={s.rowSub}>#{item.accountNo} · {item.officeName}</Text>
        </View>
        <ChevronRight size={16} color="#cbd5e1" />
      </TouchableOpacity>
    ),
    []
  );

  return (
    <View style={s.root}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Search size={16} color="#94a3b8" style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="words"
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color="#0284c7" /> : null
          }
          ListEmptyComponent={
            <Text style={s.empty}>No clients found</Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#111827' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, gap: 12,
  },
  divider: { height: 6 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#0284c7' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48 },
});
