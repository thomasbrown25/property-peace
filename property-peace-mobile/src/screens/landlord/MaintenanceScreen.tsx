import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['current', 'history'] as const).map((tab) => <TouchableOpacity key={tab} style={[styles.tab, view === tab && styles.tabActive]} onPress={() => setView(tab)} accessibilityRole="tab" accessibilityState={{ selected: view === tab }}><Text style={[styles.tabText, view === tab && styles.tabTextActive]}>{tab === 'current' ? 'Current' : 'History'}</Text></TouchableOpacity>)}
      </View>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); loadRequests(); }}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
      <FlatList
        data={requests}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} />}
        ListHeaderComponent={<View style={styles.notice}><Text style={styles.noticeTitle}>Property-team workflow</Text><Text style={styles.noticeText}>Open a request to assign work, review estimates, schedule appointments, track evidence, and close repairs. New tenant reports use the structured tenant intake; landlord quick-create is unavailable until the canonical API supports staff-submitted intake safely.</Text></View>}
        ListEmptyComponent={!error ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>{view === 'current' ? 'No open maintenance' : 'No maintenance history'}</Text><Text style={styles.emptySubtext}>{view === 'current' ? 'New tenant reports will appear here for acknowledgement and assignment.' : 'Resolved and cancelled requests will appear here.'}</Text></View> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LandlordMaintenanceDetail', { requestId: String(item.id || item.Id), listItem: item })} accessibilityRole="button" accessibilityLabel={`Open maintenance request ${item.title || item.Title || ''}`}>
            <Text style={styles.title}>{item.title || item.Title || 'Maintenance request'}</Text>
            {!!(item.description || item.Description) && <Text style={styles.meta}>{item.description || item.Description}</Text>}
            {!!(item.status || item.Status) && <Text style={styles.status}>{displayStatus(item.status || item.Status)} · Open workflow →</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#d7e0e5' },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1976d2' },
  tabText: { color: '#667985', fontWeight: '800' },
  tabTextActive: { color: '#0b5cab' },
  error: { margin: 16, marginBottom: 0, padding: 14, backgroundColor: '#fff0f1', borderWidth: 1, borderColor: '#d6909c' },
  errorText: { color: '#8d263a', fontWeight: '700', lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#0b5cab' },
  retryText: { color: '#fff', fontWeight: '900' },
  notice: { backgroundColor: '#eef6fd', borderWidth: 1, borderColor: '#9cc4e7', padding: 14, marginBottom: 16 },
  noticeTitle: { color: '#102d43', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  noticeText: { color: '#526874', lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  title: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  meta: { color: '#666', marginTop: 2, lineHeight: 20 },
  status: { color: '#1976d2', marginTop: 8, fontWeight: '700' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { color: '#777', textAlign: 'center', lineHeight: 20 },
});
