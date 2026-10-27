import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute } from '@react-navigation/native';
import PropertyAPI, { Property, Unit } from '../../api/propertyAPI';
import MaintenanceAPI, { MaintenanceAgentMessage, LocalMedia, newIdempotencyKey } from '../../api/maintenanceAPI';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (item: any) => Number(item?.id ?? item?.Id);
const labelOf = (item: any) => String(item?.name ?? item?.Name ?? item?.streetAddress ?? item?.StreetAddress ?? 'Unnamed');
const isMultiUnit = (item: Property) => String(item.propertyType ?? item.PropertyType ?? '').toLowerCase() === 'multiunit';

type Bubble = { role: 'user' | 'assistant'; content: string; photoBase64?: string; photoMimeType?: string };
export default function MaintenanceAgentIntakeScreen({ onManual }: { onManual: () => void }) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const scopedId = route.params?.propertyId ? Number(route.params.propertyId) : null;
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [unitChosen, setUnitChosen] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoRequested, setPhotoRequested] = useState(false);
  const [photo, setPhoto] = useState<LocalMedia | null>(null);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const generation = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const messagesRef = useRef<Bubble[]>([]);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([PropertyAPI.getProperties(), MaintenanceAPI.getLandlordAgentSettings()]).then(([items, allowed]) => {
      if (!active) return;
      setProperties(items ?? []);
      setEnabled(allowed);
      if (scopedId) {
        const match = items.find(item => idOf(item) === scopedId);
        if (match) void selectProperty(match);
        else setError('This property is no longer available.');
      }
    }).catch(() => { if (active) setError('Could not load the maintenance assistant. Try the manual form.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; generation.current++; };
  }, [scopedId]);

  const selectProperty = async (next: Property) => {
    const version = ++generation.current;
    setProperty(next); setUnit(null); setUnitChosen(false); setUnits([]); setOpen(false); setQuery('');
    setMessages([]); messagesRef.current = []; setDraft(''); setPhoto(null);
    setPhotoRequested(false); setUncertain(false); setError('');
    if (!isMultiUnit(next)) return;
    setLoadingUnits(true);
    try {
      const loaded = await PropertyAPI.getUnits(idOf(next));
      if (version === generation.current) setUnits(loaded ?? []);
    } catch {
      if (version === generation.current) setError('Could not load units. Select the property again to retry.');
    } finally { if (version === generation.current) setLoadingUnits(false); }
  };
  const selectUnit = (next: Unit | null) => {
    ++generation.current;
    setUnit(next); setUnitChosen(true); setMessages([]); messagesRef.current = []; setPhoto(null);
    setPhotoRequested(false); setUncertain(false); setError('');
  };
  const context = () => ({ propertyId: idOf(property), propertyName: `${labelOf(property)}${property && isMultiUnit(property) && unitChosen && !unit ? ' (common area)' : ''}`,
    ...(unit ? { unitId: idOf(unit), unitName: labelOf(unit) } : {}) });
  const chat = async (history: Bubble[], initial = false) => {
    if (busyRef.current || !property || uncertain) return;
    const version = generation.current;
    busyRef.current = true; setBusy(true); setError('');
    if (!initial) { messagesRef.current = history; setMessages(history); setDraft(''); }
    try {
      const reply = await MaintenanceAPI.chatWithLandlordAgent(history as MaintenanceAgentMessage[], context());
      if (version !== generation.current) return;
      if (reply.maintenanceRequest) {
        if (photo) {
          const id = reply.maintenanceRequest.id ?? reply.maintenanceRequest.Id;
          try {
            if (!id) throw new Error('Missing request ID');
            await MaintenanceAPI.uploadAttachment(id, 'Intake', photo);
          } catch {
            Alert.alert('Request created', 'Your request was saved, but the photo could not be attached. Open the request to add it.');
          }
        }
        navigation.goBack();
        return;
      }
      const next = [...history, { role: 'assistant' as const, content: reply.message.replace(/\[PHOTO_REQUEST\]/g, '').trim() }];
      messagesRef.current = next; setMessages(next);
      setPhotoRequested(reply.photoRequested);
    } catch (cause: any) {
      if (version === generation.current) {
        setError(cause?.response?.data?.message || cause?.message || 'Assistant unavailable.');
        // A timed-out confirmation may already have created a ticket; never resend it blindly.
        if (!initial) setUncertain(true);
      }
    } finally { if (version === generation.current) { busyRef.current = false; setBusy(false); } }
  };
  const send = () => {
    const content = draft.trim();
    if (!content || busyRef.current) return;
    void chat([...messagesRef.current, { role: 'user', content }]);
  };
  const attachPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access in device settings.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: .7 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return Alert.alert('Photo too large', 'Choose a photo under 5 MB.');
      const mimeType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return Alert.alert('Unsupported photo', 'Choose a JPEG, PNG, or WebP image.');
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (busyRef.current) return;
      setPhoto({ uri: asset.uri, fileName: asset.fileName || 'maintenance-photo.jpg', mimeType, fileSize: asset.fileSize, type: 'image', idempotencyKey: newIdempotencyKey() });
      void chat([...messagesRef.current, { role: 'user', content: "Here's a photo of the issue.", photoBase64: base64, photoMimeType: mimeType }]);
    } catch (cause: any) { Alert.alert('Photo unavailable', cause?.message || 'Try again.'); }
  };
  const filtered = properties.filter(item => !scopedId || idOf(item) === scopedId)
    .filter(item => `${labelOf(item)} ${item.streetAddress ?? item.StreetAddress ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const ink = dark ? colors.text : '#102d43';
  const surface = dark ? colors.surface : '#fff';
  const border = dark ? colors.border : '#d5e0e8';
  const muted = colors.muted;
  const ready = !!property && (!isMultiUnit(property) || (!loadingUnits && unitChosen)) && enabled;

  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}>
      <Text style={[styles.heading, { color: ink }]}>Add request</Text>
      <Text style={[styles.hint, { color: muted }]}>Tell the maintenance assistant what needs attention.</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : <>
        <Text style={[styles.label, { color: ink }]}>Property</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose property" disabled={busy} style={[styles.select, { backgroundColor: surface, borderColor: border }]} onPress={() => setOpen(value => !value)}>
          <Text style={{ color: ink }}>{property ? labelOf(property) : 'Search properties'}</Text><Text style={{ color: muted }}>⌄</Text>
        </TouchableOpacity>
        {open && <View style={[styles.dropdown, { backgroundColor: surface, borderColor: border }]}>
          <TextInput style={[styles.search, { color: ink, borderColor: border }]} placeholder="Search by name or address" placeholderTextColor={muted} value={query} onChangeText={setQuery} autoFocus accessibilityLabel="Search properties" />
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={styles.options}>
            {filtered.map(item => <TouchableOpacity key={idOf(item)} disabled={busy} style={[styles.option, { borderColor: border }]} onPress={() => void selectProperty(item)} accessibilityRole="button"><Text style={{ color: ink }}>{labelOf(item)}</Text><Text style={{ color: muted }}>{item.streetAddress ?? item.StreetAddress ?? ''}</Text></TouchableOpacity>)}
            {!filtered.length && <Text style={[styles.hint, { color: muted }]}>No matching properties.</Text>}
          </ScrollView>
        </View>}
        {property && isMultiUnit(property) && <>
          <Text style={[styles.label, { color: ink }]}>Unit</Text>
          {loadingUnits ? <ActivityIndicator color={colors.accent} /> : <ScrollView horizontal keyboardShouldPersistTaps="handled" style={styles.unitRow}>
            {[null, ...units].map(item => <TouchableOpacity key={item ? idOf(item) : 'common'} disabled={busy} style={[styles.unit, { backgroundColor: unitChosen && unit === item ? colors.accent : surface, borderColor: border }]} onPress={() => selectUnit(item)} accessibilityRole="radio" accessibilityState={{ selected: unitChosen && unit === item }}><Text style={{ color: unitChosen && unit === item ? '#fff' : ink }}>{item ? labelOf(item) : 'Common area'}</Text></TouchableOpacity>)}
          </ScrollView>}
          {!loadingUnits && !units.length && <Text style={[styles.hint, { color: muted }]}>No units found. You can report a common-area issue.</Text>}
        </>}
        {!properties.length && <Text style={[styles.hint, { color: muted }]}>Add a property before creating a request.</Text>}
      </>}
      {!enabled && !loading && !error && <Text style={[styles.hint, { color: muted }]}>The assistant is not enabled for this organization. Use the manual form instead.</Text>}
      {ready && !messages.length && <TouchableOpacity style={[styles.primary, { backgroundColor: colors.accent }]} disabled={busy} onPress={() => void chat([], true)}><Text style={styles.primaryText}>Start conversation</Text></TouchableOpacity>}
    </View>
    <ScrollView ref={scroll} style={styles.conversation} contentContainerStyle={styles.conversationInner} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => <View key={index} style={[styles.bubble, { backgroundColor: message.role === 'user' ? colors.accent : surface, borderColor: border, alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start' }]}><Text style={{ color: message.role === 'user' ? '#fff' : ink, lineHeight: 21 }}>{message.photoBase64 ? '📷 Photo attached' : message.content}</Text></View>)}
      {busy && <ActivityIndicator style={styles.activity} color={colors.accent} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {uncertain && <Text style={[styles.hint, { color: muted }]}>Check your maintenance list before starting another request; the previous message may have been submitted.</Text>}
    </ScrollView>
    <View style={[styles.footer, { borderColor: border, backgroundColor: colors.background }]}>
      {photoRequested && !uncertain && <View style={styles.actions}><TouchableOpacity disabled={busy} onPress={() => void attachPhoto()}><Text style={{ color: colors.accent, fontWeight: '700' }}>Add photo</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={() => void chat([...messagesRef.current, { role: 'user', content: "I don't have a photo. Please continue." }])}><Text style={{ color: colors.accent, fontWeight: '700' }}>Skip photo</Text></TouchableOpacity></View>}
      {messages.length > 0 && !uncertain && <View style={styles.composer}><TextInput style={[styles.input, { color: ink, backgroundColor: surface, borderColor: border }]} value={draft} onChangeText={setDraft} placeholder="Type your reply…" placeholderTextColor={muted} multiline maxLength={2000} accessibilityLabel="Message to maintenance assistant" editable={!busy} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" style={[styles.send, { backgroundColor: colors.accent }, (!draft.trim() || busy) && styles.disabled]} disabled={!draft.trim() || busy} onPress={send}><Text style={styles.primaryText}>Send</Text></TouchableOpacity></View>}
      <TouchableOpacity onPress={onManual} style={styles.manual}><Text style={{ color: colors.accent }}>Use manual form instead</Text></TouchableOpacity>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  heading: { fontSize: 27, fontWeight: '800' }, hint: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  select: { minHeight: 48, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdown: { borderWidth: 1, borderRadius: 6, marginTop: 4, padding: 8 }, search: { borderWidth: 1, borderRadius: 6, minHeight: 44, paddingHorizontal: 10 }, options: { maxHeight: 170 }, option: { borderBottomWidth: 1, padding: 10 },
  unitRow: { maxHeight: 56 }, unit: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', marginRight: 8 },
  primary: { minHeight: 46, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontWeight: '800' },
  conversation: { flex: 1 }, conversationInner: { padding: 18, paddingBottom: 24 }, bubble: { maxWidth: '88%', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }, activity: { alignSelf: 'flex-start', marginTop: 8 }, error: { color: '#a52e42', marginVertical: 8 },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }, actions: { flexDirection: 'row', gap: 24, paddingVertical: 8 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 6, minHeight: 46, maxHeight: 110, padding: 10 }, send: { minHeight: 46, paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center' }, disabled: { opacity: .5 }, manual: { alignSelf: 'center', padding: 10 },
});