import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AnnouncementsStackParamList } from '../../navigation/types';
import announcementAPI, { type Announcement } from '../../api/announcementAPI';
import { useAppTheme } from '../../theme/AppTheme';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import AnnouncementComposeModal from './AnnouncementComposeModal';

const value = (item: Announcement, key: string): any => item[key] ?? item[key[0].toUpperCase() + key.slice(1)];
const text = (item: Announcement, key: string): string => String(value(item, key) ?? '');
const status = (item: Announcement) => value(item, 'isCompleted') ? (Number(value(item, 'failedCount') || 0) > 0 ? 'Sent with issues' : 'Sent') : value(item, 'scheduledAt') ? 'Scheduled' : 'Pending';
const channels = (item: Announcement) => [value(item, 'sendAsEmail') && 'Email', value(item, 'sendAsNotification') && 'In-app'].filter(Boolean).join(' + ') || 'No channel';
const date = (input: unknown) => {
  if (!input) return 'Date unavailable';
  const parsed = new Date(String(input));
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const audience = (item: Announcement) => {
  for (const [key, label] of [['unitIds', 'unit'], ['propertyIds', 'property'], ['organizationIds', 'organization']]) {
    try {
      const ids = JSON.parse(text(item, key));
      if (Array.isArray(ids) && ids.length) return `${ids.length} ${ids.length === 1 ? label : label === 'property' ? 'properties' : `${label}s`}`;
    } catch { /* List responses do not include audience IDs. */ }
  }
  return text(item, 'organizationName') || 'Eligible tenants';
};

export default function AnnouncementsScreen() {
  const navigation = useNavigation<any>();
  const { colors, mode } = useAppTheme();
  const [composeOpen, setComposeOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const generation = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const current = ++generation.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const result = await announcementAPI.list();
      if (current === generation.current) setItems(result);
    } catch {
      if (current === generation.current) { setItems([]); setError('Could not load announcements. Try again.'); }
    } finally {
      if (current === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current += 1; };
  }, [load]));
  const filtered = useMemo(() => items.filter(item => {
    if (filter !== 'All' && (filter === 'Attention' ? !['Pending', 'Sent with issues'].includes(status(item)) : status(item) !== filter)) return false;
    return ['title', 'message', 'formattedMessage', 'createdByName', 'organizationName'].some(key => text(item, key).toLowerCase().includes(query.trim().toLowerCase()));
  }).sort((a, b) => new Date(text(b, 'createdAt')).getTime() - new Date(text(a, 'createdAt')).getTime()), [items, filter, query]);
  const bg = mode === 'dark' ? colors.background : '#fbf7f4';
  const badge = (item: Announcement) => {
    const label = status(item);
    const tint = label === 'Sent' ? '#218455' : label === 'Scheduled' ? colors.accent : '#b26b17';
    return <View style={[styles.badge, { backgroundColor: mode === 'dark' ? colors.surface : label === 'Sent' ? '#e9f6ef' : label === 'Scheduled' ? '#eaf3ff' : '#fff2df' }]}><Text style={[styles.badgeText, { color: mode === 'dark' && label !== 'Scheduled' ? colors.text : tint }]}>{label}</Text></View>;
  };

  const listHeader = <View>
    <View style={[styles.overview, { borderBottomColor: colors.border }]}>
      <Text style={[styles.overviewEyebrow, { color: mode === 'dark' ? '#75d995' : '#2f8f46' }]}>ANNOUNCEMENTS OVERVIEW</Text>
      <View style={styles.overviewRow}>
        <View style={styles.metric}>
          {!error && !loading && <Text style={[styles.overviewValue, { color: colors.text }]}>{items.length}</Text>}
          <Text style={[styles.overviewLabel, { color: colors.muted }]}>{error ? 'Announcements unavailable' : loading ? 'Loading announcements…' : 'Total announcements'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="New announcement" onPress={() => setComposeOpen(true)} style={[styles.addButton, { backgroundColor: colors.accent }]}>
          <Ionicons name="add" size={18} color={mode === 'dark' ? colors.background : '#fff'} />
          <Text style={[styles.addText, { color: mode === 'dark' ? colors.background : '#fff' }]}>New announcement</Text>
        </Pressable>
      </View>
    </View>
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="search" size={19} color={colors.muted} />
      <TextInput accessibilityLabel="Search announcements" placeholder="Search announcements" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: colors.text }]} returnKeyType="search" />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {['All', 'Sent', 'Scheduled', 'Attention'].map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: filter === option }} onPress={() => setFilter(option)} style={[styles.chip, { borderColor: colors.border, backgroundColor: filter === option ? colors.accent : colors.surface }]}><Text style={[styles.chipText, { color: filter === option ? (mode === 'dark' ? colors.background : '#fff') : colors.text }]}>{option}</Text></Pressable>)}
    </ScrollView>
  </View>;

  return <View style={[styles.container, { backgroundColor: bg }]}>
    <LandlordPageHeader title="Announcements" />
    <FlatList data={loading || error ? [] : filtered} keyExtractor={(item, index) => String(value(item, 'id') ?? index)} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.accent} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={loading ? <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>Loading announcements…</Text></View> : error ? <View style={styles.center}><Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading announcements" onPress={() => { void load(); }} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text></Pressable></View> : <View style={styles.empty}><Ionicons name="notifications-outline" size={36} color={colors.accent} /><Text style={[styles.message, { color: colors.text }]}>{items.length ? 'No matching announcements' : 'No announcements yet'}</Text><Text style={[styles.hint, { color: colors.muted }]}>{items.length ? 'Try another search or status.' : 'Sent and scheduled updates will appear here.'}</Text></View>}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${text(item, 'title') || 'announcement'}`} onPress={() => navigation.navigate('AnnouncementDetail', { item })} style={styles.row}>
          <View style={styles.rowTop}><Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{text(item, 'title') || 'Untitled announcement'}</Text>{badge(item)}</View>
          <Text numberOfLines={2} style={[styles.preview, { color: colors.muted }]}>{text(item, 'formattedMessage') || text(item, 'message') || 'No message preview'}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{date(value(item, 'completedAt') || value(item, 'scheduledAt') || value(item, 'createdAt'))} · {channels(item)}</Text>
        </Pressable>} />
    <AnnouncementComposeModal visible={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => { setComposeOpen(false); setFilter('All'); setQuery(''); void load(); }} />
  </View>;
}

