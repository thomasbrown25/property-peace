import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import React, { useRef, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { displayStatus, isClosedStatus } from '../../features/maintenance/maintenanceModel';
import { useAppTheme } from '../../theme/AppTheme';

import { forProperty } from '../../features/maintenance/propertyMaintenanceScope';

export default function MaintenanceScreen() {
  const scrollRef = useRef<FlatList>(null);
  useTabScrollReset(scrollRef);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const propertyId: string | undefined = route.params?.propertyId;
  const propertyName: string | undefined = route.params?.propertyName;
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setError('');
      const data = await MaintenanceAPI.getAll();
      setRequests(forProperty(data || [], propertyId));
    } catch (loadError: any) {
      setRequests([]);
      setError(loadError?.detail || loadError?.message || 'Maintenance requests could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void loadRequests();
    void PropertyAPI.getProperties().then((items) => setProperties(items ?? [])).catch(() => setProperties([]));
  }, [loadRequests]));

  const overview = useMemo(() => {
    const open = requests.filter((request) => !isClosedStatus(request.status ?? request.Status));
    const reported = open.filter((request) => ['reported', '0'].includes(String(request.status ?? request.Status ?? 'Reported').toLowerCase())).length;
    return { open: open.length, reported, inWorkflow: open.length - reported, closed: requests.length - open.length, total: requests.length };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const inTab = requests.filter((request) => isClosedStatus(request.status ?? request.Status) === (view === 'history'));
    const search = query.trim().toLowerCase();
    if (!search) return inTab;
    return inTab.filter((request) => {
      const id = request.id ?? request.Id;
      const property = properties.find((item) => String(item.id ?? item.Id) === String(request.propertyId ?? request.PropertyId));
      const fields = [id, id != null ? `MR-${id}` : null, request.orderNumber ?? request.OrderNumber,
        request.propertyName ?? request.PropertyName, request.property?.name ?? request.Property?.Name,
        property?.name ?? property?.Name, property?.streetAddress ?? property?.StreetAddress,
        property?.address ?? property?.Address,
        propertyId && String(request.propertyId ?? request.PropertyId) === String(propertyId) ? propertyName : null];
      return fields.some((field) => field != null && String(field).toLowerCase().includes(search));
    });
  }, [requests, query, properties, propertyId, propertyName, view]);

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, dark && { color: colors.text }]} accessibilityRole="header">Maintenance</Text>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.accent }]} hitSlop={{ top: 5, bottom: 5 }} onPress={() => { setView('current'); navigation.navigate('AddMaintenanceRequest', propertyId ? { propertyId } : undefined); }} accessibilityRole="button" accessibilityLabel="Add maintenance request">
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addText}>Request</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.pageSubtitle, dark && { color: colors.muted }]}>{propertyId ? propertyName || 'This property' : 'Keep repairs moving, from report to resolution.'}</Text>
      </View>
      {!loading && !error && <View style={[styles.maintenanceOverview, dark && { borderColor: colors.border }]}>
        <Text style={[styles.overviewEyebrow, dark && { color: colors.accent }]}>MAINTENANCE OVERVIEW</Text>
        <View style={styles.overviewTop}>
          <View>
            <Text style={[styles.overviewValue, dark && { color: colors.text }]}>{overview.open}</Text>
            <Text style={[styles.overviewLabel, dark && { color: colors.muted }]}>Open requests</Text>
          </View>
          <Text style={[styles.overviewContext, dark && { color: colors.muted }]}>{overview.open} of {overview.total} requests open</Text>
        </View>
        <View style={[styles.overviewStats, dark && { borderTopColor: colors.border }]}>
          <View style={styles.overviewStat}><Text style={[styles.overviewStatValue, dark && { color: colors.text }]}>{overview.reported}</Text><Text style={[styles.overviewStatLabel, dark && { color: colors.muted }]}>Reported</Text></View>
          <View style={styles.overviewStat}><Text style={[styles.overviewStatValue, dark && { color: colors.text }]}>{overview.inWorkflow}</Text><Text style={[styles.overviewStatLabel, dark && { color: colors.muted }]}>In workflow</Text></View>
          <View style={styles.overviewStat}><Text style={[styles.overviewStatValue, dark && { color: colors.text }]}>{overview.closed}</Text><Text style={[styles.overviewStatLabel, dark && { color: colors.muted }]}>Closed</Text></View>
        </View>
      </View>}
      <View style={[styles.search, dark && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Ionicons name="search" size={19} color={dark ? colors.muted : '#64748b'} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search maintenance ID or property" placeholderTextColor={dark ? colors.muted : '#94a3b8'} style={[styles.searchInput, dark && { color: colors.text }]} returnKeyType="search" accessibilityLabel="Search maintenance ID or property" />
        {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={dark ? colors.muted : '#94a3b8'} /></TouchableOpacity>}
      </View>
      <View style={[styles.tabs, dark && { borderBottomColor: colors.border }]} accessibilityRole="tablist">
        {(['current', 'history'] as const).map((tab) => <TouchableOpacity key={tab} style={[styles.tab, view === tab && styles.tabActive, dark && view === tab && { borderBottomColor: colors.accent }]} onPress={() => setView(tab)} accessibilityRole="tab" accessibilityState={{ selected: view === tab }}><Text style={[styles.tabText, view === tab && styles.tabTextActive, dark && { color: view === tab ? colors.text : colors.muted }]}>{tab === 'current' ? 'Open' : 'Closed'}</Text></TouchableOpacity>)}
      </View>
      {loading ? <View style={[styles.centerContainer, dark && { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={dark ? colors.accent : '#1976d2'} /></View> : <FlatList
        ref={scrollRef}
        data={visibleRequests}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={[styles.listContent, { paddingTop: 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} tintColor={dark ? colors.accent : undefined} />}
        ListHeaderComponent={<View>
          {error ? <View style={styles.error} accessibilityRole="alert"><Text style={[styles.errorText, dark && { color: colors.text }]}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); loadRequests(); }} accessibilityRole="button"><Text style={[styles.retryText, dark && { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
          {!error && <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">{view === 'current' ? 'Open requests' : 'Closed requests'}</Text>
            <Text style={[styles.count, dark && { color: colors.muted }]}>{visibleRequests.length}</Text>
          </View>}
        </View>}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        ListEmptyComponent={!error ? <View style={styles.emptyContainer}><Ionicons name="construct-outline" size={30} color={dark ? colors.muted : '#8aa5b8'} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>{query.trim() ? 'No matching maintenance' : view === 'current' ? 'No open maintenance' : 'No closed maintenance'}</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>{query.trim() ? 'Try another maintenance ID or property.' : view === 'current' ? 'New tenant reports will appear here for acknowledgement and assignment.' : 'Resolved and cancelled requests will appear here.'}</Text></View> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('LandlordMaintenanceDetail', { requestId: String(item.id || item.Id), listItem: item })} accessibilityRole="button" accessibilityLabel={`Open maintenance request ${item.title || item.Title || ''}`}>
            <Text style={[styles.title, dark && { color: colors.text }]}>{item.title || item.Title || 'Maintenance request'}</Text>
            {!!(item.description || item.Description) && <Text style={[styles.meta, dark && { color: colors.muted }]} numberOfLines={2}>{item.description || item.Description}</Text>}
            <Text style={[styles.status, dark && { color: colors.accent }]}>{item.status || item.Status ? `${displayStatus(item.status || item.Status)} · ` : ''}Open request →</Text>
          </TouchableOpacity>
        )}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  listContent: { paddingHorizontal: 20, paddingBottom: 28 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pageTitle: { color: '#102d43', fontSize: 28, fontWeight: '800', flexShrink: 1 },
  pageSubtitle: { color: '#617180', fontSize: 13, marginTop: 3 },
  maintenanceOverview: { marginHorizontal: 20, marginBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', paddingTop: 8, paddingBottom: 20 },
  overviewEyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  overviewTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  overviewValue: { color: '#102d43', fontSize: 34, lineHeight: 39, fontWeight: '800' },
  overviewLabel: { color: '#617180', fontSize: 13, marginTop: 1 },
  overviewContext: { flexShrink: 1, color: '#617180', fontSize: 12, textAlign: 'right', paddingBottom: 3 },
  overviewStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#dbe2e6', paddingTop: 16 },
  overviewStat: { flex: 1, minWidth: 0, paddingRight: 6 },
  overviewStatValue: { color: '#102d43', fontSize: 20, fontWeight: '800' },
  overviewStatLabel: { color: '#617180', fontSize: 11, lineHeight: 15, marginTop: 3 },
  search: { marginHorizontal: 20, minHeight: 46, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: 20, marginTop: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#0f2f47', fontWeight: '800' },
  error: { borderLeftWidth: 2, borderColor: '#c2413b', paddingLeft: 14, marginBottom: 24 },
  errorText: { color: '#8d263a', fontWeight: '700', lineHeight: 20 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  retryText: { color: '#2475cf', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#102d43', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: '#788995', fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  row: { paddingVertical: 18, minHeight: 82 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#102d43' },
  meta: { color: '#697887', fontSize: 13, marginTop: 3, lineHeight: 19 },
  status: { color: '#2475cf', fontSize: 13, marginTop: 7, fontWeight: '700' },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { color: '#697887', textAlign: 'center', lineHeight: 20, fontSize: 14 },
});
