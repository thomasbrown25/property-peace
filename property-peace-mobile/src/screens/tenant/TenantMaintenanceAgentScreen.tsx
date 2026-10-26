import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceAgentMessage, LocalMedia, newIdempotencyKey } from '../../api/maintenanceAPI';
import { useAppTheme } from '../../theme/AppTheme';

export default function TenantMaintenanceAgentScreen({ onManual }: { onManual: () => void }) {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<MaintenanceAgentMessage[]>([]);
  const messagesRef = useRef<MaintenanceAgentMessage[]>([]);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const photoRef = useRef<LocalMedia | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoRequested, setPhotoRequested] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [complete, setComplete] = useState(false);
  const ink = colors.text;

  const chat = async (history: MaintenanceAgentMessage[], initial = false) => {
    if (busyRef.current || !mounted.current) return;
    busyRef.current = true; setBusy(true); setError(''); setPhotoRequested(false);
    if (!initial) { messagesRef.current = history; setMessages(history); setDraft(''); }
    try {
      const reply = await MaintenanceAPI.chatWithTenantAgent(history);
      if (!mounted.current) return;
      if (!reply || typeof reply.message !== 'string' || !reply.message.trim()) throw new Error('The assistant returned an invalid response.');
      const next = [...history, { role: 'assistant' as const, content: reply.message.replace(/\[PHOTO_REQUEST\]/g, '').trim() }];
      messagesRef.current = next; setMessages(next);
      if (reply.done && reply.maintenanceRequest) {
        setComplete(true);
        const photo = photoRef.current;
        if (photo) {
          const id = reply.maintenanceRequest.id ?? reply.maintenanceRequest.Id;
          try {
            if (!id) throw new Error('Missing request ID');
            await MaintenanceAPI.uploadAttachment(id, 'Intake', photo);
          } catch {
            if (mounted.current) Alert.alert('Report created', 'Your report was saved, but the photo could not be attached. Open the report to add it.');
          }
        }
        return;
      }
      setPhotoRequested(!!reply.photoRequested);
    } catch (cause: any) {
      if (!mounted.current) return;
      setError(cause?.response?.data?.message || cause?.message || 'The assistant is unavailable.');
      // A failed initial greeting cannot create a ticket. A later request might have submitted.
      if (!initial) setUncertain(true);
    } finally {
      if (mounted.current) { busyRef.current = false; setBusy(false); }
    }
  };

  useEffect(() => {
    mounted.current = true;
    void chat([], true);
    return () => { mounted.current = false; };
  }, []);

  const send = () => {
    const content = draft.trim();
    if (!content || busyRef.current || uncertain || complete) return;
    void chat([...messagesRef.current, { role: 'user', content }]);
  };
  const attachPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access in device settings.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .7, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled || busyRef.current || uncertain || complete) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return Alert.alert('Photo too large', 'Choose a photo under 5 MB.');
      const mimeType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return Alert.alert('Unsupported photo', 'Choose a JPEG, PNG, or WebP image.');
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!mounted.current || busyRef.current || uncertain || complete) return;
      photoRef.current = { uri: asset.uri, fileName: asset.fileName || 'maintenance-photo.jpg', mimeType, fileSize: asset.fileSize, type: 'image', idempotencyKey: newIdempotencyKey() };
      void chat([...messagesRef.current, { role: 'user', content: "Here's a photo of the issue.", photoBase64: base64, photoMimeType: mimeType }]);
    } catch (cause: any) { Alert.alert('Photo unavailable', cause?.message || 'Please try again.'); }
  };

  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.header, { borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: ink }]}>Maintenance assistant</Text>
      <Text style={{ color: colors.muted }}>Tell us what needs attention. We'll guide you through reporting it.</Text>
      <Text style={[styles.safety, { color: colors.muted }]}>For fire, gas leaks, or immediate danger, leave the area and call 911. Submitting does not contact emergency services.</Text>
    </View>
    <ScrollView ref={scroll} style={styles.conversation} contentContainerStyle={styles.conversationInner} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => <View key={index} style={[styles.bubble, { backgroundColor: message.role === 'user' ? colors.accent : colors.surface, alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', borderColor: colors.border }]}><Text style={{ color: message.role === 'user' ? '#fff' : ink, lineHeight: 21 }}>{message.photoBase64 ? '📷 Photo attached' : message.content}</Text></View>)}
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {uncertain && <Text style={{ color: colors.muted }}>Check your maintenance list before starting another request; your last message may already have submitted a report.</Text>}
    </ScrollView>
    <View style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {complete ? <TouchableOpacity accessibilityRole="button" style={[styles.button, { backgroundColor: colors.accent }]} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>View maintenance reports</Text></TouchableOpacity> : <>
        {photoRequested && !uncertain && <View style={styles.actions}><TouchableOpacity disabled={busy} onPress={() => void attachPhoto()}><Text style={{ color: colors.accent }}>Add photo</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={() => void chat([...messagesRef.current, { role: 'user', content: 'No photo, please continue.' }])}><Text style={{ color: colors.accent }}>Skip photo</Text></TouchableOpacity></View>}
        {!!messages.length && !uncertain && <View style={styles.composer}><TextInput style={[styles.input, { backgroundColor: colors.surface, color: ink, borderColor: colors.border }]} value={draft} onChangeText={setDraft} placeholder="Type your reply…" placeholderTextColor={colors.muted} multiline maxLength={2000} editable={!busy} accessibilityLabel="Message to maintenance assistant" /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" style={[styles.button, { backgroundColor: colors.accent, opacity: !draft.trim() || busy ? .5 : 1 }]} disabled={!draft.trim() || busy} onPress={send}><Text style={styles.buttonText}>Send</Text></TouchableOpacity></View>}
        <TouchableOpacity style={styles.manual} onPress={onManual}><Text style={{ color: colors.accent }}>Use manual form instead</Text></TouchableOpacity>
      </>}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, header: { padding: 20, borderBottomWidth: 1, gap: 6 }, heading: { fontSize: 25, fontWeight: '800' }, safety: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  conversation: { flex: 1 }, conversationInner: { padding: 18, paddingBottom: 24 }, bubble: { maxWidth: '88%', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }, error: { color: '#a52e42', marginVertical: 8 },
  footer: { borderTopWidth: 1, padding: 16, gap: 8 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, input: { flex: 1, minHeight: 46, maxHeight: 110, padding: 10, borderWidth: 1, borderRadius: 6 }, button: { minHeight: 46, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 6 }, buttonText: { color: '#fff', fontWeight: '800' }, actions: { flexDirection: 'row', gap: 24, paddingVertical: 8 }, manual: { alignSelf: 'center', padding: 10 },
});
