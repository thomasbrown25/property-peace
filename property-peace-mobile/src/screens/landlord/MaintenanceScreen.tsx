import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import { displayStatus } from '../../features/maintenance/maintenanceModel';

export default function MaintenanceScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setError('');
      const data = view === 'current' ? await MaintenanceAPI.getCurrent() : await MaintenanceAPI.getHistory();
      setRequests(data || []);
    } catch (loadError: any) {
      setRequests([]);
      setError(loadError?.detail || loadError?.message || 'Maintenance requests could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view]);

  useEffect(() => { setLoading(true); loadRequests(); }, [loadRequests]);

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} />}
        ListHeaderComponent={<View>
          <Text style={styles.eyebrow}>PROPERTY CARE</Text>
          <Text style={styles.pageTitle} accessibilityRole="header">Repair requests</Text>
          <Text style={styles.pageSubtitle}>Keep repairs moving, from report to resolution.</Text>
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['current', 'history'] as const).map((tab) => <TouchableOpacity key={tab} style={[styles.tab, view === tab && styles.tabActive]} onPress={() => setView(tab)} accessibilityRole="tab" accessibilityState={{ selected: view === tab }}><Text style={[styles.tabText, view === tab && styles.tabTextActive]}>{tab === 'current' ? 'Current' : 'History'}</Text></TouchableOpacity>)}
          </View>
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={19} color="#2475cf" />
            <Text style={styles.noticeText}>Open a request to assign work, review estimates, schedule visits, and close repairs. Tenant reports use structured intake; landlord quick-create is not yet available.</Text>
          </View>
          {error ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); loadRequests(); }} accessibilityRole="button"><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
          {!error && <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{view === 'current' ? 'Open requests' : 'Past requests'}</Text>
            <Text style={styles.count}>{requests.length}</Text>
          </View>}
        </View>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!error ? <View style={styles.emptyContainer}><Ionicons name="construct-outline" size={30} color="#8aa5b8" /><Text style={styles.emptyText}>{view === 'current' ? 'No open maintenance' : 'No maintenance history'}</Text><Text style={styles.emptySubtext}>{view === 'current' ? 'New tenant reports will appear here for acknowledgement and assignment.' : 'Resolved and cancelled requests will appear here.'}</Text></View> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('LandlordMaintenanceDetail', { requestId: String(item.id || item.Id), listItem: item })} accessibilityRole="button" accessibilityLabel={`Open maintenance request ${item.title || item.Title || ''}`}>
            <Text style={styles.title}>{item.title || item.Title || 'Maintenance request'}</Text>
            {!!(item.description || item.Description) && <Text style={styles.meta} numberOfLines={2}>{item.description || item.Description}</Text>}
            {!!(item.status || item.Status) && <Text style={styles.status}>{displayStatus(item.status || item.Status)} · Open workflow →</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  listContent: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 100 },
  eyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  pageTitle: { color: '#102d43', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  pageSubtitle: { color: '#617180', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 26 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', marginBottom: 18 },
  tab: { minHeight: 48, marginRight: 28, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2475cf' },
  tabText: { color: '#697887', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: '#102d43', fontWeight: '700' },
  error: { borderLeftWidth: 2, borderColor: '#c2413b', paddingLeft: 14, marginBottom: 24 },
  errorText: { color: '#8d263a', fontWeight: '700', lineHeight: 20 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  retryText: { color: '#2475cf', fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', marginBottom: 30 },
  noticeText: { color: '#526874', lineHeight: 20, fontSize: 14, flex: 1 },
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
