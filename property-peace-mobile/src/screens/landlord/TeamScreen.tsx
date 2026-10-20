import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import teamAPI, { type TeamInvite, type TeamMember } from '../../api/teamAPI';
import organizationAPI from '../../api/organizationAPI';
import { useAppTheme } from '../../theme/AppTheme';
import { useAppSelector } from '../../store/hooks';

type Person = { kind: 'member' | 'invite'; id: number; userId?: number; name: string; email: string; role: string; expiresAt?: string; canManageMembers?: boolean };
const numberId = (input: unknown) => { const id = Number(input); return Number.isSafeInteger(id) && id > 0 ? id : 0; };
const permissions = ['Manager', 'Viewer', 'Owner'];
const roleDescription: Record<string, string> = {
  Manager: 'Day-to-day property operations; no billing or team management.',
  Viewer: 'Read-only organization access.',
  Owner: 'Full access, including billing and team management.',
};
const errorMessage = (error: unknown) => {
  const issue = error as { response?: { data?: { message?: string; Message?: string } }; message?: string };
  return issue?.response?.data?.message || issue?.response?.data?.Message || issue?.message || 'Please try again.';
};

export default function TeamScreen() {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(state => state.user.currentUser);
  const scope = String(user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? '');
  const userId = numberId(user?.id ?? user?.Id);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const generation = useRef(0);
  const [data, setData] = useState<{ scope: string; organization: string; role: string; people: Person[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<'invite' | 'role' | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Manager');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      if (!numberId(scope)) throw new Error('Select an organization to view its team.');
      const organization = await organizationAPI.getCurrentOrganization();
      const orgId = String(organization.id ?? (organization as any).Id ?? '');
      if (orgId !== scope) throw new Error('The selected organization changed. Refresh and try again.');
      const [members, invites] = await Promise.all([teamAPI.members(scope), teamAPI.invites(scope)]);
      const people: Person[] = [
        ...invites.map((item: TeamInvite): Person => ({ kind: 'invite', id: numberId(item.id ?? item.Id), name: item.email ?? item.Email ?? '', email: item.email ?? item.Email ?? '', role: item.role ?? item.Role ?? 'Viewer', expiresAt: item.expiresAt ?? item.ExpiresAt })),
        ...members.map((item: TeamMember): Person => ({ kind: 'member', id: numberId(item.id ?? item.Id), userId: numberId(item.userId ?? item.UserId), name: item.userName ?? item.UserName ?? item.userEmail ?? item.UserEmail ?? 'Team member', email: item.userEmail ?? item.UserEmail ?? '', role: item.role ?? item.Role ?? 'Viewer', canManageMembers: Boolean(item.canManageMembers ?? item.CanManageMembers) })),
      ];
      if (request === generation.current && scopeRef.current === scope) {
        setData({ scope, organization: organization.name ?? (organization as any).Name ?? 'Your organization', role: (organization as any).userRole ?? (organization as any).UserRole ?? String(user?.currentOrganizationRole ?? user?.CurrentOrganizationRole ?? ''), people });
      }
    } catch (e) {
      if (request === generation.current && scopeRef.current === scope) { setData(null); setError(errorMessage(e)); }
    } finally {
      if (request === generation.current && scopeRef.current === scope) { setLoading(false); setRefreshing(false); }
    }
  }, [scope, user?.currentOrganizationRole, user?.CurrentOrganizationRole]);
  useFocusEffect(useCallback(() => {
    setData(null);
    setNotice('');
    void load();
    return () => { generation.current += 1; setEditor(null); setSelected(null); };
  }, [load]));

  const current = data?.scope === scope ? data : null;
  const me = current?.people.find(item => item.kind === 'member' && item.userId === userId);
  const isOwner = current?.role === 'Owner' || me?.role === 'Owner';
  const canManage = Boolean(current && (isOwner || me?.canManageMembers));
  const ownEmail = String(user?.email ?? user?.Email ?? '').trim().toLowerCase();
  const people = useMemo(() => (current?.people ?? []).filter(item =>
    `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [current, query]);
  const totalPeople = current?.people.length ?? 0;
  const activeMembers = current?.people.filter(item => item.kind === 'member').length ?? 0;
  const background = colors.background;
  const accent = colors.accent;
  const foreground = mode === 'dark' ? colors.background : '#fff';

  const mutate = async (action: () => Promise<void>, success: string) => {
    if (!current || current.scope !== scope || !canManage || busy) return;
    setBusy(true); setFormError(''); setNotice('');
    try {
      await action();
      if (scopeRef.current !== current.scope) return;
      setEditor(null); setSelected(null); setNotice(success);
      await load(true);
    } catch (e) {
      if (scopeRef.current === current.scope) {
        if (editor) setFormError(errorMessage(e));
        else setNotice(`Action failed: ${errorMessage(e)}`);
      }
    } finally { setBusy(false); }
  };
  const confirm = (title: string, message: string, action: () => Promise<void>, success: string, destructive = false) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: destructive ? 'Remove permanently' : 'Confirm', style: destructive ? 'destructive' : 'default', onPress: () => { void mutate(action, success); } },
    ]);
  const openInvite = () => { setSelected(null); setEmail(''); setRole('Manager'); setFormError(''); setEditor('invite'); };
  const openRole = (person: Person) => { setSelected(person); setRole(person.role); setFormError(''); setEditor('role'); };
  const submit = () => {
    if (editor === 'invite') {
      const address = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setFormError('Enter a valid email address.'); return; }
      if (!current) return;
      void mutate(() => teamAPI.invite(current.scope, address, role), `Invitation sent to ${address}.`);
    } else if (editor === 'role' && selected?.id && selected.role !== role) {
      void mutate(() => teamAPI.updateRole(selected.id, role), `${selected.name}'s role was updated.`);
    }
  };
  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={[styles.rowAction, { borderColor: colors.border }]}>
      <Text style={{ color: danger ? '#b83e3e' : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return <View style={[styles.root, { backgroundColor: background }]}>
    <LandlordPageHeader title="Team" />
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
      {notice ? <Text style={[styles.notice, { color: colors.text, backgroundColor: colors.surface }]}>{notice}</Text> : null}
      {loading && !current ? <ActivityIndicator style={styles.loading} color={accent} /> : error ? <View style={styles.center}><Text style={{ color: colors.text }}>{error}</Text>{action('Retry', () => void load())}</View> : current ? <>
        <View style={[styles.overview, { borderBottomColor: colors.border }]}>
          <Text style={[styles.overviewEyebrow, { color: mode === 'dark' ? '#75d995' : '#2f8f46' }]}>TEAM OVERVIEW</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewMetric}><Text style={[styles.overviewValue, { color: colors.text }]}>{activeMembers}</Text><Text style={[styles.overviewLabel, { color: colors.muted }]}>Active members</Text></View>
            {canManage && <Pressable accessibilityRole="button" accessibilityLabel="Invite team member" onPress={openInvite} style={[styles.add, { backgroundColor: accent }]}><Ionicons name="add" size={18} color={foreground} /><Text style={[styles.addText, { color: foreground }]}>Invite</Text></Pressable>}
          </View>
          <Text style={[styles.organization, { color: colors.muted }]} numberOfLines={2}>{current.organization}</Text>
        </View>
        {!canManage && <Text style={[styles.hint, { color: colors.muted }]}>You can view this team. An owner or member with team-management access can make changes.</Text>}
        <View style={[styles.search, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="search" size={19} color={mode === 'dark' ? colors.muted : '#64748b'} />
          <TextInput accessibilityLabel="Search team members" placeholder="Search name, email, or role" placeholderTextColor={mode === 'dark' ? colors.muted : '#94a3b8'} value={query} onChangeText={setQuery} returnKeyType="search" style={[styles.searchInput, { color: colors.text }]} />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={mode === 'dark' ? colors.muted : '#94a3b8'} /></Pressable>}
        </View>
        <Text style={[styles.section, { color: colors.muted }]}>{people.length} OF {totalPeople} PEOPLE & INVITATIONS</Text>
        {people.length === 0 ? <View style={styles.center}><Ionicons name="people-outline" size={30} color={accent} /><Text style={{ color: colors.text, textAlign: 'center', marginTop: 10 }}>{query.trim() ? 'No team members match your search.' : 'No team members or pending invitations yet.'}</Text></View> : people.map((person, index) => <View key={`${person.kind}-${person.id || index}`} style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.personTop}><View style={[styles.avatar, { backgroundColor: background }]}><Text style={{ color: accent, fontWeight: '800' }}>{person.role.trim().charAt(0).toUpperCase() || '?'}</Text></View><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>{person.email !== person.name && <Text style={{ color: colors.muted }}>{person.email}</Text>}</View></View>
          <View style={styles.tags}><Text style={[styles.tag, { color: colors.text, borderColor: colors.border }]}>{person.role}</Text>{person.kind === 'member' && <Text style={[styles.tag, { color: accent, borderColor: colors.border }]}>Active</Text>}{person.userId === userId && person.kind === 'member' && <Text style={{ color: colors.muted }}>You</Text>}</View>
          {person.kind === 'invite' && <View style={styles.inviteStatus}>
            <Text style={styles.inviteWarning}>{isOwner && person.email.trim().toLowerCase() !== ownEmail ? 'Invite sent' : 'Pending invite'}</Text>
            {isOwner && person.id > 0 && person.email.trim().toLowerCase() !== ownEmail && <Pressable accessibilityRole="button" accessibilityLabel={`Resend invite to ${person.email}`} disabled={busy} onPress={() => void mutate(() => teamAPI.resend(person.id), `Invitation resent to ${person.email}.`)} style={[styles.resend, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Resend invite</Text></Pressable>}
          </View>}
          {canManage && person.id > 0 && person.userId !== userId && <View style={styles.actions}>{person.kind === 'invite' ? action('Revoke', () => confirm('Revoke invitation?', `The invitation for ${person.email} will stop working.`, () => teamAPI.revoke(person.id), 'Invitation revoked.')) : <>{action('Change role', () => openRole(person))}{person.userId ? action('Remove', () => confirm('Remove team member?', `${person.name} will permanently lose access to this organization. This removal cannot be undone.`, () => teamAPI.remove(current.scope, person.id), 'Team member removed.', true), true) : null}</>}</View>}
        </View>)}
      </> : null}
    </ScrollView>
    <Modal visible={!!editor} transparent animationType="slide" onRequestClose={() => { if (!busy) setEditor(null); }}><View style={styles.modalBackdrop}><View style={[styles.modal, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) + 16 }]}>
      <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>{editor === 'invite' ? 'Add a team member' : 'Change role'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={() => setEditor(null)} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>{editor === 'invite' ? `Email an invitation to join ${current?.organization ?? 'your organization'}.` : selected?.name}</Text>
      {editor === 'invite' && <><Text style={[styles.fieldLabel, { color: colors.text }]}>Email address</Text><TextInput autoCapitalize="none" keyboardType="email-address" autoCorrect={false} value={email} onChangeText={setEmail} placeholder="team.member@company.com" placeholderTextColor={colors.muted} style={[styles.formInput, { backgroundColor: background, color: colors.text, borderColor: colors.border }]} /></>}
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Organization role</Text>
      {permissions.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: role === option }} onPress={() => setRole(option)} style={[styles.roleRow, { borderColor: role === option ? accent : colors.border, backgroundColor: background }]}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{option}</Text><Text style={{ color: colors.muted, marginTop: 3 }}>{roleDescription[option]}</Text></View><Ionicons name={role === option ? 'radio-button-on' : 'radio-button-off'} size={22} color={accent} /></Pressable>)}
      {role === 'Owner' && <Text style={{ color: colors.text, marginTop: 8 }}>Owners can manage billing, team members, and all organization settings.</Text>}
      {!!formError && <Text style={styles.error}>{formError}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || (editor === 'role' && selected?.role === role)} onPress={submit} style={[styles.submit, { backgroundColor: accent, opacity: busy || (editor === 'role' && selected?.role === role) ? 0.55 : 1 }]}><Text style={{ color: foreground, fontWeight: '800' }}>{busy ? 'Saving…' : editor === 'invite' ? 'Send invitation' : 'Save role'}</Text></Pressable>
    </View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overview: { marginBottom: 20, paddingTop: 8, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  overviewEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  overviewMetric: { flexShrink: 1 },
  overviewValue: { fontSize: 34, lineHeight: 39, fontWeight: '800' },
  overviewLabel: { fontSize: 13, marginTop: 1 },
  organization: { fontSize: 13, marginTop: 10 },
  add: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 6, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  hint: { marginBottom: 16, lineHeight: 20 },
  search: { minHeight: 46, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  formInput: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, marginBottom: 14, fontSize: 15 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, marginBottom: 10 },
  person: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 10 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  tag: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  rowAction: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, justifyContent: 'center' },
  center: { alignItems: 'center', paddingVertical: 44, gap: 10 },
  loading: { marginTop: 60 },
  notice: { padding: 12, borderRadius: 9, marginBottom: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  modal: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontWeight: '700', marginBottom: 8 },
  roleRow: { minHeight: 60, borderWidth: 1, borderRadius: 10, marginBottom: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { color: '#b83e3e', marginTop: 8 },
  submit: { minHeight: 48, borderRadius: 10, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  inviteStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  inviteWarning: { color: '#9a651a', fontWeight: '800', fontSize: 13 },
  resend: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, justifyContent: 'center' },
});
