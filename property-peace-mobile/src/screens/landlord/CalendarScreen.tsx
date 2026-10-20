import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LeaseAPI, { type Lease } from '../../api/leaseAPI';
import MaintenanceAPI, { type MaintenanceRequest } from '../../api/maintenanceAPI';
import apiClient from '../../services/apiClient';
import { buildCalendarEvents, dayKey } from '../../features/calendar/calendarEvents';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';
import AddCalendarTaskModal from './AddCalendarTaskModal';

type LoadState = 'loading' | 'ready' | 'error';
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { mode, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const organizationId = String(useAppSelector(state => state.user.currentUser?.currentOrganizationId ?? state.user.currentUser?.CurrentOrganizationId ?? ''));
  const [selected, setSelected] = useState(() => new Date());
  const [leases, setLeases] = useState<Lease[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [partial, setPartial] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const generation = useRef(0);
  const scope = useRef(organizationId);
  scope.current = organizationId;
  const load = useCallback(async () => {
    const current = ++generation.current;
    const organization = organizationId;
    if (!organization) { setLeases([]); setRequests([]); setTasks([]); setLoadState('error'); setRefreshing(false); return; }
    const results = await Promise.allSettled([
      LeaseAPI.getLeases(),
      MaintenanceAPI.getAll(),
      apiClient.get<{ data?: any[] } | any[]>('/api/task'),
    ]);
    if (current !== generation.current || organization !== scope.current) return;
    const [leaseResult, requestResult, taskResult] = results;
    setLeases(leaseResult.status === 'fulfilled' && Array.isArray(leaseResult.value) ? leaseResult.value : []);
    setRequests(requestResult.status === 'fulfilled' && Array.isArray(requestResult.value) ? requestResult.value : []);
    const payload = taskResult.status === 'fulfilled' ? taskResult.value : null;
    const taskList = Array.isArray(payload) ? payload : payload?.data;
    setTasks(Array.isArray(taskList) ? taskList : []);
    const failures = results.filter(result => result.status === 'rejected').length;
    setLoadState(failures === results.length ? 'error' : 'ready');
    setPartial(failures > 0 || !Array.isArray(taskList) || (leaseResult.status === 'fulfilled' && !Array.isArray(leaseResult.value)) || (requestResult.status === 'fulfilled' && !Array.isArray(requestResult.value)));
    setRefreshing(false);
  }, [organizationId]);
  useFocusEffect(useCallback(() => {
    setLeases([]); setRequests([]); setTasks([]); setLoadState('loading'); setPartial(false);
    void load();
    return () => { ++generation.current; };
  }, [load]));
  const monthIndex = selected.getFullYear() * 12 + selected.getMonth();
  const events = useMemo(() => buildCalendarEvents(leases, requests, tasks, new Date(selected.getFullYear(), selected.getMonth(), 1)), [leases, requests, tasks, monthIndex]);
  const selectedKey = dayKey(selected);
  const todayKey = dayKey(new Date());
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthLength = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: monthStart.getDay() }, () => null),
    ...Array.from({ length: monthLength }, (_, day) => new Date(selected.getFullYear(), selected.getMonth(), day + 1)),
  ];
  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, typeof events>();
    for (const event of events) {
      const key = dayKey(event.date);
      byDay.set(key, [...(byDay.get(key) || []), event]);
    }
    return byDay;
  }, [events]);
  const dayEvents = eventsByDay.get(selectedKey) || [];
  const dark = mode === 'dark';
  const shiftMonth = (offset: number) => setSelected(new Date(selected.getFullYear(), selected.getMonth() + offset, 1));
  const openEvent = (event: typeof events[number]) => {
    if (event.destination) navigation.getParent()?.navigate(event.destination.tab, { screen: event.destination.screen, params: event.destination.params });
  };

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <PageBackButton onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DashboardHome')} />
      <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">Calendar</Text>
      <Pressable onPress={() => setAddingTask(true)} accessibilityRole="button" accessibilityLabel="Add task" style={[styles.addButton, { backgroundColor: colors.accent }]}><Ionicons name="add" size={19} color="#fff" /><Text style={styles.addButtonText}>Add task</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 100 }]} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <View style={styles.monthHeader}>
        <Text style={[styles.month, { color: colors.text }]}>{selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <View style={styles.monthActions}>
          <Pressable onPress={() => setSelected(new Date())} accessibilityRole="button" accessibilityLabel="Go to today" style={[styles.todayButton, { borderColor: colors.border }]}><Text style={[styles.todayButtonText, { color: colors.accent }]}>Today</Text></Pressable>
          <Pressable style={[styles.monthArrow, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
          <Pressable style={[styles.monthArrow, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Pressable>
        </View>
      </View>
      <View style={[styles.calendar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {weekdayLabels.map(label => <Text key={label} style={[styles.weekday, { color: colors.muted }]}>{label}</Text>)}
        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.cell} />;
          const key = dayKey(date);
          const count = eventsByDay.get(key)?.length || 0;
          const active = key === selectedKey;
          return <Pressable key={key} onPress={() => setSelected(date)} accessibilityRole="button" accessibilityLabel={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} events`} accessibilityState={{ selected: active }} style={styles.cell}>
            <View style={[styles.dayCircle, active && { backgroundColor: colors.accent }, !active && key === todayKey && { borderColor: colors.accent, borderWidth: 1 }]}><Text style={[styles.dayNumber, { color: active ? (dark ? colors.background : '#fff') : colors.text }]}>{date.getDate()}</Text></View>
            {count > 0 && <View style={[styles.eventDot, { backgroundColor: active ? colors.accent : dark ? '#75d995' : '#2f8f46' }]} />}
          </Pressable>;
        })}
      </View>
      <Text style={[styles.agendaHeading, { color: colors.text }]} accessibilityRole="header">{selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      {loadState === 'loading' && <ActivityIndicator color={colors.accent} style={styles.state} />}
      {loadState === 'error' && <View style={styles.state}><Text style={{ color: colors.muted }}>Calendar events couldn't be loaded.</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={[styles.retry, { color: colors.accent }]}>Retry</Text></Pressable></View>}
      {loadState === 'ready' && <>
        {partial && <Text style={[styles.notice, { color: dark ? '#f0ba72' : '#a45f12' }]}>Some events are unavailable. Pull down to retry.</Text>}
        {dayEvents.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No events scheduled for this day.</Text> : dayEvents.map(event => <Pressable key={event.id} disabled={!event.destination} onPress={() => openEvent(event)} accessibilityRole={event.destination ? 'button' : undefined} style={[styles.event, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.eventIcon, { backgroundColor: dark ? colors.background : '#eaf3fc' }]}><Ionicons name={event.category === 'Lease' ? 'document-text-outline' : event.category === 'Maintenance' ? 'construct-outline' : event.category === 'Rent' ? 'cash-outline' : 'checkbox-outline'} size={20} color={colors.accent} /></View>
          <View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text><Text style={[styles.eventDetail, { color: colors.muted }]}>{event.detail}{event.date.getHours() || event.date.getMinutes() ? ` · ${event.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</Text></View>
          {!!event.destination && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        </Pressable>)}
      </>}
    </ScrollView>
    <AddCalendarTaskModal visible={addingTask} date={selected} onClose={() => setAddingTask(false)} onSaved={() => { setAddingTask(false); void load(); }} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  heading: { flex: 1, fontSize: 26, fontWeight: '800' }, addButton: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44, borderRadius: 12, paddingHorizontal: 12 }, addButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, todayButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' }, todayButtonText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 20 }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 16, gap: 8 }, month: { flexShrink: 1, fontSize: 20, fontWeight: '800' }, monthActions: { flexDirection: 'row', gap: 6 }, monthArrow: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 14 }, weekday: { width: '14.285%', textAlign: 'center', fontSize: 12, fontWeight: '700', paddingBottom: 8 }, cell: { width: '14.285%', height: 55, alignItems: 'center', justifyContent: 'center' }, dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, dayNumber: { fontSize: 15, fontWeight: '700' }, eventDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  agendaHeading: { fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: 14 }, event: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, minHeight: 70 }, eventIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1 }, eventTitle: { fontSize: 15, fontWeight: '700' }, eventDetail: { fontSize: 13, marginTop: 4 }, state: { paddingVertical: 28, alignItems: 'center' }, retry: { fontWeight: '700', marginTop: 14 }, notice: { marginBottom: 14, fontSize: 13 }, empty: { fontSize: 14, paddingVertical: 16 },
});
