import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeaseAPI, { Lease } from '../../api/leaseAPI';
import { useAppTheme } from '../../theme/AppTheme';

type LoadStatus = 'loading' | 'success' | 'error';

export default function LeasesScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
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
    <View style={styles.leaseRow} accessibilityRole="summary">
      <Text style={[styles.leaseTitle, dark && { color: colors.text }]}>{item.propertyName || item.PropertyName || 'Lease'}</Text>
      {!!(item.rentAmount || item.RentAmount) && <Text style={[styles.leaseMeta, dark && { color: colors.muted }]}>Rent · ${item.rentAmount || item.RentAmount}</Text>}
      {!!(item.startDate || item.StartDate) && <Text style={[styles.leaseMeta, dark && { color: colors.muted }]}>Starts · {String(item.startDate || item.StartDate).slice(0, 10)}</Text>}
    </View>
  );

  if (loadStatus === 'loading') return <View style={[styles.centerContainer, dark && { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={dark ? colors.accent : '#1976d2'} /></View>;

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <FlatList
        data={leases}
        renderItem={renderLease}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeases(); }} tintColor={dark ? colors.accent : undefined} />}
        ListHeaderComponent={(
          <View>
            <Text style={[styles.eyebrow, dark && { color: colors.accent }]}>YOUR AGREEMENTS</Text>
            <Text style={[styles.pageTitle, dark && { color: colors.text }]} accessibilityRole="header">Leases</Text>
            <Text style={[styles.pageSubtitle, dark && { color: colors.muted }]}>The details behind every tenancy.</Text>
            <View style={[styles.notice, dark && { borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={19} color={dark ? colors.accent : '#2475cf'} />
              <Text style={[styles.noticeText, dark && { color: colors.muted }]}>View leases here. To add or manage a lease, use the web app.</Text>
            </View>
            {loadStatus === 'error' && (
              <View style={[styles.errorBlock, dark && { borderColor: '#ffaaa3' }]} accessibilityRole="alert">
                <Text style={[styles.errorTitle, dark && { color: '#ffaaa3' }]}>Couldn't load leases</Text>
                <Text style={[styles.errorText, dark && { color: colors.muted }]}>Lease information is unavailable right now.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadLeases} accessibilityRole="button">
                  <Text style={[styles.retryText, dark && { color: colors.accent }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {loadStatus === 'success' && <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">All leases</Text>
              <Text style={[styles.count, dark && { color: colors.muted }]}>{leases.length}</Text>
            </View>}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        ListEmptyComponent={loadStatus === 'success' ? <View style={styles.emptyContainer}><Ionicons name="document-text-outline" size={30} color={dark ? colors.accent : '#8aa5b8'} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>No leases yet</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>Lease records created in the web app will appear here.</Text></View> : null}
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
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', marginBottom: 30 },
  noticeText: { color: '#526874', fontSize: 14, lineHeight: 20, flex: 1 },
  errorBlock: { borderLeftWidth: 2, borderColor: '#c2413b', paddingLeft: 14, marginBottom: 24 },
  errorTitle: { color: '#8d2923', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#704c48', fontSize: 14, lineHeight: 20, marginTop: 4 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  retryText: { color: '#2475cf', fontSize: 15, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#102d43', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: '#788995', fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  leaseRow: { paddingVertical: 18, minHeight: 80 },
  leaseTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#102d43', marginBottom: 3 },
  leaseMeta: { color: '#697887', fontSize: 13, lineHeight: 19 },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#697887', textAlign: 'center', lineHeight: 20 },
});
