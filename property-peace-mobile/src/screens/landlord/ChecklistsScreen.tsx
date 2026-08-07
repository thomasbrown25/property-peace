import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { PropertiesStackParamList } from '../../navigation/types';
import ChecklistAPI, { Checklist, ChecklistItem } from '../../api/checklistAPI';

type ChecklistRoute = RouteProp<PropertiesStackParamList, 'Checklists'>;

const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const checklistTypeLabel = (checklist: Checklist) => {
  const raw = checklist.checklistType;
  if (Number(raw) === 40 || String(raw).toLowerCase().includes('movein')) return 'Move-in';
  if (Number(raw) === 41 || String(raw).toLowerCase().includes('moveout')) return 'Move-out';
  return 'Inspection';
};

export default function ChecklistsScreen() {
  const route = useRoute<ChecklistRoute>();
  const { propertyId, propertyName } = route.params;
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const saveLockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await ChecklistAPI.getByProperty(propertyId);
      setChecklists(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const items = checklists.flatMap((checklist) => checklist.items || []);
    return { checked: items.filter((item) => item.isChecked).length, total: items.length };
  }, [checklists]);

  const toggleItem = async (checklist: Checklist, item: ChecklistItem) => {
    if (checklist.id == null || item.id == null || saveLockRef.current) return;
    saveLockRef.current = true;
    const checklistId = String(checklist.id);
    const itemId = String(item.id);
    const nextChecked = !item.isChecked;
    const nextChecklist: Checklist = {
      ...checklist,
      items: (checklist.items || []).map((current) => String(current.id) === itemId
        ? { ...current, isChecked: nextChecked, checkedAt: nextChecked ? new Date().toISOString() : null }
        : current),
    };
    const allComplete = (nextChecklist.items || []).length > 0 && (nextChecklist.items || []).every((current) => current.isChecked);
    nextChecklist.isCompleted = allComplete;
    nextChecklist.completedAt = allComplete ? (checklist.completedAt || new Date().toISOString()) : null;

    setSavingItemId(itemId);
    setChecklists((current) => current.map((entry) => String(entry.id) === checklistId ? nextChecklist : entry));
    try {
      const saved = await ChecklistAPI.update(checklist.id, nextChecklist);
      setChecklists((current) => current.map((entry) => String(entry.id) === checklistId ? saved : entry));
    } catch (saveError: any) {
      setChecklists((current) => current.map((entry) => String(entry.id) === checklistId ? checklist : entry));
      Alert.alert('Could not update checklist', saveError?.message || saveError?.Message || 'Your change was not saved. Please try again.');
    } finally {
      saveLockRef.current = false;
      setSavingItemId(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2475cf" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2475cf" />}
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="clipboard-outline" size={27} color="#2f8f46" /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>ON-SITE WORKFLOW</Text>
          <Text style={styles.title}>{propertyName || 'Property checklists'}</Text>
          <Text style={styles.subtitle}>Complete move-in and move-out items while you walk the property.</Text>
        </View>
      </View>

      {error && (
        <TouchableOpacity style={styles.errorCard} onPress={load}>
          <Ionicons name="cloud-offline-outline" size={22} color="#a45f12" />
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>Checklists are unavailable</Text>
            <Text style={styles.errorText}>Tap to try again.</Text>
          </View>
        </TouchableOpacity>
      )}

      {!error && (
        <View style={styles.progressCard}>
          <View>
            <Text style={styles.progressEyebrow}>OVERALL PROGRESS</Text>
            <Text style={styles.progressValue}>{totals.checked} of {totals.total}</Text>
          </View>
          <View style={styles.progressCopy}>
            <Text style={styles.progressLabel}>items complete</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${totals.total ? Math.round((totals.checked / totals.total) * 100) : 0}%` }]} />
            </View>
          </View>
        </View>
      )}

      {!error && checklists.length === 0 && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Ionicons name="clipboard-outline" size={30} color="#2475cf" /></View>
          <Text style={styles.emptyTitle}>No checklists yet</Text>
          <Text style={styles.emptyText}>Create the property's move-in or move-out checklist in the web app. It will appear here for on-site completion.</Text>
        </View>
      )}

      <View style={styles.list}>
        {checklists.map((checklist) => {
          const id = String(checklist.id);
          const items = checklist.items || [];
          const checked = items.filter((item) => item.isChecked).length;
          const open = expandedId === id;
          const percent = items.length ? Math.round((checked / items.length) * 100) : 0;
          return (
            <View key={id} style={styles.checklistCard}>
              <TouchableOpacity style={styles.checklistHeader} onPress={() => setExpandedId(open ? null : id)} activeOpacity={0.8}>
                <View style={[styles.typeIcon, checklist.isCompleted && styles.typeIconComplete]}>
                  <Ionicons name={checklist.isCompleted ? 'checkmark' : 'walk-outline'} size={22} color={checklist.isCompleted ? '#2f8f46' : '#2475cf'} />
                </View>
                <View style={styles.checklistCopy}>
                  <View style={styles.typeRow}>
                    <Text style={styles.typeLabel}>{checklistTypeLabel(checklist)}</Text>
                    <View style={[styles.statusChip, checklist.isCompleted && styles.statusChipComplete]}>
                      <Text style={[styles.statusText, checklist.isCompleted && styles.statusTextComplete]}>{checklist.isCompleted ? 'Complete' : `${percent}%`}</Text>
                    </View>
                  </View>
                  <Text style={styles.checklistTitle}>{stringValue(checklist.title, 'Property checklist')}</Text>
                  <Text style={styles.checklistMeta}>{checked} of {items.length} items complete</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#71808d" />
              </TouchableOpacity>

              {open && (
                <View style={styles.itemsWrap}>
                  {items.length === 0 ? <Text style={styles.noItems}>This checklist has no items.</Text> : items.map((item, index) => {
                    const itemId = String(item.id ?? index);
                    const saving = savingItemId === itemId;
                    return (
                      <TouchableOpacity key={itemId} style={styles.itemRow} onPress={() => toggleItem(checklist, item)} disabled={savingItemId !== null} activeOpacity={0.75}>
                        <View style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}>
                          {saving ? <ActivityIndicator size="small" color={item.isChecked ? '#fff' : '#2475cf'} /> : item.isChecked ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                        </View>
                        <View style={styles.itemCopy}>
                          <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>{stringValue(item.name, `Item ${index + 1}`)}</Text>
                          {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
                          {!!item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.scopeNote}>
        <Ionicons name="information-circle-outline" size={20} color="#607080" />
        <Text style={styles.scopeText}>This mobile view saves checklist completion. Photos, signatures, and checklist setup remain in the web app for now.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf7f4' },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf9ef' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  title: { color: '#102d43', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff8e8', borderWidth: 1, borderColor: '#f1d8a7', borderRadius: 16, padding: 14, marginBottom: 16 },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#7a480f', fontWeight: '900' },
  errorText: { color: '#8f6b3b', marginTop: 2 },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#0b3558', borderRadius: 20, padding: 18, marginBottom: 16 },
  progressEyebrow: { color: '#74c86b', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressValue: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 3 },
  progressCopy: { flex: 1 },
  progressLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 8 },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#74c86b' },
  emptyCard: { alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e9ee', borderRadius: 20, padding: 26, marginBottom: 16 },
  emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#102d43', fontSize: 17, fontWeight: '900', marginBottom: 6 },
  emptyText: { color: '#697887', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  list: { gap: 12 },
  checklistCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e9ee', borderRadius: 20, overflow: 'hidden', shadowColor: '#13293d', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  checklistHeader: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  typeIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  typeIconComplete: { backgroundColor: '#edf9ef' },
  checklistCopy: { flex: 1, minWidth: 0 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  typeLabel: { color: '#2475cf', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  statusChip: { backgroundColor: '#eaf3ff', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  statusChipComplete: { backgroundColor: '#edf9ef' },
  statusText: { color: '#2475cf', fontSize: 10, fontWeight: '900' },
  statusTextComplete: { color: '#2f8f46' },
  checklistTitle: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  checklistMeta: { color: '#697887', fontSize: 12, marginTop: 2 },
  itemsWrap: { borderTopWidth: 1, borderTopColor: '#edf1f3', paddingHorizontal: 14 },
  noItems: { color: '#697887', paddingVertical: 16 },
  itemRow: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f2f4' },
  checkbox: { width: 32, height: 32, borderRadius: 11, borderWidth: 2, borderColor: '#b9c6d1', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#2f8f46', borderColor: '#2f8f46' },
  itemCopy: { flex: 1 },
  itemName: { color: '#20394d', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  itemNameChecked: { color: '#71808d', textDecorationLine: 'line-through' },
  itemDescription: { color: '#697887', fontSize: 13, lineHeight: 18, marginTop: 3 },
  itemNotes: { color: '#51606c', fontSize: 12, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },
  scopeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, paddingHorizontal: 4 },
  scopeText: { flex: 1, color: '#607080', fontSize: 12, lineHeight: 18 },
});
