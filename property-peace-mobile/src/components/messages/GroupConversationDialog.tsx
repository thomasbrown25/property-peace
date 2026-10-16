import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConversationAPI, { GroupParticipantCandidate } from '../../api/conversationAPI';
import { ConversationSummary, getActiveGroupMembers, validateGroupDraft } from '../../features/messages/messagesModel';
import { useAppTheme } from '../../theme/AppTheme';

interface Props {
  visible: boolean;
  organizationId?: string | number | null;
  currentUserId?: string | number | null;
  conversation?: ConversationSummary | null;
  onClose: () => void;
  onCreated?: (conversationId: string) => void;
  onChanged?: () => void;
  onLeft?: () => void;
}

const errorText = (error: any, fallback: string) => {
  const status = error?.status ?? error?.statusCode;
  if (status === 401) return 'Your session has expired. Sign in again to manage groups.';
  if (status === 403) return 'You do not have permission to manage this group.';
  return error?.message || fallback;
};

export default function GroupConversationDialog({ visible, organizationId, currentUserId, conversation, onClose, onCreated, onChanged, onLeft }: Props) {
  const { colors, mode } = useAppTheme();
  const dark = mode === 'dark';
  const danger = dark ? '#ffaaa2' : '#b42318';
  const creating = !conversation;
  const [title, setTitle] = useState('');
  const [candidates, setCandidates] = useState<GroupParticipantCandidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const members = useMemo(() => conversation ? getActiveGroupMembers(conversation) : [], [conversation]);
  const memberIds = useMemo(() => new Set(members.map((member) => Number(member.userId))), [members]);

  useEffect(() => {
    if (!visible) return;
    setTitle(''); setSelected([]); setError(null);
    if (!organizationId) {
      setCandidates([]);
      setError('Choose an organization before creating or managing a group.');
      return;
    }
    setLoading(true);
    ConversationAPI.discoverGroupParticipants(organizationId)
      .then((items) => setCandidates(items.filter((item) => String(item.userId) !== String(currentUserId))))
      .catch((loadError) => { setCandidates([]); setError(errorText(loadError, 'Eligible participants could not be loaded.')); })
      .finally(() => setLoading(false));
  }, [visible, organizationId, currentUserId]);

  const toggle = (userId: number) => setSelected((ids) => ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]);

  const create = async () => {
    const draft = validateGroupDraft({ title, participantUserIds: selected });
    if (draft.error || !organizationId) { setError(draft.error || 'Choose an organization first.'); return; }
    setSaving(true); setError(null);
    try {
      const group = await ConversationAPI.createGroup({ organizationId: Number(organizationId), title: draft.title, participantUserIds: draft.participantUserIds });
      onCreated?.(String(group.id));
    } catch (actionError) { setError(errorText(actionError, 'The group could not be created.')); }
    finally { setSaving(false); }
  };

  const addSelected = async () => {
    if (!conversation || selected.length === 0) return;
    setSaving(true); setError(null);
    try {
      for (const userId of selected) await ConversationAPI.addGroupParticipant(conversation.id, userId);
      setSelected([]); onChanged?.();
    } catch (actionError) { setError(errorText(actionError, 'The participant could not be added.')); }
    finally { setSaving(false); }
  };

  const remove = async (userId: string | number) => {
    if (!conversation) return;
    setSaving(true); setError(null);
    try { await ConversationAPI.removeGroupParticipant(conversation.id, userId); onChanged?.(); }
    catch (actionError) { setError(errorText(actionError, 'The participant could not be removed.')); }
    finally { setSaving(false); }
  };

  const leave = async () => {
    if (!conversation) return;
    setSaving(true); setError(null);
    try { await ConversationAPI.leaveGroup(conversation.id); onLeft?.(); }
    catch (actionError) { setError(errorText(actionError, 'You could not leave this group.')); }
    finally { setSaving(false); }
  };

  const available = candidates.filter((candidate) => !memberIds.has(candidate.userId));
  const confirmLeave = () => Alert.alert('Leave this group?', 'You will lose access to this conversation.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave group', style: 'destructive', onPress: () => void leave() },
  ]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.sheet, dark && { backgroundColor: colors.surface }]}>
      <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={[styles.heading, dark && { color: colors.text }]}>{creating ? 'New group' : conversation?.title || 'Group members'}</Text><Text style={[styles.subheading, dark && { color: colors.muted }]}>{creating ? 'Choose a title and eligible participants.' : `${members.length} active member${members.length === 1 ? '' : 's'}`}</Text></View><TouchableOpacity accessibilityLabel="Close group dialog" onPress={onClose}><Ionicons name="close" size={24} color={dark ? colors.muted : '#475569'} /></TouchableOpacity></View>
      {!!error && <View style={[styles.error, dark && { backgroundColor: '#452d32' }]}><Ionicons name="alert-circle-outline" size={18} color={danger} /><Text style={[styles.errorText, dark && { color: danger }]}>{error}</Text></View>}
      {creating && <><Text style={[styles.label, dark && { color: colors.text }]}>Group title</Text><TextInput testID="group-title" style={[styles.input, dark && { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. Maple maintenance team" placeholderTextColor={dark ? colors.muted : undefined} accessibilityLabel="Group title" /><Text style={[styles.count, dark && { color: colors.muted }]}>{title.length}/100</Text></>}
      {!creating && <><Text style={[styles.label, dark && { color: colors.text }]}>Members</Text><View style={[styles.memberList, dark && { borderColor: colors.border }]}>{members.map((member) => <View key={String(member.userId)} style={[styles.personRow, dark && { borderBottomColor: colors.border }]}><View style={styles.personCopy}><Text style={[styles.personName, dark && { color: colors.text }]}>{member.userName || member.displayName || 'Member'}{member.isAdmin ? ' · Admin' : ''}</Text>{String(member.userId) === String(currentUserId) && <Text style={[styles.you, dark && { color: colors.accent }]}>You</Text>}</View>{String(member.userId) !== String(currentUserId) && <TouchableOpacity accessibilityLabel={`Remove ${member.userName || member.displayName || 'member'}`} disabled={saving} onPress={() => void remove(member.userId)}><Text style={[styles.remove, dark && { color: danger }]}>Remove</Text></TouchableOpacity>}</View>)}</View></>}
      <Text style={[styles.label, dark && { color: colors.text }]}>{creating ? 'Participants' : 'Add people'}</Text>
      {loading ? <ActivityIndicator color={dark ? colors.accent : '#2563eb'} style={styles.loader} /> : <ScrollView style={[styles.people, dark && { borderColor: colors.border }]} contentContainerStyle={styles.peopleContent}>{available.length === 0 ? <Text style={[styles.empty, dark && { color: colors.muted }]}>{organizationId ? 'No other eligible participants are available.' : 'Organization access is required.'}</Text> : available.map((candidate) => {
        const checked = selected.includes(candidate.userId);
        return <TouchableOpacity testID={`group-participant-${candidate.userId}`} accessibilityRole="checkbox" accessibilityState={{ checked }} key={candidate.userId} style={[styles.personRow, dark && { borderBottomColor: colors.border }]} onPress={() => toggle(candidate.userId)}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={23} color={checked ? (dark ? colors.accent : '#2563eb') : (dark ? colors.muted : '#94a3b8')} /><View style={styles.personCopy}><Text style={[styles.personName, dark && { color: colors.text }]}>{candidate.displayName || 'Unnamed user'}</Text><Text style={[styles.role, dark && { color: colors.muted }]}>{candidate.isStaff ? 'Staff' : 'Participant'}</Text></View></TouchableOpacity>;
      })}</ScrollView>}
      <View style={styles.actions}>{!creating && <TouchableOpacity disabled={saving} style={styles.leaveButton} onPress={confirmLeave}><Text style={[styles.leaveText, dark && { color: danger }]}>Leave group</Text></TouchableOpacity>}<TouchableOpacity testID={creating ? 'create-group' : 'add-group-participants'} disabled={saving || loading || (!creating && selected.length === 0)} style={[styles.primary, dark && { backgroundColor: colors.accent }, (saving || loading || (!creating && selected.length === 0)) && styles.disabled]} onPress={() => void (creating ? create() : addSelected())}>{saving ? <ActivityIndicator color={dark ? colors.background : '#fff'} /> : <Text style={[styles.primaryText, dark && { color: colors.background }]}>{creating ? 'Create group' : 'Add selected'}</Text>}</TouchableOpacity></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' }, sheet: { maxHeight: '90%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 }, headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 }, headingCopy: { flex: 1 }, heading: { color: '#0f2f47', fontSize: 21, fontWeight: '900' }, subheading: { color: '#64748b', fontSize: 12, marginTop: 3 }, label: { color: '#334155', fontWeight: '800', marginTop: 10, marginBottom: 6 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a' }, count: { color: '#94a3b8', textAlign: 'right', fontSize: 10, marginTop: 3 }, people: { maxHeight: 260, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 }, peopleContent: { paddingHorizontal: 10 }, memberList: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 10 }, personRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' }, personCopy: { flex: 1 }, personName: { color: '#1e293b', fontWeight: '700' }, role: { color: '#64748b', fontSize: 11, marginTop: 2 }, you: { color: '#2563eb', fontSize: 11, marginTop: 2 }, remove: { color: '#b42318', fontWeight: '800', padding: 8 }, empty: { color: '#64748b', textAlign: 'center', padding: 22 }, loader: { padding: 25 }, error: { flexDirection: 'row', gap: 7, backgroundColor: '#fef3f2', borderRadius: 10, padding: 10 }, errorText: { flex: 1, color: '#b42318', fontSize: 12 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16 }, leaveButton: { marginRight: 'auto', paddingVertical: 11 }, leaveText: { color: '#b42318', fontWeight: '800' }, primary: { minWidth: 126, minHeight: 44, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.45 },
});
