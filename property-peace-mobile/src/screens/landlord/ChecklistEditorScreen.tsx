import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChecklistAPI from '../../api/checklistAPI';
import ChecklistItemPhotos from '../../components/checklists/ChecklistItemPhotos';
import {
  CHECKLIST_CONDITIONS,
  addChecklistItem,
  getChecklistProgress,
  groupChecklistRooms,
  removeCustomChecklistItem,
  withItemCondition,
} from '../../features/checklists/checklistModel';
import {
  addRoomToChecklistPair,
  persistChecklistPair,
  renameRoomInChecklistPair,
  withChecklistItemDetails,
} from '../../features/checklists/checklistEditorModel';
import {
  rememberFailedChecklistUpload,
  removeFailedChecklistUpload,
} from '../../features/checklists/checklistPhotoModel';
import type { FailedChecklistUploads } from '../../features/checklists/checklistPhotoModel';
import type { Checklist, ChecklistCondition, ChecklistItem, ChecklistRoom, Id } from '../../features/checklists/checklistTypes';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';
import { useAppTheme } from '../../theme/AppTheme';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'ChecklistEditor'>;
type ItemDraft = { notes: string; damageDescription: string };

const idText = (id?: Id) => String(id ?? '');
const errorMessage = (error: any, fallback: string) => error?.message || error?.Message || fallback;

