import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChecklistAPI from '../../api/checklistAPI';
import { buildConditionCycles, isConditionReport, isMoveInChecklist, isMoveOutChecklist } from '../../features/checklists/checklistModel';
import { buildChecklistOverviewCards, checklistHistoryScope } from '../../features/checklists/checklistOverviewModel';
import { buildConditionReportPayload } from '../../features/checklists/checklistWorkflow';
import { checklistDate, recentPropertyChecklists } from '../../features/checklists/recentPropertyChecklists';
import type { Checklist, ChecklistCycle } from '../../features/checklists/checklistTypes';
import type { LeaseTransitionChecklist, LeaseTransitionPhase } from '../../features/checklists/leaseTransitionChecklistModel';
import { getTransitionChecklistProgress } from '../../features/checklists/leaseTransitionChecklistModel';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';
import { useAppTheme } from '../../theme/AppTheme';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'PropertyChecklists'>;

const messageOf = (error: any, fallback: string) => error?.message || error?.Message || fallback;

const propertyChecklistLabel = (item: Checklist) => isConditionReport(item) ? 'Condition report' : isMoveInChecklist(item)
  ? 'Move-in checklist'
  : isMoveOutChecklist(item) ? 'Move-out checklist' : 'Checklist';

const propertyChecklistDate = (item: Checklist) => {
  const date = checklistDate(item);
  return date ? new Date(date).toLocaleDateString() : 'Date unavailable';
};

