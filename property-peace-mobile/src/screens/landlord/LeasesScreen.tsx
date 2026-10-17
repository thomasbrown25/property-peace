import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LeaseAPI, { Lease } from '../../api/leaseAPI';
import { LeasesStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';

type LoadStatus = 'loading' | 'success' | 'error';

export default function LeasesScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const navigation = useNavigation<NativeStackNavigationProp<LeasesStackParamList, 'LeasesList'>>();
  const insets = useSafeAreaInsets();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [search, setSearch] = useState('');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const loadLeases = useCallback(async () => {
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
  }, []);

  useFocusEffect(useCallback(() => { loadLeases(); }, [loadLeases]));

  const filteredLeases = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leases;
    return leases.filter(item => [
      item.name, item.Name, item.propertyName, item.PropertyName,
      item.unitName, item.UnitName,
      ...(item.tenants || item.Tenants || []).flatMap((tenant: any) => [tenant.name, tenant.Name, tenant.firstName, tenant.FirstName, tenant.lastName, tenant.LastName]),
    ].some(value => String(value ?? '').toLowerCase().includes(term)));
  }, [leases, search]);

  const overview = useMemo(() => {
    const current = leases.filter(item => !item.archived);
    const isDraft = (item: Lease) => item.isDrafted === true || item.IsDrafted === true || item.leaseAgreement?.isDrafted === true || item.LeaseAgreement?.IsDrafted === true;
    return {
      total: leases.length,
      active: current.filter(item => !isDraft(item) && (item.isActive === true || item.IsActive === true)).length,
      drafts: current.filter(isDraft).length,
      archived: leases.length - current.length,
    };
  }, [leases]);

  const renderLease = ({ item }: { item: Lease }) => {
    const draft = item.isDrafted === true || item.IsDrafted === true || item.leaseAgreement?.isDrafted === true || item.LeaseAgreement?.IsDrafted === true;
    const active = !item.archived && !draft && (item.isActive === true || item.IsActive === true);
    return (
    <TouchableOpacity style={styles.leaseRow} accessibilityRole="button"
      accessibilityLabel={`View lease for ${item.propertyName || item.PropertyName || 'property'}`}
      onPress={() => navigation.navigate('LeaseDetail', { leaseId: String(item.id ?? item.Id), archived: item.archived === true })}>
      <Text style={[styles.leaseTitle, dark && { color: colors.text }]}>{item.name || item.Name || item.propertyName || item.PropertyName || 'Lease'}</Text>
      {!!(item.name || item.Name) && <Text style={[styles.leaseMeta, dark && { color: colors.muted }]}>{[item.propertyName || item.PropertyName, item.unitName || item.UnitName].filter(Boolean).join(' · ')}</Text>}
      {draft && <Text style={[styles.leaseMeta, styles.statusText, { color: dark ? '#f0ba72' : '#b76b11' }]}>Draft</Text>}
      {!!(item.rentAmount || item.RentAmount) && <Text style={[styles.leaseMeta, dark && { color: colors.muted }]}>Rent · ${item.rentAmount || item.RentAmount}</Text>}
      {!!(item.startDate || item.StartDate) && <Text style={[styles.leaseMeta, dark && { color: colors.muted }]}>Starts · {String(item.startDate || item.StartDate).slice(0, 10)}</Text>}
      {active && <Text style={[styles.leaseMeta, styles.statusText, { color: dark ? '#75d995' : '#2f8f46' }]}>Active</Text>}
      <Ionicons name="chevron-forward" size={19} color={colors.muted} style={styles.rowChevron} />
    </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <View style={[styles.topHeader, { paddingTop: insets.top + 16 }]}>
        <View style={[styles.backCircle, { borderColor: dark ? colors.border : '#dbe2e6' }]}><PageBackButton inHeader /></View>
        <Text style={[styles.pageTitle, dark && { color: colors.text }]} accessibilityRole="header">Leases</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loadStatus === 'loading' ? <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.accent} /></View> : <FlatList
        data={loadStatus === 'error' ? [] : filteredLeases}
        renderItem={renderLease}
        keyExtractor={(item, index) => `${item.archived ? 'archive' : 'current'}-${item.id || item.Id || index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeases(); }} tintColor={colors.accent} />}
        ListHeaderComponent={<View>
          <View style={[styles.overview, dark && { borderColor: colors.border }]}>
            <View style={styles.overviewHeading}>
              <Text style={[styles.overviewEyebrow, dark && { color: '#75d995' }]}>LEASE OVERVIEW</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('AddLease')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Add lease">
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Lease</Text>
              </TouchableOpacity>
            </View>
            {loadStatus === 'success' && <>
              <View style={styles.overviewTop}>
                <View><Text style={[styles.overviewValue, dark && { color: colors.text }]}>{overview.active}</Text><Text style={[styles.overviewLabel, dark && { color: colors.muted }]}>Active leases</Text></View>
                <Text style={[styles.overviewContext, dark && { color: colors.muted }]}>{overview.total} leases total</Text>
              </View>
              <View style={[styles.overviewStats, dark && { borderTopColor: colors.border }]}>
                <View style={styles.overviewStat}><Text style={[styles.overviewStatValue, dark && { color: colors.text }]}>{overview.drafts}</Text><Text style={[styles.overviewStatLabel, dark && { color: colors.muted }]}>Drafts</Text></View>
                <View style={styles.overviewStat}><Text style={[styles.overviewStatValue, dark && { color: colors.text }]}>{overview.archived}</Text><Text style={[styles.overviewStatLabel, dark && { color: colors.muted }]}>Archived</Text></View>
              </View>
            </>}
          </View>
          <View style={[styles.searchWrap, dark && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="search" size={19} color={dark ? colors.muted : '#64748b'} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search leases, properties, tenants..." placeholderTextColor={dark ? colors.muted : '#94a3b8'} style={[styles.searchInput, dark && { color: colors.text }]} accessibilityLabel="Search leases" returnKeyType="search" />
            {!!search && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={dark ? colors.muted : '#94a3b8'} /></TouchableOpacity>}
          </View>
          {loadStatus === 'error' ? <View style={styles.errorBlock} accessibilityRole="alert">
            <Text style={[styles.errorTitle, dark && { color: '#ffaaa3' }]}>Couldn't load leases</Text>
            <Text style={[styles.errorText, dark && { color: colors.muted }]}>Lease information is unavailable right now.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadLeases} accessibilityRole="button"><Text style={[styles.retryText, dark && { color: colors.accent }]}>Retry</Text></TouchableOpacity>
          </View> : <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">All leases</Text>
            <Text style={[styles.count, dark && { color: colors.muted }]}>{filteredLeases.length}</Text>
          </View>}
        </View>}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        ListEmptyComponent={loadStatus === 'success' ? <View style={styles.emptyContainer}><Ionicons name={search.trim() ? 'search-outline' : 'document-text-outline'} size={30} color={colors.accent} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>{search.trim() ? 'No matching leases' : 'No leases yet'}</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>{search.trim() ? 'Try a different name, property, unit, or tenant.' : 'Add a lease draft to get started.'}</Text></View> : null}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topHeader: { paddingHorizontal: 22, paddingBottom: 18, flexDirection: 'row', alignItems: 'center' },
  backCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 },
  pageTitle: { flex: 1, textAlign: 'center', color: '#102d43', fontSize: 28, fontWeight: '800' },
  primaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#061e35', borderRadius: 10, paddingHorizontal: 12 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  overview: { marginBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', paddingTop: 8, paddingBottom: 20 },
  overviewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  overviewEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, flexShrink: 1 },
  overviewTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  overviewValue: { color: '#102d43', fontSize: 34, lineHeight: 39, fontWeight: '800' },
  overviewLabel: { color: '#617180', fontSize: 13, marginTop: 1 },
  overviewContext: { flexShrink: 1, color: '#617180', fontSize: 12, textAlign: 'right', paddingBottom: 3 },
  overviewStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#dbe2e6', paddingTop: 16 },
  overviewStat: { flex: 1, minWidth: 0, paddingRight: 6 },
  overviewStatValue: { color: '#102d43', fontSize: 20, fontWeight: '800' },
  overviewStatLabel: { color: '#617180', fontSize: 11, lineHeight: 15, marginTop: 3 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 13, minHeight: 46, marginBottom: 22 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#102d43', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: '#788995', fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  leaseRow: { paddingVertical: 18, paddingRight: 32, minHeight: 80 },
  rowChevron: { position: 'absolute', right: 0, top: 30 },
  leaseTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#102d43', marginBottom: 3 },
  leaseMeta: { color: '#697887', fontSize: 13, lineHeight: 19 },
  statusText: { fontWeight: '700' },
  errorBlock: { borderLeftWidth: 2, borderColor: '#c2413b', paddingLeft: 14, marginBottom: 24 },
  errorTitle: { color: '#8d2923', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#704c48', fontSize: 14, lineHeight: 20, marginTop: 4 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  retryText: { color: '#2475cf', fontSize: 15, fontWeight: '700' },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#697887', textAlign: 'center', lineHeight: 20 },
});
