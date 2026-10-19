import React, { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { buildMaintenanceWindow, validateMaintenanceRequest } from '../../features/maintenance/maintenanceForm';
import { SIGNAL_OPTIONS, emergencyGuidance, normalizeMaintenanceMediaFileName, validateMaintenanceMedia, type MaintenanceSignal } from '../../features/maintenance/maintenanceModel';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import PropertyAPI, { Property, Unit } from '../../api/propertyAPI';
import MaintenanceAPI, { newIdempotencyKey, type LocalMedia } from '../../api/maintenanceAPI';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (item: any) => Number(item?.id ?? item?.Id);
const labelOf = (item: any) => String(item?.name ?? item?.Name ?? item?.streetAddress ?? item?.StreetAddress ?? 'Unnamed');

export default function AddMaintenanceRequestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scopedPropertyId = route.params?.propertyId ? Number(route.params.propertyId) : null;
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [signals, setSignals] = useState<MaintenanceSignal[]>([]);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [access, setAccess] = useState('');
  const [picker, setPicker] = useState<'start-date' | 'start-time' | 'end-date' | 'end-time' | null>(null);
  const createdId = useRef<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const createKey = useRef(newIdempotencyKey());
  const selection = useRef(0);

  const selectProperty = async (next: Property) => {
    const generation = ++selection.current;
    setProperty(next);
    setUnit(null);
    setUnits([]);
    setError('');
    setLoadingUnits(true);
    try {
      const loaded = await PropertyAPI.getUnits(idOf(next));
      if (generation === selection.current) setUnits(loaded ?? []);
    } catch {
      if (generation === selection.current) setError('Could not load units. Tap the property to retry.');
    } finally {
      if (generation === selection.current) setLoadingUnits(false);
    }
  };

  useEffect(() => {
    let active = true;
    PropertyAPI.getProperties().then(items => {
      if (!active) return;
      setProperties(items ?? []);
      if (scopedPropertyId) {
        const selected = items?.find(item => idOf(item) === scopedPropertyId);
        if (selected) selectProperty(selected);
        else setError('This property is no longer available.');
      }
    }).catch(() => { if (active) setError('Could not load properties. Please try again later.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; selection.current++; };
  }, [scopedPropertyId]);

  const pickMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access in device settings.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 10 - media.length, videoMaxDuration: 60, quality: .8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled) return;
      const selected: LocalMedia[] = [];
      for (const asset of result.assets) {
        const type = asset.type === 'video' ? 'video' : 'image';
        const mimeType = asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg');
        const file: LocalMedia = { uri: asset.uri, fileName: normalizeMaintenanceMediaFileName(asset.fileName, mimeType), mimeType, fileSize: asset.fileSize, type, idempotencyKey: newIdempotencyKey() };
        const issue = validateMaintenanceMedia(file, media.length + selected.length);
        if (issue) Alert.alert('Media not added', issue); else selected.push(file);
      }
      setMedia(old => [...old, ...selected]);
    } catch (cause: any) { Alert.alert('Media unavailable', cause?.message || 'Try again.'); }
  };
  const submit = async () => {
    if (saving) return;
    const issue = validateMaintenanceRequest({ propertyId: property && idOf(property), unitId: unit && idOf(unit), title, description, startsAt, endsAt });
    if (issue && !createdId.current) {
      Alert.alert('Check the request', issue);
      return;
    }
    setSaving(true);
    try {
      if (!createdId.current) {
        const created = await MaintenanceAPI.createRequest({
          propertyId: idOf(property), unitId: idOf(unit), title: title.trim(),
          description: description.trim(), location: location.trim(),
          signals, hasPhotos: media.some(file => file.type === 'image'), preferredWindows: buildMaintenanceWindow(startsAt, endsAt, access),
        }, createKey.current);
        const id = created.id ?? created.Id;
        if (!id && media.length) throw new Error('Request created but no ID was returned for attaching media. Check your requests before retrying.');
        createdId.current = id || null;
        createKey.current = newIdempotencyKey();
      }
      if (media.length && createdId.current) {
        const results = await Promise.allSettled(media.map(file => MaintenanceAPI.uploadAttachment(createdId.current!, 'Intake', file)));
        const failed = media.filter((_, index) => results[index].status === 'rejected');
        setMedia(failed);
        if (failed.length) throw new Error(`Request saved, but ${failed.length} attachment${failed.length === 1 ? '' : 's'} could not be uploaded. Retry only the remaining files.`);
      }
      navigation.goBack();
    } catch (cause: any) {
      Alert.alert('Could not add request', cause?.detail || cause?.response?.data?.message || cause?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const option = (item: Property | Unit, selected: boolean, onPress: () => void) => (
    <TouchableOpacity key={idOf(item)} style={[styles.option, dark && { borderColor: colors.border }, selected && { borderColor: colors.accent, backgroundColor: dark ? colors.surface : '#eef6fd' }]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <Text style={[styles.optionText, dark && { color: colors.text }]}>{labelOf(item)}</Text>
    </TouchableOpacity>
  );

  return <KeyboardAvoidingView style={[styles.page, dark && { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.heading, dark && { color: colors.text }]}>Add request</Text>
      <Text style={[styles.hint, dark && { color: colors.muted }]}>Record a repair for a property you manage.</Text>
      <Text style={[styles.label, dark && { color: colors.text }]}>Property</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : properties.length === 0 && !error ? <Text style={[styles.hint, dark && { color: colors.muted }]}>Add a property before creating a request.</Text> : (scopedPropertyId ? properties.filter(item => idOf(item) === scopedPropertyId) : properties).map(item => option(item, property === item, () => selectProperty(item)))}
      {property && <>
        <Text style={[styles.label, dark && { color: colors.text }]}>Unit</Text>
        {loadingUnits ? <ActivityIndicator color={colors.accent} /> : units.length === 0 ? <Text style={[styles.hint, dark && { color: colors.muted }]}>No units available for this property.</Text> : units.map(item => option(item, unit === item, () => setUnit(item)))}
      </>}
      <Text style={[styles.label, dark && { color: colors.text }]}>Request title</Text>
      <TextInput style={[styles.input, dark && { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} placeholder="e.g. Leaking kitchen faucet" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} maxLength={100} accessibilityLabel="Request title" />
      <Text style={[styles.label, dark && { color: colors.text }]}>Location (optional)</Text>
      <TextInput style={[styles.input, dark && { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} placeholder="e.g. Kitchen" placeholderTextColor={colors.muted} value={location} onChangeText={setLocation} maxLength={500} accessibilityLabel="Location" />
      <Text style={[styles.label, dark && { color: colors.text }]}>Describe the issue</Text>
      <TextInput style={[styles.input, styles.description, dark && { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} placeholder="What needs to be repaired?" placeholderTextColor={colors.muted} value={description} onChangeText={setDescription} multiline textAlignVertical="top" maxLength={4000} accessibilityLabel="Describe the issue" />
      <Text style={[styles.label, dark && { color: colors.text }]}>Safety / urgency signals</Text>
      {SIGNAL_OPTIONS.map(option => <TouchableOpacity key={option.value} accessibilityRole="checkbox" accessibilityState={{ checked: signals.includes(option.value) }} style={[styles.option, dark && { borderColor: colors.border }]} onPress={() => setSignals(old => old.includes(option.value) ? old.filter(signal => signal !== option.value) : [...old, option.value])}><Text style={[styles.optionText, dark && { color: colors.text }]}>{signals.includes(option.value) ? '☑' : '☐'}  {option.label}</Text></TouchableOpacity>)}
      {emergencyGuidance(signals) && <Text style={styles.error}>{emergencyGuidance(signals)}</Text>}
      <Text style={[styles.label, dark && { color: colors.text }]}>Preferred access window (optional)</Text>
      {(['start-date', 'start-time', 'end-date', 'end-time'] as const).map(part => <TouchableOpacity key={part} accessibilityRole="button" accessibilityLabel={`Choose ${part.replace('-', ' ')}`} style={[styles.option, dark && { borderColor: colors.border }]} onPress={() => setPicker(part)}><Text style={[styles.optionText, dark && { color: colors.text }]}>{part.replace('-', ' ')}: {(part.startsWith('start') ? startsAt : endsAt)?.toLocaleString() ?? 'Not set'}</Text></TouchableOpacity>)}
      {!!picker && <DateTimePicker value={(picker.startsWith('start') ? startsAt : endsAt) || new Date(Date.now() + 86400000)} mode={picker.endsWith('date') ? 'date' : 'time'} onChange={(_, selected) => { const part = picker; setPicker(null); if (!selected) return; const prior = (part.startsWith('start') ? startsAt : endsAt) || new Date(Date.now() + 86400000); const next = new Date(prior); if (part.endsWith('date')) next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate()); else next.setHours(selected.getHours(), selected.getMinutes()); if (part.startsWith('start')) setStartsAt(next); else setEndsAt(next); }} />}
      {(startsAt || endsAt) && <TouchableOpacity accessibilityRole="button" onPress={() => { setStartsAt(null); setEndsAt(null); }}><Text style={{ color: colors.accent }}>Clear access window</Text></TouchableOpacity>}
      <TextInput style={[styles.input, dark && { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} placeholder="Access instructions (optional)" placeholderTextColor={colors.muted} value={access} onChangeText={setAccess} accessibilityLabel="Access instructions" />
      <Text style={[styles.label, dark && { color: colors.text }]}>Photos or videos (optional)</Text>
      <TouchableOpacity accessibilityRole="button" style={[styles.option, dark && { borderColor: colors.border }]} onPress={() => void pickMedia()} disabled={media.length >= 10}><Text style={[styles.optionText, dark && { color: colors.text }]}>Add evidence ({media.length}/10)</Text></TouchableOpacity>
      {media.map(file => <TouchableOpacity key={file.idempotencyKey} accessibilityRole="button" onPress={() => setMedia(old => old.filter(item => item !== file))}><Text style={[styles.hint, dark && { color: colors.muted }]}>{file.fileName} · Remove</Text></TouchableOpacity>)}
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <TouchableOpacity style={[styles.save, { backgroundColor: colors.accent }, (!property || !unit || saving) && styles.disabled]} onPress={submit} disabled={!property || !unit || saving} accessibilityRole="button" accessibilityLabel="Submit maintenance request">
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Submit request</Text>}
      </TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  heading: { color: '#102d43', fontSize: 27, fontWeight: '800' },
  hint: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 6 },
  label: { color: '#102d43', fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 9 },
  option: { minHeight: 48, padding: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#d5e0e8', borderRadius: 6, marginBottom: 8 },
  optionText: { color: '#102d43', fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbd7dd', borderRadius: 6, minHeight: 48, padding: 12, color: '#102d43', fontSize: 15 },
  description: { minHeight: 120 },
  error: { color: '#a52e42', marginTop: 18 },
  save: { minHeight: 50, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.5 },
});