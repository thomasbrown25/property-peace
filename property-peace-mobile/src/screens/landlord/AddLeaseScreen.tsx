import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PropertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import LeaseAPI from '../../api/leaseAPI';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';
import { emptyLease, hydrateLease, isSignedLease, leasePayload, rowFields, validateLease, type LeaseForm, type LeaseRow, type RowField } from '../../features/leases/leaseForm';

const idOf = (value: { id?: number | string; Id?: number | string }) => Number(value.id ?? value.Id);
const label = (value: any) => String(value?.name ?? value?.Name ?? value?.streetAddress ?? 'Unnamed');
export default function AddLeaseScreen() {
  const navigation = useNavigation<any>();
  const leaseId = (useRoute().params as { leaseId?: string } | undefined)?.leaseId;
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState<LeaseForm>(emptyLease);
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const mark = (current: LeaseForm, key: string) => current.dirtyFields.includes(key) ? current.dirtyFields : [...current.dirtyFields, key];
  const updateExtra = (key: keyof LeaseForm, value: string | boolean) => { setForm(current => ({ ...current, [key]: value, dirtyFields: mark(current, key) })); setError(''); };
  const updateRow = (key: RowField, index: number, field: string, value: string | boolean) => {
    setForm(current => {
      const rows = key === 'parking' ? [current.parking ?? {}] : [...current[key] as LeaseRow[]];
      rows[index] = { ...rows[index], [field]: value };
      return { ...current, [key]: key === 'parking' ? rows[0] : rows, dirtyFields: mark(current, key) };
    }); setError('');
  };
  const addRow = (key: Exclude<RowField, 'parking'>) => setForm(current => ({ ...current, [key]: [...current[key], key === 'leaseKeys' ? { keyType: 'Property', copies: '1' } : key === 'utilityServiceResponsibilities' ? { responsibility: 'Tenant' } : key === 'maintenanceResponsibilities' ? { responsibility: 'Landlord' } : {}], dirtyFields: mark(current, key) }));
  const removeRow = (key: Exclude<RowField, 'parking'>, index: number) => setForm(current => ({ ...current, [key]: current[key].filter((_, i) => i !== index), dirtyFields: mark(current, key) }));
  const selection = useRef(0);
  const signed = useRef(false);
  const update = (key: keyof LeaseForm, value: string) => { setForm(current => ({ ...current, [key]: value })); setError(''); };

  useEffect(() => {
    let active = true;
    if (leaseId) {
      LeaseAPI.getLeases().then(leases => {
        const match = leases.find(item => !item.archived && String(item.id ?? item.Id) === leaseId);
        if (!match) throw new Error('Lease not found');
        if (isSignedLease(match)) throw new Error('Signed leases cannot be edited here.');
        if (active) { signed.current = false; setForm(hydrateLease(match)); }
      }).catch((reason: unknown) => { if (active) { signed.current = true; setError(reason instanceof Error && reason.message === 'Signed leases cannot be edited here.' ? reason.message : 'Could not load the lease for editing. Go back and try again.'); } })
        .finally(() => { if (active) setLoading(false); });
    } else {
      PropertyAPI.getProperties().then(data => { if (active) setProperties(data || []); })
        .catch(() => { if (active) setError('Could not load properties. Go back and try again.'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [leaseId]);
  const selectProperty = async (selected: Property) => {
    const request = ++selection.current;
    setProperty(selected); setUnit(null); setUnits([]);
    setForm(current => ({ ...current, propertyId: idOf(selected), unitId: 0 }));
    setError(''); setLoadingUnits(true);
    try {
      const data = await PropertyAPI.getUnits(idOf(selected));
      if (Array.isArray(data)) { if (request === selection.current) setUnits(data); } else throw new Error('Invalid units');
    } catch { if (request === selection.current) setError('Could not load units for this property. Tap the property to retry.'); }
    finally { if (request === selection.current) setLoadingUnits(false); }
  };
  const save = async () => {
    if (saving || loading || loadingUnits || signed.current || (leaseId && !form.id)) return;
    const problem = validateLease(form, form.isDraft);
    if (problem) { setError(problem); return; }
    setSaving(true); setError('');
    try {
      let payloadForm = form;
      if (leaseId) {
        const latest = (await LeaseAPI.getLeases()).find(item => !item.archived && String(item.id ?? item.Id) === leaseId);
        if (!latest) throw new Error('Lease no longer available for editing.');
        if (isSignedLease(latest)) { signed.current = true; throw new Error('Signed leases cannot be edited here.'); }
        // A fresh DTO avoids overwriting web-only changes made after opening this form.
        payloadForm = { ...form, original: latest };
      }
      await LeaseAPI.addOrUpdateLease(leasePayload(payloadForm, form.isDraft));
      Alert.alert(leaseId ? 'Lease updated' : form.isDraft ? 'Lease draft saved' : 'Lease created', 'Your lease is in the leases list.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (cause: any) { setError(cause?.message === 'Signed leases cannot be edited here.' || cause?.message === 'Lease no longer available for editing.' ? cause.message : cause?.response?.data?.message || 'Could not save the lease. Please try again.'); }
    finally { setSaving(false); }
  };
  const input = (key: keyof LeaseForm, title: string, multiline = false) => <React.Fragment key={key}>
    <Text style={[styles.label, dark && { color: colors.text }]}>{title}</Text>
    <TextInput value={String(form[key] ?? '')} onChangeText={value => update(key, value)} accessibilityLabel={title} placeholder={key.endsWith('Date') ? 'YYYY-MM-DD' : multiline ? 'Optional' : '0'} placeholderTextColor={colors.muted} keyboardType={key.endsWith('Date') ? 'numbers-and-punctuation' : ['name', 'additionalTerms', 'earlyTerminationClauseText'].includes(key) ? 'default' : 'decimal-pad'} multiline={multiline} style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }, dark && { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
  </React.Fragment>;
  const section = (title: string) => <Text accessibilityRole="header" style={[styles.section, dark && { color: colors.text }]}>{title}</Text>;
  const choice = (key: keyof LeaseForm, title: string, options: { value: string | boolean; label: string }[]) => <React.Fragment key={key}>
    <Text style={[styles.label, dark && { color: colors.text }]}>{title}</Text>
    {options.map(({ value, label: optionLabel }) => <TouchableOpacity key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: form[key] === value }} onPress={() => { setForm(current => ({ ...current, [key]: value })); setError(''); }} style={[styles.option, { borderColor: form[key] === value ? colors.accent : colors.border }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{optionLabel}</Text>{form[key] === value && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}</TouchableOpacity>)}
  </React.Fragment>;
  const toggle = (key: keyof LeaseForm, title: string) => <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: form[key] === true }} onPress={() => { setForm(current => ({ ...current, [key]: !current[key], ...(key === 'proratedRentDue' ? { isProratedRent: !current[key], prorationMethod: current.prorationMethod || 'calculated' } : {}) })); setError(''); }} style={[styles.option, { borderColor: colors.border, marginTop: 14 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{title}</Text><Ionicons name={form[key] === true ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>;
  const titleOf = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase());
  const group = (title: string, contents: React.ReactNode) => <React.Fragment key={title}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: expanded.includes(title) }} onPress={() => setExpanded(current => current.includes(title) ? current.filter(item => item !== title) : [...current, title])} style={[styles.group, { borderColor: colors.border }]}>
      <Text style={[styles.optionText, dark && { color: colors.text }]}>{title}</Text><Ionicons name={expanded.includes(title) ? 'chevron-up' : 'chevron-down'} size={20} color={colors.accent} />
    </TouchableOpacity>
    {expanded.includes(title) && contents}
  </React.Fragment>;
  const extraInput = (key: keyof LeaseForm, title = titleOf(key), multiline = false) => <React.Fragment key={key}>
    <Text style={[styles.label, dark && { color: colors.text }]}>{title}</Text>
    <TextInput value={String(form[key] ?? '')} accessibilityLabel={title} onChangeText={value => updateExtra(key, value)} placeholder={key.toLowerCase().includes('date') ? 'YYYY-MM-DD' : 'Optional'} placeholderTextColor={colors.muted} multiline={multiline} keyboardType="default" style={[styles.input, multiline && { minHeight: 85, textAlignVertical: 'top' }, dark && { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
  </React.Fragment>;
  const extraBool = (key: keyof LeaseForm, title = titleOf(key)) => <TouchableOpacity key={key} accessibilityRole="checkbox" accessibilityState={{ checked: form[key] === true }} onPress={() => updateExtra(key, form[key] !== true)} style={[styles.option, { borderColor: colors.border, marginTop: 12 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{title}</Text><Ionicons name={form[key] === true ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>;
  const jsonChoices = (key: 'rentCollectionOtherOptions' | 'maintenanceNotificationMethods', title: string, options: { id: string; label: string }[]) => {
    let parsed: any;
    try { parsed = JSON.parse(form[key] || (key === 'rentCollectionOtherOptions' ? '{}' : '[]')); } catch { parsed = key === 'rentCollectionOtherOptions' ? {} : []; }
    const selected = key === 'rentCollectionOtherOptions' ? (Array.isArray(parsed) ? Object.fromEntries(parsed.map(id => [id, true])) : parsed && typeof parsed === 'object' ? parsed : {}) : Array.isArray(parsed) ? parsed : [];
    return <React.Fragment><Text style={[styles.label, dark && { color: colors.text }]}>{title}</Text>{options.map(option => {
      const checked = key === 'rentCollectionOtherOptions' ? selected[option.id] === true : selected.includes(option.id);
      return <TouchableOpacity key={option.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => updateExtra(key, JSON.stringify(key === 'rentCollectionOtherOptions' ? { ...selected, [option.id]: !checked } : checked ? selected.filter((id: string) => id !== option.id) : [...selected, option.id]))} style={[styles.option, { borderColor: colors.border }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{option.label}</Text><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>;
    })}</React.Fragment>;
  };
  const parkingChoices = () => {
    let selected: string[] = [];
    try { const parsed = JSON.parse(String(form.parking?.parkingTypes ?? '[]')); if (Array.isArray(parsed)) selected = parsed; } catch { /* untouched malformed GET remains preserved until edited */ }
    return <>{['garage', 'driveway', 'street', 'designatedSpace', 'other'].map(id => <TouchableOpacity key={id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(id) }} onPress={() => updateRow('parking', 0, 'parkingTypes', JSON.stringify(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]))} style={[styles.option, { borderColor: colors.border }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{titleOf(id)}</Text><Ionicons name={selected.includes(id) ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>)}</>;
  };
  const rowEditor = (key: Exclude<RowField, 'parking'>, title: string) => <React.Fragment key={key}>
    {section(title)}
    {form[key].map((item, index) => <React.Fragment key={`${key}-${index}`}>
      <Text style={[styles.label, dark && { color: colors.text }]}>{title} {index + 1}</Text>
      {[...rowFields[key].text, ...rowFields[key].money, ...rowFields[key].int].map(field => <React.Fragment key={field}>
        <Text style={[styles.label, dark && { color: colors.text }]}>{titleOf(field)}</Text>
        <TextInput accessibilityLabel={`${title} ${index + 1} ${titleOf(field)}`} value={String(item[field] ?? '')} onChangeText={value => updateRow(key, index, field, value)} placeholder={field === 'dueDate' ? 'YYYY-MM-DD' : 'Optional'} placeholderTextColor={colors.muted} keyboardType={rowFields[key].money.includes(field as never) || rowFields[key].int.includes(field as never) ? 'decimal-pad' : 'default'} style={[styles.input, dark && { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      </React.Fragment>)}
      {rowFields[key].bool.map(field => <TouchableOpacity key={field} accessibilityRole="checkbox" accessibilityState={{ checked: item[field] === true }} onPress={() => updateRow(key, index, field, item[field] !== true)} style={[styles.option, { borderColor: colors.border, marginTop: 12 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>{titleOf(field)}</Text><Ionicons name={item[field] === true ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${title} ${index + 1}`} onPress={() => removeRow(key, index)} style={styles.rowAction}><Text style={{ color: colors.accent }}>Remove {title.toLowerCase()}</Text></TouchableOpacity>
    </React.Fragment>)}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add ${title}`} onPress={() => addRow(key)} style={styles.rowAction}><Text style={{ color: colors.accent }}>+ Add {title.toLowerCase()}</Text></TouchableOpacity>
  </React.Fragment>;
  return <ScrollView style={[styles.container, dark && { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
    <PageBackButton />
    <Text accessibilityRole="header" style={[styles.title, dark && { color: colors.text }]}>{leaseId ? 'Edit lease' : 'Add lease'}</Text>
    <Text style={[styles.subtitle, dark && { color: colors.muted }]}>Save a draft or enter complete lease terms. A draft won't activate a lease or collect rent.</Text>
    {loading ? <ActivityIndicator color={colors.accent} /> : leaseId ? <Text style={[styles.hint, dark && { color: colors.muted }]}>Lease {leaseId} · property and unit cannot be changed.</Text> : <>
      <Text style={[styles.label, dark && { color: colors.text }]}>Property</Text>
      {properties.length === 0 && !error && <Text style={[styles.hint, dark && { color: colors.muted }]}>Add a property before creating a lease.</Text>}
      {properties.map(item => <TouchableOpacity key={String(idOf(item))} style={[styles.option, { borderColor: property === item ? colors.accent : colors.border }]} onPress={() => void selectProperty(item)} accessibilityRole="radio" accessibilityState={{ checked: property === item }}><Text style={[styles.optionText, dark && { color: colors.text }]}>{label(item)}</Text>{property === item && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}</TouchableOpacity>)}
      {property && <><Text style={[styles.label, dark && { color: colors.text }]}>Unit</Text>{loadingUnits ? <ActivityIndicator color={colors.accent} /> : units.length === 0 ? <Text style={[styles.hint, dark && { color: colors.muted }]}>No units available for this property.</Text> : units.map(item => <TouchableOpacity key={String(idOf(item))} style={[styles.option, { borderColor: unit === item ? colors.accent : colors.border }]} onPress={() => { setUnit(item); setForm(current => ({ ...current, unitId: idOf(item) })); setError(''); }} accessibilityRole="radio" accessibilityState={{ checked: unit === item }}><Text style={[styles.optionText, dark && { color: colors.text }]}>{label(item)}</Text>{unit === item && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}</TouchableOpacity>)}</>}
    </>}
    {section('Lease term')}
    {input('name', 'Lease name (optional)')}{input('startDate', 'Start date (YYYY-MM-DD)')}{input('endDate', 'End date (YYYY-MM-DD)')}
    {form.leaseLength === -1 && <Text style={[styles.hint, dark && { color: colors.muted }]}>Month-to-month term retained. Changing dates will not convert this lease to fixed-term.</Text>}
    {section('Rent & deposits')}
    {input('rentAmount', 'Rent amount')}{input('depositAmount', 'Security deposit')}{input('petDepositAmount', 'Pet deposit')}{input('overdueAmount', 'Overdue amount')}{input('rentDueDay', 'Rent due day (1–31)')}
    {choice('rentFrequency', 'Rent frequency', ['monthly', 'quarterly', 'yearly'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) })))}
    {toggle('proratedRentDue', 'Prorated rent due')}
    {form.proratedRentDue && <>{choice('prorationMethod', 'Proration method', [{ value: 'calculated', label: 'Calculated' }, { value: 'manual', label: 'Manual' }])}{input('proratedRentAmount', 'Prorated rent amount')}</>}
    {section('Renewal & increases')}
    {toggle('autoRenewLease', 'Automatically renew lease')}
    {form.autoRenewLease && <>{input('autoRenewLeaseLength', 'Renewal length (months; -1 for month-to-month)')}{toggle('autoRenewRentIncrement', 'Increase rent on renewal')}{form.autoRenewRentIncrement && <>{choice('autoRenewRentIncrementType', 'Renewal increase type', [{ value: 'percentage', label: 'Percentage' }, { value: 'amount', label: 'Amount' }])}{input('autoRenewRentIncrementValue', 'Renewal increase value')}</>}</>}
    {choice('rentIncreaseType', 'Automatic rent increase', [{ value: '', label: 'None' }, { value: 'percentage', label: 'Percentage' }, { value: 'amount', label: 'Amount' }])}
    {!!form.rentIncreaseType && <>{input('rentIncreaseValue', 'Rent increase value')}{input('rentIncreaseInterval', 'Increase every (months)')}</>}
    {toggle('createChecklistOnStartDate', 'Create checklist on start date')}
    {section('Policies & additional terms')}
    {choice('petsAllowed', 'Pets allowed', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }])}
    {choice('smokingAllowed', 'Smoking policy', [{ value: '', label: 'Not specified' }, { value: 'no', label: 'No smoking' }, { value: 'outsideOnly', label: 'Outside only' }, { value: 'yes', label: 'Allowed' }])}
    {toggle('includeEarlyTerminationClause', 'Include early termination clause')}
    {form.includeEarlyTerminationClause && input('earlyTerminationClauseText', 'Early termination terms', true)}
    {input('additionalTerms', 'Additional terms', true)}
    {group('Fees & other deposits', <>{rowEditor('fees', 'Fee')}{rowEditor('leaseDeposits', 'Other deposit')}</>)}
    {group('Rent collection', <>
      {extraBool('rentCollectionByPlatform', 'Collect rent through platform')}{extraBool('rentCollectionOther', 'Accept other payment methods')}
      {form.rentCollectionOther && <>{jsonChoices('rentCollectionOtherOptions', 'Other payment methods', ['cash', 'personalCheck', 'cashiersCheck', 'moneyOrder', 'achDirectDeposit', 'other'].map(id => ({ id, label: titleOf(id) })))}{extraInput('rentCollectionOtherSpecify', 'Other payment instructions')}</>}
    </>)}
    {group('People & mailing address', <>
      {extraBool('addTenantsLater', 'Add tenants later')}{extraBool('tenantMailingAddressDiffers', 'Tenant mailing address differs')}
      {form.tenantMailingAddressDiffers && <>{extraInput('tenantMailingStreetAddress')}{extraInput('tenantMailingUnit')}{extraInput('tenantMailingCity')}{extraInput('tenantMailingState')}{extraInput('tenantMailingZipCode')}</>}
      {rowEditor('leaseLandlords', 'Landlord')}{rowEditor('leaseCoSigners', 'Co-signer')}{rowEditor('leaseAdditionalSigners', 'Additional signer')}{rowEditor('leaseOccupants', 'Occupant')}
    </>)}
    {group('Pets & parking', <>
      {rowEditor('pets', 'Pet')}
      <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: !!form.parking }} onPress={() => setForm(current => ({ ...current, parking: current.parking ? null : { includeParkingRules: false, parkingTypes: '[]', customRules: '' }, dirtyFields: mark(current, 'parking') }))} style={[styles.option, { borderColor: colors.border, marginTop: 12 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>Include parking terms</Text><Ionicons name={form.parking ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>
      {form.parking && <>{parkingChoices()}<Text style={[styles.label, dark && { color: colors.text }]}>Custom parking rules</Text><TextInput accessibilityLabel="Custom parking rules" value={String(form.parking.customRules ?? '')} onChangeText={value => updateRow('parking', 0, 'customRules', value)} style={[styles.input, dark && { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: form.parking.includeParkingRules === true }} onPress={() => updateRow('parking', 0, 'includeParkingRules', form.parking?.includeParkingRules !== true)} style={[styles.option, { borderColor: colors.border, marginTop: 12 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>Include parking rules</Text><Ionicons name={form.parking.includeParkingRules === true ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity></>}
    </>)}
    {group('Utilities, maintenance & keys', <>
      {extraBool('hasSharedUtilities', 'Shared utilities')}{form.hasSharedUtilities && extraInput('sharedUtilitiesDisclosure', 'Shared utilities disclosure', true)}
      {jsonChoices('maintenanceNotificationMethods', 'Maintenance notification methods', ['platform', 'usMail', 'email', 'text', 'other'].map(id => ({ id, label: titleOf(id) })))}
      {rowEditor('utilityServiceResponsibilities', 'Utility service')}{rowEditor('maintenanceResponsibilities', 'Maintenance responsibility')}{rowEditor('leaseKeys', 'Key')}
    </>)}
    {group('Lead paint disclosure', <>
      {extraBool('builtBefore1978', 'Built before 1978')}
      {form.builtBefore1978 && <>{extraBool('awareOfLeadPaint', 'Aware of lead paint')}{form.awareOfLeadPaint && extraInput('leadPaintExplanation', 'Lead paint explanation', true)}{extraBool('hasLeadPaintRecords', 'Lead paint records available')}{form.hasLeadPaintRecords && extraInput('leadPaintRecordsExplanation', 'Lead paint records explanation', true)}</>}
    </>)}
    <Text style={[styles.hint, dark && { color: colors.muted }]}>Attachments and signatures must be managed in the web lease builder.</Text>
    {(!leaseId || form.isDraft) && <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: form.isDraft }} onPress={() => setForm(current => ({ ...current, isDraft: !current.isDraft }))} style={[styles.option, { borderColor: colors.border, marginTop: 20 }]}><Text style={[styles.optionText, dark && { color: colors.text }]}>Save as draft</Text><Ionicons name={form.isDraft ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /></TouchableOpacity>}
    {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }, (loading || loadingUnits || saving || signed.current || (!!leaseId && !form.id)) && styles.disabled]} disabled={loading || loadingUnits || saving || signed.current || (!!leaseId && !form.id)} onPress={() => void save()} accessibilityRole="button" accessibilityLabel={leaseId ? 'Update lease' : form.isDraft ? 'Save lease draft' : 'Create lease'}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{leaseId ? 'Update lease' : form.isDraft ? 'Save lease draft' : 'Create lease'}</Text>}</TouchableOpacity>
  </ScrollView>;
}
const styles = StyleSheet.create({
  group: { minHeight: 52, borderWidth: 1, borderRadius: 10, marginTop: 20, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }, rowAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  container: { flex: 1, backgroundColor: '#fff' }, content: { paddingHorizontal: 22 }, title: { fontSize: 28, fontWeight: '800', color: '#102d43', marginTop: 8 }, subtitle: { fontSize: 14, lineHeight: 21, color: '#617180', marginTop: 6, marginBottom: 24 }, section: { fontSize: 20, fontWeight: '800', color: '#102d43', marginTop: 28, marginBottom: 4 }, label: { fontSize: 16, fontWeight: '700', color: '#102d43', marginTop: 16, marginBottom: 8 }, hint: { color: '#617180', fontSize: 14 }, option: { minHeight: 48, borderWidth: 1, borderColor: '#dbe2e6', borderRadius: 10, marginBottom: 8, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, optionText: { fontSize: 15, color: '#102d43', flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#dbe2e6', borderRadius: 10, paddingHorizontal: 14, color: '#102d43', backgroundColor: '#fff' }, error: { marginTop: 18, color: '#a5322e', fontSize: 14 }, saveButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 28 }, disabled: { opacity: 0.5 }, saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
