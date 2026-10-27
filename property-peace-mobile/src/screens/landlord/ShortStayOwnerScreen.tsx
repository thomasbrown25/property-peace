import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PropertiesStackParamList } from '../../navigation/types';
import shortStayAPI, { type AirbnbCalendarStatus, type ShortStayCalendar, type ShortStayInventoryReport, type ShortStayListing, type ShortStayPhoto } from '../../api/shortStayAPI';
import { orderedPhotos, toPhotoUpload, validatePhotoSelection } from '../../features/properties/shortStayPhotos';
import PropertyAPI from '../../api/propertyAPI';
import { unitRentalMode } from '../../features/properties/rentalMode';
import { airbnbTimestamp, emptyListing, isOwnerBlock, listingPayload, ownerError, parseLocalDate, ratePayload, rangeRatePayload, validLocalRange, type ListingForm } from '../../features/properties/shortStayOwner';
import { useAppTheme } from '../../theme/AppTheme';
import ShortStayCollectionSection from './ShortStayCollectionSection';

type Route = RouteProp<PropertiesStackParamList, 'ShortStayOwner'>;
const fields: { key: Exclude<keyof ListingForm, 'lodgingTaxRatePercent' | 'attestLodgingTaxResponsibility'>; label: string; keyboard?: 'decimal-pad' | 'number-pad'; multiline?: boolean; hint?: string; maxLength?: number }[] = [
  { key: 'publicTitle', label: 'Public title (100 characters)', maxLength: 100 },
  { key: 'publicSummary', label: 'Public summary (1,200 characters)', multiline: true, maxLength: 1200 },
  { key: 'nightlyBasePrice', label: 'Base nightly rate', keyboard: 'decimal-pad' },
  { key: 'weekendNightlyRate', label: 'Weekend nightly rate (optional)', keyboard: 'decimal-pad', hint: 'Blank uses base rate' },
  { key: 'weeklyDiscountPercent', label: 'Weekly discount (%)', keyboard: 'decimal-pad', hint: '0–99.99 (two decimals)' },
  { key: 'monthlyDiscountPercent', label: 'Monthly discount (%)', keyboard: 'decimal-pad', hint: '0–99.99 (two decimals)' },
  { key: 'minimumNights', label: 'Minimum nights', keyboard: 'number-pad' },
  { key: 'capacity', label: 'Sleeping capacity', keyboard: 'number-pad' },
  { key: 'cleaningFee', label: 'Cleaning fee', keyboard: 'decimal-pad' },
  { key: 'checkInTime', label: 'Check-in time', hint: 'HH:mm (24-hour)' },
  { key: 'checkOutTime', label: 'Check-out time', hint: 'HH:mm (24-hour)' },
  { key: 'houseRules', label: 'House rules', multiline: true },
  { key: 'amenities', label: 'Amenities', multiline: true },
  { key: 'cancellationPolicy', label: 'Cancellation policy', multiline: true },
];
function Field({ label, value, onChangeText, hint, keyboardType, multiline, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; hint?: string; keyboardType?: 'decimal-pad' | 'number-pad'; multiline?: boolean; maxLength?: number }) {
  const { colors } = useAppTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><TextInput accessibilityLabel={label} style={[styles.input, { color: colors.text, borderColor: colors.muted, backgroundColor: colors.background }, multiline && styles.multiline]} value={value} onChangeText={onChangeText} maxLength={maxLength} placeholder={hint} placeholderTextColor={colors.muted} keyboardType={keyboardType} multiline={multiline} autoCapitalize="none" /></View>;
}
type GuidebookForm = { houseRules: string; arrivalOverview: string; localNotes: string };
const guidebookFields: { key: keyof GuidebookForm; label: string }[] = [
  { key: 'houseRules', label: 'Guidebook house rules' },
  { key: 'arrivalOverview', label: 'Arrival overview' },
  { key: 'localNotes', label: 'Local notes' },
];
const emptyGuidebook = (): GuidebookForm => ({ houseRules: '', arrivalOverview: '', localNotes: '' });
// Mirror the server's public-safe text restrictions for prompt feedback; server validates again.
const unsafeGuidebookText = (text: string) => /\b(?:wi[ -]?fi|password|passcode|pin|access[ -]?code|door[ -]?code|lockbox|keypad|security[ -]?code|entry[ -]?code|secret|credential)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?\d[\d ().-]{7,}\d)\b|<\s*\/?\s*[a-z][^>]*>|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/i.test(text);
function ShortStayGuidebook({ unitId, propertyId, checkUnitMode }: { unitId: string; propertyId: string; checkUnitMode: () => Promise<void> }) {
  const { colors } = useAppTheme();
  const [form, setForm] = useState<GuidebookForm>(emptyGuidebook);
  const [loaded, setLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const live = useRef(true);
  const generation = useRef(0);
  const locked = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setLoaded(false); setHasDraft(false); setError(''); setNotice('');
    try {
      const draft = await shortStayAPI.getGuidebookDraft(unitId);
      if (live.current && request === generation.current) {
        setForm({ houseRules: draft?.houseRules ?? '', arrivalOverview: draft?.arrivalOverview ?? '', localNotes: draft?.localNotes ?? '' });
        setHasDraft(draft != null);
        setLoaded(true);
      }
    } catch { if (live.current && request === generation.current) setError('Could not load guidebook draft. Retry to load before editing.'); }
    finally { if (live.current && request === generation.current) setLoading(false); }
  }, [unitId, propertyId]);
  useEffect(() => {
    live.current = true;
    void load();
    return () => { live.current = false; ++generation.current; locked.current = false; };
  }, [load]);
  const valid = guidebookFields.every(({ key }) => form[key].length <= 2000 && !unsafeGuidebookText(form[key]));
  const save = async () => {
    if (!loaded || !valid || locked.current) return;
    const request = generation.current;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await checkUnitMode();
      if (!live.current || request !== generation.current) return;
      await shortStayAPI.putGuidebookDraft(unitId, form);
      if (live.current && request === generation.current) { setHasDraft(true); setNotice('Private guidebook draft saved. Not published to guests.'); }
    } catch { if (live.current && request === generation.current) setError('Could not save guidebook draft. Your edits are still here; try again.'); }
    finally { if (live.current && request === generation.current) { locked.current = false; setBusy(false); } }
  };
  const confirmDiscard = () => {
    if (!loaded || !hasDraft || locked.current) return;
    const request = generation.current;
    Alert.alert('Discard guidebook draft permanently?', 'This permanently removes the private guidebook draft and any unsaved edits. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard permanently', style: 'destructive', onPress: () => {
        if (!live.current || request !== generation.current || locked.current) return;
        void (async () => {
          locked.current = true; setBusy(true); setError(''); setNotice('');
          let completed = false;
          try {
            await checkUnitMode();
            if (!live.current || request !== generation.current) return;
            await shortStayAPI.deleteGuidebookDraft(unitId);
            if (live.current && request === generation.current) {
              ++generation.current; // Invalidate any older reads before clearing the editor.
              completed = true;
              setForm(emptyGuidebook()); setHasDraft(false);
              setNotice('Guidebook draft discarded permanently.');
            }
          } catch { if (live.current && request === generation.current) setError('Could not discard guidebook draft. Your edits are still here; try again.'); }
          finally { if (live.current && generation.current === request + (completed ? 1 : 0)) { locked.current = false; setBusy(false); } }
        })();
      } },
    ]);
  };
  return <View>
    <Text style={[styles.section, { color: colors.text }]}>Guidebook draft</Text>
    <Text style={{ color: colors.muted }}>Private owner draft — not published to guests. Plain text only (2,000 characters per field). Do not include photos, names, contact details, access codes, passwords or other personal information.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice && <Text style={{ color: colors.text }}>{notice}</Text>}
    {loading && <ActivityIndicator color={colors.accent} />}
    {!loaded && !loading && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry guidebook draft" onPress={() => void load()} style={[styles.button, { backgroundColor: colors.accent }]}><Text style={styles.buttonText}>Retry guidebook draft</Text></TouchableOpacity>}
    {loaded && <>
      {guidebookFields.map(({ key, label }) => <View key={key} style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>{label} · {form[key].length}/2000</Text>
        <TextInput accessibilityLabel={label} value={form[key]} onChangeText={value => { setForm(current => ({ ...current, [key]: value })); setNotice(''); }} maxLength={2000} multiline textAlignVertical="top" style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.muted, backgroundColor: colors.background }]} placeholderTextColor={colors.muted} />
      </View>)}
      {!valid && <Text accessibilityRole="alert" style={styles.error}>Use public-safe plain text only; remove contact information, access credentials or markup.</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save guidebook draft" disabled={busy || !valid} onPress={() => void save()} style={[styles.button, { backgroundColor: colors.accent }, (busy || !valid) && styles.disabled]}><Text style={styles.buttonText}>Save guidebook draft</Text></TouchableOpacity>
      {hasDraft && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Discard guidebook draft" disabled={busy} onPress={confirmDiscard} style={[styles.button, { backgroundColor: '#bf3d37' }, busy && styles.disabled]}><Text style={styles.buttonText}>Discard guidebook draft</Text></TouchableOpacity>}
    </>}
  </View>;
}
function ShortStayPhotos({ unitId }: { unitId: string }) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<ShortStayPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const refreshPhotos = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await shortStayAPI.getPhotos(unitId);
      if (live.current && request === generation.current) { setPhotos(orderedPhotos(result)); setLoaded(true); setError(''); }
    } catch (e) {
      if (live.current && request === generation.current) { setLoaded(true); setError(ownerError(e)); }
    }
  }, [unitId]);
  useEffect(() => {
    live.current = true;
    void refreshPhotos();
    // SAS links expire; request fresh links on foreground rather than persisting them.
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refreshPhotos(); });
    const unsubscribe = navigation.addListener('focus', () => { void refreshPhotos(); });
    return () => { live.current = false; ++generation.current; listener.remove(); unsubscribe(); };
  }, [navigation, refreshPhotos]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await action();
      // Mutations can succeed even when a refresh fails; never optimistically reuse old SAS URLs.
      setPhotos([]);
      await refreshPhotos();
    } catch (e) { if (live.current) setError(ownerError(e)); }
    finally { inFlight.current = false; if (live.current) setBusy(false); }
  };
  const pickPhotos = async () => {
    if (inFlight.current || !loaded || error || photos.length >= 20) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access in Settings to add listing photos.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.min(5, 20 - photos.length), quality: 0.8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled) return;
      const issue = validatePhotoSelection(result.assets, photos.length);
      if (issue) { Alert.alert('Photo not supported', issue); return; }
      await mutate(() => shortStayAPI.uploadPhotos(unitId, result.assets.map(toPhotoUpload)));
    } catch (e) { if (live.current) setError(ownerError(e)); }
  };
  return <View>
    <Text style={[styles.section, { color: colors.text }]}>Listing photos</Text>
    <Text style={{ color: colors.muted }}>JPEG or PNG · up to 5 MB each · 20 photos maximum. Photos are part of the draft, not published.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loaded && <ActivityIndicator color={colors.accent} />}
    {loaded && <>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh listing photos" disabled={busy} onPress={() => void refreshPhotos()} style={[styles.button, { backgroundColor: colors.accent }, busy && styles.disabled]}><Text style={styles.buttonText}>Refresh photos</Text></TouchableOpacity>
      {!error && <>
        {photos.length === 0 && <Text style={{ color: colors.muted, marginTop: 12 }}>No listing photos yet.</Text>}
        {photos.map(photo => <View key={photo.id} style={styles.photoRow}>
          <Image source={{ uri: photo.url, cache: 'reload', headers: { 'Cache-Control': 'no-store' } }} style={styles.photo} resizeMode="cover" />
          <View style={{ flex: 1 }}><Text style={{ color: colors.text }}>{photo.isCoverPhoto ? 'Cover photo' : `Photo ${photo.displayOrder + 1}`}</Text>
            {!photo.isCoverPhoto && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Set photo ${photo.id} as cover`} disabled={busy} onPress={() => void mutate(() => shortStayAPI.setCover(unitId, photo.id))} style={[styles.button, { backgroundColor: colors.accent }, busy && styles.disabled]}><Text style={styles.buttonText}>Set as cover</Text></TouchableOpacity>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove photo ${photo.id}`} disabled={busy} onPress={() => Alert.alert('Remove listing photo?', 'This photo will be permanently removed from the draft.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void mutate(() => shortStayAPI.deletePhoto(unitId, photo.id)) }])} style={[styles.button, { backgroundColor: colors.accent }, busy && styles.disabled]}><Text style={styles.buttonText}>Remove photo</Text></TouchableOpacity>
          </View>
        </View>)}
        {photos.length < 20 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add listing photos" disabled={busy} onPress={() => void pickPhotos()} style={[styles.button, { backgroundColor: colors.accent }, busy && styles.disabled]}><Text style={styles.buttonText}>Add photos</Text></TouchableOpacity>}
      </>}
    </>}
  </View>;
}
function AirbnbCalendar({ unitId, timeZoneId, checkUnitMode, onCalendarChanged }: { unitId: string; timeZoneId: string; checkUnitMode: () => Promise<void>; onCalendarChanged: () => void }) {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<AirbnbCalendarStatus | null>(null);
  const [url, setUrl] = useState(''); // Secret stays in component memory only; never persist or log it.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const live = useRef(true);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const loadStatus = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await shortStayAPI.getAirbnb(unitId);
      if (live.current && request === generation.current) { setStatus(result); setError(''); }
    } catch {
      if (live.current && request === generation.current) setError('Could not load Airbnb calendar status. Try again.');
    }
  }, [unitId]);
  useEffect(() => {
    live.current = true;
    void loadStatus();
    return () => { live.current = false; ++generation.current; setUrl(''); };
  }, [loadStatus]);
  const mutate = async (action: () => Promise<AirbnbCalendarStatus>, message: string, clearsSecret = false) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await checkUnitMode();
      const result = await action();
      if (!live.current) return;
      ++generation.current;
      setStatus(result);
      if (clearsSecret) setUrl('');
      onCalendarChanged();
      setNotice(message);
    } catch {
      if (live.current) setError('Could not update Airbnb calendar. Check the connection and try again.');
    } finally { inFlight.current = false; if (live.current) setBusy(false); }
  };
  const actionButton = (label: string, onPress: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={onPress} style={[styles.button, { backgroundColor: colors.accent }, (busy || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  const zone = status?.timeZoneId || timeZoneId;
  return <View>
    <Text style={[styles.section, { color: colors.text }]}>4. Airbnb calendar (iCal)</Text>
    <Text style={{ color: colors.muted }}>Import only: changes are not sent to Airbnb. iCal sync can be delayed or incomplete; check availability in both calendars before accepting reservations.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice && <Text style={{ color: colors.text }}>{notice}</Text>}
    {!status && actionButton('Retry Airbnb status', () => void loadStatus())}
    {status && <>
      {actionButton('Reload Airbnb status', () => void loadStatus())}
      <Text style={{ color: colors.text }}>Connection: {status.enabled ? 'Connected' : 'Not connected'} · {status.health.replace(/_/g, ' ')}</Text>
      {status.enabled && <>
        <Text style={{ color: colors.text }}>Last attempt ({zone}): {airbnbTimestamp(status.lastAttemptAtUtc, zone)}</Text>
        <Text style={{ color: colors.text }}>Last successful sync ({zone}): {airbnbTimestamp(status.lastSuccessAtUtc, zone)}</Text>
        {status.nextAttemptAtUtc && <Text style={{ color: colors.text }}>Next attempt ({zone}): {airbnbTimestamp(status.nextAttemptAtUtc, zone)}</Text>}
        {(status.health === 'stale' || status.health === 'retrying') && <Text accessibilityRole="alert" style={styles.error}>Airbnb availability may be stale. Verify dates directly in Airbnb.</Text>}
        {actionButton('Queue Airbnb refresh', () => void mutate(() => shortStayAPI.refreshAirbnb(unitId), 'Refresh queued. Imported dates update after the background sync completes.'))}
      </>}
      <Text style={{ color: colors.muted, marginTop: 12 }}>{status.enabled ? 'Enter a new export URL to replace the current connection. The existing URL is never shown.' : 'Paste the private Airbnb iCal export URL to connect.'}</Text>
      <TextInput accessibilityLabel="Airbnb iCal URL" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://www.airbnb.com/calendar/ical/..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.muted, backgroundColor: colors.background }]} />
      {actionButton(status.enabled ? 'Replace Airbnb calendar' : 'Connect Airbnb calendar', () => void mutate(() => shortStayAPI.connectAirbnb(unitId, url.trim()), 'Connection saved. Initial import is queued; reload availability after sync.', true), !url.trim())}
      {status.enabled && actionButton('Disconnect Airbnb calendar', () => Alert.alert('Disconnect Airbnb calendar?', 'This clears imported dates for this unit. Owner blocks are unaffected.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => void mutate(() => shortStayAPI.disconnectAirbnb(unitId), 'Disconnected. Imported dates cleared; reload availability.') }]))}
    </>}
  </View>;
}
export default function ShortStayOwnerScreen() {
  const { propertyId, unitId, unitName } = useRoute<Route>().params;
  const navigation = useNavigation<NativeStackNavigationProp<PropertiesStackParamList, 'ShortStayOwner'>>();
  const { colors } = useAppTheme();
  const [timeZoneId, setTimeZoneId] = useState('');
  const [savedZone, setSavedZone] = useState(false);
  const [form, setForm] = useState<ListingForm>(emptyListing);
  const [savedTax, setSavedTax] = useState<ShortStayListing | null>(null);
  const [calendar, setCalendar] = useState<ShortStayCalendar | null>(null);
  const [inventory, setInventory] = useState<ShortStayInventoryReport | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [reason, setReason] = useState('');
  const [rateDate, setRateDate] = useState('');
  const [rate, setRate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeRate, setRangeRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [listingLoaded, setListingLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const calendarGeneration = useRef(0);
  const inventoryGeneration = useRef(0);
  const loadGeneration = useRef(0);
  useEffect(() => { navigation.setOptions({ title: `${unitName} · short-stay setup` }); }, [navigation, unitName]);
  const checkUnitMode = useCallback(async () => {
    const units = await PropertyAPI.getUnits(propertyId);
    const unit = units.find(item => String(item.id ?? item.Id) === String(unitId));
    if (!unit || unitRentalMode(unit) !== 'ShortTerm') throw new Error('This unit is no longer short-term. Return to the property and refresh.');
  }, [propertyId, unitId]);
  const load = useCallback(async () => {
    const request = ++loadGeneration.current;
    setLoading(true);
    setSavedZone(false);
    setListingLoaded(false);
    setHasDraft(false);
    setSavedTax(null);
    setCalendar(null);
    ++calendarGeneration.current;
    ++inventoryGeneration.current; setInventory(null); setInventoryError(''); setInventoryLoading(false);
    setError('');
    try {
      await checkUnitMode();
      const zone = await shortStayAPI.getTimeZone(propertyId);
      if (request !== loadGeneration.current) return;
      setTimeZoneId(zone.timeZoneId || '');
      setSavedZone(Boolean(zone.timeZoneId));
      if (zone.timeZoneId) {
        const draft = await shortStayAPI.getListing(unitId);
        if (request !== loadGeneration.current) return;
        setForm(draft ? { nightlyBasePrice: String(draft.nightlyBasePrice), weekendNightlyRate: draft.weekendNightlyRate == null ? '' : String(draft.weekendNightlyRate), weeklyDiscountPercent: String(draft.weeklyDiscountPercent ?? 0), monthlyDiscountPercent: String(draft.monthlyDiscountPercent ?? 0), minimumNights: String(draft.minimumNights), capacity: String(draft.capacity), cleaningFee: String(draft.cleaningFee), checkInTime: draft.checkInTime?.slice(0, 5) || '', checkOutTime: draft.checkOutTime?.slice(0, 5) || '', houseRules: draft.houseRules || '', amenities: draft.amenities || '', cancellationPolicy: draft.cancellationPolicy || '', publicTitle: draft.publicTitle || '', publicSummary: draft.publicSummary || '', lodgingTaxRatePercent: draft.lodgingTaxRatePercent == null ? '' : String(draft.lodgingTaxRatePercent), attestLodgingTaxResponsibility: draft.lodgingTaxRatePercent != null && Boolean(draft.taxPolicyAttestedAtUtc && draft.taxPolicyAttestedByUserId) } : emptyListing());
        setSavedTax(draft);
        setListingLoaded(true);
        setHasDraft(Boolean(draft));
      }
    } catch (e) { if (request === loadGeneration.current) setError(ownerError(e)); }
    finally { if (request === loadGeneration.current) setLoading(false); }
  }, [checkUnitMode, propertyId, unitId]);
  useEffect(() => {
    void load();
    return () => { ++loadGeneration.current; ++calendarGeneration.current; ++inventoryGeneration.current; };
  }, [load]);
  const refreshInventory = useCallback(async (requestedStart = start, requestedEnd = end) => {
    const request = ++inventoryGeneration.current;
    setInventory(null); setInventoryError(''); setInventoryLoading(true);
    try {
      const result = await shortStayAPI.getInventoryReport(unitId, requestedStart, requestedEnd);
      if (request === inventoryGeneration.current) {
        if (!result || String(result.unitId) !== String(unitId) || result.start !== requestedStart || result.end !== requestedEnd || !result.timeZoneId || !['totalNights', 'ownerBlockedNights', 'airbnbBlockedNights', 'overlapNights', 'blockedNights', 'unblockedNights', 'pricedUnblockedNights', 'unpricedUnblockedNights'].every(key => Number.isInteger(result[key as keyof ShortStayInventoryReport]))) throw new Error('Mismatched inventory response');
        setInventory(result);
      }
    } catch {
      if (request === inventoryGeneration.current) setInventoryError('Inventory snapshot unavailable. Retry to load current counts.');
    } finally { if (request === inventoryGeneration.current) setInventoryLoading(false); }
  }, [unitId, start, end]);
  const refreshCalendar = useCallback(async () => {
    const request = ++calendarGeneration.current;
    const requestedStart = start, requestedEnd = end;
    setCalendar(null);
    void refreshInventory(requestedStart, requestedEnd);
    const result = await shortStayAPI.getCalendar(unitId, requestedStart, requestedEnd);
    if (request === calendarGeneration.current) setCalendar(result);
  }, [unitId, start, end, refreshInventory]);
  const invalidateCalendar = useCallback(() => { ++calendarGeneration.current; setCalendar(null); if (validLocalRange(start, end)) void refreshInventory(); }, [start, end, refreshInventory]);
  const changeRange = (setter: (value: string) => void) => (value: string) => {
    ++calendarGeneration.current;
    setCalendar(null);
    ++inventoryGeneration.current; setInventory(null); setInventoryError(''); setInventoryLoading(false);
    setter(value);
  };
  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); after?.(); }
    catch (e) { setError(ownerError(e)); }
    finally { setBusy(false); }
  };
  const button = (label: string, onPress: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={onPress} style={[styles.button, { backgroundColor: colors.accent }, (busy || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} /></View>;
  if (error && !savedZone) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{button('Try again', () => void load())}</View>;
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={[styles.heading, { color: colors.text }]}>Short-stay owner setup</Text>
    <Text style={[styles.notice, { color: colors.text }]}>Owner setup only. Guests cannot book yet. Booking and payment are disabled; rates and availability here do not confirm reservations.</Text>
    <ShortStayCollectionSection propertyId={propertyId} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Text style={[styles.section, { color: colors.text }]}>1. Property time zone</Text>
    <Text style={{ color: colors.muted }}>Use an IANA zone (for example America/New_York). Shared by this property's short-term units.</Text>
    <Field label="IANA time zone" value={timeZoneId} onChangeText={value => { setTimeZoneId(value); setSavedZone(false); setListingLoaded(false); setHasDraft(false); setSavedTax(null); setCalendar(null); ++calendarGeneration.current; ++inventoryGeneration.current; setInventory(null); setInventoryError(''); }} hint="America/New_York" />
    {button('Save time zone', () => void run(async () => { if (!timeZoneId.trim()) throw new Error('Enter an IANA time zone, such as America/New_York or UTC.'); await checkUnitMode(); await shortStayAPI.putTimeZone(propertyId, timeZoneId.trim()); setSavedZone(true); await load(); }), !timeZoneId.trim())}
    {savedZone && !listingLoaded && <View><Text style={{ color: colors.muted }}>Listing draft unavailable. Load it before editing or saving.</Text>{button('Retry loading draft', () => void load())}</View>}
    {savedZone && listingLoaded && <>
      <Text style={[styles.section, { color: colors.text }]}>2. Listing draft</Text>
      <Text style={{ color: colors.muted }}>Draft details only — not a monthly rental listing and not published.</Text>
      <Text style={{ color: colors.muted }}>Publicly visible to guests if published. Do not include access codes or private addresses. Plain text only.</Text>
      {fields.map(field => <Field key={field.key} label={field.label} value={form[field.key]} onChangeText={value => setForm(current => ({ ...current, [field.key]: value }))} hint={field.hint} keyboardType={field.keyboard} multiline={field.multiline} maxLength={field.maxLength} />)}
      <Text style={{ color: colors.muted }}>Pricing priority: a date-specific nightly override replaces the base or weekend rate. Otherwise Friday and Saturday use the optional weekend rate; other nights use the base rate. A nonzero weekly discount applies to stays of 7+ nights. At 28+ nights, a nonzero monthly discount supersedes the weekly discount (they never stack). Set a discount to 0 to turn it off. Discounts apply to the nightly subtotal before fees and estimated tax.</Text>
      <Text style={[styles.section, { color: colors.text }]}>Lodging tax · owner configuration</Text>
      <Text style={{ color: colors.muted }}>Enter the lodging tax rate you determine applies to this listing. Blank means not configured; enter 0 only if you intentionally select a 0% rate. Any estimated tax shown in a quote is informational, not collected or payable through Property Peace. Property Peace does not calculate your tax obligations or remit lodging tax.</Text>
      <Field label="Lodging tax rate (%)" value={form.lodgingTaxRatePercent} onChangeText={value => setForm(current => ({ ...current, lodgingTaxRatePercent: value }))} hint="Blank until configured (0–100, up to 4 decimals)" keyboardType="decimal-pad" />
      <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="I am responsible for correct lodging tax and remittance" accessibilityState={{ checked: form.attestLodgingTaxResponsibility }} onPress={() => setForm(current => ({ ...current, attestLodgingTaxResponsibility: !current.attestLodgingTaxResponsibility }))} style={styles.taxCheckbox}>
        <Text style={{ color: colors.text, fontSize: 22 }}>{form.attestLodgingTaxResponsibility ? '☑' : '☐'}</Text>
        <Text style={{ color: colors.text, flex: 1 }}>I confirm that I, as owner or manager, am responsible for setting the correct lodging tax rate and for calculating and remitting applicable lodging taxes.</Text>
      </TouchableOpacity>
      {savedTax?.lodgingTaxRatePercent != null && savedTax.taxPolicyAttestedAtUtc && savedTax.taxPolicyAttestedByUserId ?
        <Text style={{ color: colors.text }}>Saved lodging tax rate: {savedTax.lodgingTaxRatePercent}% · responsibility attested {savedTax.taxPolicyAttestedAtUtc} by user {savedTax.taxPolicyAttestedByUserId}.</Text> :
        <Text style={{ color: colors.muted }}>Saved lodging tax rate: not configured · no attestation on file.</Text>}
      {!listingPayload(form) && <Text accessibilityRole="alert" style={styles.error}>Check listing values: weekend rate is blank or positive (up to two decimals); weekly and monthly discounts are 0–99.99% (up to two decimals). For lodging tax enter 0–100% with up to four decimals and check the responsibility box, or leave both blank and unchecked.</Text>}
      {button('Save listing draft', () => {
        const save = () => void run(async () => { const window = calendarGeneration.current; const saved = await shortStayAPI.putListing(unitId, form); setSavedTax(saved); setHasDraft(true); if ((calendar || inventory) && window === calendarGeneration.current) await refreshCalendar(); });
        if (savedTax?.lodgingTaxRatePercent != null && form.lodgingTaxRatePercent.trim() === '') {
          Alert.alert('Clear lodging tax configuration?', 'Clear the saved lodging tax rate and attestation? Bookings may be blocked until a rate is set and attested again.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Clear rate and attestation', style: 'destructive', onPress: save },
          ]);
        } else save();
      }, !listingPayload(form))}
      {listingLoaded && (hasDraft ? <ShortStayPhotos unitId={unitId} /> : <Text style={{ color: colors.muted, marginTop: 12 }}>Save the listing draft before adding photos.</Text>)}
      <Text style={[styles.section, { color: colors.text }]}>3. Availability (owner + imported)</Text>
      <Text style={{ color: colors.muted }}>Property-local YYYY-MM-DD dates. End dates are exclusive (checkout day is not blocked). Select a window to see owner and read-only Airbnb blocks plus nightly rates.</Text>
      <Field label="View from" value={start} onChangeText={changeRange(setStart)} hint="YYYY-MM-DD" />
      <Field label="View until (exclusive)" value={end} onChangeText={changeRange(setEnd)} hint="YYYY-MM-DD" />
      {button('Load availability', () => void run(refreshCalendar), !validLocalRange(start, end))}
      <View style={[styles.inventoryCard, { borderColor: colors.muted }]}>
        <Text style={[styles.label, { color: colors.text }]}>Inventory snapshot · property-local nights</Text>
        {inventoryLoading && <ActivityIndicator color={colors.accent} />}
        {!!inventoryError && <Text accessibilityRole="alert" style={styles.error}>{inventoryError}</Text>}
        {!!inventoryError && button('Retry inventory snapshot', () => void refreshInventory(), !validLocalRange(start, end))}
        {inventory && !inventoryLoading && <>
          <Text style={{ color: colors.muted }}>{inventory.start} → {inventory.end} (exclusive) · {inventory.timeZoneId} · snapshot at {inventory.snapshotAtUtc}</Text>
          <Text style={{ color: colors.text }}>Total nights: {inventory.totalNights}</Text>
          <Text style={{ color: colors.text }}>Owner blocked nights: {inventory.ownerBlockedNights}</Text>
          <Text style={{ color: colors.text }}>Airbnb blocked nights: {inventory.airbnbBlockedNights}</Text>
          <Text style={{ color: colors.text }}>Overlap nights (counted once in blocked total): {inventory.overlapNights}</Text>
          <Text style={{ color: colors.text }}>Blocked nights: {inventory.blockedNights}</Text>
          <Text style={{ color: colors.text }}>Unblocked nights (not booked): {inventory.unblockedNights}</Text>
          <Text style={{ color: colors.text }}>Priced unblocked nights: {inventory.pricedUnblockedNights}</Text>
          <Text style={{ color: colors.text }}>Unpriced unblocked nights: {inventory.unpricedUnblockedNights}</Text>
          {inventory.airbnbSyncStaleWarning && <Text accessibilityRole="alert" style={styles.error}>Airbnb availability may be stale ({inventory.airbnbSyncStatus.replace(/_/g, ' ')}). Verify directly in Airbnb.</Text>}
        </>}
        {!inventory && !inventoryLoading && !inventoryError && <Text style={{ color: colors.muted }}>Load availability to see inventory counts (up to 90 nights).</Text>}
      </View>
      {calendar && <>
        <Text style={[styles.label, { color: colors.text }]}>Availability · {calendar.timeZoneId}</Text>
        {calendar.blocks.length === 0 && <Text style={{ color: colors.muted }}>No blocks in this window.</Text>}
        {calendar.blocks.map(block => <View key={`${block.source}-${block.id}`} style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>{isOwnerBlock(block) ? 'Manual block' : 'Airbnb · read-only'} · {block.startDate} → {block.endDate} (exclusive){isOwnerBlock(block) && block.reason ? ` · ${block.reason}` : ''}</Text>{isOwnerBlock(block) && button('Remove block', () => Alert.alert('Remove manual block?', `${block.startDate} to ${block.endDate}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void run(async () => { await shortStayAPI.deleteBlock(unitId, block.id); await refreshCalendar(); }) }]))}</View>)}
        {calendar.nights.map(night => <View key={night.date} style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>{night.date} · {night.effectiveRate == null ? 'No base rate' : `$${night.effectiveRate}`}{night.overrideRate != null ? ' (override)' : night.priceSource === 'Weekend' ? ' (weekend)' : ''}</Text>{night.overrideRate != null && button('Reset rate', () => void run(async () => { await shortStayAPI.deleteRate(unitId, night.date); await refreshCalendar(); }))}</View>)}
      </>}
      <Text style={[styles.section, { color: colors.text }]}>Block nights</Text>
      <Field label="Block start" value={blockStart} onChangeText={setBlockStart} hint="YYYY-MM-DD" />
      <Field label="Block end (exclusive)" value={blockEnd} onChangeText={setBlockEnd} hint="YYYY-MM-DD" />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} />
      {button('Add owner block', () => void run(async () => { await shortStayAPI.addBlock(unitId, blockStart, blockEnd, reason); setBlockStart(''); setBlockEnd(''); setReason(''); if (calendar || inventory) await refreshCalendar(); }), !validLocalRange(blockStart, blockEnd) || reason.length > 500)}
      <Text style={[styles.section, { color: colors.text }]}>Nightly rate override</Text>
      <Field label="Rate date" value={rateDate} onChangeText={setRateDate} hint="YYYY-MM-DD" />
      <Field label="Override rate" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
      {button('Save rate override', () => void run(async () => { await shortStayAPI.putRate(unitId, rateDate, rate); setRate(''); if (calendar || inventory) await refreshCalendar(); }), !parseLocalDate(rateDate) || !ratePayload(rate))}
      {button('Remove rate override', () => Alert.alert('Remove rate override?', rateDate, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void run(async () => { await shortStayAPI.deleteRate(unitId, rateDate); if (calendar || inventory) await refreshCalendar(); }) }]), !parseLocalDate(rateDate))}
      <Text style={[styles.section, { color: colors.text }]}>Date-range nightly override</Text>
      <Text style={{ color: colors.muted }}>Set the same nightly rate on each property-local night from start (inclusive) to end (exclusive), up to 366 nights. Existing overrides in the range are replaced; remove individual overrides above or from the loaded calendar.</Text>
      <Field label="Range start" value={rangeStart} onChangeText={setRangeStart} hint="YYYY-MM-DD" />
      <Field label="Range end (exclusive)" value={rangeEnd} onChangeText={setRangeEnd} hint="YYYY-MM-DD" />
      <Field label="Range nightly rate" value={rangeRate} onChangeText={setRangeRate} keyboardType="decimal-pad" />
      {button('Save range rate override', () => void run(async () => { await shortStayAPI.putRateRange(unitId, rangeStart, rangeEnd, rangeRate); setRangeRate(''); if (calendar || inventory) await refreshCalendar(); }), !rangeRatePayload(rangeStart, rangeEnd, rangeRate))}
      <AirbnbCalendar unitId={unitId} timeZoneId={timeZoneId} checkUnitMode={checkUnitMode} onCalendarChanged={invalidateCalendar} />
    </>}
    <ShortStayGuidebook key={`${propertyId}:${unitId}`} propertyId={propertyId} unitId={unitId} checkUnitMode={checkUnitMode} />
  </ScrollView>;
}
const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, content: { padding: 20, paddingBottom: 60 }, heading: { fontSize: 23, fontWeight: '800' }, notice: { fontWeight: '700', marginVertical: 14 }, section: { fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 9 }, inventoryCard: { borderWidth: 1, borderRadius: 9, padding: 12, marginTop: 16, gap: 5 }, field: { marginTop: 12 }, label: { fontWeight: '700', marginBottom: 5 }, input: { borderWidth: 1, borderRadius: 9, padding: 12, minHeight: 48 }, multiline: { minHeight: 90, textAlignVertical: 'top' }, taxCheckbox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 }, button: { minHeight: 44, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.5 }, error: { color: '#bf3d37', marginVertical: 8 }, row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#aab4bf', flexDirection: 'row', alignItems: 'center', gap: 8 }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }, photo: { width: 110, height: 110, borderRadius: 8 } });
