import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import announcementAPI, { type Announcement } from '../../api/announcementAPI';
import propertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import { announcementDraftFromDetail, emptyAnnouncementDraft, validateAnnouncementDraft, type AnnouncementDraft } from '../../features/announcements/announcementForm';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (item: Property | Unit) => Number(item.id ?? item.Id);
const labelOf = (item: Property | Unit) => String(item.name ?? item.Name ?? item.streetAddress ?? 'Unnamed');
export default function AnnouncementComposeModal({ visible, onClose, onSent, editing }: { visible: boolean; onClose: () => void; onSent: () => void; editing?: Announcement | null }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyAnnouncementDraft);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    try {
      setDraft(editing ? announcementDraftFromDetail(editing) : emptyAnnouncementDraft());
      setOptionsError(''); setProperties([]); setUnits([]); setError('');
    } catch (cause) {
      setDraft(emptyAnnouncementDraft()); setProperties([]); setUnits([]);
      setOptionsError(cause instanceof Error ? cause.message : 'Cannot safely restore announcement audience.');
      return;
    }
    void (async () => {
      try {
        const loaded = await propertyAPI.getProperties();
        const allUnits = await Promise.all(loaded.map(property => propertyAPI.getUnits(idOf(property))));
        if (active) { setProperties(loaded); setUnits(allUnits.flat()); }
      } catch { if (active) setOptionsError('Could not load audience options. Close and retry.'); }
    })();
    return () => { active = false; };
  }, [visible, editing]);
  useEffect(() => {
    if (!visible || optionsError || (draft.audience !== 'all' && !properties.length)) return;
    let active = true;
    setRecipientCount(null); setPreviewError('');
    if (validateAnnouncementDraft({ ...draft, message: 'preview', email: true, schedule: 'now' }).some(reason => reason.startsWith('Choose at least one'))) return;
    void announcementAPI.previewRecipients(draft).then(recipients => { if (active) setRecipientCount(recipients.length); })
      .catch(() => { if (active) setPreviewError('Could not check recipients. Retry by changing audience.'); });
    return () => { active = false; };
  }, [visible, draft.audience, draft.propertyIds.join(','), draft.unitIds.join(','), properties.length, optionsError]);
  const update = (changes: Partial<AnnouncementDraft>) => setDraft(old => ({ ...old, ...changes }));
  const toggle = (key: 'propertyIds' | 'unitIds', id: number) => setDraft(old => ({ ...old, [key]: old[key].includes(id) ? old[key].filter(value => value !== id) : [...old[key], id] }));
  const submit = () => {
    const issues = validateAnnouncementDraft(draft);
    if (issues.length) { setError(issues.join(' ')); return; }
    if (!recipientCount || previewError || optionsError || busy) { setError('Check the selected recipients before saving.'); return; }
    Alert.alert(editing ? 'Save announcement?' : draft.schedule === 'later' ? 'Schedule announcement?' : 'Send announcement?', `${editing ? 'Update' : 'Deliver'} to ${recipientCount} eligible tenant${recipientCount === 1 ? '' : 's'} via ${[draft.email && 'email', draft.notification && 'in-app notification'].filter(Boolean).join(' and ')}${draft.schedule === 'later' ? ` at ${new Date(draft.scheduledAt!).toLocaleString()}` : ' now'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: editing ? 'Save' : draft.schedule === 'later' ? 'Schedule' : 'Send now', onPress: async () => {
        setBusy(true); setError('');
        try { await announcementAPI.save(draft, editing?.id); onSent(); }
        catch (cause: any) { setError(cause?.message || 'Could not save announcement. Your draft is still here.'); }
        finally { setBusy(false); }
      } },
    ]);
  };
  const option = (name: string, selected: boolean, onPress: () => void) => <Pressable key={name} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.option, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>{selected ? '☑' : '☐'}  {name}</Text></Pressable>;
  const targetDate = draft.scheduledAt && Number.isFinite(Date.parse(draft.scheduledAt)) ? new Date(draft.scheduledAt) : new Date(Date.now() + 3600000);
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), backgroundColor: colors.background }]}>
      <View style={styles.header}><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Edit announcement' : 'New announcement'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close announcement" disabled={busy} onPress={onClose} style={styles.option}><Text style={{ color: colors.accent }}>Close</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.text }]}>Audience</Text>
        {(['all', 'properties', 'units'] as const).map(audience => option(audience === 'all' ? 'All properties' : audience === 'properties' ? 'Select properties' : 'Select units', draft.audience === audience, () => update({ audience })))}
        {draft.audience === 'properties' && properties.map(property => option(labelOf(property), draft.propertyIds.includes(idOf(property)), () => toggle('propertyIds', idOf(property))))}
        {draft.audience === 'units' && units.map(unit => option(labelOf(unit), draft.unitIds.includes(idOf(unit)), () => toggle('unitIds', idOf(unit))))}
        {!!optionsError && <Text style={styles.error}>{optionsError}</Text>}
        {!!previewError ? <Text style={styles.error}>{previewError}</Text> : recipientCount === null ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent }}>{recipientCount} eligible tenants for this audience</Text>}
        <Text style={[styles.label, { color: colors.text }]}>Message</Text>
        <TextInput accessibilityLabel="Announcement message" multiline textAlignVertical="top" placeholder="Write your announcement…" placeholderTextColor={colors.muted} value={draft.message} onChangeText={message => update({ message })} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.label, { color: colors.text }]}>Delivery</Text>
        {option('In-app notification', draft.notification, () => update({ notification: !draft.notification }))}
        {option('Email', draft.email, () => update({ email: !draft.email }))}
        <Text style={[styles.label, { color: colors.text }]}>When</Text>
        {option('Send now', draft.schedule === 'now', () => update({ schedule: 'now' }))}
        {option('Schedule for later', draft.schedule === 'later', () => update({ schedule: 'later', scheduledAt: draft.scheduledAt || targetDate.toISOString() }))}
        {draft.schedule === 'later' && <View><Pressable accessibilityRole="button" accessibilityLabel="Choose schedule date" onPress={() => setPicker('date')} style={styles.option}><Text style={{ color: colors.accent }}>Date: {targetDate.toLocaleDateString()}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Choose schedule time" onPress={() => setPicker('time')} style={styles.option}><Text style={{ color: colors.accent }}>Time: {targetDate.toLocaleTimeString()}</Text></Pressable></View>}
        {!!picker && <DateTimePicker value={targetDate} mode={picker} onChange={(_, date) => { setPicker(null); if (date) { const next = new Date(targetDate); if (picker === 'date') next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()); else next.setHours(date.getHours(), date.getMinutes()); update({ scheduledAt: next.toISOString() }); } }} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save announcement' : 'Send announcement'} disabled={busy || !recipientCount || !!optionsError || !!previewError} onPress={submit} style={[styles.save, { backgroundColor: colors.accent, opacity: busy || !recipientCount ? .5 : 1 }]}><Text style={{ color: '#fff', fontWeight: '800' }}>{busy ? 'Saving…' : editing ? 'Save changes' : draft.schedule === 'later' ? 'Review & schedule' : 'Review & send'}</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 23, fontWeight: '800' }, content: { paddingHorizontal: 22, paddingBottom: 48 }, label: { fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 8 }, option: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, paddingHorizontal: 10 }, input: { minHeight: 150, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 }, save: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 25 }, error: { color: '#c2413b', marginTop: 12 } });
