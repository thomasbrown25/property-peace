import React, { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moneyCenterAPI, { type FinanceScope, type MoneyCenterItem, type MoneyCenterItems, type MoneyCenterOverview } from '../../api/moneyCenterAPI';
import propertyAPI, { type Property } from '../../api/propertyAPI';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/AppTheme';

type Period = 'this-month' | 'last-month' | 'ytd' | 'last-year';
type Section = 'review' | 'activity' | 'expenses' | 'payments' | 'upcoming';
const periods: { id: Period; label: string }[] = [
  { id: 'this-month', label: 'This month' }, { id: 'last-month', label: 'Last month' },
  { id: 'ytd', label: 'This year' }, { id: 'last-year', label: 'Last year' },
];
const sections: { id: Section; label: string }[] = [
  { id: 'review', label: 'Needs review' }, { id: 'activity', label: 'Activity' },
  { id: 'expenses', label: 'Expenses' }, { id: 'payments', label: 'Payments' },
  { id: 'upcoming', label: 'Upcoming' },
];
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const amount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? money(n) : 'Unavailable';
const dateLabel = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};
function range(period: Period, now = new Date()): Pick<FinanceScope, 'from' | 'to'> {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString();
  if (period === 'last-month') return { from: start(year, month - 1), to: start(year, month) };
  if (period === 'last-year') return { from: start(year - 1, 0), to: start(year, 0) };
  return { from: start(year, period === 'ytd' ? 0 : month), to: new Date(Math.max(now.getTime(), new Date(start(year, period === 'ytd' ? 0 : month)).getTime() + 1)).toISOString() };
}
function relevant(item: MoneyCenterItem, section: Section) {
  if (section === 'review') return item.needsAttention || (item.sourceType === 'expense' && (!item.hasReceipt || item.category?.toLowerCase() === 'uncategorized'));
  if (section === 'expenses') return item.sourceType === 'expense';
  if (section === 'payments') return item.sourceType === 'payment';
  if (section === 'upcoming') return item.direction === 'obligation';
  return item.direction !== 'obligation';
}

function matchesSearch(item: MoneyCenterItem, query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;
  return [item.description, item.category, item.propertyName, item.unitName, item.counterparty, item.treatment, item.needsAttention ? 'needs review' : '']
    .some(value => String(value ?? '').toLocaleLowerCase().includes(term));
}