export function AnnouncementDetailScreen({ route }: NativeStackScreenProps<AnnouncementsStackParamList, 'AnnouncementDetail'>) {
  const { colors, mode } = useAppTheme();
  const [selected, setSelected] = useState(route.params.item);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const bg = mode === 'dark' ? colors.background : '#fbf7f4';
  const id = Number(value(route.params.item, 'id'));
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!Number.isSafeInteger(id) || id <= 0) { setDetailError('Announcement unavailable.'); setDetailLoading(false); return; }
    setDetailLoading(true);
    setDetailError('');
    try { const result = await announcementAPI.detail(id); if (isCurrent()) setSelected(result); }
    catch { if (isCurrent()) setDetailError('Could not load announcement details.'); }
    finally { if (isCurrent()) setDetailLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));
  const state = status(selected);
  const tint = state === 'Sent' ? '#218455' : state === 'Scheduled' ? colors.accent : '#b26b17';
  return <View style={{ flex: 1, backgroundColor: bg }}><ScrollView contentContainerStyle={styles.detail}>
    <View style={styles.detailHeading}>
      <View style={[styles.badge, { backgroundColor: mode === 'dark' ? colors.surface : state === 'Sent' ? '#e9f6ef' : state === 'Scheduled' ? '#eaf3ff' : '#fff2df' }]}><Text style={[styles.badgeText, { color: mode === 'dark' && state !== 'Scheduled' ? colors.text : tint }]}>{state}</Text></View>
      <Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>{text(selected, 'title') || 'Untitled announcement'}</Text>
    </View>
    {detailLoading ? <ActivityIndicator color={colors.accent} /> : detailError ? <View><Text accessibilityRole="alert" style={{ color: colors.text }}>{detailError}</Text><Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retry}><Text style={{ color: colors.accent }}>Retry details</Text></Pressable></View> : <>
      {state === 'Scheduled' && <Pressable accessibilityRole="button" accessibilityLabel="Edit scheduled announcement" onPress={() => setEditOpen(true)} style={[styles.addButton, { backgroundColor: colors.accent }]}><Text style={styles.addText}>Edit scheduled announcement</Text></Pressable>}
      <Text style={[styles.detailMessage, { color: colors.text }]}>{text(selected, 'formattedMessage') || text(selected, 'message') || 'No message available'}</Text>
      {([['Status', state], ['Audience', audience(selected)], ['Channels', channels(selected)], ['Created', date(value(selected, 'createdAt'))], ['Sent / scheduled', date(value(selected, 'completedAt') || value(selected, 'scheduledAt'))], ['Delivered', String(value(selected, 'sentCount') ?? 0)], ['Failed', String(value(selected, 'failedCount') ?? 0)], ['Created by', text(selected, 'createdByName') || 'Unavailable']] as const).map(([label, content]) => <View key={label} style={[styles.detailRow, { borderTopColor: colors.border }]}><Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.text }]}>{content}</Text></View>)}
    </>}
  </ScrollView><AnnouncementComposeModal visible={editOpen} editing={selected} onClose={() => setEditOpen(false)} onSent={() => { setEditOpen(false); void load(); }} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overview: { marginBottom: 20, paddingTop: 8, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  overviewEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  metric: { flexShrink: 1 }, overviewValue: { fontSize: 34, lineHeight: 39, fontWeight: '800' }, overviewLabel: { fontSize: 13, marginTop: 1 },
  addButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, addText: { fontSize: 12, fontWeight: '800' },
  search: { borderWidth: 1, borderRadius: 10, minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }, searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 }, clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingVertical: 14 }, chip: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, chipText: { fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: 22, paddingBottom: 28, flexGrow: 1 }, section: { fontSize: 16, fontWeight: '800', marginBottom: 4 }, row: { paddingVertical: 18, minHeight: 112 }, rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, rowTitle: { fontSize: 17, fontWeight: '800', flex: 1 }, badge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, badgeText: { fontSize: 11, fontWeight: '800' }, preview: { fontSize: 14, lineHeight: 20, marginTop: 8 }, meta: { fontSize: 12, marginTop: 9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, empty: { alignItems: 'center', paddingVertical: 60 }, message: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }, hint: { fontSize: 14, marginTop: 8, textAlign: 'center' }, retry: { minHeight: 44, justifyContent: 'center' },
  modalHeader: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { fontSize: 23, fontWeight: '800' }, detail: { paddingHorizontal: 22, paddingBottom: 40 }, detailHeading: { alignItems: 'flex-start', gap: 14, marginBottom: 18 }, detailTitle: { fontSize: 27, fontWeight: '800' }, detailMessage: { fontSize: 16, lineHeight: 25, marginBottom: 26 }, detailRow: { borderTopWidth: 1, paddingVertical: 14 }, detailLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 }, detailValue: { fontSize: 15 },
});
