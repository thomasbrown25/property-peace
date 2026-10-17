import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import { displayStatus } from '../../features/maintenance/maintenanceModel';
import { useAppTheme } from '../../theme/AppTheme';

import { forProperty } from '../../features/maintenance/propertyMaintenanceScope';

export default function MaintenanceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const propertyId: string | undefined = route.params?.propertyId;
  const propertyName: string | undefined = route.params?.propertyName;
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setError('');
      const data = view === 'current' ? await MaintenanceAPI.getCurrent() : await MaintenanceAPI.getHistory();
      setRequests(forProperty(data || [], propertyId));
    } catch (loadError: any) {
      setRequests([]);
      setError(loadError?.detail || loadError?.message || 'Maintenance requests could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, propertyId]);

  useEffect(() => { setLoading(true); loadRequests(); }, [loadRequests]);

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.pageTitle, dark && { color: colors.text }]} accessibilityRole="header">Maintenance</Text>
        <Text style={[styles.pageSubtitle, dark && { color: colors.muted }]}>{propertyId ? propertyName || 'This property' : 'Keep repairs moving, from report to resolution.'}</Text>
      </View>
      <View style={[styles.tabs, dark && { borderBottomColor: colors.border }]} accessibilityRole="tablist">
        {(['current', 'history'] as const).map((tab) => <TouchableOpacity key={tab} style={[styles.tab, view === tab && styles.tabActive, dark && view === tab && { borderBottomColor: colors.accent }]} onPress={() => setView(tab)} accessibilityRole="tab" accessibilityState={{ selected: view === tab }}><Text style={[styles.tabText, view === tab && styles.tabTextActive, dark && { color: view === tab ? colors.text : colors.muted }]}>{tab === 'current' ? 'Open' : 'Closed'}</Text></TouchableOpacity>)}
      </View>
      {loading ? <View style={[styles.centerContainer, dark && { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={dark ? colors.accent : '#1976d2'} /></View> : <FlatList
        data={requests}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={[styles.listContent, { paddingTop: 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} tintColor={dark ? colors.accent : undefined} />}
        ListHeaderComponent={<View>
          {error ? <View style={styles.error} accessibilityRole="alert"><Text style={[styles.errorText, dark && { color: colors.text }]}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); loadRequests(); }} accessibilityRole="button"><Text style={[styles.retryText, dark && { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
          {!error && <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">{view === 'current' ? 'Open requests' : 'Closed requests'}</Text>
            <Text style={[styles.count, dark && { color: colors.muted }]}>{requests.length}</Text>
          </View>}
        </View>}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        ListEmptyComponent={!error ? <View style={styles.emptyContainer}><Ionicons name="construct-outline" size={30} color={dark ? colors.muted : '#8aa5b8'} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>{view === 'current' ? 'No open maintenance' : 'No closed maintenance'}</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>{view === 'current' ? 'New tenant reports will appear here for acknowledgement and assignment.' : 'Resolved and cancelled requests will appear here.'}</Text></View> : null}
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
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  pageTitle: { color: '#102d43', fontSize: 28, fontWeight: '800' },
  pageSubtitle: { color: '#617180', fontSize: 13, marginTop: 3 },
  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
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