export default function PropertyChecklistsScreen({ navigation, route }: Props) {
  const { mode, colors } = useAppTheme();
  const themed = mode === 'dark' ? darkStyles : styles;
  const home = route.params;
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [transitionChecklists, setTransitionChecklists] = useState<LeaseTransitionChecklist[]>([]);
  const [conditionReports, setConditionReports] = useState<Checklist[]>([]);
  const [transitionHistoryError, setTransitionHistoryError] = useState('');
  const [conditionReportHistoryError, setConditionReportHistoryError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startingKey, setStartingKey] = useState('');
  const [transitionRequestIds, setTransitionRequestIds] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const scope = checklistHistoryScope(home);
    try {
      const loaded = scope.scope === 'unit'
        ? await ChecklistAPI.getByUnit(scope.id)
        : await ChecklistAPI.getByProperty(scope.id);
      setChecklists(loaded);
      setError('');
    } catch (loadError: any) {
      setChecklists([]);
      setError(messageOf(loadError, 'Checklist history could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    try {
      setTransitionChecklists(await ChecklistAPI.getTransitionChecklists({
        propertyId: home.propertyId,
        unitId: home.unitId,
        leaseId: home.leaseId,
      }));
      setTransitionHistoryError('');
    } catch (loadError: any) {
      // Preserve the last successful list so a partial refresh does not hide useful history.
      setTransitionHistoryError(messageOf(loadError, 'Handoff checklist history could not be loaded.'));
    }

    try {
      const reports = await ChecklistAPI.getConditionReports({ propertyId: home.propertyId, unitId: home.unitId, leaseId: home.leaseId });
      setConditionReports(reports.filter(isConditionReport));
      setConditionReportHistoryError('');
    } catch (loadError: any) {
      // Preserve the last successful list so a partial refresh does not hide useful history.
      setConditionReportHistoryError(messageOf(loadError, 'Condition report history could not be loaded.'));
    }

  }, [home]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cycles = useMemo(() => buildConditionCycles(checklists), [checklists]);
  const cards = useMemo(() => buildChecklistOverviewCards(cycles), [cycles]);

  const findChecklist = (id?: string | null) => id
    ? checklists.find((checklist) => String(checklist.id) === id) ?? null
    : null;

  const openEditor = (checklist: Checklist) => {
    if (checklist.id == null) return;
    navigation.navigate('ChecklistEditor', { ...home, checklistId: String(checklist.id) });
  };

  const startTransition = async (phase: LeaseTransitionPhase) => {
    const leaseId = home.leaseId;
    const key = `transition-${phase}`;
    const requestId = transitionRequestIds[key] ?? `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    if (!transitionRequestIds[key]) setTransitionRequestIds((current) => ({ ...current, [key]: requestId }));
    setStartingKey(key);
    try {
      const started = await ChecklistAPI.createTransitionChecklist({
        propertyId: home.propertyId,
        unitId: home.unitId,
        leaseId,
        phase,
        requestId,
      });
      if (started.id == null) throw new Error('The new checklist did not include an ID.');
      setTransitionRequestIds((current) => {
        const { [key]: _, ...remaining } = current;
        return remaining;
      });
      navigation.navigate('LeaseTransitionChecklist', { ...home, leaseId, transitionChecklistId: String(started.id) });
    } catch (startError: any) {
      Alert.alert('Could not start checklist', messageOf(startError, 'No checklist changes were saved. Please try again.'));
    } finally {
      setStartingKey('');
    }
  };

  const openTransition = (transition: LeaseTransitionChecklist) => {
    if (transition.id == null) return;
    navigation.navigate('LeaseTransitionChecklist', { ...home, leaseId: transition.leaseId == null ? undefined : String(transition.leaseId), transitionChecklistId: String(transition.id) });
  };

  const startConditionReport = async () => {
    const key = 'condition-report';
    const requestId = transitionRequestIds[key] ?? `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    setTransitionRequestIds((current) => ({ ...current, [key]: requestId }));
    setStartingKey(key);
    try {
      const report = await ChecklistAPI.createConditionReport({ ...buildConditionReportPayload(home), LeaseId: home.leaseId ?? null, requestId });
      if (report.id == null) throw new Error('The new condition report did not include an ID.');
      setTransitionRequestIds((current) => {
        const { [key]: _, ...remaining } = current;
        return remaining;
      });
      navigation.navigate('ChecklistEditor', { ...home, checklistId: String(report.id) });
    } catch (startError: any) {
      Alert.alert('Could not start condition report', messageOf(startError, 'No report changes were saved. Please try again.'));
    } finally {
      setStartingKey('');
    }
  };

  if (loading) return <View style={themed.center}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#0b3558'} /></View>;

  if (home.propertyWide) {
    const history = recentPropertyChecklists([...checklists, ...conditionReports], home.propertyId);
    return (
      <FlatList
        style={themed.container}
        contentContainerStyle={themed.content}
        data={history}
        keyExtractor={(item, index) => String(item.id ?? index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={mode === 'dark' ? colors.accent : '#0b3558'} />}
        ListHeaderComponent={<View>
          <Text style={themed.eyebrow}>PROPERTY CHECKLISTS</Text>
          <Text style={themed.title}>{home.propertyName}</Text>
          <Text style={[themed.subtitle, { marginBottom: 18 }]}>Checklist and condition report history</Text>
          <TouchableOpacity style={[themed.primaryButton, { marginBottom: 18 }]} onPress={() => navigation.navigate('ChecklistPropertySearch', { preselectedPropertyId: home.propertyId })} accessibilityRole="button">
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={themed.primaryText}>Choose a unit</Text>
          </TouchableOpacity>
          {transitionChecklists.map((transition) => (
            <TouchableOpacity key={String(transition.id)} style={themed.transitionRow} onPress={() => openTransition(transition)} accessibilityRole="button">
              <View style={themed.flex}><Text style={themed.sideTitle}>{transition.phase === 'moveIn' ? 'Move-in checklist' : 'Move-out checklist'}</Text><Text style={themed.sideMeta}>{transition.unitName || (transition.unitId ? `Unit ${transition.unitId}` : home.propertyName)}</Text></View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          ))}
          {!!(conditionReportHistoryError || transitionHistoryError) && <TouchableOpacity style={themed.sectionRetry} onPress={load} accessibilityRole="button"><Text style={[themed.sectionRetryText, { color: colors.accent }]}>Some history could not be loaded. Tap to retry.</Text></TouchableOpacity>}
          {!!error && <TouchableOpacity style={themed.errorCard} onPress={load} accessibilityRole="button"><Text style={themed.errorText}>{error} Tap to retry.</Text></TouchableOpacity>}
        </View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={themed.propertyRow} onPress={() => item.id != null && navigation.navigate('ChecklistEditor', {
            propertyId: home.propertyId,
            propertyName: home.propertyName,
            propertyType: home.propertyType,
            unitId: item.unitId == null ? undefined : String(item.unitId),
            unitName: item.unitName,
            checklistId: String(item.id),
          })} accessibilityRole="button" accessibilityLabel={`${propertyChecklistLabel(item)}, ${propertyChecklistDate(item)}`} disabled={item.id == null}>
            <View style={themed.flex}>
              <Text style={themed.sideTitle}>{propertyChecklistLabel(item)}</Text>
              <Text style={themed.sideMeta}>{propertyChecklistDate(item)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={mode === 'dark' ? '#b4c3d0' : '#617180'} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={!error && !conditionReportHistoryError ? <Text style={themed.emptyText}>No condition reports for this property yet.</Text> : null}
      />
    );
  }

  const renderCycle = ({ item, index }: { item: ReturnType<typeof buildChecklistOverviewCards>[number]; index: number }) => {
    const cycle: ChecklistCycle = cycles[index];
    return (
      <View style={themed.cycleCard}>
        <Text style={themed.cycleEyebrow}>INSPECTION CYCLE {cards.length - index}</Text>
        <ChecklistSide
          side={item.moveIn}
          checklist={cycle.moveIn}
          kind="move-in"
          onOpen={() => cycle.moveIn && openEditor(cycle.moveIn)}
        />
        <View style={themed.divider} />
        <ChecklistSide
          side={item.moveOut}
          checklist={cycle.moveOut}
          kind="move-out"
          onOpen={() => cycle.moveOut && openEditor(cycle.moveOut)}
        />
      </View>
    );
  };

  return (
    <FlatList
      style={themed.container}
      contentContainerStyle={themed.content}
      data={cards}
      keyExtractor={({ id }) => id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={mode === 'dark' ? colors.accent : '#0b3558'} />}
      ListHeaderComponent={(
        <View>
          <View style={themed.hero}>
            <View style={themed.heroIcon}><Ionicons name="clipboard-outline" size={28} color={colors.accent} /></View>
            <View style={themed.heroCopy}>
              <Text style={themed.eyebrow}>RENTAL HANDOFF</Text>
              <Text style={themed.title}>{home.propertyName}</Text>
              {!!home.unitName && <Text style={themed.unit}>{home.unitName}</Text>}
              <Text style={themed.subtitle}>Keep handoff tasks and condition reports connected.</Text>
            </View>
          </View>
          <View style={themed.transitionActions}>
            <TouchableOpacity style={[themed.transitionButton, { borderColor: colors.accent }]} disabled={Boolean(startingKey)} onPress={() => startTransition('moveIn')}>
              {startingKey === 'transition-moveIn' ? <ActivityIndicator color={colors.accent} /> : <Text style={[themed.transitionButtonText, { color: colors.accent }]}>Start move-in checklist</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[themed.transitionButton, { borderColor: colors.accent }]} disabled={Boolean(startingKey)} onPress={() => startTransition('moveOut')}>
              {startingKey === 'transition-moveOut' ? <ActivityIndicator color={colors.accent} /> : <Text style={[themed.transitionButtonText, { color: colors.accent }]}>Start move-out checklist</Text>}
            </TouchableOpacity>
          </View>
          {transitionChecklists.map((transition) => {
            const progress = getTransitionChecklistProgress(transition);
            const phase = transition.phase === 'moveIn' ? 'Move-in checklist' : 'Move-out checklist';
            return <TouchableOpacity key={String(transition.id)} style={themed.transitionRow} onPress={() => openTransition(transition)}>
              <View style={themed.flex}><Text style={themed.sideTitle}>{phase}</Text><Text style={themed.sideMeta}>{progress.done} of {progress.total} tasks complete</Text></View>
              <Text style={[themed.transitionProgress, { color: colors.accent }]}>{progress.percent}%</Text>
            </TouchableOpacity>;
          })}
          {!!transitionHistoryError && <TouchableOpacity style={themed.sectionRetry} onPress={load} accessibilityRole="button"><Text style={[themed.sectionRetryText, { color: colors.accent }]}>{transitionHistoryError} Tap to retry.</Text></TouchableOpacity>}
          <Text style={[themed.conditionSectionTitle, { color: colors.muted }]}>CONDITION REPORTS</Text>
          <TouchableOpacity style={[themed.transitionButton, { borderColor: colors.accent, marginBottom: 8 }]} disabled={Boolean(startingKey)} onPress={startConditionReport}>
            {startingKey === 'condition-report' ? <ActivityIndicator color={colors.accent} /> : <Text style={[themed.transitionButtonText, { color: colors.accent }]}>Start condition report</Text>}
          </TouchableOpacity>
          {conditionReports.map((report) => <TouchableOpacity key={`report-${String(report.id)}`} style={themed.transitionRow} onPress={() => openEditor(report)}>
            <View style={themed.flex}><Text style={themed.sideTitle}>{report.title || 'Condition report'}</Text><Text style={themed.sideMeta}>{propertyChecklistDate(report)}</Text></View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>)}
          {!!conditionReportHistoryError && <TouchableOpacity style={themed.sectionRetry} onPress={load} accessibilityRole="button"><Text style={[themed.sectionRetryText, { color: colors.accent }]}>{conditionReportHistoryError} Tap to retry.</Text></TouchableOpacity>}
          {!!error && (
            <TouchableOpacity style={themed.errorCard} onPress={load}>
              <Ionicons name="cloud-offline-outline" size={21} color={mode === 'dark' ? '#f0b669' : '#a45f12'} />
              <View style={themed.flex}><Text style={themed.errorTitle}>Checklists are unavailable</Text><Text style={themed.errorText}>{error} Tap to retry.</Text></View>
            </TouchableOpacity>
          )}
        </View>
      )}
      renderItem={renderCycle}
      ItemSeparatorComponent={() => <View style={themed.separator} />}
      ListEmptyComponent={!error && !conditionReports.length && !conditionReportHistoryError ? (
        <View style={themed.emptyCard}>
          <View style={themed.emptyIcon}><Ionicons name="clipboard-outline" size={30} color={mode === 'dark' ? '#86dc9a' : '#2f8f46'} /></View>
          <Text style={themed.emptyTitle}>No condition reports yet</Text>
        </View>
      ) : null}
    />
  );
}

function ChecklistSide({
  side,
  checklist,
  kind,
  onOpen,
}: {
  side: ReturnType<typeof buildChecklistOverviewCards>[number]['moveIn'];
  checklist: Checklist | null;
  kind: 'move-in' | 'move-out';
  onOpen: () => void;
}) {
  const { mode } = useAppTheme();
  const themed = mode === 'dark' ? darkStyles : styles;
  const displayAccent = mode === 'dark' ? '#72b6ff' : '#0b3558';
  const completeAccent = mode === 'dark' ? '#86dc9a' : '#2f8f46';
  const actionAccent = side?.complete ? completeAccent : displayAccent;
  return (
    <View style={themed.side}>
      <View style={themed.sideIcon}><Ionicons name={side?.complete ? 'checkmark' : 'walk-outline'} size={24} color={side?.complete ? completeAccent : displayAccent} /></View>
      <View style={themed.flex}>
        <View style={themed.sideTop}>
          <Text style={[themed.sideLabel, { color: completeAccent }]}>{side?.label || (kind === 'move-in' ? 'Move-in' : 'Move-out')}</Text>
          {!!side && <Text style={[themed.progress, side.complete && themed.completeProgress]}>{side.complete ? 'Complete' : `${side.percent}%`}</Text>}
        </View>
        <Text style={themed.sideTitle}>{side?.title || 'Not created yet'}</Text>
        {!!side && <Text style={themed.sideMeta}>{side.done} of {side.total} items · {side.tenantName || 'No tenant linked'}</Text>}
        {checklist && <TouchableOpacity style={[themed.sideButton, { borderColor: actionAccent }]} onPress={onOpen}>
          <Text style={[themed.sideButtonText, { color: actionAccent }]}>Open checklist</Text>
        </TouchableOpacity>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 18, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  heroIcon: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#102d43', fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6, marginTop: 2 },
  unit: { color: '#0b3558', fontSize: 14, fontWeight: '900', marginTop: 1 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  transitionActions: { gap: 9, marginBottom: 12 },
  transitionButton: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  transitionButtonText: { fontSize: 13, fontWeight: '900' },
  transitionRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#dce4e8', paddingVertical: 13 },
  sectionRetry: { paddingVertical: 10 },
  sectionRetryText: { fontSize: 12, fontWeight: '800', lineHeight: 18 },
  transitionProgress: { fontWeight: '900', fontSize: 13 },
  conditionSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 22, marginBottom: 4 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f1d8a7', backgroundColor: '#fff8e8', marginBottom: 14 },
  errorTitle: { color: '#7a480f', fontWeight: '900' },
  errorText: { color: '#8f6b3b', marginTop: 2, fontSize: 12 },
  cycleCard: { borderTopWidth: 1, borderTopColor: '#dce4e8', paddingTop: 18, paddingBottom: 8 },
  propertyRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#dce4e8', paddingVertical: 14 },
  cycleEyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 18 },
  side: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  sideIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sideLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  progress: { color: '#536575', fontSize: 11, fontWeight: '900', backgroundColor: '#f0f3f5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  completeProgress: { color: '#2f8f46', backgroundColor: '#edf9ef' },
  sideTitle: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  sideMeta: { color: '#697887', fontSize: 12, marginTop: 3 },
  sideButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginTop: 10 },
  sideButtonText: { fontSize: 13, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#e2e7e9', marginVertical: 19 },
  separator: { height: 24 },
  emptyCard: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#dce4e8', paddingHorizontal: 24, paddingVertical: 30 },
  emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#102d43', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#697887', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#2f8f46', borderRadius: 14, paddingHorizontal: 17, marginTop: 17 },
  primaryText: { color: '#fff', fontWeight: '900' },
});

const darkStyles = StyleSheet.create({
  ...styles,
  container: { ...styles.container, backgroundColor: '#101923' },
  center: { ...styles.center, backgroundColor: '#101923' },
  heroIcon: { ...styles.heroIcon },
  emptyIcon: { ...styles.emptyIcon },
  eyebrow: { ...styles.eyebrow, color: '#86dc9a' },
  cycleEyebrow: { ...styles.cycleEyebrow, color: '#86dc9a' },
  title: { ...styles.title, color: '#f2f6fa' },
  emptyTitle: { ...styles.emptyTitle, color: '#f2f6fa' },
  sideTitle: { ...styles.sideTitle, color: '#f2f6fa' },
  unit: { ...styles.unit, color: '#72b6ff' },
  subtitle: { ...styles.subtitle, color: '#b4c3d0' },
  emptyText: { ...styles.emptyText, color: '#b4c3d0' },
  sideMeta: { ...styles.sideMeta, color: '#b4c3d0' },
  progress: { ...styles.progress, color: '#f2f6fa', backgroundColor: '#25394b' },
  completeProgress: { ...styles.completeProgress, color: '#86dc9a', backgroundColor: '#1c3a34' },
  cycleCard: { ...styles.cycleCard, borderTopColor: '#35495b' },
  propertyRow: { ...styles.propertyRow, borderTopColor: '#35495b' },
  transitionRow: { ...styles.transitionRow, borderTopColor: '#35495b' },
  emptyCard: { ...styles.emptyCard, borderTopColor: '#35495b' },
  divider: { ...styles.divider, backgroundColor: '#35495b' },
  errorCard: { ...styles.errorCard, borderColor: '#8b6531', backgroundColor: '#382d21' },
  errorTitle: { ...styles.errorTitle, color: '#f8d39b' },
  errorText: { ...styles.errorText, color: '#e5c59d' },
});
