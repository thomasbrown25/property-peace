import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/AppTheme';

export type RecordData = Record<string, any>;
export const field = (item: RecordData, key: string): any => item[key] ?? item[key[0].toUpperCase() + key.slice(1)];
export const label = (item: RecordData, key: string): string => String(field(item, key) ?? '').trim();
export const dateLabel = (input: unknown): string => {
  if (!input) return 'Date unavailable';
  const parsed = new Date(String(input));
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
export const moneyLabel = (input: unknown): string => {
  const amount = Number(input);
  return input == null || input === '' || !Number.isFinite(amount) ? 'Unavailable' : amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

export interface WorkspaceConfig<T extends RecordData> {
  title: string;
  eyebrow: string;
  subtitle: string;
  searchPlaceholder: string;
  filters: readonly string[];
  load: () => Promise<T[]>;
  status: (item: T) => string;
  titleFor: (item: T) => string;
  subtitleFor: (item: T) => string;
  metaFor: (item: T) => string;
  searchFor: (item: T) => string;
  details: (item: T) => Array<[string, string]>;
}

export default function RentalWorkspace<T extends RecordData>({ config, scope }: { config: WorkspaceConfig<T>; scope: string }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<T | null>(null);
  const [loadedScope, setLoadedScope] = useState('');
  const generation = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      if (!scope) throw new Error('Missing account');
      const result = await config.load();
      if (!Array.isArray(result)) throw new Error('Invalid response');
      if (request === generation.current) { setItems(result); setLoadedScope(scope); }
    } catch {
      if (request === generation.current) { setItems([]); setLoadedScope(scope); setError(`Could not load ${config.title.toLowerCase()}. Try again.`); }
    } finally {
      if (request === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [config, scope]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current += 1; setSelected(null); };
  }, [load]));
  const current = loadedScope === scope && !!scope;
  const filtered = useMemo(() => (current ? items : []).filter(item =>
    (filter === 'All' || config.status(item) === filter) && config.searchFor(item).toLowerCase().includes(query.trim().toLowerCase())
  ), [items, current, filter, query, config]);
  const bg = mode === 'dark' ? colors.background : '#fbf7f4';
  return <View style={[styles.root, { backgroundColor: bg }]}>
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{config.eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{config.title}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{config.subtitle}</Text>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={19} color={colors.muted} />
        <TextInput accessibilityLabel={`Search ${config.title.toLowerCase()}`} placeholder={config.searchPlaceholder} placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: colors.text }]} returnKeyType="search" />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" style={styles.close} onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {config.filters.map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: filter === option }} onPress={() => setFilter(option)} style={[styles.chip, { borderColor: colors.border, backgroundColor: filter === option ? colors.accent : colors.surface }]}><Text style={[styles.chipText, { color: filter === option ? (mode === 'dark' ? colors.background : '#fff') : colors.text }]}>{option}</Text></Pressable>)}
      </ScrollView>
    </View>
    {(!scope || (current && error)) ? <View style={styles.center}><Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>{!scope ? 'Sign in again to view this page.' : error}</Text>{!!scope && <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text></Pressable>}</View> : (loading || !current) ? <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>Loading {config.title.toLowerCase()}…</Text></View> :
      <FlatList data={filtered} keyExtractor={(item, index) => String(field(item, 'id') ?? index)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.accent} />}
        ListHeaderComponent={<Text style={[styles.section, { color: colors.text }]}>{filtered.length} {config.title.toLowerCase()}</Text>}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="folder-open-outline" size={34} color={colors.accent} /><Text style={[styles.message, { color: colors.text }]}>{items.length ? `No matching ${config.title.toLowerCase()}` : `No ${config.title.toLowerCase()} yet`}</Text><Text style={[styles.hint, { color: colors.muted }]}>{items.length ? 'Try another search or status.' : `Your ${config.title.toLowerCase()} will appear here.`}</Text></View>}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${config.titleFor(item)}`} onPress={() => setSelected(item)} style={styles.row}>
          <View style={styles.rowTop}><Text style={[styles.rowTitle, { color: colors.text }]}>{config.titleFor(item)}</Text><View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.accent }]}>{config.status(item)}</Text></View></View>
          <Text style={[styles.preview, { color: colors.muted }]}>{config.subtitleFor(item)}</Text><Text style={[styles.meta, { color: colors.muted }]}>{config.metaFor(item)}</Text>
        </Pressable>} />}
    <Modal visible={!!selected && current} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      <View style={[styles.root, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.modalHeader}><Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>{config.title === 'Listings' ? 'Listing details' : 'Application details'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={() => setSelected(null)} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
        {selected && <ScrollView contentContainerStyle={styles.detail}><Text style={[styles.detailTitle, { color: colors.text }]}>{config.titleFor(selected)}</Text><Text style={[styles.subtitle, { color: colors.muted }]}>{config.subtitleFor(selected)}</Text>{config.details(selected).filter(([, value]) => !!value).map(([heading, value]) => <View key={heading} style={[styles.detailRow, { borderTopColor: colors.border }]}><Text style={[styles.detailLabel, { color: colors.muted }]}>{heading}</Text><Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text></View>)}</ScrollView>}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 22 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 }, title: { fontSize: 32, lineHeight: 40, fontWeight: '800' }, subtitle: { fontSize: 15, marginTop: 6, marginBottom: 18 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }, searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, filters: { gap: 8, paddingVertical: 14 }, chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, chipText: { fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, message: { fontSize: 18, fontWeight: '700', textAlign: 'center' }, retry: { minHeight: 44, justifyContent: 'center' }, list: { paddingHorizontal: 22, paddingBottom: 28, flexGrow: 1 }, section: { fontSize: 16, fontWeight: '800', marginBottom: 4 }, empty: { alignItems: 'center', paddingVertical: 60, gap: 12 }, hint: { fontSize: 14, textAlign: 'center' }, row: { paddingVertical: 18, minHeight: 112 }, rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, rowTitle: { flex: 1, fontSize: 17, fontWeight: '800' }, badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, badgeText: { fontSize: 11, fontWeight: '800' }, preview: { fontSize: 14, lineHeight: 20, marginTop: 8 }, meta: { fontSize: 12, marginTop: 9 },
  modalHeader: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { fontSize: 23, fontWeight: '800' }, detail: { paddingHorizontal: 22, paddingBottom: 40 }, detailTitle: { fontSize: 27, fontWeight: '800' }, detailRow: { borderTopWidth: 1, paddingVertical: 14 }, detailLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 }, detailValue: { fontSize: 15, lineHeight: 22 },
});
