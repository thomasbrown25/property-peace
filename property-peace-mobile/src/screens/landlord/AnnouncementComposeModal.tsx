import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import announcementAPI from '../../api/announcementAPI';
import { useAppTheme } from '../../theme/AppTheme';

export default function AnnouncementComposeModal({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(false);
  const [notification, setNotification] = useState(true);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setRecipientCount(null);
    setPreviewError('');
    void announcementAPI.previewRecipients().then(recipients => {
      if (active) setRecipientCount(recipients.length);
    }).catch(() => { if (active) setPreviewError('Could not check recipients. Close and try again.'); });
    return () => { active = false; };
  }, [visible]);

  const submit = () => {
    if (!message.trim() || !recipientCount || (!email && !notification) || sending) return;
    Alert.alert('Send announcement?', `Send to ${recipientCount} eligible tenant${recipientCount === 1 ? '' : 's'} across all properties in your current organization via ${[email && 'email', notification && 'in-app notification'].filter(Boolean).join(' and ')}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send now', onPress: async () => {
        setSending(true);
        setError('');
        try {
          await announcementAPI.send(message.trim(), email, notification);
          setMessage(''); setEmail(false); setNotification(true);
          onSent();
        } catch {
          setError('Could not send announcement. Your draft is still here; try again.');
        } finally { setSending(false); }
      } },
    ]);
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!sending) onClose(); }}>
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), backgroundColor: mode === 'dark' ? colors.background : '#fbf7f4' }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>New announcement</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close new announcement" disabled={sending} onPress={onClose} style={styles.close}><Ionicons name="close" size={25} color={colors.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.text }]}>Audience</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>All eligible tenants across your current organization’s properties.</Text>
        {previewError ? <Text accessibilityRole="alert" style={styles.error}>{previewError}</Text> : recipientCount === null ? <ActivityIndicator color={colors.accent} style={styles.preview} /> : <Text style={[styles.count, { color: colors.accent }]}>{recipientCount} eligible tenant{recipientCount === 1 ? '' : 's'}</Text>}
        <Text style={[styles.label, { color: colors.text }]}>Message</Text>
        <TextInput accessibilityLabel="Announcement message" multiline textAlignVertical="top" placeholder="Write your announcement…" placeholderTextColor={colors.muted} value={message} onChangeText={setMessage} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.label, { color: colors.text }]}>Delivery</Text>
        {([['In-app notification', notification, setNotification], ['Email', email, setEmail]] as const).map(([label, checked, change]) => <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => change(!checked)} style={styles.option}>
          <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /><Text style={[styles.optionText, { color: colors.text }]}>{label}</Text>
        </Pressable>)}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Send announcement" accessibilityState={{ disabled: sending || !message.trim() || !recipientCount || (!email && !notification) }} disabled={sending || !message.trim() || !recipientCount || (!email && !notification)} onPress={submit} style={[styles.send, { backgroundColor: colors.accent, opacity: sending || !message.trim() || !recipientCount || (!email && !notification) ? 0.5 : 1 }]}>
          {sending ? <ActivityIndicator color={mode === 'dark' ? colors.background : '#fff'} /> : <Text style={[styles.sendText, { color: mode === 'dark' ? colors.background : '#fff' }]}>Review & send</Text>}
        </Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 23, fontWeight: '800' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 22, paddingBottom: 48 }, label: { fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  caption: { fontSize: 14, lineHeight: 20 }, preview: { alignSelf: 'flex-start', marginTop: 12 }, count: { fontWeight: '800', fontSize: 15, marginTop: 12 },
  input: { minHeight: 150, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, lineHeight: 23 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, optionText: { fontSize: 15 }, error: { color: '#c2413b', marginTop: 14, lineHeight: 20 },
  send: { marginTop: 28, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, sendText: { fontSize: 15, fontWeight: '800' },
});
