import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TenantAPI, { type Tenant } from '../../api/tenantAPI';
import LeaseAPI, { type Lease } from '../../api/leaseAPI';
import type { TenantsStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppTheme';

type DetailRoute = RouteProp<TenantsStackParamList, 'TenantDetail'>;
type DetailNavigation = NativeStackNavigationProp<TenantsStackParamList, 'TenantDetail'>;
const read = (record: Record<string, any> | null, ...keys: string[]) => keys.map(key => record?.[key]).find(value => value !== null && value !== undefined);
const validId = (value: unknown) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? String(id) : null; };
const displayName = (tenant: Tenant) => [read(tenant, 'firstname', 'Firstname', 'firstName', 'FirstName'), read(tenant, 'lastname', 'Lastname', 'lastName', 'LastName')].filter(Boolean).join(' ').trim() || 'Unnamed tenant';
const formatDate = (value: unknown) => {
  if (typeof value !== 'string') return 'Not set';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 'Not set';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[0]) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
};

export default function TenantDetailScreen() {
  const { tenantId } = useRoute<DetailRoute>().params;
  const navigation = useNavigation<DetailNavigation>();
  const { colors, mode } = useAppTheme();
  const dark = mode === 'dark';
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leaseError, setLeaseError] = useState(false);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const refresh = () => { setRefreshing(true); setReload(value => value + 1); };

  useFocusEffect(useCallback(() => {
    let active = true;
    setTenant(null);
    setLeases([]);
    setLeaseError(false);
    setLeaseLoading(true);
    setState('loading');
    const load = async () => {
      try {
        const result = await TenantAPI.getTenant(tenantId);
        if (!active) return;
        if (!result || validId(read(result, 'id', 'Id')) !== tenantId) { setState('missing'); return; }
        setTenant(result);
        setState('ready');
        try {
          const all = await LeaseAPI.getLeases();
          if (active) setLeases(all.filter(lease => Array.isArray(read(lease, 'tenants', 'Tenants')) &&
            (read(lease, 'tenants', 'Tenants') as Tenant[]).some(person => validId(read(person, 'id', 'Id')) === tenantId)));
        } catch {
          if (active) setLeaseError(true);
        } finally {
          if (active) setLeaseLoading(false);
        }
      } catch {
        if (active) setState('error');
      } finally {
        if (active) setRefreshing(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [tenantId, reload]));

  const name = tenant ? displayName(tenant) : '';
  const email = tenant ? read(tenant, 'email', 'Email') : null;
  const phone = tenant ? read(tenant, 'phoneNumber', 'PhoneNumber') : null;
  const property = tenant ? read(tenant, 'propertyName', 'PropertyName') : null;
  const unit = tenant ? read(tenant, 'unitName', 'UnitName') : null;
  const connected = Boolean(tenant && validId(read(tenant, 'userId', 'UserId')));
  const activeLeases = leases.filter(lease => read(lease, 'archived', 'Archived') !== true && read(lease, 'isActive', 'IsActive') === true && read(lease, 'isDrafted', 'IsDrafted') !== true);
  const row = (icon: keyof typeof Ionicons.glyphMap, label: string, value: string, last = false) => (
    <View style={[styles.row, { borderBottomColor: colors.border }, last && styles.last]}>
      <Ionicons name={icon} size={20} color={colors.accent} style={styles.icon} />
      <View style={styles.rowText}><Text style={[styles.label, { color: colors.muted }]}>{label}</Text><Text style={[styles.value, { color: colors.text }]} selectable>{value}</Text></View>
    </View>
  );
  return <ScrollView style={{ flex: 1, backgroundColor: dark ? colors.background : '#fbf7f4' }} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
    {state === 'loading' ? <View style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>Loading tenant…</Text></View> :
      state !== 'ready' || !tenant ? <View style={styles.state} accessibilityRole="alert">
        <Ionicons name="person-outline" size={32} color={colors.accent} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{state === 'missing' ? 'Tenant not found' : 'Tenant unavailable'}</Text>
        <Text style={[styles.stateCopy, { color: colors.muted }]}>{state === 'missing' ? 'This tenant record is no longer available.' : 'We couldn’t load this tenant right now.'}</Text>
        <TouchableOpacity style={[styles.retry, { backgroundColor: colors.accent }]} onPress={refresh} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
      </View> : <>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>TENANT PROFILE</Text>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: dark ? '#233c56' : '#eaf3ff' }]}><Text style={[styles.initials, { color: colors.accent }]}>{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</Text></View>
          <View style={styles.identityText}><Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{name}</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Tenant record #{tenantId}</Text></View>
        </View>
        {read(tenant, 'isActive', 'IsActive') === false && <Text style={[styles.archived, { color: colors.muted }]}>Archived record</Text>}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact & access</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {row('mail-outline', 'Email', email || 'Not added')}
          {row('call-outline', 'Phone', phone || 'Not added')}
          {row('key-outline', 'Portal access', connected ? 'Connected' : email ? 'No portal account' : 'Email needed', true)}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Residence</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {row('home-outline', 'Property on record', property || 'Not assigned')}
          {row('business-outline', 'Unit', unit || 'Not assigned', true)}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Leases</Text>
        {leaseLoading ? <ActivityIndicator color={colors.accent} /> : leaseError ? <Text style={[styles.note, { color: colors.muted }]}>Lease information is unavailable right now. Pull down to retry.</Text> :
          leases.length === 0 ? <Text style={[styles.note, { color: colors.muted }]}>No linked leases found.</Text> :
            leases.map(lease => {
              const id = validId(read(lease, 'id', 'Id'));
              const archived = read(lease, 'archived', 'Archived') === true;
              const current = activeLeases.includes(lease);
              return <TouchableOpacity key={`${archived ? 'archived' : 'live'}-${id}`} disabled={!id} onPress={() => {
                if (id) navigation.getParent<any>()?.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: id, archived } });
              }} accessibilityRole="button" accessibilityLabel={`View ${archived ? 'archived ' : ''}lease ${id}`} style={[styles.lease, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowText}><Text style={[styles.value, { color: colors.text }]}>{read(lease, 'propertyName', 'PropertyName') || 'Lease'}{read(lease, 'unitName', 'UnitName') ? ` · ${read(lease, 'unitName', 'UnitName')}` : ''}</Text>
                  <Text style={[styles.label, { color: colors.muted }]}>{current ? 'Active' : archived ? 'Archived' : 'Not active'} · {formatDate(read(lease, 'startDate', 'StartDate'))} – {formatDate(read(lease, 'endDate', 'EndDate'))}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>;
            })}
        <Text style={[styles.note, { color: colors.muted }]}>To edit tenant details or manage portal invitations, use the web app.</Text>
      </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, minWidth: 0 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 13, marginTop: 3 },
  archived: { marginTop: 14, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 30, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingVertical: 12, borderBottomWidth: 1 },
  last: { borderBottomWidth: 0 },
  icon: { width: 34 },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, lineHeight: 18, marginBottom: 3 },
  value: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  lease: { minHeight: 72, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  note: { fontSize: 13, lineHeight: 20, marginTop: 12 },
  state: { paddingVertical: 72, alignItems: 'center', gap: 12 },
  stateCopy: { textAlign: 'center', lineHeight: 21 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700' },
});