export default function FinancesScreen() {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(state => state.user.currentUser);
  const authScope = `${user?.id ?? user?.Id ?? ''}:${user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? ''}`;
  const [period, setPeriod] = useState<Period>('this-month');
  const [section, setSection] = useState<Section>('review');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesError, setPropertiesError] = useState(false);
  const [overview, setOverview] = useState<MoneyCenterOverview | null>(null);
  const [items, setItems] = useState<MoneyCenterItems | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [itemsError, setItemsError] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const currentKey = `${authScope}:${period}:${propertyId ?? 'all'}`;
  const keyRef = useRef(currentKey);
  keyRef.current = currentKey;

  const load = useCallback(async (refresh = false) => {
    const key = currentKey;
    const request = ++generation.current;
    if (refresh) setRefreshing(true);
    const scope = { ...range(period), ...(propertyId ? { propertyId } : {}) };
    const [propertyResult, overviewResult, itemsResult] = await Promise.allSettled([
      propertyAPI.getProperties(), moneyCenterAPI.getOverview(scope), moneyCenterAPI.getItems(scope),
    ]);
    if (request !== generation.current || key !== keyRef.current) return;
    if (propertyResult.status === 'fulfilled' && Array.isArray(propertyResult.value)) {
      setProperties(propertyResult.value);
      setPropertiesError(false);
    } else { setProperties([]); setPropertiesError(true); }
    setOverview(overviewResult.status === 'fulfilled' ? overviewResult.value : null);
    setOverviewError(overviewResult.status === 'rejected');
    setItems(itemsResult.status === 'fulfilled' ? itemsResult.value : null);
    setItemsError(itemsResult.status === 'rejected');
    setLoadedKey(key);
    setRefreshing(false);
  }, [currentKey, period, propertyId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++generation.current; };
  }, [load]));

  const ready = loadedKey === currentKey;
  const visibleOverview = ready ? overview : null;
  const visibleItems = ready ? items : null;
  const sectionItems = visibleItems?.items.filter(item => relevant(item, section)) ?? [];
  const list = sectionItems.filter(item => matchesSearch(item, search));
  const sectionLabel = sections.find(tab => tab.id === section)?.label ?? 'Activity';
  const bg = mode === 'dark' ? colors.background : '#fbf7f4';
  const metrics: { label: string; value: unknown; note: string; target: Section }[] = [
    { label: 'Income', value: visibleOverview?.cameIn, note: 'Recorded money in', target: 'payments' },
    { label: 'Expenses', value: visibleOverview?.wentOut, note: 'Recorded money out', target: 'expenses' },
    { label: 'Net cash flow', value: visibleOverview?.recordedNetCashFlow, note: 'Income minus expenses', target: 'activity' },
    { label: 'Due now', value: visibleOverview?.dueNow, note: 'Unpaid obligations', target: 'upcoming' },
  ];

  return <View style={[styles.container, { backgroundColor: bg }]}>
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Finances</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Your recorded property money, all in one place.</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}>
      <Text style={[styles.label, { color: colors.muted }]}>PROPERTY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !propertyId }} onPress={() => setPropertyId(undefined)} style={[styles.chip, { borderColor: colors.border, backgroundColor: !propertyId ? colors.accent : colors.surface }]}><Text style={{ color: !propertyId ? bg : colors.text, fontWeight: '700' }}>All properties</Text></Pressable>
        {ready && !propertiesError && properties.map(property => {
          const id = Number(property.id ?? property.Id);
          if (!Number.isSafeInteger(id) || id <= 0) return null;
          return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: propertyId === id }} onPress={() => setPropertyId(id)} style={[styles.chip, { borderColor: colors.border, backgroundColor: propertyId === id ? colors.accent : colors.surface }]}><Text style={{ color: propertyId === id ? bg : colors.text, fontWeight: '700' }}>{property.name ?? property.Name ?? `Property ${id}`}</Text></Pressable>;
        })}
      </ScrollView>
      {ready && propertiesError && <Text style={[styles.hint, { color: colors.muted }]}>Property filter unavailable. Showing your current selection.</Text>}
      <Text style={[styles.label, { color: colors.muted }]}>PERIOD</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {periods.map(option => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: period === option.id }} onPress={() => setPeriod(option.id)} style={[styles.chip, { borderColor: colors.border, backgroundColor: period === option.id ? colors.accent : colors.surface }]}><Text style={{ color: period === option.id ? bg : colors.text, fontWeight: '700' }}>{option.label}</Text></Pressable>)}
      </ScrollView>
      {!ready && <View style={styles.feedback}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>Loading finances…</Text></View>}
      {ready && <>
        {overviewError && <View style={[styles.notice, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>Summary unavailable. Activity may still be available.</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Try again</Text></Pressable></View>}
        <View style={styles.metrics}>{metrics.map(metric => <Pressable key={metric.label} accessibilityRole="button" disabled={typeof metric.value !== 'number'} onPress={() => setSection(metric.target)} style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>{metric.label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, { color: colors.text }]}>{amount(metric.value)}</Text><Text style={[styles.hint, { color: colors.muted }]}>{metric.note}</Text></Pressable>)}</View>
        <Text style={[styles.hint, { color: colors.muted, marginBottom: 18 }]}>Based on recorded activity, not a bank balance.</Text>
        {!!visibleOverview?.dataQuality?.warnings?.length && <View style={[styles.notice, { borderColor: colors.border }]}>{visibleOverview.dataQuality.warnings.map((warning, index) => <Text key={index} style={{ color: colors.muted, lineHeight: 21 }}>{warning}</Text>)}</View>}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{sectionLabel}</Text>
        <View style={styles.toolbar}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={19} color={colors.muted} />
            <TextInput accessibilityLabel="Search finances" placeholder="Search records" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[styles.searchInput, { color: colors.text }]} returnKeyType="search" />
            {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={styles.clearSearch}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter finances: ${sectionLabel}`} accessibilityState={{ expanded: filterOpen }} onPress={() => setFilterOpen(open => !open)} style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="options-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>Filter</Text>
            <Ionicons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
          </Pressable>
        </View>
        {filterOpen && <View style={[styles.filterMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>{sections.map(option => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: section === option.id }} onPress={() => { setSection(option.id); setFilterOpen(false); }} style={styles.filterOption}><Text style={{ color: section === option.id ? colors.accent : colors.text, fontWeight: section === option.id ? '700' : '500' }}>{option.label}</Text>{section === option.id && <Ionicons name="checkmark" size={19} color={colors.accent} />}</Pressable>)}</View>}
        {itemsError ? <View style={styles.feedback}><Text style={{ color: colors.text }}>Financial activity is unavailable.</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Try again</Text></Pressable></View> : <>
          {visibleItems && visibleItems.totalCount > visibleItems.items.length && <Text style={[styles.hint, { color: colors.muted, marginBottom: 12 }]}>Showing {visibleItems.items.length} of {visibleItems.totalCount} records. This list may be incomplete.</Text>}
          {!list.length && <View style={styles.feedback}><Ionicons name="receipt-outline" size={28} color={colors.accent} /><Text style={{ color: colors.muted }}>{search.trim() && sectionItems.length ? 'No records match your search.' : `No ${sectionLabel.toLowerCase()} records for this selection.`}</Text></View>}
          {list.map((item, index) => <View key={`${item.sourceId}-${index}`} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.rowMain}><Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>{item.description || item.category || 'Recorded item'}</Text><Text style={[styles.rowAmount, { color: item.direction === 'wentOut' ? colors.text : colors.accent }]}>{amount(item.amount)}</Text></View><Text style={[styles.hint, { color: colors.muted }]}>{[item.propertyName, item.unitName, dateLabel(item.occurredAt)].filter(Boolean).join(' · ')}</Text><Text style={[styles.hint, { color: colors.muted }]}>{[item.category, item.treatment, item.needsAttention ? 'Needs review' : ''].filter(Boolean).join(' · ')}</Text></View>)}
        </>}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, top: { paddingHorizontal: 22, paddingBottom: 14 }, title: { fontSize: 34, fontWeight: '800' }, subtitle: { fontSize: 15, marginTop: 5 },
  content: { paddingHorizontal: 22, paddingBottom: 32 }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 16, marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 5 }, chip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, justifyContent: 'center' },
  hint: { fontSize: 13, lineHeight: 19 }, feedback: { alignItems: 'center', paddingVertical: 36, gap: 12 }, notice: { borderWidth: 1, borderRadius: 12, padding: 15, gap: 6, marginVertical: 12 }, retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  metrics: { gap: 10, marginTop: 24, marginBottom: 12 }, metric: { borderWidth: 1, borderRadius: 15, padding: 18, minHeight: 112 }, metricLabel: { fontSize: 13, fontWeight: '700' }, metricValue: { fontSize: 28, fontWeight: '800', marginVertical: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginTop: 6, marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, searchBox: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }, searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 15 }, clearSearch: { minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filterButton: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 }, filterMenu: { borderWidth: 1, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }, filterOption: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { paddingVertical: 17, borderBottomWidth: 1, gap: 4 }, rowMain: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, rowTitle: { fontSize: 16, fontWeight: '700', flex: 1 }, rowAmount: { fontSize: 16, fontWeight: '800' },
});
