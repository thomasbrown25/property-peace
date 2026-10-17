import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import MaintenanceAPI from '../../api/maintenanceAPI';
import RentCollectionAPI from '../../api/rentCollectionAPI';
import ChecklistAPI, { Checklist } from '../../api/checklistAPI';
import PaymentAPI, { PropertyPayment } from '../../api/paymentAPI';
import type { MaintenanceRequest } from '../../api/maintenanceAPI';
import { forProperty } from '../../features/maintenance/propertyMaintenanceScope';
import { collectionPayload } from '../../features/rentCollection/collectionPayload';
import { propertyOpenRepairs, propertyRentDue } from '../../features/properties/propertyOverview';
import { buildPropertyChecklistEntry, buildPropertyChecklistHistoryEntry } from '../../features/checklists/checklistNavigationModel';
import { checklistSummary, recentPropertyChecklists } from '../../features/checklists/recentPropertyChecklists';
import { useAppTheme } from '../../theme/AppTheme';
type PropertyDetailRoute = RouteProp<PropertiesStackParamList, 'PropertyDetail'>;

type PropertyDetailNavigation = NativeStackNavigationProp<PropertiesStackParamList, 'PropertyDetail'>;

const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const numberValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
};

const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const monthlyRent = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export default function PropertyDetailScreen() {
  const { mode, colors } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  const route = useRoute<PropertyDetailRoute>();
  const navigation = useNavigation<PropertyDetailNavigation>();
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [openRepairs, setOpenRepairs] = useState<number | null>(null);
  const [rentDue, setRentDue] = useState<number | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[] | null>(null);
  const [checklists, setChecklists] = useState<Checklist[] | null>(null);
  const [payments, setPayments] = useState<PropertyPayment[] | null>(null);
  const [tab, setTab] = useState<'overview' | 'units' | 'checklists' | 'actions'>('overview');
  const generation = useRef(0);

  const loadProperty = useCallback(async () => {
    const request = ++generation.current;
    const [propertyResult, maintenanceResult, rentResult, checklistResult, paymentResult] = await Promise.allSettled([
      PropertyAPI.getPropertyById(propertyId),
      MaintenanceAPI.getCurrent(),
      RentCollectionAPI.getRentCollection(propertyId).then((response) => {
        const data = collectionPayload(response);
        return propertyRentDue(data.rentRecords ?? data.RentRecords, propertyId);
      }),
      ChecklistAPI.getByProperty(propertyId),
      PaymentAPI.getByProperty(propertyId),
    ]);
    if (request !== generation.current) return;
    setProperty(propertyResult.status === 'fulfilled' ? propertyResult.value : null);
    setError(propertyResult.status === 'rejected');
    setOpenRepairs(maintenanceResult.status === 'fulfilled' ? propertyOpenRepairs(maintenanceResult.value, propertyId) : null);
    setRequests(maintenanceResult.status === 'fulfilled' ? forProperty(maintenanceResult.value, propertyId) : null);
    setChecklists(checklistResult.status === 'fulfilled' ? checklistResult.value.filter(item => String(item.propertyId) === String(propertyId)) : null);
    setPayments(paymentResult.status === 'fulfilled' ? paymentResult.value.sort((a, b) => Date.parse(b.paymentDate) - Date.parse(a.paymentDate)).slice(0, 1) : null);
    setRentDue(rentResult.status === 'fulfilled' ? rentResult.value : null);
    setLoading(false);
    setRefreshing(false);
  }, [propertyId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void loadProperty();
    return () => { ++generation.current; };
  }, [loadProperty]));

  const details = useMemo(() => {
    if (!property) return null;
    const units = property.units || property.Units || [];
    const name = stringValue(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Property');
    const street = stringValue(property.streetAddress, property.StreetAddress, property.address, property.Address);
    const propertyType = stringValue(property.propertyType, property.PropertyType).toLowerCase();
    const imageUrl = stringValue(property.mainImageUrl, property.MainImageUrl, property.images?.[0]?.blobUrl, property.Images?.[0]?.BlobUrl);
    const firstUnit = units[0] || {};
    const beds = numberValue(firstUnit.bedrooms, firstUnit.Bedrooms, property.bedrooms, property.Bedrooms);
    const baths = numberValue(firstUnit.baths, firstUnit.Baths, property.baths, property.Baths);
    const sqft = numberValue(firstUnit.squareFeet, firstUnit.SquareFeet, property.squareFeet, property.SquareFeet);
    const rent = numberValue(firstUnit.rentAmount, firstUnit.RentAmount, property.targetRent, property.TargetRent, property.monthlyRent, property.MonthlyRent);
    const occupied = units.filter((unit: any) => ['occupied', 'overdue'].includes(stringValue(unit.status, unit.Status).toLowerCase())).length;
    return { units, name, street, propertyType, imageUrl, occupied, beds, baths, sqft, rent };
  }, [property]);

  const pendingChecklists = checklists?.filter(item => !item.isCompleted && !item.completedAt) ?? [];
  const recentChecklists = recentPropertyChecklists(checklists ?? [], String(propertyId)).slice(0, 10);

  useEffect(() => {
    navigation.setOptions({ title: details?.name || 'Property' });
  }, [navigation, details?.name]);

  const isMultiUnit = stringValue(property?.propertyType, property?.PropertyType).toLowerCase() === 'multiunit';
  const visibleTab = tab === 'units' && !isMultiUnit ? 'overview' : tab;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>;

  if (error || !property || !details) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={30} color="#a45f12" /></View>
        <Text style={styles.errorTitle}>Property unavailable</Text>
        <Text style={styles.errorText}>We couldn't load this property.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProperty}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProperty(); }} tintColor={mode === 'dark' ? colors.accent : '#2475cf'} />}
      >
      <View style={styles.heroCard}>
        {details.imageUrl ? <Image source={{ uri: details.imageUrl }} style={styles.heroImage} /> : (
          <View style={styles.heroImageFallback}><Ionicons name="home" size={52} color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>
        )}
        <View style={styles.heroBody}>
          {!!details.street && <Text style={styles.address}>{details.street}</Text>}
          {!!details.propertyType && <Text style={styles.propertyType}>{details.propertyType === 'multiunit' ? 'Multi-unit' : details.propertyType === 'singlefamily' ? 'Single-family' : details.propertyType}</Text>}
          {(details.beds > 0 || details.baths > 0 || details.sqft > 0 || details.rent > 0) && (
            <View style={styles.propertyFacts}>
              {details.beds > 0 && <Text style={styles.propertyFact}>🛏 {details.beds} beds</Text>}
              {details.baths > 0 && <Text style={styles.propertyFact}>🛁 {details.baths} baths</Text>}
              {details.sqft > 0 && <Text style={styles.propertyFact}>· {details.sqft.toLocaleString()} sqft</Text>}
              {details.rent > 0 && <Text style={styles.propertyRent}>· {monthlyRent(details.rent)}/mo</Text>}
            </View>
          )}
          <View style={styles.snapshotRow}>
            <Snapshot label="Units occupied" value={`${details.occupied}/${details.units.length}`} />
            <View style={styles.snapshotDivider} />
            <Snapshot label="Open requests" value={openRepairs === null ? '—' : String(openRepairs)} />
            <View style={styles.snapshotDivider} />
            <Snapshot label="Rent due" value={rentDue === null ? '—' : currency(rentDue)} />
          </View>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {([['overview', 'Overview'], ...(isMultiUnit ? [['units', `Units (${details.units.length})`] as const] : []), ['checklists', 'Checklists'], ['actions', 'Actions']] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, visibleTab === key && styles.activeTab]} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: visibleTab === key }}>
            <Text style={[styles.tabText, visibleTab === key && styles.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {visibleTab === 'overview' && <View style={styles.overviewDetails}>
        <Text style={styles.overviewKicker}>PROPERTY PULSE</Text>
        <Text style={styles.sectionTitle} accessibilityRole="header">What needs attention</Text>
        <Text style={styles.overviewIntro}>The next things to check for this property.</Text>
        <TouchableOpacity style={styles.pulseRow} onPress={() => navigation.navigate('PropertyMaintenance', { propertyId, propertyName: details.name })} accessibilityRole="button" accessibilityLabel="View property maintenance requests">
          <View style={[styles.pulseIcon, styles.repairIcon]}><Ionicons name="construct-outline" size={21} color={mode === 'dark' ? '#ffca82' : '#a66310'} /></View>
          <View style={styles.pulseCopy}>
            <Text style={styles.pulseTitle}>Maintenance</Text>
            <Text style={styles.pulseDescription}>{requests === null ? 'Requests unavailable · Pull to retry' : requests.length ? `${requests.length} open ${requests.length === 1 ? 'request' : 'requests'}` : 'No open requests'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={mode === 'dark' ? '#b4c3d0' : '#71808d'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pulseRow, styles.lastPulseRow]} onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistEntry(property))} accessibilityRole="button" accessibilityLabel="View property checklists">
          <View style={[styles.pulseIcon, styles.checklistIcon]}><Ionicons name="clipboard-outline" size={21} color={mode === 'dark' ? '#89dda0' : '#2f8f46'} /></View>
          <View style={styles.pulseCopy}>
            <Text style={styles.pulseTitle}>Checklists</Text>
            <Text style={styles.pulseDescription}>{checklists === null ? 'Checklists unavailable · Pull to retry' : pendingChecklists.length ? `${pendingChecklists.length} ${pendingChecklists.length === 1 ? 'checklist' : 'checklists'} to review` : 'Nothing pending'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={mode === 'dark' ? '#b4c3d0' : '#71808d'} />
        </TouchableOpacity>
        <View style={styles.paymentPanel}>
          <View style={styles.paymentHeader}>
            <View style={styles.paymentIcon}><Ionicons name="receipt-outline" size={21} color={mode === 'dark' ? '#72b6ff' : '#2475cf'} /></View>
            <Text style={styles.paymentHeading}>Latest payment</Text>
          </View>
          {payments === null ? <Text style={styles.paymentEmpty}>Payments unavailable · Pull to retry</Text> : payments.length === 0 ? <Text style={styles.paymentEmpty}>No payments recorded for this property yet.</Text> : (
            <View style={styles.paymentBody}>
              <Text style={styles.paymentAmount}>{Number.isFinite(Number(payments[0].amount)) ? currency(Number(payments[0].amount)) : 'Amount unavailable'}</Text>
              <Text style={styles.paymentMeta}>{[payments[0].tenantName || payments[0].unitName, payments[0].paymentDate ? String(payments[0].paymentDate).slice(0, 10) : null].filter(Boolean).join(' · ') || 'Payment details unavailable'}</Text>
              <Text style={styles.paymentStatus}>{stringValue(payments[0].status, 'Status unavailable')}</Text>
            </View>
          )}
        </View>
      </View>}

      {visibleTab === 'checklists' && <View style={styles.checklistPanel}>
        <View style={styles.checklistHeader}>
          <Text style={styles.checklistHeading}>Recent checklists</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistHistoryEntry(property))} accessibilityRole="button" accessibilityLabel="View all checklists for this property">
            <Text style={styles.viewAllText}>View all</Text>
            <Ionicons name="arrow-forward" size={17} color={mode === 'dark' ? '#72b6ff' : '#2475cf'} />
          </TouchableOpacity>
        </View>
        {checklists === null ? <Text style={styles.activityMeta}>Checklists unavailable · Pull to retry</Text> : recentChecklists.length === 0 ? <Text style={styles.activityMeta}>No checklists for this property yet</Text> : recentChecklists.map((item, index) => (
          <TouchableOpacity key={String(item.id ?? index)} style={styles.activityRow} onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistHistoryEntry(property))} accessibilityRole="button">
            <Text style={styles.activityTitle}>{item.title || item.checklistTypeName || 'Checklist'}</Text>
            <Text style={styles.activityMeta}>{checklistSummary(item)}</Text>
          </TouchableOpacity>
        ))}
      </View>}

      {visibleTab === 'actions' && <View style={styles.actionList}>
        <ActionRow icon="construct-outline" title={openRepairs === null ? 'Open repairs' : `${openRepairs} open repairs`} titleColor={openRepairs !== null && openRepairs > 0 ? (mode === 'dark' ? '#ff9bad' : '#c2413b') : undefined} subtitle={openRepairs === null ? 'Repair count unavailable' : 'Requests for this property'} color={mode === 'dark' ? '#ff9bad' : '#d94d63'} background={mode === 'dark' ? '#442b38' : '#fff0f3'} onPress={() => navigation.navigate('PropertyMaintenance', { propertyId, propertyName: details.name })} />
        <ActionRow icon="clipboard-outline" title="Checklists" subtitle="Complete move-in and move-out items" color={mode === 'dark' ? '#89dda0' : '#2f8f46'} background={mode === 'dark' ? '#203b30' : '#edf9ef'} onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistEntry(property))} />
        <ActionRow icon="people-outline" title="View tenants" subtitle="Open your tenant directory" color={mode === 'dark' ? colors.accent : '#2475cf'} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.getParent<any>()?.navigate('Tenants')} />
        <ActionRow icon="document-text-outline" title="View leases" subtitle="Review lease status and dates" color={mode === 'dark' ? '#d2a9f4' : '#8b5bb7'} background={mode === 'dark' ? '#392d49' : '#f5effb'} onPress={() => navigation.getParent<any>()?.navigate('Leases')} />
      </View>}

      {isMultiUnit && visibleTab === 'units' && <>
      {details.units.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={27} color={mode === 'dark' ? colors.muted : '#71808d'} />
          <Text style={styles.emptyTitle}>No units to show</Text>
          <Text style={styles.emptyText}>Add or manage units in the web app, then use them here for maintenance and checklists.</Text>
        </View>
      ) : (
        <View style={styles.unitList}>
          {details.units.map((unit: any, index: number) => {
            const status = stringValue(unit.status, unit.Status, 'Unknown');
            const rent = numberValue(unit.rentAmount, unit.RentAmount, unit.monthlyRent, unit.MonthlyRent);
            const unitId = String(unit.id || unit.Id || index);
            return (
              <View key={unitId} style={styles.unitCard}>
                <View style={styles.unitIcon}><Ionicons name="key-outline" size={21} color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>
                <View style={styles.unitCopy}>
                  <Text style={styles.unitName}>{stringValue(unit.name, unit.Name, unit.unitNumber, unit.UnitNumber, `Unit ${index + 1}`)}</Text>
                  <Text style={styles.unitMeta}>{status}{rent > 0 ? ` · ${currency(rent)}/mo` : ''}</Text>
                </View>
                <TouchableOpacity style={styles.unitAction} onPress={() => navigation.navigate('PropertyMaintenance', { propertyId, propertyName: details.name })} accessibilityLabel="View property maintenances">
                  <Ionicons name="construct-outline" size={20} color={mode === 'dark' ? colors.accent : '#0b3558'} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
      </>}
      </ScrollView>
    </View>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  const { mode } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  return <View style={styles.snapshot}><Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.snapshotLabel}>{label}</Text></View>;
}

function ActionRow({ icon, title, titleColor, subtitle, color, background, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; titleColor?: string; subtitle: string; color: string; background: string; onPress: () => void }) {
  const { mode, colors } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.actionIcon, { backgroundColor: background }]}><Ionicons name={icon} size={24} color={color} /></View>
      <View style={styles.actionCopy}><Text style={[styles.actionTitle, titleColor && { color: titleColor }]}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={mode === 'dark' ? colors.muted : '#8c9aa6'} />
    </TouchableOpacity>
  );
}

const lightStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 18, paddingBottom: 28 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff' },
  tab: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2563eb' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: '#0f2f47', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' },
  errorIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff8e8', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  errorTitle: { color: '#102d43', fontSize: 19, fontWeight: '900' },
  errorText: { color: '#697887', marginTop: 5 },
  retryButton: { minHeight: 44, justifyContent: 'center', backgroundColor: '#2475cf', borderRadius: 13, paddingHorizontal: 18, marginTop: 16 },
  retryText: { color: '#fff', fontWeight: '900' },
  heroCard: { marginBottom: 16 },
  overviewDetails: { paddingTop: 22 },
  overviewKicker: { color: '#2475cf', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  overviewIntro: { color: '#667789', fontSize: 14, lineHeight: 20, marginBottom: 13 },
  pulseRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e7e9', paddingVertical: 12 },
  lastPulseRow: { borderBottomWidth: 0 },
  pulseIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  repairIcon: { backgroundColor: '#fff4e5' },
  checklistIcon: { backgroundColor: '#edf9ef' },
  pulseCopy: { flex: 1, minWidth: 0 },
  pulseTitle: { color: '#102d43', fontSize: 15, fontWeight: '800' },
  pulseDescription: { color: '#667789', fontSize: 13, lineHeight: 18, marginTop: 3 },
  paymentPanel: { backgroundColor: '#eaf3ff', borderRadius: 20, padding: 18, marginTop: 22, marginBottom: 12 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  paymentIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#d8e9ff', alignItems: 'center', justifyContent: 'center' },
  paymentHeading: { color: '#18374c', fontSize: 15, fontWeight: '800' },
  paymentBody: { marginTop: 11 },
  paymentAmount: { color: '#102d43', fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
  paymentMeta: { color: '#556d64', fontSize: 13, lineHeight: 19, marginTop: 3 },
  paymentStatus: { color: '#18374c', fontSize: 12, fontWeight: '700', marginTop: 7 },
  paymentEmpty: { color: '#556d64', fontSize: 13, lineHeight: 19, marginTop: 11 },
  activityRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#e2e7e9' },
  activityTitle: { color: '#102d43', fontSize: 15, fontWeight: '700' },
  activityMeta: { color: '#71808d', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  heroImage: { width: '100%', height: 190, borderRadius: 18, backgroundColor: '#eaf3ff' },
  heroImageFallback: { width: '100%', height: 150, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  heroBody: { paddingTop: 20 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 },
  title: { color: '#102d43', fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  address: { color: '#516576', fontSize: 15, fontWeight: 'bold', lineHeight: 21, marginTop: 6 },
  propertyType: { color: '#71808d', fontSize: 14, lineHeight: 20 },
  propertyFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 10 },
  propertyFact: { color: '#516576', fontSize: 13, lineHeight: 19 },
  propertyRent: { color: '#2475cf', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  snapshotRow: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#dce4e8', marginTop: 22, paddingVertical: 16 },
  snapshot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  snapshotDivider: { width: 1, backgroundColor: '#e0e7ec' },
  snapshotValue: { color: '#102d43', fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  snapshotLabel: { color: '#71808d', fontSize: 10, marginTop: 3 },
  sectionTitle: { color: '#102d43', fontSize: 21, fontWeight: '900', letterSpacing: -0.3, marginBottom: 12 },
  actionList: { marginBottom: 30 },
  checklistPanel: { paddingTop: 16, paddingBottom: 24 },
  checklistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  checklistHeading: { color: '#102d43', fontSize: 17, fontWeight: '800', flex: 1 },
  viewAllButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  viewAllText: { color: '#2475cf', fontSize: 14, fontWeight: '800' },
  actionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: '#e2e7e9', paddingVertical: 12 },
  actionIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: '#102d43', fontSize: 15, fontWeight: '900' },
  actionSubtitle: { color: '#71808d', fontSize: 12, lineHeight: 17, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countChip: { minWidth: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff', marginBottom: 11 },
  countText: { color: '#2475cf', fontSize: 12, fontWeight: '900' },
  emptyCard: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e7e9', paddingVertical: 30, paddingHorizontal: 18 },
  emptyTitle: { color: '#102d43', fontSize: 16, fontWeight: '900', marginTop: 9 },
  emptyText: { color: '#71808d', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  unitList: { borderTopWidth: 1, borderTopColor: '#e2e7e9' },
  unitCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e7e9', paddingVertical: 12 },
  unitIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  unitCopy: { flex: 1 },
  unitName: { color: '#102d43', fontSize: 15, fontWeight: '900' },
  unitMeta: { color: '#71808d', fontSize: 12, marginTop: 3 },
  unitAction: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f9' },
});

const darkStyles = StyleSheet.create({
  ...lightStyles,
  container: { ...lightStyles.container, backgroundColor: '#101923' },
  overviewKicker: { ...lightStyles.overviewKicker, color: '#72b6ff' },
  overviewIntro: { ...lightStyles.overviewIntro, color: '#b4c3d0' },
  pulseRow: { ...lightStyles.pulseRow, borderBottomColor: '#35495b' },
  repairIcon: { ...lightStyles.repairIcon, backgroundColor: '#4b3829' },
  checklistIcon: { ...lightStyles.checklistIcon, backgroundColor: '#203b30' },
  pulseTitle: { ...lightStyles.pulseTitle, color: '#f2f6fa' },
  pulseDescription: { ...lightStyles.pulseDescription, color: '#b4c3d0' },
  paymentPanel: { ...lightStyles.paymentPanel, backgroundColor: '#233e59' },
  paymentIcon: { ...lightStyles.paymentIcon, backgroundColor: '#315372' },
  paymentHeading: { ...lightStyles.paymentHeading, color: '#f2f6fa' },
  paymentAmount: { ...lightStyles.paymentAmount, color: '#f2f6fa' },
  paymentMeta: { ...lightStyles.paymentMeta, color: '#b4c3d0' },
  paymentStatus: { ...lightStyles.paymentStatus, color: '#dbe5ee' },
  paymentEmpty: { ...lightStyles.paymentEmpty, color: '#b4c3d0' },
  tabs: { ...lightStyles.tabs, backgroundColor: '#101923', borderBottomColor: '#35495b' },
  activityRow: { ...lightStyles.activityRow, borderBottomColor: '#35495b' },
  checklistHeading: { ...lightStyles.checklistHeading, color: '#f2f6fa' },
  viewAllText: { ...lightStyles.viewAllText, color: '#72b6ff' },
  activityTitle: { ...lightStyles.activityTitle, color: '#f2f6fa' },
  activityMeta: { ...lightStyles.activityMeta, color: '#b4c3d0' },
  activeTab: { ...lightStyles.activeTab, borderBottomColor: '#72b6ff' },
  tabText: { ...lightStyles.tabText, color: '#b4c3d0' },
  activeTabText: { ...lightStyles.activeTabText, color: '#f2f6fa' },
  center: { ...lightStyles.center, backgroundColor: '#101923' },
  errorIcon: { ...lightStyles.errorIcon, backgroundColor: '#493a25' },
  errorTitle: { ...lightStyles.errorTitle, color: '#f2f6fa' },
  errorText: { ...lightStyles.errorText, color: '#b4c3d0' },
  heroImage: { ...lightStyles.heroImage, backgroundColor: '#233e59' },
  heroImageFallback: { ...lightStyles.heroImageFallback, backgroundColor: '#233e59' },
  eyebrow: { ...lightStyles.eyebrow, color: '#89dda0' },
  title: { ...lightStyles.title, color: '#f2f6fa' },
  address: { ...lightStyles.address, color: '#dbe5ee' },
  propertyType: { ...lightStyles.propertyType, color: '#b4c3d0' },
  propertyFact: { ...lightStyles.propertyFact, color: '#b4c3d0' },
  propertyRent: { ...lightStyles.propertyRent, color: '#72b6ff' },
  snapshotRow: { ...lightStyles.snapshotRow, borderColor: '#35495b' },
  snapshotDivider: { ...lightStyles.snapshotDivider, backgroundColor: '#35495b' },
  snapshotValue: { ...lightStyles.snapshotValue, color: '#f2f6fa' },
  snapshotLabel: { ...lightStyles.snapshotLabel, color: '#b4c3d0' },
  sectionTitle: { ...lightStyles.sectionTitle, color: '#f2f6fa' },
  actionRow: { ...lightStyles.actionRow, borderBottomColor: '#35495b' },
  actionTitle: { ...lightStyles.actionTitle, color: '#f2f6fa' },
  actionSubtitle: { ...lightStyles.actionSubtitle, color: '#b4c3d0' },
  countChip: { ...lightStyles.countChip, backgroundColor: '#233e59' },
  countText: { ...lightStyles.countText, color: '#72b6ff' },
  emptyCard: { ...lightStyles.emptyCard, borderTopColor: '#35495b' },
  emptyTitle: { ...lightStyles.emptyTitle, color: '#f2f6fa' },
  emptyText: { ...lightStyles.emptyText, color: '#b4c3d0' },
  unitList: { ...lightStyles.unitList, borderTopColor: '#35495b' },
  unitCard: { ...lightStyles.unitCard, borderBottomColor: '#35495b' },
  unitIcon: { ...lightStyles.unitIcon, backgroundColor: '#233e59' },
  unitName: { ...lightStyles.unitName, color: '#f2f6fa' },
  unitMeta: { ...lightStyles.unitMeta, color: '#b4c3d0' },
  unitAction: { ...lightStyles.unitAction, backgroundColor: '#1b2937' },
});
