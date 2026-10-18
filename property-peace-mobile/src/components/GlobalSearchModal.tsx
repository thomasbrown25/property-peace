import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { globalSearch, type SearchResult } from '../api/searchAPI';
import { useAppTheme } from '../theme/AppTheme';

type SearchType = 'property' | 'tenant' | 'lease';
const empty: SearchResult = { properties: [], tenants: [], leases: [] };

export default function GlobalSearchModal({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: SearchType, id: number) => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setQuery(''); setResults(empty); setError(false); setLoading(false);
      return;
    }
    const focus = setTimeout(() => input.current?.focus(), 200);
    return () => clearTimeout(focus);
  }, [visible]);

  useEffect(() => {
    const term = query.trim();
    if (!visible || !term) { setResults(empty); setLoading(false); setError(false); return; }
    let active = true;
    setLoading(true); setError(false); setResults(empty);
    const timer = setTimeout(() => {
      globalSearch(term).then((data) => { if (active) setResults(data); })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retry, visible]);

  const select = (type: SearchType, id: number) => {
    Keyboard.dismiss();
    onClose();
    onSelect(type, id);
  };
  const section = (label: string, icon: keyof typeof Ionicons.glyphMap, items: { id: number; title: string; detail?: string; type: SearchType }[]) => (
    items.length ? <View key={label}>
      <Text style={[styles.section, { color: colors.muted, borderBottomColor: colors.border }]}>{label}</Text>
      {items.map((item) => <Pressable key={`${item.type}-${item.id}`} style={[styles.result, { borderBottomColor: colors.border }]} accessibilityRole="button"
        accessibilityLabel={`Open ${item.type} ${item.title}`} onPress={() => select(item.type, item.id)}>
        <View style={[styles.icon, { backgroundColor: colors.background }]}><Ionicons name={icon} size={22} color={colors.accent} /></View>
        <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          {!!item.detail && <Text style={{ color: colors.muted }} numberOfLines={1}>{item.detail}</Text>}</View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>)}
    </View> : null
  );
  const hasResults = results.properties.length + results.tenants.length + results.leases.length > 0;

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={22} color={colors.muted} />
          <TextInput ref={input} style={[styles.input, { color: colors.text }]} placeholder="Search properties, tenants, leases..."
            placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false}
            returnKeyType="search" accessibilityLabel="Search properties, tenants, and leases" />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>}
        </View>
        <Pressable style={styles.cancel} accessibilityRole="button" accessibilityLabel="Close search" onPress={onClose}><Text style={{ color: colors.accent, fontWeight: '700' }}>Cancel</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator style={styles.state} color={colors.accent} />
          : error ? <View style={styles.state}><Text style={{ color: colors.text }}>Couldn't search right now.</Text>
            <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}><Text style={{ color: colors.accent, marginTop: 12 }}>Retry</Text></Pressable></View>
          : !query.trim() ? <Text style={[styles.state, { color: colors.muted }]}>Search across your properties, tenants, and leases.</Text>
          : !hasResults ? <Text style={[styles.state, { color: colors.muted }]}>No results for “{query.trim()}”</Text>
          : <>
            {section('Properties', 'home-outline', results.properties.map((p) => ({ id: p.id, title: p.name, detail: p.address || p.propertyType, type: 'property' as const })))}
            {section('Tenants', 'person-outline', results.tenants.map((t) => ({ id: t.id, title: `${t.firstname} ${t.lastname}`.trim(), detail: [t.propertyName, t.unitName].filter(Boolean).join(' · ') || t.email, type: 'tenant' as const })))}
            {section('Leases', 'document-text-outline', results.leases.map((l) => ({ id: l.id, title: [l.propertyName, l.unitName].filter(Boolean).join(' · '), detail: l.tenantNames?.join(', '), type: 'lease' as const })))}
          </>}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, minHeight: 48, gap: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 }, cancel: { minHeight: 48, justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }, state: { marginTop: 36, alignItems: 'center', textAlign: 'center' },
  section: { paddingVertical: 12, fontWeight: '800', fontSize: 16, borderBottomWidth: 1 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, borderBottomWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 }, title: { fontSize: 16, fontWeight: '600' },
});
