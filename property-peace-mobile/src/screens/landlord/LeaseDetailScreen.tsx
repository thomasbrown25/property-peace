import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LeaseAPI, { type Lease } from '../../api/leaseAPI';
import { nextRentDueDate } from '../../features/leases/nextRentDueDate';
import type { LeasesStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppTheme';

type DetailRoute = RouteProp<LeasesStackParamList, 'LeaseDetail'>;
type DetailNavigation = NativeStackNavigationProp<LeasesStackParamList, 'LeaseDetail'>;

const field = (item: Lease, name: string) => item[name] ?? item[name[0].toUpperCase() + name.slice(1)];
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : null;
};
const date = (value: unknown) => {
  const source = text(value);
  const parts = source?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return null;
  const dateValue = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  if (dateValue.toISOString().slice(0, 10) !== parts[0]) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(dateValue);
};
const tenantName = (tenant: any) => text(tenant?.fullName ?? tenant?.FullName)
  ?? [tenant?.firstname ?? tenant?.Firstname ?? tenant?.firstName ?? tenant?.FirstName,
    tenant?.lastname ?? tenant?.Lastname ?? tenant?.lastName ?? tenant?.LastName].filter(Boolean).join(' ').trim()
  ?? '';

export default function LeaseDetailScreen() {
  const { colors, mode } = useAppTheme();
  const navigation = useNavigation<DetailNavigation>();
  const { leaseId, archived } = useRoute<DetailRoute>().params;
  const [lease, setLease] = useState<Lease | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'missing'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(useCallback(() => { setToday(new Date()); }, []));

  const load = useCallback(async () => {
    try {
      // The unit endpoint returns its current lease, not necessarily this contract.
      // Match the selected ID and archive namespace in the scoped lease list instead.
      const leases = await LeaseAPI.getLeases();
      const match = leases.find((item) => String(field(item, 'id')) === leaseId && (item.archived === true) === archived);
      setLease(match ?? null);
      setStatus(match ? 'success' : 'missing');
    } catch {
      setLease(null);
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, [leaseId, archived]);
  useEffect(() => { setLease(null); setStatus('loading'); load(); }, [load]);

  const dark = mode === 'dark';
  const surface = dark ? colors.surface : '#fff';
  const ink = colors.text;
  const muted = colors.muted;
  const line = colors.border;
  const accent = colors.accent;
  const property = lease ? text(field(lease, 'propertyName')) ?? 'Property' : 'Property';
  const unit = lease ? text(field(lease, 'unitName')) : null;
  const start = lease ? date(field(lease, 'startDate')) : null;
  const end = lease ? date(field(lease, 'endDate')) : null;
  const rent = lease ? money(field(lease, 'rentAmount')) : null;
  const deposit = lease ? money(field(lease, 'depositAmount') ?? field(lease, 'securityDeposit')) : null;
  const tenants = lease && Array.isArray(field(lease, 'tenants')) ? field(lease, 'tenants') as any[] : [];
  const names = tenants.map(tenantName).filter(Boolean);
  const frequency = lease ? text(field(lease, 'rentFrequency')) : null;
  const isActive = lease ? field(lease, 'isActive') : null;
  const agreement = lease ? field(lease, 'leaseAgreement') : null;
  const signed = Boolean(agreement && (agreement.landlordSignedAt || agreement.LandlordSignedAt || agreement.signatureCompletedAt || agreement.SignatureCompletedAt || agreement.docuSignEnvelopeId || agreement.DocuSignEnvelopeId));
  const draft = lease ? field(lease, 'isDrafted') === true || agreement?.isDrafted === true || agreement?.IsDrafted === true : false;
  const statusLabel = archived ? 'Archived' : draft ? 'Draft' : isActive === false ? 'Inactive' : isActive === true ? 'Active' : 'Status unavailable';
  const nextDue = lease && !archived && !draft && isActive === true ? nextRentDueDate(lease, today) : null;
  const propertyId = lease ? field(lease, 'propertyId') : null;

  const detailRow = (icon: keyof typeof Ionicons.glyphMap, label: string, value: string, last = false) => (
    <View style={[styles.detailRow, { borderBottomColor: line }, last && styles.lastRow]}>
      <Ionicons name={icon} size={20} color={accent} style={styles.rowIcon} />
      <View style={styles.rowCopy}><Text style={[styles.rowLabel, { color: muted }]}>{label}</Text><Text style={[styles.rowValue, { color: ink }]}>{value}</Text></View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: dark ? colors.background : '#fbf7f4' }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setToday(new Date()); setRefreshing(true); load(); }} tintColor={accent} />}>
      {status === 'loading' ? <View style={styles.state}><ActivityIndicator color={accent} /><Text style={[styles.stateText, { color: muted }]}>Loading lease…</Text></View> :
        status !== 'success' || !lease ? <View style={styles.state} accessibilityRole="alert">
          <Ionicons name="document-text-outline" size={32} color={accent} />
          <Text style={[styles.stateTitle, { color: ink }]}>{status === 'error' ? 'Lease unavailable' : 'Lease not found'}</Text>
          <Text style={[styles.stateText, { color: muted }]}>{status === 'error' ? 'We couldn’t load this lease right now.' : 'This lease may have been removed or is no longer available.'}</Text>
          <TouchableOpacity style={[styles.retry, { backgroundColor: accent }]} accessibilityRole="button" onPress={load}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View> : <>
          <Text style={[styles.eyebrow, { color: accent }]}>LEASE DETAILS</Text>
          <Text style={[styles.title, { color: ink }]} accessibilityRole="header">{property}</Text>
          <View style={styles.subline}>
            {unit ? <Text style={[styles.subtitle, { color: muted }]}>{unit}</Text> : null}
            <Text style={[styles.subtitle, { color: muted }]}>{unit ? ' · ' : ''}Lease {leaseId}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusLabel === 'Active' ? (dark ? '#183d2d' : '#e5f5e9') : (dark ? '#233e59' : '#eaf3ff') }]}><View style={[styles.statusDot, { backgroundColor: statusLabel === 'Active' ? (dark ? '#75d995' : '#2f8f46') : accent }]} /><Text style={[styles.statusText, { color: statusLabel === 'Active' ? (dark ? '#75d995' : '#2f8f46') : ink }]}>{statusLabel}</Text></View>

          <View style={[styles.termBand, { borderColor: line }]}>
            <View style={styles.termCell}><Text style={[styles.termLabel, { color: muted }]}>START DATE</Text><Text style={[styles.termValue, { color: ink }]}>{start ?? 'Not set'}</Text></View>
            <View style={[styles.termDivider, { backgroundColor: line }]} />
            <View style={styles.termCell}><Text style={[styles.termLabel, { color: muted }]}>END DATE</Text><Text style={[styles.termValue, { color: ink }]}>{end ?? 'Not set'}</Text></View>
          </View>

          <Text style={[styles.sectionTitle, { color: ink }]} accessibilityRole="header">Rent & deposit</Text>
          <View style={[styles.section, { backgroundColor: surface, borderColor: line }]}>
            {detailRow('cash-outline', 'Rent amount', rent ? `${rent}${frequency ? ` · ${frequency}` : ''}` : 'Not set')}
            {detailRow('calendar-outline', 'Next rent due', nextDue ? date(nextDue) ?? 'Unavailable' : 'No upcoming date')}
            {detailRow('shield-checkmark-outline', 'Security deposit', deposit ?? 'Not set', true)}
          </View>

          <Text style={[styles.sectionTitle, { color: ink }]} accessibilityRole="header">People on this lease</Text>
          <View style={[styles.section, { backgroundColor: surface, borderColor: line }]}>
            {names.length ? names.map((name, index) => <View key={`${name}-${index}`}>{detailRow('person-outline', `Tenant ${index + 1}`, name, index === names.length - 1)}</View>) :
              <Text style={[styles.emptyPeople, { color: muted }]}>No tenant names are available for this lease.</Text>}
          </View>

          {propertyId && !archived ? <TouchableOpacity style={[styles.propertyLink, { borderColor: line }]} accessibilityRole="button" onPress={() => navigation.getParent<any>()?.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: String(propertyId) } })}>
            <Ionicons name="home-outline" size={21} color={accent} />
            <Text style={[styles.propertyLinkText, { color: ink }]}>View property</Text>
            <Ionicons name="arrow-forward" size={19} color={muted} />
          </TouchableOpacity> : null}
          {!signed && !archived && <TouchableOpacity style={[styles.propertyLink, { borderColor: line }]} accessibilityRole="button" accessibilityLabel="Edit lease" onPress={() => navigation.navigate('AddLease' as any, { leaseId } as any)}><Ionicons name="create-outline" size={21} color={accent} /><Text style={[styles.propertyLinkText, { color: ink }]}>Edit lease terms</Text><Ionicons name="arrow-forward" size={19} color={muted} /></TouchableOpacity>}
          <Text style={[styles.footnote, { color: muted }]}>Renewal, signatures, and payments are not managed here. Amounts shown are lease terms, not payment balances.</Text>
        </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 32 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  subline: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, borderRadius: 20, paddingHorizontal: 11, minHeight: 30, marginTop: 16 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  termBand: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, marginTop: 27, paddingVertical: 19 },
  termCell: { flex: 1, minWidth: 0 },
  termDivider: { width: 1, marginHorizontal: 13 },
  termLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  termValue: { fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 32, marginBottom: 12 },
  section: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 67, paddingVertical: 12, borderBottomWidth: 1 },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 34 },
  rowCopy: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 3 },
  rowValue: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  emptyPeople: { fontSize: 14, lineHeight: 21, paddingVertical: 20 },
  propertyLink: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, marginTop: 20 },
  propertyLinkText: { flex: 1, fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 13, lineHeight: 19, marginTop: 24 },
  state: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  stateTitle: { fontSize: 20, fontWeight: '800' },
  stateText: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  retry: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 20, marginTop: 8 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