export default function ChecklistEditorScreen({ route }: Props) {
  const { mode, colors } = useAppTheme();
  const themed = mode === 'dark' ? darkStyles : styles;
  const { checklistId } = route.params;
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [counterpart, setCounterpart] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [counterpartLoadError, setCounterpartLoadError] = useState('');
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [roomDraft, setRoomDraft] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [itemNameDrafts, setItemNameDrafts] = useState<Record<string, string>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [savingKey, setSavingKey] = useState('');
  const [retryCondition, setRetryCondition] = useState<{ itemId: Id; condition: ChecklistCondition | null } | null>(null);
  const [failedUploads, setFailedUploads] = useState<FailedChecklistUploads>({});
  const mutationLock = useRef('');
  const busy = Boolean(savingKey);

  const beginMutation = (key: string) => {
    if (mutationLock.current) return false;
    mutationLock.current = key;
    setSavingKey(key);
    return true;
  };

  const endMutation = (key: string) => {
    if (mutationLock.current === key) {
      mutationLock.current = '';
      setSavingKey('');
    }
    return true;
  };

  const load = useCallback(async () => {
    try {
      const loaded = await ChecklistAPI.getById(checklistId);
      setChecklist(loaded);
      setItemDrafts(Object.fromEntries(loaded.items.map((item) => [idText(item.id), {
        notes: item.notes || '',
        damageDescription: item.damageDescription || '',
      }])));
      if (loaded.counterpartChecklistId != null) {
        try {
          setCounterpart(await ChecklistAPI.getById(loaded.counterpartChecklistId));
          setCounterpartLoadError('');
        } catch {
          setCounterpart(null);
          setCounterpartLoadError('The connected move-in or move-out checklist could not be loaded.');
        }
      } else {
        setCounterpart(null);
        setCounterpartLoadError('');
      }
      setError('');
    } catch (loadError: any) {
      setError(errorMessage(loadError, 'The checklist could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checklistId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rooms = useMemo(() => checklist ? groupChecklistRooms(checklist) : [], [checklist]);
  const progress = useMemo(() => checklist ? getChecklistProgress(checklist) : { done: 0, total: 0, percent: 0, complete: false }, [checklist]);

  const saveActive = async (next: Checklist) => {
    if (next.id == null) throw new Error('Checklist ID is missing');
    const saved = await ChecklistAPI.update(next.id, next);
    setChecklist(saved);
    return saved;
  };

  const savePair = async (nextActive: Checklist, nextCounterpart: Checklist | null) => {
    if (!checklist) throw new Error('Checklist is not loaded');
    const saved = await persistChecklistPair(
      checklist, nextActive, counterpart, nextCounterpart, ChecklistAPI,
    );
    setChecklist(saved.active);
    setCounterpart(saved.counterpart);
  };

  const changeCondition = async (item: ChecklistItem, requested: ChecklistCondition | null) => {
    if (!checklist || item.id == null) return;
    const key = `condition-${idText(item.id)}`;
    if (!beginMutation(key)) return;
    const previous = checklist;
    const condition = item.condition === requested ? null : requested;
    const next = withItemCondition(previous, item.id, condition, new Date().toISOString());
    setChecklist(next);
    setRetryCondition(null);
    try {
      await saveActive(next);
    } catch (saveError: any) {
      setChecklist(previous);
      setRetryCondition({ itemId: item.id, condition });
      Alert.alert('Condition not saved', errorMessage(saveError, 'Retry this item when you are back online.'));
    } finally {
      endMutation(key);
    }
  };

  const saveDetails = async (item: ChecklistItem) => {
    if (!checklist || item.id == null) return;
    const key = idText(item.id);
    const mutationKey = `details-${key}`;
    if (!beginMutation(mutationKey)) return;
    const draft = itemDrafts[key] || { notes: item.notes || '', damageDescription: item.damageDescription || '' };
    try {
      await saveActive(withChecklistItemDetails(checklist, item.id, draft));
    } catch (saveError: any) {
      Alert.alert('Details not saved', errorMessage(saveError, 'Your notes were not saved. Please try again.'));
    } finally {
      endMutation(mutationKey);
    }
  };

  const addRoom = async () => {
    if (!checklist) return;
    if (!beginMutation('add-room')) return;
    try {
      const next = addRoomToChecklistPair(checklist, counterpart, roomDraft);
      await savePair(next.active, next.counterpart);
      setRoomDraft('');
    } catch (saveError: any) {
      Alert.alert('Room not added', errorMessage(saveError, 'The room was not added. Please try again.'));
    } finally {
      endMutation('add-room');
    }
  };

  const renameRoom = async (room: ChecklistRoom) => {
    if (!checklist) return;
    const key = `rename-${room.name}`;
    if (!beginMutation(key)) return;
    const nextName = renameDrafts[room.name] ?? room.name;
    try {
      const next = renameRoomInChecklistPair(checklist, counterpart, room.name, nextName);
      await savePair(next.active, next.counterpart);
      setRenameDrafts((current) => ({ ...current, [nextName]: nextName }));
    } catch (saveError: any) {
      Alert.alert('Room not renamed', errorMessage(saveError, 'The room name was not saved. Please try again.'));
    } finally {
      endMutation(key);
    }
  };

  const addItem = async (room: ChecklistRoom) => {
    if (!checklist) return;
    const key = `add-item-${room.name}`;
    if (!beginMutation(key)) return;
    try {
      await saveActive(addChecklistItem(checklist, room.name, itemNameDrafts[room.name] || ''));
      setItemNameDrafts((current) => ({ ...current, [room.name]: '' }));
    } catch (saveError: any) {
      Alert.alert('Item not added', errorMessage(saveError, 'The checklist item was not added.'));
    } finally {
      endMutation(key);
    }
  };

  const confirmDelete = (item: ChecklistItem) => {
    if (!checklist || item.id == null || mutationLock.current) return;
    Alert.alert('Delete checklist item?', `Remove “${item.name}” from this inspection?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const key = `delete-${idText(item.id)}`;
        if (!beginMutation(key)) return;
        try {
          await saveActive(removeCustomChecklistItem(checklist, item.id!));
        } catch (saveError: any) {
          Alert.alert('Item not deleted', errorMessage(saveError, 'The item remains on the checklist.'));
        } finally {
          endMutation(key);
        }
      } },
    ]);
  };

  const toggleRoom = (roomName: string) => setCollapsedRooms((current) => {
    const next = new Set(current);
    if (next.has(roomName)) next.delete(roomName); else next.add(roomName);
    return next;
  });

  if (loading) return <View style={themed.center}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>;
  if (!checklist) return (
    <View style={themed.center}>
      <Ionicons name="cloud-offline-outline" size={34} color={mode === 'dark' ? '#f0b669' : '#a45f12'} />
      <Text style={themed.loadErrorTitle}>Checklist unavailable</Text>
      <Text style={themed.loadErrorText}>{error}</Text>
      <TouchableOpacity style={themed.retryButton} onPress={load}><Text style={themed.retryText}>Retry</Text></TouchableOpacity>
    </View>
  );

  const renderRoom = ({ item: room }: { item: ChecklistRoom }) => {
    const collapsed = collapsedRooms.has(room.name);
    const roomDone = room.items.filter((item) => Boolean(item.condition)).length;
    const renameValue = renameDrafts[room.name] ?? room.name;
    return (
      <View style={themed.roomCard}>
        <TouchableOpacity style={themed.roomTop} onPress={() => toggleRoom(room.name)}>
          <View style={themed.roomIcon}><Ionicons name="home-outline" size={20} color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>
          <View style={themed.flex}><Text style={themed.roomTitle}>{room.name}</Text><Text style={themed.roomProgress}>{roomDone} of {room.items.length} complete</Text></View>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color={mode === 'dark' ? colors.muted : '#71808d'} />
        </TouchableOpacity>
        {!collapsed && (
          <View>
            <View style={themed.renameRow}>
              <TextInput value={renameValue} onChangeText={(value) => setRenameDrafts((current) => ({ ...current, [room.name]: value }))} style={themed.smallInput} accessibilityLabel={`Rename ${room.name}`} editable={!busy} />
              <TouchableOpacity style={themed.secondaryButton} onPress={() => renameRoom(room)} disabled={busy}>
                {savingKey === `rename-${room.name}` ? <ActivityIndicator size="small" color={mode === 'dark' ? colors.accent : '#2475cf'} /> : <Text style={themed.secondaryText}>Rename</Text>}
              </TouchableOpacity>
            </View>
            {room.items.length === 0 ? <Text style={themed.noItems}>Add the first checklist item for this room.</Text> : room.items.map((item) => (
              <InspectionItem
                key={idText(item.id)}
                item={item}
                checklistId={checklistId}
                onChecklistUpdated={setChecklist}
                draft={itemDrafts[idText(item.id)] || { notes: item.notes || '', damageDescription: item.damageDescription || '' }}
                onDraft={(draft) => setItemDrafts((current) => ({ ...current, [idText(item.id)]: draft }))}
                savingKey={savingKey}
                disabled={busy}
                failedAsset={failedUploads[idText(item.id)] ?? null}
                onFailedAssetChange={(asset) => setFailedUploads((current) => asset ? rememberFailedChecklistUpload(current, item.id!, asset) : removeFailedChecklistUpload(current, item.id!))}
                onBusyChange={(isBusy) => isBusy ? beginMutation(`photo-${idText(item.id)}`) : endMutation(`photo-${idText(item.id)}`)}
                retryCondition={retryCondition}
                onCondition={(condition) => changeCondition(item, condition)}
                onSaveDetails={() => saveDetails(item)}
                onDelete={() => confirmDelete(item)}
              />
            ))}
            <View style={themed.addItemRow}>
              <TextInput
                value={itemNameDrafts[room.name] || ''}
                onChangeText={(value) => setItemNameDrafts((current) => ({ ...current, [room.name]: value }))}
                placeholder={`Add item to ${room.name}`}
                placeholderTextColor={mode === 'dark' ? colors.muted : '#8795a1'}
                style={themed.smallInput}
                editable={!busy}
              />
              <TouchableOpacity style={themed.addButton} onPress={() => addItem(room)} disabled={busy || !itemNameDrafts[room.name]?.trim()}>
                {savingKey === `add-item-${room.name}` ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={21} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      style={themed.container}
      contentContainerStyle={themed.content}
      data={rooms}
      keyExtractor={({ name }) => name.toLowerCase()}
      renderItem={renderRoom}
      ItemSeparatorComponent={() => <View style={themed.separator} />}
      refreshControl={<RefreshControl refreshing={refreshing} enabled={!busy} onRefresh={() => { if (!busy) { setRefreshing(true); load(); } }} tintColor={mode === 'dark' ? colors.accent : '#2475cf'} />}
      ListHeaderComponent={(
        <View>
          <Text style={themed.eyebrow}>{Number(checklist.checklistType) === 41 ? 'MOVE-OUT INSPECTION' : 'MOVE-IN INSPECTION'}</Text>
          <Text style={themed.title}>{checklist.title}</Text>
          <Text style={themed.subtitle}>Set a condition for each item, then add notes for anything that needs attention.</Text>
          {!!counterpartLoadError && (
            <View style={themed.counterpartWarning}>
              <Text style={themed.counterpartWarningText}>{counterpartLoadError} Room changes are paused to keep both inspections matched.</Text>
              <TouchableOpacity style={themed.counterpartRetryButton} onPress={() => { setRefreshing(true); load(); }} disabled={busy}>
                <Text style={themed.counterpartRetryText}>Retry connected checklist</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={themed.progressCard}>
            <Text style={themed.progressValue}>{progress.done} of {progress.total}</Text>
            <View style={themed.flex}><Text style={themed.progressLabel}>{progress.complete ? 'Inspection complete' : `${progress.percent}% complete`}</Text><View style={themed.progressTrack}><View style={[themed.progressFill, { width: `${progress.percent}%` }]} /></View></View>
          </View>
          <View style={themed.addRoomCard}>
            <Text style={themed.addRoomTitle}>Add another room</Text>
            <View style={themed.addRoomRow}>
              <TextInput value={roomDraft} onChangeText={setRoomDraft} placeholder="Room name" placeholderTextColor={mode === 'dark' ? colors.muted : '#8795a1'} style={themed.smallInput} editable={!busy} />
              <TouchableOpacity style={themed.addButton} onPress={addRoom} disabled={busy || !roomDraft.trim()}>
                {savingKey === 'add-room' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={21} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    />
  );
}

function InspectionItem({ checklistId, item, draft, onDraft, savingKey, disabled, failedAsset, onFailedAssetChange, onBusyChange, retryCondition, onCondition, onSaveDetails, onDelete, onChecklistUpdated }: {
  checklistId: Id;
  item: ChecklistItem;
  draft: ItemDraft;
  onDraft: (draft: ItemDraft) => void;
  savingKey: string;
  disabled: boolean;
  failedAsset: FailedChecklistUploads[string] | null;
  onFailedAssetChange: (asset: FailedChecklistUploads[string] | null) => void;
  onBusyChange: (busy: boolean) => boolean;
  retryCondition: { itemId: Id; condition: ChecklistCondition | null } | null;
  onCondition: (condition: ChecklistCondition | null) => void;
  onSaveDetails: () => void;
  onDelete: () => void;
  onChecklistUpdated: (checklist: Checklist) => void;
}) {
  const { mode, colors } = useAppTheme();
  const themed = mode === 'dark' ? darkStyles : styles;
  const key = idText(item.id);
  const savingCondition = savingKey === `condition-${key}`;
  const retry = retryCondition && idText(retryCondition.itemId) === key ? retryCondition : null;
  return (
    <View style={themed.itemCard}>
      <View style={themed.itemTop}>
        <View style={themed.flex}><Text style={themed.itemName}>{item.name}</Text>{!!item.description && <Text style={themed.itemDescription}>{item.description}</Text>}</View>
        {(item.sortOrder ?? 0) >= 1000 && <TouchableOpacity style={themed.iconButton} onPress={onDelete} disabled={disabled}><Ionicons name="trash-outline" size={19} color={mode === 'dark' ? '#ff918b' : '#c2413b'} /></TouchableOpacity>}
      </View>
      <View style={themed.conditions}>
        {CHECKLIST_CONDITIONS.map((option) => {
          const selected = item.condition === option.value;
          return <TouchableOpacity key={option.value} accessibilityLabel={option.label} style={[themed.condition, selected && themed.conditionSelected]} onPress={() => onCondition(option.value)} disabled={disabled}><Text style={[themed.conditionText, selected && themed.conditionTextSelected]}>{option.label}</Text></TouchableOpacity>;
        })}
      </View>
      {savingCondition && <Text style={themed.savingText}>Saving condition…</Text>}
      {!!retry && <TouchableOpacity style={themed.retryConditionButton} onPress={() => onCondition(retry.condition)} disabled={disabled}><Text style={themed.retryInline}>Condition not saved · Retry</Text></TouchableOpacity>}
      <TextInput
        value={draft.notes}
        onChangeText={(notes) => onDraft({ ...draft, notes })}
        placeholder="Notes"
        placeholderTextColor={mode === 'dark' ? colors.muted : '#8795a1'}
        style={[themed.detailInput, themed.multiline]}
        multiline
        editable={!disabled}
      />
      <TextInput
        value={draft.damageDescription}
        onChangeText={(damageDescription) => onDraft({ ...draft, damageDescription })}
        placeholder="Damage or repair details (optional)"
        placeholderTextColor={mode === 'dark' ? colors.muted : '#8795a1'}
        style={themed.detailInput}
        editable={!disabled}
      />
      <TouchableOpacity style={themed.saveDetailsButton} onPress={onSaveDetails} disabled={disabled}>
        {savingKey === `details-${key}` ? <ActivityIndicator size="small" color={mode === 'dark' ? colors.accent : '#2475cf'} /> : <Text style={themed.saveDetailsText}>Save notes</Text>}
      </TouchableOpacity>
      <ChecklistItemPhotos checklistId={checklistId} item={item} disabled={disabled} failedAsset={failedAsset} onFailedAssetChange={onFailedAssetChange} onBusyChange={onBusyChange} onChecklistUpdated={onChecklistUpdated} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#fbf7f4' },
  flex: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#102d43', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 16 },
  loadErrorTitle: { color: '#102d43', fontSize: 19, fontWeight: '900', marginTop: 10 },
  counterpartWarning: { borderWidth: 1, borderColor: '#e2b66f', borderRadius: 14, backgroundColor: '#fff6e6', padding: 12, marginBottom: 14 },
  counterpartWarningText: { color: '#7a4c12', fontSize: 13, lineHeight: 19 },
  counterpartRetryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 4 },
  counterpartRetryText: { color: '#9a5b0b', fontSize: 13, fontWeight: '900' },
  loadErrorText: { color: '#697887', textAlign: 'center', lineHeight: 20, marginTop: 5 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#2475cf', marginTop: 15 },
  retryText: { color: '#fff', fontWeight: '900' },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#dce4e8', paddingVertical: 18, marginBottom: 24 },
  progressValue: { color: '#102d43', fontSize: 23, fontWeight: '900' },
  progressLabel: { color: '#617180', fontSize: 12, marginBottom: 7 },
  progressTrack: { height: 7, borderRadius: 5, overflow: 'hidden', backgroundColor: '#dfe8e6' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#74c86b' },
  addRoomCard: { marginBottom: 30 },
  addRoomTitle: { color: '#102d43', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  addRoomRow: { flexDirection: 'row', gap: 8 },
  roomCard: { borderTopWidth: 1, borderTopColor: '#cfdcde' },
  roomTop: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 15 },
  roomIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  roomTitle: { color: '#102d43', fontSize: 17, fontWeight: '900' },
  roomProgress: { color: '#697887', fontSize: 12, marginTop: 2 },
  renameRow: { flexDirection: 'row', gap: 8, paddingBottom: 16, paddingTop: 4 },
  smallInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#d8e0e6', borderRadius: 12, backgroundColor: '#fff', color: '#102d43', paddingHorizontal: 12 },
  secondaryButton: { minWidth: 78, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#9cc4eb', borderRadius: 12, paddingHorizontal: 10 },
  secondaryText: { color: '#2475cf', fontSize: 12, fontWeight: '900' },
  noItems: { color: '#697887', paddingBottom: 16 },
  itemCard: { borderTopWidth: 1, borderTopColor: '#e2e7e9', paddingVertical: 20 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName: { color: '#20394d', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  itemDescription: { color: '#697887', fontSize: 12, marginTop: 2 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  conditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  condition: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d7e0e6', borderRadius: 11, backgroundColor: '#f8fafb', paddingHorizontal: 10 },
  conditionSelected: { backgroundColor: '#2f8f46', borderColor: '#2f8f46' },
  conditionText: { color: '#526775', fontSize: 11, fontWeight: '900' },
  conditionTextSelected: { color: '#fff' },
  savingText: { color: '#2475cf', fontSize: 11, marginTop: 6 },
  retryConditionButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryInline: { color: '#b75e10', fontSize: 12, fontWeight: '900', marginTop: 7 },
  detailInput: { minHeight: 44, borderWidth: 1, borderColor: '#dce3e8', borderRadius: 12, color: '#20394d', paddingHorizontal: 11, marginTop: 8, backgroundColor: '#fbfcfd' },
  multiline: { minHeight: 66, paddingTop: 10, textAlignVertical: 'top' },
  saveDetailsButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#eaf3ff', marginTop: 8 },
  saveDetailsText: { color: '#2475cf', fontSize: 12, fontWeight: '900' },
  addItemRow: { flexDirection: 'row', gap: 8, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#e2e7e9' },
  addButton: { width: 46, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#2475cf' },
  separator: { height: 30 },
});

const darkStyles = StyleSheet.create({
  ...styles,
  container: { ...styles.container, backgroundColor: '#101923' },
  center: { ...styles.center, backgroundColor: '#101923' },
  eyebrow: { ...styles.eyebrow, color: '#86dc9a' },
  title: { ...styles.title, color: '#f2f6fa' },
  subtitle: { ...styles.subtitle, color: '#b4c3d0' },
  loadErrorTitle: { ...styles.loadErrorTitle, color: '#f2f6fa' },
  loadErrorText: { ...styles.loadErrorText, color: '#b4c3d0' },
  counterpartWarning: { ...styles.counterpartWarning, backgroundColor: '#382d21', borderColor: '#8b6531' },
  counterpartWarningText: { ...styles.counterpartWarningText, color: '#f8d39b' },
  counterpartRetryText: { ...styles.counterpartRetryText, color: '#f0b669' },
  progressCard: { ...styles.progressCard, borderColor: '#35495b' },
  progressValue: { ...styles.progressValue, color: '#f2f6fa' },
  progressLabel: { ...styles.progressLabel, color: '#b4c3d0' },
  progressTrack: { ...styles.progressTrack, backgroundColor: '#35495b' },
  addRoomTitle: { ...styles.addRoomTitle, color: '#f2f6fa' },
  roomCard: { ...styles.roomCard, borderTopColor: '#35495b' },
  roomIcon: { ...styles.roomIcon, backgroundColor: '#25394b' },
  roomTitle: { ...styles.roomTitle, color: '#f2f6fa' },
  roomProgress: { ...styles.roomProgress, color: '#b4c3d0' },
  smallInput: { ...styles.smallInput, borderColor: '#35495b', backgroundColor: '#1b2937', color: '#f2f6fa' },
  secondaryButton: { ...styles.secondaryButton, borderColor: '#72b6ff' },
  secondaryText: { ...styles.secondaryText, color: '#72b6ff' },
  noItems: { ...styles.noItems, color: '#b4c3d0' },
  itemCard: { ...styles.itemCard, borderTopColor: '#35495b' },
  itemName: { ...styles.itemName, color: '#f2f6fa' },
  itemDescription: { ...styles.itemDescription, color: '#b4c3d0' },
  condition: { ...styles.condition, borderColor: '#35495b', backgroundColor: '#1b2937' },
  conditionText: { ...styles.conditionText, color: '#d9e6ef' },
  conditionTextSelected: { ...styles.conditionTextSelected, color: '#fff' },
  savingText: { ...styles.savingText, color: '#72b6ff' },
  retryInline: { ...styles.retryInline, color: '#f0b669' },
  detailInput: { ...styles.detailInput, borderColor: '#35495b', backgroundColor: '#1b2937', color: '#f2f6fa' },
  saveDetailsButton: { ...styles.saveDetailsButton, backgroundColor: '#25394b' },
  saveDetailsText: { ...styles.saveDetailsText, color: '#72b6ff' },
  addItemRow: { ...styles.addItemRow, borderTopColor: '#35495b' },
});
