import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TenantAPI, { type Tenant } from '../../api/tenantAPI';
import TenantInviteAPI, { type TenantInvite } from '../../api/tenantInviteAPI';
import LeaseAPI, { type Lease } from '../../api/leaseAPI';
import { emptyTenantForm, formFromTenant, tenantPayload, validateTenant, type TenantForm } from '../../features/tenants/tenantForm';
import { invitationStatus, inviteEmail, inviteError } from '../../features/tenants/tenantInvite';
import TenantAssociationFields from './TenantAssociationFields';
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [associationsReady, setAssociationsReady] = useState(false);
  const [form, setForm] = useState<TenantForm>(emptyTenantForm);
  const [invites, setInvites] = useState<TenantInvite[]>([]);
  const [inviteState, setInviteState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sendingInvite, setSendingInvite] = useState(false);
  const refresh = () => { setRefreshing(true); setReload(value => value + 1); };

  useFocusEffect(useCallback(() => {
    let active = true;
    setTenant(null);
    setEditing(false);
    setLeases([]);
    setLeaseError(false);
    setLeaseLoading(true);
    setInvites([]);
    setInviteState('loading');
    setState('loading');
    const load = async () => {
      try {
        const result = await TenantAPI.getTenant(tenantId);
        if (!active) return;
        if (!result || validId(read(result, 'id', 'Id')) !== tenantId) { setState('missing'); return; }
        setTenant(result);
        setState('ready');
        void TenantInviteAPI.getInvitesByTenantId(tenantId).then(items => {
          if (active) { setInvites(items); setInviteState('ready'); }
        }).catch(() => { if (active) setInviteState('error'); });
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

  const save = async () => {
    if (!tenant || saving || !associationsReady) return;
    const problem = validateTenant(form, 'edit');
    if (problem) { Alert.alert('Check tenant details', problem); return; }
    setSaving(true);
    try {
      await TenantAPI.updateTenant({ ...tenantPayload(form, tenant), id: tenantId });
      // Reload the server's representation rather than assuming the submitted values were stored.
      const updated = await TenantAPI.getTenant(tenantId);
      if (!updated || validId(read(updated, 'id', 'Id')) !== tenantId) throw new Error('Could not reload the updated tenant.');
      setTenant(updated);
      setEditing(false);
      Alert.alert('Tenant saved', 'Tenant details were updated.');
    } catch (error: any) {
      Alert.alert('Could not save tenant', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendPortalInvite = async () => {
    if (!tenant || sendingInvite || inviteState !== 'ready' || editing) return;
    const address = inviteEmail(tenant);
    if (!address) return;
    const existing = invitationStatus(tenant, invites);
    let alreadySent = false;
    setSendingInvite(true);
    try {
      // Server validates organization ownership and the saved tenant email.
      if (existing) await TenantInviteAPI.resendInvite(existing.id);
      else {
        const response = await TenantInviteAPI.createInvite(tenantId, address);
        if (response.data?.email?.trim().toLowerCase() !== address.toLowerCase()) {
          throw new Error('The saved tenant email has changed. Refresh the tenant before inviting.');
        }
        alreadySent = response.message === 'Portal invite already sent';
      }
    } catch (error) {
      Alert.alert('Could not send portal invitation', inviteError(error));
      setSendingInvite(false);
      return;
    }
    try {
      setInviteState('loading');
      setInvites(await TenantInviteAPI.getInvitesByTenantId(tenantId));
      setInviteState('ready');
    } catch {
      setInviteState('error');
    } finally {
      setSendingInvite(false);
      Alert.alert(existing ? 'Invitation resent' : alreadySent ? 'Invitation already pending' : 'Invitation sent',
        alreadySent ? `An active portal invitation already exists for ${address}. No new email was sent.` :
          `A portal invitation email was ${existing ? 'resent' : 'sent'} to ${address}. This does not create or change the tenant record or connect a portal account.`);
    }
  };

  const name = tenant ? displayName(tenant) : '';
  const email = tenant ? read(tenant, 'email', 'Email') : null;
  const phone = tenant ? read(tenant, 'phoneNumber', 'PhoneNumber') : null;
  const property = tenant ? read(tenant, 'propertyName', 'PropertyName') : null;
  const unit = tenant ? read(tenant, 'unitName', 'UnitName') : null;
  const connected = Boolean(tenant && validId(read(tenant, 'userId', 'UserId')));
  const pendingInvite = tenant ? invitationStatus(tenant, invites) : null;
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
          <View style={styles.identityText}><View style={styles.nameRow}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{name}</Text>
            <TouchableOpacity style={styles.editIcon} onPress={() => { setForm(formFromTenant(tenant)); setEditing(true); }} disabled={editing || saving} accessibilityRole="button" accessibilityLabel={`Edit ${name}`}>
              <Ionicons name="pencil-outline" size={21} color={colors.accent} />
            </TouchableOpacity>
          </View><Text style={[styles.subtitle, { color: colors.muted }]}>Tenant record #{tenantId}</Text></View>
        </View>
        {read(tenant, 'isActive', 'IsActive') === false && <Text style={[styles.archived, { color: colors.muted }]}>Archived record</Text>}
        {editing && <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, styles.editTitle, { color: colors.text }]}>Edit tenant</Text>
          {([['firstName', 'First name'], ['lastName', 'Last name'], ['email', 'Email'], ['phoneNumber', 'Phone']] as const).map(([key, label]) =>
            <View key={key} style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form[key]}
                onChangeText={value => setForm(current => ({ ...current, [key]: value }))} accessibilityLabel={label}
                autoCapitalize={key === 'email' ? 'none' : 'words'} keyboardType={key === 'email' ? 'email-address' : key === 'phoneNumber' ? 'phone-pad' : 'default'} />
            </View>)}
          <TenantAssociationFields form={form} onChange={change => setForm(current => ({ ...current, ...change }))} onReadyChange={setAssociationsReady} disabled={saving} />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.action, { borderColor: colors.border }]} disabled={saving} onPress={() => setEditing(false)} accessibilityRole="button" accessibilityLabel="Cancel editing"><Text style={[styles.actionText, { color: colors.text }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.action, { backgroundColor: colors.accent }, (saving || !associationsReady) && styles.disabled]} disabled={saving || !associationsReady} onPress={() => void save()} accessibilityRole="button" accessibilityLabel="Save tenant">{saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionText, { color: '#fff' }]}>Save</Text>}</TouchableOpacity>
          </View>
        </View>}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact & access</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {row('mail-outline', 'Email', email || 'Not added')}
          {row('call-outline', 'Phone', phone || 'Not added')}
          {row('key-outline', 'Portal access', connected ? 'Connected' : email ? 'No portal account' : 'Email needed', true)}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Portal invitation</Text>
        <Text style={[styles.note, { color: colors.muted }]}>A tenant record is separate from a portal account. An invitation emails the tenant a link to connect their account.</Text>
        {connected ? <Text style={[styles.note, { color: colors.muted }]}>Portal account connected. No invitation needed.</Text> :
          !inviteEmail(tenant) ? <Text style={[styles.note, { color: colors.muted }]}>Save a valid tenant email before inviting.</Text> :
            inviteState === 'loading' ? <ActivityIndicator color={colors.accent} /> :
              inviteState === 'error' ? <TouchableOpacity onPress={async () => {
                setInviteState('loading');
                try { setInvites(await TenantInviteAPI.getInvitesByTenantId(tenantId)); setInviteState('ready'); }
                catch (error) { setInviteState('error'); Alert.alert('Could not load invitations', inviteError(error)); }
              }} accessibilityRole="button" accessibilityLabel="Retry loading portal invitations"><Text style={[styles.note, { color: colors.accent }]}>Could not load invitations. Tap to retry.</Text></TouchableOpacity> : <>
                <Text style={[styles.note, { color: colors.muted }]}>{pendingInvite ? `Invitation pending for ${pendingInvite.email}. Account not connected yet.` : 'No active portal invitation.'}</Text>
                <TouchableOpacity style={[styles.retry, { backgroundColor: colors.accent, alignSelf: 'flex-start', marginTop: 12 }, (sendingInvite || editing) && styles.disabled]}
                  disabled={sendingInvite || editing} accessibilityRole="button" accessibilityLabel={pendingInvite ? 'Resend portal invitation' : 'Invite to portal'}
                  onPress={() => void sendPortalInvite()}>{sendingInvite ? <ActivityIndicator color="#fff" /> : <Text style={styles.retryText}>{pendingInvite ? 'Resend invitation' : 'Invite to portal'}</Text>}</TouchableOpacity>
              </>}
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
      </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: '800' },
  title: { flexShrink: 1, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 13, marginTop: 3 },
  archived: { marginTop: 14, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 30, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  editCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 22 },
  editTitle: { marginTop: 0 },
  field: { marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 12, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: 'transparent', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
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
