import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import React, { useRef, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import { displayStatus, isClosedStatus } from '../../features/maintenance/maintenanceModel';
import { useAppTheme } from '../../theme/AppTheme';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const value = (item: any, key: string) => item?.[key] ?? item?.[key[0].toUpperCase() + key.slice(1)];

export default function TenantMaintenanceScreen() {
  const scrollRef = useRef<FlatList>(null);
  useTabScrollReset(scrollRef);
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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

  return <View style={[styles.page, dark && { backgroundColor: colors.background }]}>
    <LandlordPageHeader title="Maintenance" />
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, dark && { color: '#8cdda4' }]}>YOUR HOME</Text>
      <Text style={[styles.heading, dark && { color: colors.text }]}>Repairs & maintenance</Text>
      <Text style={[styles.sub, dark && { color: colors.muted }]}>Report an issue, see who is handling it, and follow every update.</Text>
    </View>
    <TouchableOpacity accessibilityRole="button" style={[styles.newButton, dark && { backgroundColor: '#357bd0' }]} onPress={() => navigation.navigate('TenantMaintenanceIntake')}>
      <Text style={styles.newText}>+ Report an issue</Text>
    </TouchableOpacity>
    <View style={[styles.tabs, dark && { borderBottomColor: colors.border }]}>
      {(['current', 'history'] as const).map((name) => <TouchableOpacity key={name} style={[styles.tab, tab === name && styles.tabActive, dark && tab === name && { borderBottomColor: colors.accent }]} onPress={() => setTab(name)}>
        <Text style={[styles.tabText, tab === name && styles.tabTextActive, dark && { color: tab === name ? colors.text : colors.muted }]}>{name === 'current' ? 'Current' : 'History'}</Text>
      </TouchableOpacity>)}
    </View>
    {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={dark ? colors.accent : '#0b5cab'} /> : <FlatList
      ref={scrollRef}
      data={items}
      keyExtractor={(x, i) => String(value(x, 'id') ?? i)}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={dark ? colors.accent : '#0b5cab'} onRefresh={() => { setRefreshing(true); load(); }} />}
      contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 24) + 100 }]}
      ItemSeparatorComponent={() => <View style={[styles.divider, dark && { backgroundColor: colors.border }]} />}
      ListHeaderComponent={<View>
        {error && <View style={[styles.error, dark && { backgroundColor: '#432630' }]}><Text style={[styles.errorText, dark && { color: '#ffb8c2' }]}>{error}</Text><TouchableOpacity onPress={load}><Text style={[styles.retry, dark && { color: colors.accent }]}>Try again</Text></TouchableOpacity></View>}
        {items.length > 0 && <Text style={[styles.listLabel, dark && { color: colors.muted }]}>{tab === 'current' ? 'OPEN REQUESTS' : 'PAST REQUESTS'}</Text>}
      </View>}
      ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyTitle, dark && { color: colors.text }]}>{tab === 'current' ? 'No open repairs' : 'No repair history'}</Text><Text style={[styles.sub, dark && { color: colors.muted }]}>{tab === 'current' ? 'When something needs attention, report it with the maintenance assistant.' : 'Completed and cancelled requests will appear here.'}</Text></View>}
      renderItem={({ item }) => {
        const status = value(item, 'status');
        return <TouchableOpacity style={styles.requestRow} onPress={() => navigation.navigate('TenantMaintenanceDetail', { requestId: String(value(item, 'id')), listItem: item })}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, dark && { color: colors.text }]} numberOfLines={2}>{value(item, 'title') || 'Maintenance request'}</Text>
            <Text style={[styles.status, isClosedStatus(status) && styles.statusClosed, dark && { color: isClosedStatus(status) ? '#8cdda4' : '#ffd28b' }]}>{displayStatus(status)}</Text>
          </View>
          <Text style={[styles.description, dark && { color: colors.muted }]} numberOfLines={2}>{value(item, 'description')}</Text>
          <Text style={[styles.meta, dark && { color: colors.muted }]}>{value(item, 'unitName') || value(item, 'location') || 'Your unit'}  ·  Tap for timeline</Text>
        </TouchableOpacity>;
      }}
    />}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#24733a' },
  heading: { fontSize: 27, fontWeight: '800', color: '#102d43', marginTop: 5 },
  sub: { fontSize: 14, lineHeight: 20, color: '#60717e', marginTop: 5 },
  newButton: { marginHorizontal: 20, minHeight: 50, backgroundColor: '#0b5cab', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  newText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, borderBottomWidth: 1, borderBottomColor: '#e0e7eb' },
  tab: { minHeight: 48, marginRight: 28, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0b5cab' },
  tabText: { fontWeight: '700', color: '#60717e' },
  tabTextActive: { color: '#102d43', fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 },
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
