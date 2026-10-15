import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import { displayStatus, isClosedStatus } from '../../features/maintenance/maintenanceModel';

const value = (item: any, key: string) => item?.[key] ?? item?.[key[0].toUpperCase() + key.slice(1)];

export default function TenantMaintenanceScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [items, setItems] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setError('');
      setItems(tab === 'current' ? await MaintenanceAPI.getCurrent(true) : await MaintenanceAPI.getHistory(true));
    } catch (e: any) {
      setItems([]);
      setError(e?.detail || e?.message || 'Maintenance could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return <View style={styles.page}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>YOUR HOME</Text>
      <Text style={styles.heading}>Repairs & maintenance</Text>
      <Text style={styles.sub}>Report an issue, see who is handling it, and follow every update.</Text>
    </View>
    <TouchableOpacity accessibilityRole="button" style={styles.newButton} onPress={() => navigation.navigate('TenantMaintenanceIntake')}>
      <Text style={styles.newText}>+ Report an issue</Text>
    </TouchableOpacity>
    <View style={styles.tabs}>
      {(['current', 'history'] as const).map((name) => <TouchableOpacity key={name} style={[styles.tab, tab === name && styles.tabActive]} onPress={() => setTab(name)}>
        <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{name === 'current' ? 'Current' : 'History'}</Text>
      </TouchableOpacity>)}
    </View>
    {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#0b5cab" /> : <FlatList
      data={items}
      keyExtractor={(x, i) => String(value(x, 'id') ?? i)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      ListHeaderComponent={<View>
        {error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.retry}>Try again</Text></TouchableOpacity></View>}
        {items.length > 0 && <Text style={styles.listLabel}>{tab === 'current' ? 'OPEN REQUESTS' : 'PAST REQUESTS'}</Text>}
      </View>}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{tab === 'current' ? 'No open repairs' : 'No repair history'}</Text><Text style={styles.sub}>{tab === 'current' ? 'When something needs attention, start a structured report here.' : 'Completed and cancelled requests will appear here.'}</Text></View>}
      renderItem={({ item }) => {
        const status = value(item, 'status');
        return <TouchableOpacity style={styles.requestRow} onPress={() => navigation.navigate('TenantMaintenanceDetail', { requestId: String(value(item, 'id')), listItem: item })}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={2}>{value(item, 'title') || 'Maintenance request'}</Text>
            <Text style={[styles.status, isClosedStatus(status) && styles.statusClosed]}>{displayStatus(status)}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>{value(item, 'description')}</Text>
          <Text style={styles.meta}>{value(item, 'unitName') || value(item, 'location') || 'Your unit'}  ·  Tap for timeline</Text>
        </TouchableOpacity>;
      }}
    />}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#b7475a' },
  heading: { fontSize: 27, fontWeight: '800', color: '#102d43', marginTop: 5 },
  sub: { fontSize: 14, lineHeight: 20, color: '#60717e', marginTop: 5 },
  newButton: { marginHorizontal: 20, minHeight: 50, backgroundColor: '#0b5cab', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  newText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, borderBottomWidth: 1, borderBottomColor: '#e0e7eb' },
  tab: { minHeight: 48, marginRight: 28, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0b5cab' },
  tabText: { fontWeight: '700', color: '#60717e' },
  tabTextActive: { color: '#102d43', fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  listLabel: { paddingTop: 22, paddingBottom: 5, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#778794' },
  requestRow: { paddingVertical: 19 },
  divider: { height: 1, backgroundColor: '#e8edf0' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#173449' },
  status: { color: '#98620f', fontSize: 11, fontWeight: '800', paddingTop: 3 },
  statusClosed: { color: '#35734c' },
  description: { color: '#5e707c', lineHeight: 19, marginTop: 7 },
  meta: { fontSize: 12, color: '#778794', marginTop: 9, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 36 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#173449' },
  error: { backgroundColor: '#fff6f6', borderLeftWidth: 3, borderLeftColor: '#b7475a', padding: 12, marginTop: 16 },
  errorText: { color: '#8d2e3d' },
  retry: { color: '#0b5cab', fontWeight: '800', marginTop: 7 },
});
