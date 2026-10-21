import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property, Unit } from '../../api/propertyAPI';
import UnitAPI from '../../api/unitAPI';
import AddressAutocompleteInput from '../../components/properties/AddressAutocompleteInput';
import { applyGooglePlaceDetails } from '../../features/properties/addressAutocomplete';
import { BulkCreateUncertainError, buildingErrors, bulkCreateWithReconciliation, bulkUnitCountError, bulkUnitDrafts, createPropertyErrors, emptyProperty, emptyUnit, initialUnitUpdates, locationErrors, nextUnitName, prefillProperty, prefillUnit, propertyErrors, propertyPayload, unitErrors, unitPayload, type PropertyForm, type UnitForm } from '../../features/properties/propertyForms';
import { useAppTheme } from '../../theme/AppTheme';
import { unitRentalMode } from '../../features/properties/rentalMode';
import { propertyRentalMode } from '../../features/properties/rentalMode';

const types = [['singleFamily', 'Single-family'], ['townhouse', 'Townhouse'], ['condominium', 'Condominium'], ['smallMultiFamily', 'Small multi-family'], ['apartmentBuilding', 'Apartment building'], ['other', 'Other multi-unit']] as const;
type Route = RouteProp<PropertiesStackParamList, 'AddProperty'>;

export default function AddPropertyScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const navigation = useNavigation<NativeStackNavigationProp<PropertiesStackParamList, 'AddProperty'>>();
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const route = useRoute<Route>();
  const propertyId = route.params?.propertyId;
  const unitId = route.params?.unitId;
  const isUnit = route.params?.mode === 'unit';

  const [loading, setLoading] = useState(Boolean(propertyId));
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState<PropertyForm>(emptyProperty);
  const [units, setUnits] = useState<UnitForm[]>(() => propertyId ? [] : [emptyUnit('1')]);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [bulkRetryBlocked, setBulkRetryBlocked] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [unitMode, setUnitMode] = useState<'manual' | 'bulk'>('manual');
  const [bulkCount, setBulkCount] = useState('2');
  const isCreating = !propertyId && !isUnit;
  const title = isUnit ? (unitId ? 'Edit unit' : 'Add units') : propertyId ? 'Edit property' : 'Add a property';

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    setLoading(true);
    PropertyAPI.getPropertyById(propertyId).then((result) => {
      if (!active) return;
      setProperty(result);
      if (isUnit) {
        const existing = result.units ?? result.Units ?? [];
        const chosen = existing.find((item: Unit) => String(item.id ?? item.Id) === String(unitId));
        if (unitId && !chosen) setError('Unit could not be found.');
        else { setSelectedUnit(chosen ?? null); setUnits([chosen ? prefillUnit(chosen) : emptyUnit(nextUnitName(existing), propertyRentalMode(existing) === 'ShortTerm' ? 'ShortTerm' : 'LongTerm')]); }
      } else setForm(prefillProperty(result));
    }).catch(() => { if (active) setError('Could not load property. Go back and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [propertyId, unitId, isUnit]);

  const update = (key: keyof PropertyForm, value: string) => { setError(''); setForm(current => ({ ...current, [key]: value })); };
  const updateUnit = (index: number, key: keyof UnitForm, value: string | boolean) => {
    setError(''); setUnits(current => current.map((unit, i) => i === index ? { ...unit, [key]: value } : unit));
  };
  const multiUnit = !['singleFamily', 'townhouse', 'condominium'].includes(form.propertyType);
  const draftUnits = isCreating && !multiUnit ? [emptyUnit('1', form.rentalMode)] : isCreating && multiUnit && unitMode === 'bulk' ? bulkUnitDrafts(bulkCount, form.rentalMode) : isCreating ? units.map(unit => ({ ...unit, rentalMode: form.rentalMode ?? 'LongTerm' })) : units;
  const next = () => {
    const issues = step === 0 ? locationErrors(form) : buildingErrors(form);
    if (issues.length) { setError(issues.join('\n')); return; }
    setError('');
    setStep(step === 0 ? 1 : 2);
  };
  const save = async () => {
    if (saving || bulkRetryBlocked || (isUnit && unitId && !selectedUnit)) return;
    if (isCreating && (step < 1 || (multiUnit && step < 2))) return;
    if (propertyId && !property) { setError('Could not load property. Go back and try again.'); return; }
    if (isCreating && multiUnit && unitMode === 'bulk' && bulkUnitCountError(bulkCount)) {
      setError(bulkUnitCountError(bulkCount)); return;
    }
    const issues = isUnit ? units.flatMap((unit, i) => unitErrors(unit).map(message => `Unit ${i + 1}: ${message}`)) : [
      ...propertyErrors(form),
      ...(!propertyId ? createPropertyErrors(form, draftUnits) : []),
    ];
    if (issues.length) { setError(issues.join('\n')); return; }
    setError(''); setSaving(true);
    try {
      if (isUnit) {
        if (!propertyId) throw new Error('Property ID is missing');
        if (selectedUnit) await UnitAPI.saveUnit(unitPayload(units[0], propertyId, selectedUnit));
        else await bulkCreateWithReconciliation(propertyId, units, PropertyAPI.getUnits.bind(PropertyAPI), UnitAPI.bulkCreate.bind(UnitAPI));
      } else if (propertyId) {
        await PropertyAPI.updateProperty(propertyId, propertyPayload(form, property ?? undefined));
      } else {
        // Keep the new ID after a partial unit failure so retry never duplicates the property.
        let id = createdId;
        if (!id) {
          const landlordId = currentUser?.id ?? currentUser?.Id;
          if (!landlordId) throw new Error('Sign in again to add a property.');
          const result = await PropertyAPI.createProperty({ ...propertyPayload(form, undefined, draftUnits.length), landlordId: Number(landlordId) });
          id = String(result.id ?? result.Id ?? '');
          if (!id) throw new Error('Property was created, but its ID was not returned. Refresh the property list before retrying.');
          setCreatedId(id);
        }
        // Fetch fresh backend-generated unit IDs on every retry; updates are idempotent.
        const created = await PropertyAPI.getPropertyById(id);
        const updates = initialUnitUpdates(draftUnits, created.units ?? created.Units ?? [], id);
        for (const update of updates) await UnitAPI.saveUnit(update);
      }
      navigation.goBack();
    } catch (e: any) {
      if (e instanceof BulkCreateUncertainError) setBulkRetryBlocked(true);
      setError(e?.response?.data?.message || e?.message || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  const field = (label: string, value: string, onChangeText: (value: string) => void, keyboardType: 'default' | 'numeric' = 'default') => (
    <View style={styles.field} key={label}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder={label} placeholderTextColor={colors.muted} value={value} onChangeText={onChangeText} keyboardType={keyboardType} editable={!saving && !createdId} />
    </View>
  );
  const unitFields = (unit: UnitForm, index: number) => (
    <View key={index} style={[styles.unitCard, { borderColor: colors.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.section, { color: colors.text }]}>Unit {index + 1}</Text>
        {!unitId && !createdId && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove unit ${index + 1}`} onPress={() => setUnits(current => current.filter((_, i) => i !== index))}><Text style={{ color: colors.accent }}>Remove</Text></TouchableOpacity>}
      </View>
      {field('Unit name *', unit.name, value => updateUnit(index, 'name', value))}
      <Text style={[styles.label, { color: colors.text }]}>Rental mode: {selectedUnit ? unitRentalMode(selectedUnit) : isCreating ? form.rentalMode : unit.rentalMode ?? 'LongTerm'}</Text>
      {!selectedUnit && !isCreating && <View style={styles.choices}>{(['LongTerm', 'ShortTerm'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`${value === 'LongTerm' ? 'Long-term' : 'Short-term'} unit ${index + 1}`} accessibilityState={{ checked: (unit.rentalMode ?? 'LongTerm') === value }} disabled={saving} onPress={() => updateUnit(index, 'rentalMode', value)} style={[styles.choice, { borderColor: unit.rentalMode === value ? colors.accent : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{value === 'LongTerm' ? 'Long-term' : 'Short-term'}</Text></TouchableOpacity>)}</View>}
      <View style={styles.row}>
        <View style={styles.half}>{field(isUnit ? 'Bedrooms *' : 'Bedrooms', unit.bedrooms, value => updateUnit(index, 'bedrooms', value), 'numeric')}</View>
        <View style={styles.half}>{field(isUnit ? 'Baths *' : 'Baths', unit.baths, value => updateUnit(index, 'baths', value), 'numeric')}</View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}>{field('Square feet', unit.squareFeet, value => updateUnit(index, 'squareFeet', value), 'numeric')}</View>
        {(selectedUnit ? unitRentalMode(selectedUnit) : isCreating ? form.rentalMode : unit.rentalMode) !== 'ShortTerm' && <View style={styles.half}>{field('Rent / month', unit.rentAmount, value => updateUnit(index, 'rentAmount', value), 'numeric')}</View>}
      </View>
      {field('Unit type', unit.type, value => updateUnit(index, 'type', value))}
      {(selectedUnit ? unitRentalMode(selectedUnit) : isCreating ? form.rentalMode : unit.rentalMode) !== 'ShortTerm' && <View style={styles.rowBetween}><Text style={[styles.label, { color: colors.text }]}>Occupied</Text><Switch accessibilityLabel={`Unit ${index + 1} occupied`} value={unit.isOccupied} onValueChange={value => updateUnit(index, 'isOccupied', value)} disabled={saving || Boolean(createdId)} /></View>}
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{isUnit ? 'UNIT DETAILS' : isCreating ? `STEP ${step + 1} OF ${multiUnit ? 3 : 2}` : 'PROPERTY DETAILS'}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{isCreating ? step === 0 ? 'Property location' : step === 1 ? 'Building' : 'Units' : title}</Text>
        {!isUnit && (!isCreating || step === 0) && <>
          <Text style={[styles.section, { color: colors.text }]}>Location</Text>
          {isCreating && <><Text style={[styles.label, { color: colors.text }]}>Rental mode *</Text><View style={styles.choices}>{(['LongTerm', 'ShortTerm'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`${value === 'LongTerm' ? 'Long-term' : 'Short-term'} rental mode`} accessibilityState={{ checked: form.rentalMode === value }} disabled={saving || Boolean(createdId)} onPress={() => update('rentalMode', value)} style={[styles.choice, { borderColor: form.rentalMode === value ? colors.accent : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{value === 'LongTerm' ? 'Long-term rentals' : 'Short-term rentals'}</Text></TouchableOpacity>)}</View><Text style={{ color: colors.muted, marginBottom: 12 }}>Sets the initial mode for every unit; building type is selected separately. Short-term bookings and payments are not available yet.</Text></>}
          {field('Property name *', form.name, value => update('name', value))}
          <Text style={[styles.label, { color: colors.text }]}>Street address *</Text>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>Choose an address suggestion to fill city, state, and ZIP automatically.</Text>
          <AddressAutocompleteInput value={form.address} onChangeText={value => update('address', value)} onPlaceSelected={details => { setError(''); setForm(current => ({ ...current, ...applyGooglePlaceDetails({ ...current, address: current.address }, details) })); }} disabled={saving || Boolean(createdId)} />
          {field('City *', form.city, value => update('city', value))}
          <View style={styles.row}><View style={styles.half}>{field('State *', form.state, value => update('state', value))}</View><View style={styles.half}>{field('ZIP code *', form.zipCode, value => update('zipCode', value))}</View></View>
        </>}
        {!isUnit && (!isCreating || step === 1) && <>
          <Text style={[styles.section, { color: colors.text }]}>Building</Text>
          <Text style={[styles.label, { color: colors.text }]}>Property type *</Text>
          <View style={styles.choices}>{types.map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: form.propertyType === value }} style={[styles.choice, { borderColor: form.propertyType === value ? colors.accent : colors.border, backgroundColor: colors.surface }]} onPress={() => !createdId && update('propertyType', value)} disabled={saving || Boolean(createdId)}><Text style={{ color: colors.text }}>{label}</Text></TouchableOpacity>)}</View>
          {field('Year built', form.yearBuilt, value => update('yearBuilt', value), 'numeric')}
          {isCreating && !multiUnit && <Text style={{ color: colors.muted }}>One unit will be created automatically. You can add its details later.</Text>}
        </>}
        {isCreating && multiUnit && step === 2 && <>
          <Text style={{ color: colors.muted, marginBottom: 16 }}>Add units individually or create numbered units in one step.</Text>
          <View style={styles.choices}>
            {(['manual', 'bulk'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: unitMode === value }} accessibilityLabel={value === 'bulk' ? 'Bulk create' : 'Add individually'} style={[styles.choice, { borderColor: unitMode === value ? colors.accent : colors.border, backgroundColor: colors.surface }]} disabled={saving || Boolean(createdId)} onPress={() => { setError(''); setUnitMode(value); }}><Text style={{ color: colors.text }}>{value === 'bulk' ? 'Bulk create' : 'Add individually'}</Text></TouchableOpacity>)}
          </View>
          {unitMode === 'bulk' ? <>
            {field('Number of units *', bulkCount, value => { setError(''); setBulkCount(value); }, 'numeric')}
            <Text style={{ color: colors.muted }}>Creates Unit 1, Unit 2, and so on. You can edit each unit after adding the property.</Text>
          </> : <>
            {units.map(unitFields)}
            {!createdId && <TouchableOpacity accessibilityRole="button" onPress={() => setUnits(current => [...current, emptyUnit(nextUnitName(current))])} style={styles.secondary}><Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add unit</Text></TouchableOpacity>}
          </>}
        </>}
        {isUnit && <>{units.map(unitFields)}{!unitId && <TouchableOpacity accessibilityRole="button" onPress={() => setUnits(current => [...current, emptyUnit(nextUnitName([...(property?.units ?? property?.Units ?? []), ...current]), current[0]?.rentalMode ?? 'LongTerm')])} style={styles.secondary}><Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add another unit</Text></TouchableOpacity>}</>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {isCreating && step > 0 && !createdId && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous step" disabled={saving} onPress={() => { setError(''); setStep(current => (current - 1) as 0 | 1 | 2); }} style={styles.secondary}><Text style={{ color: colors.accent, fontWeight: '700' }}>Back</Text></TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isCreating && (step === 0 || step === 1 && multiUnit) ? 'Next step' : isUnit ? unitId ? 'Save unit' : 'Add units' : propertyId ? 'Save property' : 'Add property'} disabled={saving || bulkRetryBlocked || (isUnit && !units.length) || Boolean(isUnit && unitId && !selectedUnit)} onPress={isCreating && (step === 0 || step === 1 && multiUnit) ? next : save} style={[styles.primary, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}><Text style={[styles.primaryText, dark && { color: colors.background }]}>{saving ? 'Saving…' : isCreating && (step === 0 || step === 1 && multiUnit) ? 'Continue' : isUnit ? unitId ? 'Save unit' : 'Add units' : propertyId ? 'Save property' : 'Add property'}</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center' }, content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 70 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { fontSize: 27, fontWeight: '800', marginTop: 6, marginBottom: 24 }, section: { fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 12 },
  field: { flex: 1, marginBottom: 12 }, label: { fontSize: 13, fontWeight: '700', marginBottom: 7 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, choice: { borderWidth: 1, borderRadius: 11, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  unitCard: { borderTopWidth: 1, paddingTop: 8, marginBottom: 12 }, secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  error: { color: '#bd3535', lineHeight: 21, marginTop: 12 }, primary: { borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
