import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../services/apiClient';
import { createTenantPaymentsAPI, type TenantLease } from '../../api/tenantPaymentsAPI';
import { leasesForView, tenantLeaseDate, tenantLeaseMoney, type LeaseView } from '../../features/leases/tenantLeaseModel';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppTheme } from '../../theme/AppTheme';
import { useAppSelector } from '../../store/hooks';
import type { TenantLeasesStackParamList } from '../../navigation/types';

const api = createTenantPaymentsAPI(apiClient);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Lease information is unavailable right now.';

function useTenantLeases() {
  const user = useAppSelector(state => state.user.currentUser);
  const scope = `${user?.id ?? user?.Id ?? ''}:${user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? ''}`;
  const [result, setResult] = useState<{ scope: string; leases: TenantLease[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setResult(null); setLoading(true); setError('');
    api.leases().then(leases => { if (active) { setResult({ scope, leases }); setError(''); } })
      .catch(e => { if (active) { setResult(null); setError(errorMessage(e)); } })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [scope, generation]));
  const refresh = () => { setRefreshing(true); setGeneration(value => value + 1); };
  return { leases: result?.scope === scope ? result.leases : [], loading: loading || (!!result && result.scope !== scope), refreshing, error, refresh };
}

export default function TenantLeasesScreen() {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TenantLeasesStackParamList, 'TenantLeasesList'>>();
  const { leases, loading, refreshing, error, refresh } = useTenantLeases();
  const [view, setView] = useState<LeaseView>('active');
  const shown = leasesForView(leases, view);
  const dark = mode === 'dark';
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <LandlordPageHeader title="Leases" />
    <FlatList data={shown} keyExtractor={item => String(item.id)}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListHeaderComponent={<View>
        <Text style={[styles.heading, { color: colors.text }]}>Your leases</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>View the details of your current and past leases.</Text>
        <View style={[styles.tabs, { borderBottomColor: colors.border }]} accessibilityRole="tablist">
          {(['active', 'history'] as const).map(tab => <TouchableOpacity key={tab} onPress={() => setView(tab)}
            style={[styles.tab, view === tab && { borderBottomColor: colors.accent }]}
            accessibilityRole="tab" accessibilityState={{ selected: view === tab }}>
            <Text style={[styles.tabText, { color: view === tab ? colors.text : colors.muted }, view === tab && styles.tabTextActive]}>{tab === 'active' ? 'Active' : 'History'}</Text>
          </TouchableOpacity>)}
        </View>
        {loading && <ActivityIndicator style={styles.state} color={colors.accent} />}
        {!!error && !loading && <View style={styles.state} accessibilityRole="alert"><Text style={{ color: colors.text }}>Couldn’t load leases. {error}</Text><TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Try again</Text></TouchableOpacity></View>}
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />}
      renderItem={({ item }) => <TouchableOpacity style={styles.row} accessibilityRole="button" accessibilityLabel={`View lease for ${item.propertyName || 'property'}${item.unitName ? `, ${item.unitName}` : ''}`}
        onPress={() => navigation.navigate('TenantLeaseDetail', { leaseId: item.id })}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{item.propertyName || 'Property'}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{[item.unitName, item.name].filter(Boolean).join(' · ') || `Lease ${item.id}`}</Text>
        <Text style={[styles.meta, { color: item.isActive === true ? (dark ? '#75d995' : '#2f8f46') : colors.muted }, styles.status]}>{item.isActive === true ? 'Active' : 'Inactive'}</Text>
        <Ionicons name="chevron-forward" size={19} color={colors.muted} style={styles.chevron} />
      </TouchableOpacity>}
      ListEmptyComponent={!loading && !error ? <View style={styles.state}><Ionicons name="document-text-outline" size={30} color={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{view === 'active' ? 'No active leases' : 'No lease history'}</Text><Text style={[styles.caption, { color: colors.muted }]}>Your {view === 'active' ? 'current' : 'past'} leases will appear here.</Text></View> : null}
    />
  </View>;
}

export function TenantLeaseDetailScreen() {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { leaseId } = useRoute<RouteProp<TenantLeasesStackParamList, 'TenantLeaseDetail'>>().params;
  const { leases, loading, refreshing, error, refresh } = useTenantLeases();
  const lease = leases.find(item => item.id === leaseId);
  const detail = (label: string, value: string) => <View style={[styles.detailRow, { borderBottomColor: colors.border }]}><Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text></View>;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.detailContent, { paddingBottom: Math.max(insets.bottom, 24) + 100 }]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
    {loading ? <ActivityIndicator style={styles.state} color={colors.accent} /> : error || !lease ? <View style={styles.state} accessibilityRole="alert"><Text style={[styles.emptyTitle, { color: colors.text }]}>{error ? 'Lease unavailable' : 'Lease not found'}</Text><Text style={[styles.caption, { color: colors.muted }]}>{error || 'This lease is no longer available to your account.'}</Text><TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={refresh}><Text style={{ color: colors.accent, fontWeight: '700' }}>Try again</Text></TouchableOpacity></View> : <>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>LEASE DETAILS</Text>
      <Text style={[styles.detailTitle, { color: colors.text }]} accessibilityRole="header">{lease.propertyName || 'Property'}</Text>
      <Text style={[styles.caption, { color: colors.muted }]}>{[lease.unitName, lease.name].filter(Boolean).join(' · ') || `Lease ${lease.id}`}</Text>
      <View style={[styles.badge, { backgroundColor: lease.isActive === true ? (mode === 'dark' ? '#183d2d' : '#e5f5e9') : colors.surface }]}><Text style={{ color: lease.isActive === true ? (mode === 'dark' ? '#75d995' : '#2f8f46') : colors.text, fontWeight: '700' }}>{lease.isActive === true ? 'Active' : 'Inactive'}</Text></View>
      <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {detail('Start date', tenantLeaseDate(lease.startDate))}
        {detail('End date', tenantLeaseDate(lease.endDate))}
        {detail('Rent amount', `${tenantLeaseMoney(lease.rentAmount)}${lease.rentFrequency ? ` · ${lease.rentFrequency}` : ''}`)}
        {detail('Security deposit', tenantLeaseMoney(lease.depositAmount))}
      </View>
      <Text style={[styles.caption, { color: colors.muted }]}>Amounts shown are lease terms, not your payment balance. Check Payments for your current bill.</Text>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 20 },
  heading: { fontSize: 28, fontWeight: '800' }, caption: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 24, marginTop: 23, borderBottomWidth: 1 },
  tab: { minHeight: 44, justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' }, tabTextActive: { fontWeight: '800' },
  row: { paddingVertical: 18, paddingRight: 32, minHeight: 88 }, rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 3 }, status: { fontWeight: '700' },
  chevron: { position: 'absolute', right: 0, top: 30 },
  state: { alignItems: 'center', paddingVertical: 44, gap: 7 }, emptyTitle: { fontSize: 18, fontWeight: '700' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  detailContent: { paddingHorizontal: 22, paddingTop: 26 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  detailTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800' }, badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginTop: 16 },
  detailCard: { borderWidth: 1, borderRadius: 16, marginTop: 28, paddingHorizontal: 16 },
  detailRow: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 12, marginBottom: 4 }, detailValue: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
