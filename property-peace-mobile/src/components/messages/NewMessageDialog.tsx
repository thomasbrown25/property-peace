import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConversationAPI from '../../api/conversationAPI';
import TenantAPI, { Tenant } from '../../api/tenantAPI';
import { ConversationSummary } from '../../features/messages/messagesModel';
import { useAppTheme } from '../../theme/AppTheme';

interface Props {
  onClose: () => void;
  onOpen: (conversation: ConversationSummary) => void;
}

const tenantName = (tenant: Tenant) => [tenant.firstname ?? tenant.Firstname ?? tenant.firstName, tenant.lastname ?? tenant.Lastname ?? tenant.lastName].filter(Boolean).join(' ') || tenant.email || tenant.Email || 'Renter';
const positiveId = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

export default function NewMessageDialog({ onClose, onOpen }: Props) {
  const { colors, mode } = useAppTheme();
  const dark = mode === 'dark';
  const active = useRef(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    active.current = true;
    TenantAPI.getTenants().then((items) => {
      if (active.current) setTenants(items ?? []);
    }).catch((cause) => {
      if (active.current) setError(cause?.message || 'Renters could not be loaded.');
    }).finally(() => {
      if (active.current) setLoading(false);
    });
    return () => { active.current = false; };
  }, []);
  const eligible = useMemo(() => tenants.filter((tenant) => positiveId(tenant.userId ?? tenant.UserId) !== null), [tenants]);
  const visible = eligible.filter((tenant) => `${tenantName(tenant)} ${tenant.email ?? tenant.Email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  const start = async (tenant: Tenant) => {
    if (saving) return;
    const tenantId = positiveId(tenant.id ?? tenant.Id);
    const userId = positiveId(tenant.userId ?? tenant.UserId);
    if (!tenantId || !userId) { setError('This renter cannot receive in-app messages yet.'); return; }
    setSaving(true); setError(null);
    try {
      const propertyId = positiveId(tenant.propertyId ?? tenant.PropertyId);
      const leaseId = positiveId(tenant.leaseId ?? tenant.LeaseId);
      const propertyName = tenant.propertyName ?? tenant.PropertyName ?? 'Property';
      const conversation = await ConversationAPI.createConversation({
        title: String(propertyName), tenantId, propertyId, leaseId,
        participantUserIds: [userId], isGroupChat: false,
      });
      if (active.current) onOpen(conversation);
    } catch (cause: any) {
      if (active.current) setError(cause?.message || 'The conversation could not be opened.');
    } finally {
      if (active.current) setSaving(false);
    }
  };

  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={styles.overlay}><View style={[styles.sheet, dark && { backgroundColor: colors.surface }]}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.heading, dark && { color: colors.text }]}>New message</Text><Text style={[styles.subheading, dark && { color: colors.muted }]}>Choose one renter to message.</Text></View><TouchableOpacity accessibilityLabel="Close new message" accessibilityRole="button" disabled={saving} style={styles.close} onPress={onClose}><Ionicons name="close" size={23} color={dark ? colors.text : '#334155'} /></TouchableOpacity></View>
      <TextInput accessibilityLabel="Search renters" placeholder="Search renters" placeholderTextColor={dark ? colors.muted : '#94a3b8'} value={query} onChangeText={setQuery} style={[styles.search, dark && { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator style={styles.loading} color={dark ? colors.accent : '#2563eb'} /> : <ScrollView style={styles.people} keyboardShouldPersistTaps="handled">
        {visible.length === 0 && !error ? <Text style={[styles.empty, dark && { color: colors.muted }]}>{query ? 'No matching renters.' : 'No renters with an active app account are available yet.'}</Text> : visible.map((tenant) => <TouchableOpacity key={String(tenant.id ?? tenant.Id)} testID={`message-renter-${tenant.id ?? tenant.Id}`} accessibilityRole="button" accessibilityLabel={`Message ${tenantName(tenant)}`} disabled={saving} style={[styles.person, dark && { borderBottomColor: colors.border }]} onPress={() => void start(tenant)}><View style={styles.personCopy}><Text style={[styles.name, dark && { color: colors.text }]}>{tenantName(tenant)}</Text>{!!(tenant.propertyName ?? tenant.PropertyName) && <Text style={[styles.detail, dark && { color: colors.muted }]}>{tenant.propertyName ?? tenant.PropertyName}</Text>}</View><Ionicons name="chevron-forward" size={19} color={dark ? colors.muted : '#64748b'} /></TouchableOpacity>)}
      </ScrollView>}
      {saving && <View style={styles.saving}><ActivityIndicator color={dark ? colors.accent : '#2563eb'} /><Text style={[styles.detail, dark && { color: colors.muted }]}>Opening conversation…</Text></View>}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { maxHeight: '85%', minHeight: 340, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, headerCopy: { flex: 1 }, heading: { color: '#0f2f47', fontSize: 22, fontWeight: '800' }, subheading: { color: '#64748b', marginTop: 4 }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  search: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, minHeight: 46, color: '#0f172a' }, people: { maxHeight: 400, marginTop: 10 }, person: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' }, personCopy: { flex: 1 }, name: { fontSize: 16, fontWeight: '700', color: '#0f172a' }, detail: { fontSize: 13, color: '#64748b', marginTop: 3 }, error: { color: '#b42318', marginTop: 12 }, empty: { color: '#64748b', textAlign: 'center', padding: 24 }, loading: { marginTop: 40 }, saving: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
});
