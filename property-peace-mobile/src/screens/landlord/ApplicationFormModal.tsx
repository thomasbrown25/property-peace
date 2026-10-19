import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApplication, saveApplication, type RentalApplication } from '../../api/landlordApplicationsAPI';
import { applicationError, applicationInitial, applicationTexts, prefillApplicationTenant, tenantMatchesApplication, type ApplicationForm, type ApplicationText } from '../../features/rentals/applicationForm';
import { useAppTheme } from '../../theme/AppTheme';
import { FormAction, FormSwitch, FormText, formTitle } from './RentalFormFields';
import { multiUnit, PropertyUnitPicker } from './PropertyUnitPicker';
import type { Property } from '../../api/propertyAPI';
import TenantAPI, { type Tenant } from '../../api/tenantAPI';

export default function ApplicationFormModal({ visible, scope, item, onClose, onSaved }: { visible: boolean; scope: string; item?: RentalApplication; onClose: () => void; onSaved: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(() => applicationInitial(item));
  const [original, setOriginal] = useState<ApplicationForm | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantError, setTenantError] = useState('');
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantRetry, setTenantRetry] = useState(0);
  const [tenantQuery, setTenantQuery] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [requiresUnit, setRequiresUnit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setForm(applicationInitial(item)); setOriginal(null); setError(''); setRequiresUnit(!!item?.unitId);
    setSelectedTenantId(null); setTenantQuery('');
    if (item?.id) {
      let live = true;
      setLoading(true);
      getApplication(item.id).then(data => { if (live) { const loaded = applicationInitial(data); setOriginal(loaded); setForm(loaded); } })
        .catch(() => { if (live) setError('Could not load full application. Close and try again.'); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }
  }, [visible, scope, item?.id]);
  useEffect(() => {
    if (!visible || !scope) return;
    let live = true;
    setTenantLoading(true); setTenantError(''); setTenants([]);
    TenantAPI.getTenants().then(result => { if (live) setTenants(result); })
      .catch(() => { if (live) setTenantError('Could not load existing tenants. You can still enter an applicant manually.'); })
      .finally(() => { if (live) setTenantLoading(false); });
    return () => { live = false; };
  }, [visible, scope, tenantRetry]);
  const visibleTenants = tenants.filter(tenant => tenantMatchesApplication(tenant, form) &&
    `${tenant.firstname ?? tenant.firstName ?? ''} ${tenant.lastname ?? tenant.lastName ?? ''} ${tenant.email ?? ''}`.toLowerCase().includes(tenantQuery.trim().toLowerCase()));
  const selectTenant = (tenant: Tenant) => {
    setSelectedTenantId(String(tenant.id));
    setForm(previous => prefillApplicationTenant(previous, tenant));
    setError('');
  };
  const change = (key: ApplicationText, value: string) => { setForm(previous => ({ ...previous, [key]: value })); setError(''); };
  const submit = async () => {
    if (busy || loading || (item && !original) || !scope || error.startsWith('Could not load')) return;
    const problem = applicationError(form, !!item, requiresUnit, original ?? undefined);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      await saveApplication(form, item?.id);
      onClose(); onSaved(); Alert.alert('Application saved', item ? 'Application updated.' : 'Application created.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save application. Try again.'); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible && !!scope} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }}>
    <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{item ? 'Edit application' : 'Enter application'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close application form" onPress={onClose} style={{ padding: 14 }}><Text style={{ color: colors.accent }}>Close</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 50 }}>
      {item ? <Text style={{ color: colors.muted }}>Property and unit cannot be changed after creation. Status changes are managed separately. Existing dates and numbers can be replaced but not cleared here.</Text> : <PropertyUnitPicker propertyId={form.propertyId} unitId={form.unitId} onChange={(propertyId, unitId, property?: Property) => { setForm(previous => ({ ...previous, propertyId, unitId })); setSelectedTenantId(null); setRequiresUnit(multiUnit(property)); setError(''); }} />}
      {(!item || original) && <><Text style={{ color: colors.text, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>Existing tenant (optional)</Text>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Choose a tenant to copy contact details, then review or edit the application. This does not link the application to a tenant record. Manual entry keeps any details already copied.</Text>
      {tenantLoading && <ActivityIndicator accessibilityLabel="Loading tenants" color={colors.accent} />}
      {!!tenantError && <Pressable accessibilityRole="button" accessibilityLabel="Retry loading tenants" onPress={() => setTenantRetry(value => value + 1)}><Text style={{ color: '#b93535', marginBottom: 8 }}>{tenantError} Retry loading tenants.</Text></Pressable>}
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedTenantId === null }} onPress={() => setSelectedTenantId(null)} style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: selectedTenantId === null ? colors.accent : colors.border, marginBottom: 6 }}><Text style={{ color: colors.text }}>Use manual entry</Text></Pressable>
      {!tenantLoading && !tenantError && <>
        <TextInput accessibilityLabel="Search existing tenants" placeholder="Search tenants by name or email" placeholderTextColor={colors.muted} value={tenantQuery} onChangeText={setTenantQuery} style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginVertical: 8 }} />
        {visibleTenants.map(tenant => {
          const label = `${tenant.firstname ?? tenant.firstName ?? ''} ${tenant.lastname ?? tenant.lastName ?? ''}`.trim() || 'Unnamed tenant';
          return <Pressable key={String(tenant.id)} accessibilityRole="radio" accessibilityLabel={`${label}${tenant.email ? `, ${tenant.email}` : ''}`} accessibilityState={{ checked: selectedTenantId === String(tenant.id) }} onPress={() => selectTenant(tenant)} style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: selectedTenantId === String(tenant.id) ? colors.accent : colors.border, marginBottom: 6 }}><Text style={{ color: colors.text }}>{label}{tenant.email ? ` · ${tenant.email}` : ''}</Text></Pressable>;
        })}
        {!visibleTenants.length && <Text style={{ color: colors.muted }}>No matching tenants for this property and unit. Enter the applicant manually or change the selection.</Text>}
      </>}</>}
      {loading && <Text style={{ color: colors.muted }}>Loading application…</Text>}
      {applicationTexts.map(key => <FormText key={key} title={formTitle(key)} value={form[key]} onChange={value => change(key, value)} number={['monthlyIncome', 'employmentMonths', 'numberOfOccupants'].includes(key)} multiline={['additionalNotes', 'petDetails', 'vehicleDetails'].includes(key)} />)}
      <FormSwitch title="Has pets" value={form.hasPets} onChange={value => setForm(previous => ({ ...previous, hasPets: value }))} />
      <FormSwitch title="Has vehicles" value={form.hasVehicles} onChange={value => setForm(previous => ({ ...previous, hasVehicles: value }))} />
      {!item && <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>{[0, 1].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: form.status === value }} onPress={() => setForm(previous => ({ ...previous, status: value }))} style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: form.status === value ? colors.accent : colors.border }}><Text style={{ color: colors.text }}>{value === 0 ? 'Save as draft' : 'Submit application'}</Text></Pressable>)}</View>}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#b93535', marginTop: 14 }}>{error}</Text>}
      <FormAction label={item ? 'Save application' : form.status === 0 ? 'Create draft application' : 'Submit application'} busy={busy || loading || !!item && !original || error.startsWith('Could not load')} onPress={() => { void submit(); }} />
    </ScrollView>
  </View></Modal>;
}
