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
import TenantAPI, { Tenant } from '../../api/tenantAPI';
import type { MaintenanceRequest } from '../../api/maintenanceAPI';
import { forProperty } from '../../features/maintenance/propertyMaintenanceScope';
import { collectionPayload } from '../../features/rentCollection/collectionPayload';
import { propertyOpenRepairs, propertyRentDue, propertyOverdueRent, propertyRentStatus, type PropertyRentStatus } from '../../features/properties/propertyOverview';
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
  const [overdueRent, setOverdueRent] = useState<boolean | null>(null);
  const [rentStatus, setRentStatus] = useState<PropertyRentStatus | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[] | null>(null);
  const [checklists, setChecklists] = useState<Checklist[] | null>(null);
  const [payments, setPayments] = useState<PropertyPayment[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tab, setTab] = useState<'overview' | 'units' | 'checklists' | 'tenants' | 'actions'>('overview');
  const generation = useRef(0);

  const loadProperty = useCallback(async () => {
    const request = ++generation.current;
    const [propertyResult, maintenanceResult, rentResult, checklistResult, paymentResult, tenantResult] = await Promise.allSettled([
      PropertyAPI.getPropertyById(propertyId),
      MaintenanceAPI.getCurrent(),
      RentCollectionAPI.getRentCollection(propertyId).then((response) => {
        const data = collectionPayload(response);
        return {
          due: propertyRentDue(data.rentRecords ?? data.RentRecords, propertyId),
          overdue: propertyOverdueRent(data.rentRecords ?? data.RentRecords, propertyId),
          status: propertyRentStatus(data.rentRecords ?? data.RentRecords, propertyId),
        };
      }),
      ChecklistAPI.getByProperty(propertyId),
      PaymentAPI.getByProperty(propertyId),
      TenantAPI.getTenants(),
    ]);
    if (request !== generation.current) return;
    setProperty(propertyResult.status === 'fulfilled' ? propertyResult.value : null);
    setError(propertyResult.status === 'rejected');
    setOpenRepairs(maintenanceResult.status === 'fulfilled' ? propertyOpenRepairs(maintenanceResult.value, propertyId) : null);
    setRequests(maintenanceResult.status === 'fulfilled' ? forProperty(maintenanceResult.value, propertyId) : null);
    setChecklists(checklistResult.status === 'fulfilled' ? checklistResult.value.filter(item => String(item.propertyId) === String(propertyId)) : null);
    setPayments(paymentResult.status === 'fulfilled' ? paymentResult.value.sort((a, b) => Date.parse(b.paymentDate) - Date.parse(a.paymentDate)).slice(0, 1) : null);
    setTenants(tenantResult.status === 'fulfilled' && Array.isArray(tenantResult.value) ? tenantResult.value.filter(item => String(item.propertyId ?? item.PropertyId) === String(propertyId)) : null);
    setRentDue(rentResult.status === 'fulfilled' ? rentResult.value.due : null);
    setOverdueRent(rentResult.status === 'fulfilled' ? rentResult.value.overdue : null);
    setRentStatus(rentResult.status === 'fulfilled' ? rentResult.value.status : null);
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
  const tenantName = (tenant: Tenant) => [stringValue(tenant.firstname, tenant.firstName, tenant.Firstname, tenant.FirstName), stringValue(tenant.lastname, tenant.lastName, tenant.Lastname, tenant.LastName)].filter(Boolean).join(' ') || stringValue(tenant.email, tenant.Email, 'Tenant');

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
        <TouchableOpacity style={styles.editEntry} accessibilityRole="button" accessibilityLabel="Edit property" onPress={() => navigation.navigate('AddProperty', { propertyId })}>
          <Ionicons name="create-outline" size={18} color={mode === 'dark' ? colors.accent : '#2475cf'} />
          <Text style={styles.editEntryText}>Edit property</Text>
        </TouchableOpacity>
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
            <Snapshot label={rentDue !== null && overdueRent === true ? 'Overdue rent' : 'Rent due'} value={rentDue === null ? '—' : currency(rentDue)} alert={rentDue !== null && overdueRent === true} />
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent} accessibilityRole="tablist">
        {([['overview', 'Overview'], ...(isMultiUnit ? [['units', `Units (${details.units.length})`] as const] : []), ['checklists', 'Checklists'], ['tenants', 'Tenants'], ['actions', 'Actions']] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, visibleTab === key && styles.activeTab]} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: visibleTab === key }}>
            <Text style={[styles.tabText, visibleTab === key && styles.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
            <Text style={styles.paymentHeading}>Rent status</Text>
          </View>
          <Text style={[styles.rentStatusText, rentStatus === 'overdue' && styles.rentStatusOverdue, rentStatus === 'paid' && styles.rentStatusPaid]}>
            {rentStatus === 'overdue' ? 'Overdue' : rentStatus === 'paid' ? 'Paid up to date' : rentStatus === 'due' ? 'Rent due' : rentStatus === 'no-records' ? 'No rent records yet' : 'Rent status unavailable · Pull to retry'}
          </Text>
          {rentDue !== null && rentDue > 0 && (rentStatus === 'overdue' || rentStatus === 'due') ? <Text style={styles.rentBalance}>{currency(rentDue)} rent due</Text> : null}
          <Text style={styles.paymentSubheading}>Most recent payment</Text>
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

      {visibleTab === 'tenants' && <View style={styles.tenantPanel}>
        {tenants === null ? <Text style={styles.tenantEmpty}>Tenants unavailable · Pull to retry</Text> : tenants.length === 0 ? <Text style={styles.tenantEmpty}>No tenants for this property yet.</Text> : tenants.map((tenant, index) => (
          <View key={String(tenant.id ?? tenant.Id ?? index)} style={styles.tenantRow} accessibilityRole="summary">
            <View style={styles.tenantAvatar}><Text style={styles.tenantInitial}>{tenantName(tenant).charAt(0).toUpperCase()}</Text></View>
            <View style={styles.tenantCopy}>
              <Text style={styles.tenantName}>{tenantName(tenant)}</Text>
              {isMultiUnit && <Text style={styles.tenantMeta}>{stringValue(tenant.unitName, tenant.UnitName, 'Unit not assigned')}</Text>}
              {!!stringValue(tenant.email, tenant.Email) && <Text style={styles.tenantMeta}>{stringValue(tenant.email, tenant.Email)}</Text>}
            </View>
          </View>
        ))}
      </View>}

      {visibleTab === 'actions' && <View style={styles.actionList}>
        <ActionRow icon="construct-outline" title={openRepairs === null ? 'Open repairs' : `${openRepairs} open repairs`} titleColor={openRepairs !== null && openRepairs > 0 ? (mode === 'dark' ? '#ff9bad' : '#c2413b') : undefined} subtitle={openRepairs === null ? 'Repair count unavailable' : 'Requests for this property'} color={mode === 'dark' ? '#ff9bad' : '#d94d63'} background={mode === 'dark' ? '#442b38' : '#fff0f3'} onPress={() => navigation.navigate('PropertyMaintenance', { propertyId, propertyName: details.name })} />
        <ActionRow icon="clipboard-outline" title="Checklists" subtitle="Complete move-in and move-out items" color={mode === 'dark' ? '#89dda0' : '#2f8f46'} background={mode === 'dark' ? '#203b30' : '#edf9ef'} onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistEntry(property))} />
        <ActionRow icon="people-outline" title="View tenants" subtitle="Open your tenant directory" color={mode === 'dark' ? colors.accent : '#2475cf'} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.getParent<any>()?.navigate('Tenants')} />
        <ActionRow icon="document-text-outline" title="View leases" subtitle="Review lease status and dates" color={mode === 'dark' ? '#d2a9f4' : '#8b5bb7'} background={mode === 'dark' ? '#392d49' : '#f5effb'} onPress={() => navigation.getParent<any>()?.navigate('Leases')} />
        <ActionRow icon="create-outline" title="Edit property" subtitle="Update building and address details" color={colors.accent} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.navigate('AddProperty', { propertyId })} />
        {!isMultiUnit && details.units[0] && <ActionRow icon="key-outline" title="Edit unit" subtitle="Update beds, baths, and rent" color={colors.accent} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.navigate('AddProperty', { propertyId, mode: 'unit', unitId: String(details.units[0].id ?? details.units[0].Id) })} />}
        {!isMultiUnit && !details.units.length && <ActionRow icon="add-circle-outline" title="Add unit" subtitle="Set up the home's unit" color={colors.accent} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.navigate('AddProperty', { propertyId, mode: 'unit' })} />}
        {isMultiUnit && <ActionRow icon="add-circle-outline" title="Add units" subtitle="Create units for this property" color={colors.accent} background={mode === 'dark' ? '#233e59' : '#eaf3ff'} onPress={() => navigation.navigate('AddProperty', { propertyId, mode: 'unit' })} />}
      </View>}

      {isMultiUnit && visibleTab === 'units' && <>
      <TouchableOpacity style={styles.editEntry} accessibilityRole="button" accessibilityLabel="Add units" onPress={() => navigation.navigate('AddProperty', { propertyId, mode: 'unit' })}><Ionicons name="add-circle-outline" size={18} color={mode === 'dark' ? colors.accent : '#2475cf'} /><Text style={styles.editEntryText}>Add units</Text></TouchableOpacity>
      {details.units.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={27} color={mode === 'dark' ? colors.muted : '#71808d'} />
          <Text style={styles.emptyTitle}>No units to show</Text>
          <Text style={styles.emptyText}>Add a unit to start managing this building.</Text>
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
                <TouchableOpacity style={styles.unitAction} onPress={() => navigation.navigate('AddProperty', { propertyId, mode: 'unit', unitId: String(unit.id ?? unit.Id) })} accessibilityRole="button" accessibilityLabel={`Edit unit ${stringValue(unit.name, unit.Name, unit.unitNumber, unit.UnitNumber, `Unit ${index + 1}`)}`}>
                  <Ionicons name="create-outline" size={20} color={mode === 'dark' ? colors.accent : '#0b3558'} />
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

function Snapshot({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  const { mode } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  return <View style={styles.snapshot}><Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={[styles.snapshotLabel, alert && styles.snapshotAlert]}>{label}</Text></View>;
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
  tabs: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff' },
  tabsContent: { flexGrow: 1, flexDirection: 'row' },
  tab: { flexGrow: 1, minWidth: 72, paddingHorizontal: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
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
  editEntry: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', minHeight: 44, gap: 6, paddingHorizontal: 8 },
  editEntryText: { color: '#2475cf', fontWeight: '800', fontSize: 14 },
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
  rentStatusText: { color: '#18374c', fontSize: 20, fontWeight: '800', marginTop: 15 },
  rentStatusOverdue: { color: '#c2413b' },
  rentStatusPaid: { color: '#237443' },
  rentBalance: { color: '#556d64', fontSize: 13, marginTop: 3 },
  paymentSubheading: { color: '#556d64', fontSize: 12, fontWeight: '700', marginTop: 16 },
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
  address: { color: '#000000', fontSize: 15, fontWeight: 'bold', lineHeight: 21, marginTop: 6 },
  propertyType: { color: '#71808d', fontSize: 14, lineHeight: 20 },
  propertyFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 10 },
  propertyFact: { color: '#516576', fontSize: 13, lineHeight: 19 },
  propertyRent: { color: '#2475cf', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  snapshotRow: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#dce4e8', marginTop: 22, paddingVertical: 16 },
  snapshot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  snapshotDivider: { width: 1, backgroundColor: '#e0e7ec' },
  snapshotValue: { color: '#102d43', fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  snapshotLabel: { color: '#71808d', fontSize: 10, marginTop: 3 },
  snapshotAlert: { color: '#c2413b', fontWeight: '800' },
  sectionTitle: { color: '#102d43', fontSize: 21, fontWeight: '900', letterSpacing: -0.3, marginBottom: 12 },
  actionList: { marginBottom: 30 },
  checklistPanel: { paddingTop: 16, paddingBottom: 24 },
  tenantPanel: { paddingTop: 12, paddingBottom: 24 },
  tenantEmpty: { color: '#71808d', fontSize: 14, paddingVertical: 18 },
  tenantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e7e9' },
  tenantAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  tenantInitial: { color: '#2475cf', fontWeight: '700', fontSize: 17 },
  tenantCopy: { flex: 1, minWidth: 0 },
  tenantName: { color: '#102d43', fontSize: 15, fontWeight: '700' },
  tenantMeta: { color: '#71808d', fontSize: 13, lineHeight: 19, marginTop: 2 },
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
  rentStatusText: { ...lightStyles.rentStatusText, color: '#f2f6fa' },
  rentStatusOverdue: { ...lightStyles.rentStatusOverdue, color: '#ff9bad' },
  rentStatusPaid: { ...lightStyles.rentStatusPaid, color: '#89dda0' },
  rentBalance: { ...lightStyles.rentBalance, color: '#b4c3d0' },
  paymentSubheading: { ...lightStyles.paymentSubheading, color: '#b4c3d0' },
  paymentAmount: { ...lightStyles.paymentAmount, color: '#f2f6fa' },
  paymentMeta: { ...lightStyles.paymentMeta, color: '#b4c3d0' },
  paymentStatus: { ...lightStyles.paymentStatus, color: '#dbe5ee' },
  paymentEmpty: { ...lightStyles.paymentEmpty, color: '#b4c3d0' },
  tabs: { ...lightStyles.tabs, backgroundColor: '#101923', borderBottomColor: '#35495b' },
  activityRow: { ...lightStyles.activityRow, borderBottomColor: '#35495b' },
  checklistHeading: { ...lightStyles.checklistHeading, color: '#f2f6fa' },
  tenantEmpty: { ...lightStyles.tenantEmpty, color: '#b4c3d0' },
  tenantRow: { ...lightStyles.tenantRow, borderBottomColor: '#35495b' },
  tenantAvatar: { ...lightStyles.tenantAvatar, backgroundColor: '#233e59' },
  tenantInitial: { ...lightStyles.tenantInitial, color: '#72b6ff' },
  tenantName: { ...lightStyles.tenantName, color: '#f2f6fa' },
  tenantMeta: { ...lightStyles.tenantMeta, color: '#b4c3d0' },
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
  editEntryText: { ...lightStyles.editEntryText, color: '#72b6ff' },
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
  snapshotAlert: { ...lightStyles.snapshotAlert, color: '#ff9bad' },
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
