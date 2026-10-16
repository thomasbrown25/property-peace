import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RentCollectionAPI from '../../api/rentCollectionAPI';
import { collectionPayload } from '../../features/rentCollection/collectionPayload';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/AppTheme';

type RentRecord = {
  id?: number; Id?: number;
  leaseId?: number; LeaseId?: number;
  propertyName?: string; PropertyName?: string;
  unitName?: string; UnitName?: string;
  rentAmount?: number; RentAmount?: number;
  currentMonthRentDue?: number; CurrentMonthRentDue?: number;
  rentDue?: number; RentDue?: number;
  status?: string | number; Status?: string | number;
  currentMonthRentIsOverdue?: boolean; CurrentMonthRentIsOverdue?: boolean;
  processingPaymentCount?: number; ProcessingPaymentCount?: number;
  paymentIssueCount?: number; PaymentIssueCount?: number;
  tenants?: Array<{ firstName?: string; firstname?: string; FirstName?: string; lastName?: string; lastname?: string; LastName?: string }>;
  Tenants?: RentRecord['tenants'];
};
type Collection = { expected: number; collected: number; remaining: number; outstanding: number; records: RentRecord[] };
const empty: Collection = { expected: 0, collected: 0, remaining: 0, outstanding: 0, records: [] };
const value = (...inputs: unknown[]) => {
  for (const input of inputs) {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input === 'string' && input.trim() && Number.isFinite(Number(input))) return Number(input);
  }
  return 0;
};
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const read = <T,>(record: Record<string, any>, key: string): T | undefined => record[key] ?? record[key[0].toUpperCase() + key.slice(1)];

function parseCollection(payload: any): Collection {
  const source = payload?.summary ?? payload?.Summary ?? {};
  const expected = Math.max(0, value(read(source, 'expectedThisMonth'), read(source, 'totalMonthlyRent')));
  const collected = Math.max(0, value(read(source, 'collectedThisMonth')));
  const records = read<RentRecord[]>(payload, 'rentRecords');
  return {
    expected, collected,
    remaining: Math.max(0, expected - Math.min(expected, collected)),
    outstanding: Math.max(0, value(read(source, 'outstanding'))),
    records: Array.isArray(records) ? records : [],
  };
}

function recordState(record: RentRecord) {
  const raw = read<string | number>(record, 'status');
  const status = String(raw ?? '').toLowerCase();
  const due = Math.max(0, value(read(record, 'currentMonthRentDue')));
  if (value(read(record, 'paymentIssueCount')) > 0) return { label: 'Needs review', icon: 'alert-circle-outline' as const, tone: 'warning' as const };
  if (value(read(record, 'processingPaymentCount')) > 0) return { label: 'Processing', icon: 'time-outline' as const, tone: 'info' as const };
  if (read(record, 'currentMonthRentIsOverdue') || status === 'overdue' || status === '2') return { label: 'Overdue', icon: 'alert-circle-outline' as const, tone: 'warning' as const };
  if (due > 0) return { label: 'Awaiting payment', icon: 'time-outline' as const, tone: 'info' as const };
  if (value(read(record, 'rentDue')) > 0) return { label: 'Balance due', icon: 'alert-circle-outline' as const, tone: 'warning' as const };
  if (status === 'uptodate' || status === 'paid' || status === '1') return { label: 'Up to date', icon: 'checkmark-circle' as const, tone: 'success' as const };
  return { label: 'No payment due', icon: 'remove-circle-outline' as const, tone: 'neutral' as const };
}

