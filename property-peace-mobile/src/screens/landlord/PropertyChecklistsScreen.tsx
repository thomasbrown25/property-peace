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
import LeaseAPI, { Lease } from '../../api/leaseAPI';
import { buildConditionCycles } from '../../features/checklists/checklistModel';
import { buildChecklistOverviewCards, checklistHistoryScope, isChecklistStarted } from '../../features/checklists/checklistOverviewModel';
import { startChecklistCycle } from '../../features/checklists/checklistWorkflow';
import type { Checklist, ChecklistCycle } from '../../features/checklists/checklistTypes';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'PropertyChecklists'>;

const messageOf = (error: any, fallback: string) => error?.message || error?.Message || fallback;

export default function PropertyChecklistsScreen({ navigation, route }: Props) {
  const home = route.params;
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeLease, setActiveLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startingKey, setStartingKey] = useState('');

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
      const lease = await LeaseAPI.getActiveLease(home.propertyId);
      const leaseUnitId = lease?.unitId ?? lease?.UnitId;
      setActiveLease(lease && (!home.unitId || String(leaseUnitId) === home.unitId) ? lease : null);
    } catch {
      setActiveLease(null);
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

  const startMissing = async (type: 40 | 41, counterpart: Checklist | null, key: string) => {
    setStartingKey(key);
    try {
      const result = await startChecklistCycle({
        type,
        home,
        counterpart,
        lease: activeLease,
        now: new Date().toISOString(),
      }, ChecklistAPI);
      await load();
      openEditor(result.primary);
    } catch (startError: any) {
      Alert.alert('Could not start checklist', messageOf(startError, 'No checklist changes were saved. Please try again.'));
    } finally {
      setStartingKey('');
    }
  };

  const startExisting = async (checklist: Checklist, key: string) => {
    if (checklist.id == null) return;
    setStartingKey(key);
    try {
      const started = await ChecklistAPI.update(checklist.id, {
        ...checklist,
        inspectionDate: new Date().toISOString(),
      });
      openEditor(started);
    } catch (startError: any) {
      Alert.alert('Could not start checklist', messageOf(startError, 'The inspection was not started. Please try again.'));
    } finally {
      setStartingKey('');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2475cf" /></View>;

  const renderCycle = ({ item, index }: { item: ReturnType<typeof buildChecklistOverviewCards>[number]; index: number }) => {
    const cycle: ChecklistCycle = cycles[index];
    return (
      <View style={styles.cycleCard}>
        <Text style={styles.cycleEyebrow}>INSPECTION CYCLE {cards.length - index}</Text>
        <ChecklistSide
          side={item.moveIn}
          checklist={cycle.moveIn}
          accent="#2475cf"
          starting={startingKey === `${item.id}-in`}
          onOpen={() => cycle.moveIn && openEditor(cycle.moveIn)}
          onStart={() => cycle.moveIn
            ? startExisting(cycle.moveIn, `${item.id}-in`)
            : startMissing(40, cycle.moveOut, `${item.id}-in`)}
        />
        <View style={styles.divider} />
        <ChecklistSide
          side={item.moveOut}
          checklist={cycle.moveOut}
          accent="#c17620"
          starting={startingKey === `${item.id}-out`}
          onOpen={() => cycle.moveOut && openEditor(cycle.moveOut)}
          onStart={() => cycle.moveOut
            ? startExisting(cycle.moveOut, `${item.id}-out`)
            : startMissing(41, cycle.moveIn, `${item.id}-out`)}
        />
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={cards}
      keyExtractor={({ id }) => id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2475cf" />}
      ListHeaderComponent={(
        <View>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="home-outline" size={26} color="#2f8f46" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>CONDITION HISTORY</Text>
              <Text style={styles.title}>{home.propertyName}</Text>
              {!!home.unitName && <Text style={styles.unit}>{home.unitName}</Text>}
              <Text style={styles.subtitle}>Start an inspection or continue where you left off.</Text>
            </View>
          </View>
          {!!error && (
            <TouchableOpacity style={styles.errorCard} onPress={load}>
              <Ionicons name="cloud-offline-outline" size={21} color="#a45f12" />
              <View style={styles.flex}><Text style={styles.errorTitle}>Checklists are unavailable</Text><Text style={styles.errorText}>{error} Tap to retry.</Text></View>
            </TouchableOpacity>
          )}
        </View>
      )}
      renderItem={renderCycle}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={!error ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Ionicons name="clipboard-outline" size={30} color="#2f8f46" /></View>
          <Text style={styles.emptyTitle}>No inspection history yet</Text>
          <Text style={styles.emptyText}>Start with move-in. Its future move-out checklist will stay connected here.</Text>
          <TouchableOpacity style={styles.primaryButton} disabled={Boolean(startingKey)} onPress={() => startMissing(40, null, 'new-in')}>
            {startingKey === 'new-in' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
            <Text style={styles.primaryText}>Start move-in checklist</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    />
  );
}

function ChecklistSide({
  side,
  checklist,
  accent,
  starting,
  onOpen,
  onStart,
}: {
  side: ReturnType<typeof buildChecklistOverviewCards>[number]['moveIn'];
  checklist: Checklist | null;
  accent: string;
  starting: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const started = checklist ? isChecklistStarted(checklist) : false;
  const action = side && started ? onOpen : onStart;
  return (
    <View style={styles.side}>
      <View style={[styles.sideIcon, { backgroundColor: `${accent}18` }]}><Ionicons name={side?.complete ? 'checkmark' : 'walk-outline'} size={21} color={accent} /></View>
      <View style={styles.flex}>
        <View style={styles.sideTop}>
          <Text style={[styles.sideLabel, { color: accent }]}>{side?.label || (accent === '#2475cf' ? 'Move-in' : 'Move-out')}</Text>
          {!!side && <Text style={styles.progress}>{side.complete ? 'Complete' : `${side.percent}%`}</Text>}
        </View>
        <Text style={styles.sideTitle}>{side?.title || 'Not created yet'}</Text>
        {!!side && <Text style={styles.sideMeta}>{side.done} of {side.total} items · {side.tenantName || 'No tenant linked'}</Text>}
        <TouchableOpacity style={[styles.sideButton, { borderColor: accent }]} onPress={action} disabled={starting}>
          {starting ? <ActivityIndicator size="small" color={accent} /> : <Text style={[styles.sideButtonText, { color: accent }]}>{side && started ? 'Open checklist' : `Start ${side?.label?.toLowerCase() || (accent === '#2475cf' ? 'move-in' : 'move-out')}`}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf7f4' },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf9ef' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#102d43', fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6, marginTop: 2 },
  unit: { color: '#2475cf', fontSize: 14, fontWeight: '900', marginTop: 1 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f1d8a7', backgroundColor: '#fff8e8', marginBottom: 14 },
  errorTitle: { color: '#7a480f', fontWeight: '900' },
  errorText: { color: '#8f6b3b', marginTop: 2, fontSize: 12 },
  cycleCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8ed', borderRadius: 20, padding: 15 },
  cycleEyebrow: { color: '#75838e', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  side: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sideIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sideLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  progress: { color: '#536575', fontSize: 11, fontWeight: '900', backgroundColor: '#f0f3f5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  sideTitle: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  sideMeta: { color: '#697887', fontSize: 12, marginTop: 3 },
  sideButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginTop: 10 },
  sideButtonText: { fontSize: 13, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#edf1f3', marginVertical: 15 },
  separator: { height: 12 },
  emptyCard: { alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8ed', borderRadius: 20, padding: 26 },
  emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#edf9ef', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#102d43', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#697887', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#2f8f46', borderRadius: 14, paddingHorizontal: 17, marginTop: 17 },
  primaryText: { color: '#fff', fontWeight: '900' },
});
