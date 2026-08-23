import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LeaseAPI, { Lease } from '../../api/leaseAPI';

type LoadStatus = 'loading' | 'success' | 'error';

export default function LeasesScreen() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const loadLeases = async () => {
    try {
      const data = await LeaseAPI.getLeases();
      setLeases(data || []);
      setLoadStatus('success');
    } catch (error) {
      console.error('Error loading leases:', error);
      setLoadStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadLeases(); }, []);

  const renderLease = ({ item }: { item: Lease }) => (
    <View style={styles.leaseCard} accessibilityRole="summary">
      <Text style={styles.leaseTitle}>{item.propertyName || item.PropertyName || 'Lease'}</Text>
      {!!(item.rentAmount || item.RentAmount) && <Text style={styles.leaseMeta}>Rent: ${item.rentAmount || item.RentAmount}</Text>}
      {!!(item.startDate || item.StartDate) && <Text style={styles.leaseMeta}>Starts: {String(item.startDate || item.StartDate).slice(0, 10)}</Text>}
    </View>
  );

  if (loadStatus === 'loading') return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={leases}
        renderItem={renderLease}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeases(); }} />}
        ListHeaderComponent={(
          <>
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Lease overview</Text>
              <Text style={styles.noticeText}>Leases are read-only in the mobile app. Use the web app to add or manage lease records.</Text>
            </View>
            {loadStatus === 'error' && (
              <View style={styles.errorCard} accessibilityRole="alert">
                <Text style={styles.errorTitle}>Couldn't load leases</Text>
                <Text style={styles.errorText}>Lease information is unavailable right now.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadLeases} accessibilityRole="button">
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        ListEmptyComponent={loadStatus === 'success' ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No leases found</Text><Text style={styles.emptySubtext}>Lease records created in the web app will appear here.</Text></View> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  notice: { backgroundColor: '#eaf3ff', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#c9def5' },
  noticeTitle: { color: '#0b3558', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  noticeText: { color: '#526874', fontSize: 14, lineHeight: 20 },
  errorCard: { backgroundColor: '#fff4f2', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#efc6c0' },
  errorTitle: { color: '#8d2923', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#704c48', fontSize: 14, lineHeight: 20, marginTop: 4 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8, paddingHorizontal: 4 },
  retryText: { color: '#1976d2', fontSize: 15, fontWeight: '700' },
  leaseCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  leaseTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  leaseMeta: { color: '#666', marginTop: 4 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#777', textAlign: 'center' },
});