export default function RentCollectionScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const organizationId = String(currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId ?? '');
  const currentOrganizationId = useRef(organizationId);
  currentOrganizationId.current = organizationId;
  const generation = useRef(0);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [data, setData] = useState<Collection>(empty);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const scope = organizationId;
    const request = ++generation.current;
    if (!scope) { setLoadedScope(null); setStatus('error'); setRefreshing(false); return; }
    if (refresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const response = await RentCollectionAPI.getRentCollection();
      if (request !== generation.current || scope !== currentOrganizationId.current) return;
      // RentCollectionAPI has already unwrapped both the HTTP body and ServiceResponse.Data.
      setData(parseCollection(collectionPayload(response)));
      setStatus('success');
    } catch {
      if (request !== generation.current || scope !== currentOrganizationId.current) return;
      setData(empty);
      setStatus('error');
    } finally {
      if (request === generation.current && scope === currentOrganizationId.current) {
        setLoadedScope(scope);
        setRefreshing(false);
      }
    }
  }, [organizationId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++generation.current; };
  }, [load]));

  const scoped = loadedScope === organizationId;
  const visible = scoped && status === 'success' ? data : empty;
  const viewStatus = scoped ? status : 'loading';
  const percent = visible.expected > 0 ? Math.min(100, Math.round(visible.collected / visible.expected * 100)) : 0;
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={dark ? colors.accent : '#2475cf'} />}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back to dashboard">
          <Ionicons name="arrow-back" size={22} color={dark ? colors.text : '#0b3558'} />
          <Text style={[styles.backText, dark && { color: colors.text }]}>Home</Text>
        </TouchableOpacity>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, dark && { color: colors.accent }]}>YOUR RENT</Text>
          <Text style={[styles.title, dark && { color: colors.text }]} accessibilityRole="header">Rent collection</Text>
          <Text style={[styles.subtitle, dark && { color: colors.muted }]}>A clear view of what's collected and what's still due.</Text>
        </View>
        <View style={styles.period}><Ionicons name="calendar-outline" size={18} color={dark ? colors.accent : '#2475cf'} /><Text style={[styles.periodText, dark && { color: colors.text }]}>{month}</Text><Text style={[styles.periodHint, dark && { color: colors.muted }]}>CURRENT MONTH</Text></View>

        {viewStatus === 'loading' ? (
          <View style={styles.feedback}><ActivityIndicator color={dark ? colors.accent : '#2475cf'} /><Text style={[styles.feedbackText, dark && { color: colors.muted }]}>Loading rent collection…</Text></View>
        ) : viewStatus === 'error' ? (
          <View style={styles.feedback}>
            <Ionicons name="cloud-offline-outline" size={27} color={dark ? '#ffca82' : '#a45f12'} />
            <Text style={[styles.feedbackTitle, dark && { color: colors.text }]}>Rent collection is unavailable</Text>
            <Text style={[styles.feedbackText, dark && { color: colors.muted }]}>We couldn't load your current rent figures.</Text>
            <TouchableOpacity style={[styles.retry, dark && { backgroundColor: colors.accent }]} onPress={() => void load()} accessibilityRole="button"><Text style={[styles.retryText, dark && { color: colors.background }]}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.summary, dark && { backgroundColor: '#1b3833' }]}>
              <Text style={[styles.summaryLabel, dark && { color: colors.text }]}>Collected this month</Text>
              <View style={styles.summaryValueRow}>
                <Text style={[styles.summaryValue, dark && { color: '#82e5a5' }]} adjustsFontSizeToFit numberOfLines={1}>{money(visible.collected)}</Text>
                {visible.expected > 0 && <Text style={[styles.percent, dark && { color: '#82e5a5' }]}>{percent}%</Text>}
              </View>
              <Text style={[styles.expected, dark && { color: colors.muted }]}>{money(visible.expected)} expected</Text>
              {visible.expected > 0 && <View style={[styles.track, dark && { backgroundColor: '#36584a' }]} accessibilityRole="progressbar" accessibilityLabel="Rent collected this month" accessibilityValue={{ min: 0, max: 100, now: percent }}><View style={[styles.fill, { width: `${percent}%` }, dark && { backgroundColor: '#82e5a5' }]} /></View>}
              <Text style={[styles.remaining, dark && { color: colors.muted }]}>{money(visible.remaining)} remaining this month</Text>
            </View>
            {visible.outstanding > 0 && <Text style={[styles.outstanding, dark && { color: '#ffca82' }]}>{money(visible.outstanding)} total outstanding, including prior periods</Text>}
            <View style={styles.sectionHead}>
              <View><Text style={[styles.sectionEyebrow, dark && { color: colors.accent }]}>BY LEASE</Text><Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">Rent status</Text></View>
              <Text style={[styles.count, dark && { color: colors.muted }]}>{visible.records.length} {visible.records.length === 1 ? 'lease' : 'leases'}</Text>
            </View>
            {visible.records.length === 0 ? (
              <View style={styles.emptyState}><Ionicons name="receipt-outline" size={26} color={dark ? colors.accent : '#2475cf'} /><Text style={[styles.emptyTitle, dark && { color: colors.text }]}>No rent records yet</Text><Text style={[styles.feedbackText, dark && { color: colors.muted }]}>Active lease rent will appear here when available.</Text></View>
            ) : visible.records.map((record, index) => {
              const tenants = read<RentRecord['tenants']>(record, 'tenants') ?? [];
              const tenant = tenants.map((person) => [person.firstName ?? person.firstname ?? person.FirstName, person.lastName ?? person.lastname ?? person.LastName].filter(Boolean).join(' ')).filter(Boolean).join(', ');
              const name = tenant || 'Tenant not listed';
              const location = [read<string>(record, 'propertyName'), read<string>(record, 'unitName')].filter(Boolean).join(' · ') || 'Property not listed';
              const state = recordState(record);
              const due = Math.max(0, value(read(record, 'currentMonthRentDue')));
              const totalDue = Math.max(0, value(read(record, 'rentDue')));
              const amount = Math.max(0, value(read(record, 'rentAmount')));
              const displayAmount = due > 0 ? due : totalDue > 0 ? totalDue : amount;
              const amountLabel = due > 0 ? 'due this month' : totalDue > 0 ? 'rent due' : 'monthly rent';
              return (
                <View key={`${read(record, 'leaseId') ?? read(record, 'id') ?? index}`} style={[styles.row, dark && { borderBottomColor: colors.border }, index === visible.records.length - 1 && styles.lastRow]}>
                  <View style={[styles.rowIcon, state.tone === 'success' ? styles.successIcon : state.tone === 'warning' ? styles.warningIcon : styles.infoIcon, dark && { backgroundColor: state.tone === 'success' ? '#224737' : state.tone === 'warning' ? '#4b3829' : '#233c56' }]}><Ionicons name={state.icon} size={23} color={dark ? state.tone === 'success' ? '#82e5a5' : state.tone === 'warning' ? '#ffca82' : colors.accent : state.tone === 'success' ? '#219447' : state.tone === 'warning' ? '#ae680d' : '#2475cf'} /></View>
                  <View style={styles.rowCopy}><Text style={[styles.rowName, dark && { color: colors.text }]} numberOfLines={2}>{name}</Text><Text style={[styles.rowLocation, dark && { color: colors.muted }]} numberOfLines={2}>{location}</Text><Text style={[styles.status, state.tone === 'success' ? styles.successText : state.tone === 'warning' ? styles.warningText : styles.infoText, dark && { color: state.tone === 'success' ? '#82e5a5' : state.tone === 'warning' ? '#ffca82' : colors.accent }]}>{state.label}</Text></View>
                  <View style={styles.amountBlock}><Text style={[styles.rowAmount, dark && { color: colors.text }]}>{money(displayAmount)}</Text><Text style={[styles.amountCaption, dark && { color: colors.muted }]}>{amountLabel}</Text></View>
                </View>
              );
            })}
            <TouchableOpacity style={[styles.leaseLink, dark && { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="button" onPress={() => navigation.navigate('Leases', { screen: 'LeasesList' })}>
              <View style={[styles.linkIcon, dark && { backgroundColor: '#233c56' }]}><Ionicons name="document-text-outline" size={21} color={dark ? colors.accent : '#0b3558'} /></View>
              <View style={styles.linkCopy}><Text style={[styles.linkTitle, dark && { color: colors.text }]}>View leases</Text><Text style={[styles.linkSubtitle, dark && { color: colors.muted }]}>Review the leases behind these balances</Text></View>
              <Ionicons name="arrow-forward" size={20} color={dark ? colors.accent : '#2475cf'} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, marginBottom: 18 },
  backText: { color: '#0b3558', fontSize: 14, fontWeight: '700' },
  intro: { marginBottom: 22 },
  eyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 9 },
  title: { color: '#061e35', fontSize: 32, fontWeight: '800', letterSpacing: -0.9 },
  subtitle: { color: '#667789', fontSize: 15, lineHeight: 22, marginTop: 5 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, minHeight: 42 },
  periodText: { color: '#102d43', fontSize: 15, fontWeight: '700', flex: 1 },
  periodHint: { color: '#7c8c9b', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  summary: { backgroundColor: '#e8f8ee', borderRadius: 20, padding: 20 },
  summaryLabel: { color: '#18374c', fontSize: 14, fontWeight: '700' },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  summaryValue: { color: '#188d40', fontSize: 35, fontWeight: '800', letterSpacing: -1.3, flexShrink: 1 },
  percent: { color: '#188d40', fontSize: 19, fontWeight: '800' },
  expected: { color: '#556d64', fontSize: 14, marginTop: 3 },
  track: { height: 11, borderRadius: 7, overflow: 'hidden', backgroundColor: '#d1edda', marginTop: 13 },
  fill: { height: '100%', borderRadius: 7, backgroundColor: '#20a04b' },
  remaining: { color: '#556d64', fontSize: 13, marginTop: 8 },
  outstanding: { color: '#7a5a28', fontSize: 13, marginTop: 10, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 32, marginBottom: 7 },
  sectionEyebrow: { color: '#2475cf', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  sectionTitle: { color: '#061e35', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: '#667789', fontSize: 13, marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#e6ebee' },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  successIcon: { backgroundColor: '#e8f8ee' }, warningIcon: { backgroundColor: '#fff4e5' }, infoIcon: { backgroundColor: '#eaf3ff' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { color: '#102d43', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  rowLocation: { color: '#667789', fontSize: 12, lineHeight: 17, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  successText: { color: '#188d40' }, warningText: { color: '#a66310' }, infoText: { color: '#2475cf' },
  amountBlock: { alignItems: 'flex-end', maxWidth: 112 },
  rowAmount: { color: '#102d43', fontSize: 15, fontWeight: '800' },
  amountCaption: { color: '#7c8c9b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  leaseLink: { minHeight: 76, borderWidth: 1, borderColor: '#e2e9ee', borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 14, marginTop: 16 },
  linkIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#edf4f8', alignItems: 'center', justifyContent: 'center' },
  linkCopy: { flex: 1 }, linkTitle: { color: '#102d43', fontSize: 15, fontWeight: '800' }, linkSubtitle: { color: '#667789', fontSize: 12, marginTop: 3 },
  feedback: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  feedbackTitle: { color: '#102d43', fontSize: 17, fontWeight: '800', marginTop: 6 },
  feedbackText: { color: '#667789', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: { paddingHorizontal: 24, minHeight: 46, justifyContent: 'center', backgroundColor: '#082f58', borderRadius: 24, marginTop: 8 },
  retryText: { color: '#ffffff', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { color: '#102d43', fontSize: 16, fontWeight: '800' },
});