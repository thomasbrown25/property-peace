import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChecklistAPI from '../../api/checklistAPI';
import {
  conditionReportAction,
  getTransitionChecklistProgress,
  type LeaseTransitionChecklist,
  type LeaseTransitionItemStatus,
} from '../../features/checklists/leaseTransitionChecklistModel';
import type { Checklist } from '../../features/checklists/checklistTypes';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';
import { useAppTheme } from '../../theme/AppTheme';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'LeaseTransitionChecklist'>;

const errorMessage = (error: any) => error?.message || error?.Message || 'Please try again.';

export default function LeaseTransitionChecklistScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const [checklist, setChecklist] = useState<LeaseTransitionChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [reportCandidates, setReportCandidates] = useState<Checklist[]>([]);
  const [reportError, setReportError] = useState('');
  const [loadingReports, setLoadingReports] = useState(false);
  const [showReportPicker, setShowReportPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await ChecklistAPI.getTransitionChecklistById(route.params.transitionChecklistId);
      setChecklist(loaded);
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [route.params.transitionChecklistId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateItem = async (key: string, status: LeaseTransitionItemStatus) => {
    if (!checklist?.id) return;
    setSavingKey(key);
    try {
      setChecklist(await ChecklistAPI.updateTransitionItem(checklist.id, { key, status }));
    } catch (saveError) {
      Alert.alert('Could not save task', errorMessage(saveError));
    } finally {
      setSavingKey('');
    }
  };

  const loadReportCandidates = async () => {
    if (!checklist?.id) return;
    setLoadingReports(true);
    setReportError('');
    try {
      const candidates = await ChecklistAPI.getConditionReports({ propertyId: checklist.propertyId, unitId: checklist.unitId ?? undefined });
      setReportCandidates(candidates.filter((report) => !checklist.leaseId || !report.leaseId || String(checklist.leaseId) === String(report.leaseId)));
    } catch (cause) {
      setReportError(errorMessage(cause));
    } finally {
      setLoadingReports(false);
    }
  };

  const startOrOpenReport = () => {
    if (!checklist?.id) return;
    const action = conditionReportAction(checklist);
    if (action.reportId) {
      navigation.navigate('ChecklistEditor', { ...route.params, checklistId: action.reportId });
      return;
    }
    setShowReportPicker(true);
    loadReportCandidates();
  };

  const createAndOpenReport = async () => {
    if (!checklist?.id) return;
    setSavingKey('condition-report');
    try {
      const linked = await ChecklistAPI.linkConditionReport(checklist.id);
      setChecklist(linked);
      const reportId = linked.conditionReport?.id;
      if (reportId != null) {
        navigation.navigate('ChecklistEditor', { ...route.params, checklistId: String(reportId) });
        return;
      }
      throw new Error('The server did not return the linked condition report.');
    } catch (reportError) {
      Alert.alert('Could not start condition report', errorMessage(reportError));
    } finally {
      setSavingKey('');
    }
  };

  const attachExistingReport = async (reportId: string) => {
    if (!checklist?.id) return;
    setSavingKey('condition-report');
    try {
      const linked = await ChecklistAPI.linkConditionReport(checklist.id, reportId);
      setChecklist(linked);
      setShowReportPicker(false);
      navigation.navigate('ChecklistEditor', { ...route.params, checklistId: reportId });
    } catch (reportError) {
      Alert.alert('Could not attach condition report', errorMessage(reportError));
    } finally {
      setSavingKey('');
    }
  };

  const detachReport = () => {
    if (!checklist?.id) return;
    Alert.alert('Detach condition report?', 'The report will remain in your condition report history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Detach',
        style: 'destructive',
        onPress: async () => {
          setSavingKey('condition-report');
          try {
            setChecklist(await ChecklistAPI.detachConditionReport(checklist.id!));
          } catch (detachError) {
            Alert.alert('Could not detach report', errorMessage(detachError));
          } finally {
            setSavingKey('');
          }
        },
      },
    ]);
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} /></View>;
  if (!checklist) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.text }]}>{error || 'Checklist unavailable.'}</Text><TouchableOpacity onPress={load}><Text style={[styles.link, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View>;

  const progress = getTransitionChecklistProgress(checklist);
  const reportAction = conditionReportAction(checklist);
  const phaseLabel = checklist.phase === 'moveIn' ? 'MOVE-IN HANDOFF' : 'MOVE-OUT HANDOFF';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{phaseLabel}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{route.params.propertyName}</Text>
      {!!route.params.unitName && <Text style={[styles.unit, { color: colors.accent }]}>{route.params.unitName}</Text>}
      <Text style={[styles.description, { color: colors.muted }]}>Keep the handoff records together. The condition report stores room-by-room notes and photos.</Text>
      <View style={[styles.progressBlock, { borderColor: colors.border }]}>
        <Text style={[styles.progressText, { color: colors.text }]}>{progress.done} of {progress.total} complete</Text>
        <Text style={[styles.percent, { color: colors.accent }]}>{progress.percent}%</Text>
      </View>
      {checklist.items.map((item) => {
        const reportTask = item.key === 'condition-report';
        const done = reportTask ? Boolean(checklist.conditionReport?.isCompleted) : item.status !== 'pending';
        return <View key={item.key} style={[styles.item, { borderColor: colors.border }]}>
          <TouchableOpacity disabled={reportTask || Boolean(savingKey)} onPress={() => updateItem(item.key, done ? 'pending' : 'done')} style={styles.itemRow} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled: reportTask }}>
            <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? colors.accent : colors.muted} />
            <Text style={[styles.itemLabel, { color: colors.text }]}>{item.label}</Text>
          </TouchableOpacity>
          {reportTask ? (
            <TouchableOpacity onPress={startOrOpenReport} disabled={Boolean(savingKey)} style={[styles.reportButton, { borderColor: colors.accent }]}>
              {savingKey === item.key ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.reportButtonText, { color: colors.accent }]}>{reportAction.label}</Text>}
            </TouchableOpacity>
          ) : item.allowNotApplicable ? (
            <TouchableOpacity onPress={() => updateItem(item.key, item.status === 'notApplicable' ? 'pending' : 'notApplicable')} disabled={Boolean(savingKey)}>
              <Text style={[styles.notApplicable, { color: colors.muted }]}>{done && item.status === 'notApplicable' ? 'Marked not applicable' : 'Mark not applicable'}</Text>
            </TouchableOpacity>
          ) : null}
          {reportTask && reportAction.reportId ? (
            <TouchableOpacity onPress={detachReport} disabled={Boolean(savingKey)}>
              <Text style={[styles.notApplicable, { color: colors.muted }]}>Detach report</Text>
            </TouchableOpacity>
          ) : null}
          {reportTask && showReportPicker && !reportAction.reportId ? (
            <View style={[styles.reportPicker, { borderColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Use an existing condition record or start a new report</Text>
              <TouchableOpacity onPress={createAndOpenReport} disabled={Boolean(savingKey)}>
                <Text style={[styles.pickerAction, { color: colors.accent }]}>Start new condition report</Text>
              </TouchableOpacity>
              {loadingReports && <ActivityIndicator color={colors.accent} />}
              {!!reportError && <TouchableOpacity onPress={loadReportCandidates} accessibilityRole="button"><Text style={[styles.pickerAction, { color: colors.accent }]}>{reportError} Tap to retry.</Text></TouchableOpacity>}
              {reportCandidates.map((report) => report.id != null && (
                <TouchableOpacity key={String(report.id)} onPress={() => attachExistingReport(String(report.id))} disabled={Boolean(savingKey)}>
                  <Text style={[styles.pickerAction, { color: colors.accent }]}>Use {report.title || 'condition record'}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowReportPicker(false)} disabled={Boolean(savingKey)}>
                <Text style={[styles.notApplicable, { color: colors.muted, marginLeft: 0 }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>;
      })}
      {!!error && <Text style={[styles.saveError, { color: '#b93832' }]}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 4 },
  unit: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 18 },
  progressBlock: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 14, marginBottom: 4 },
  progressText: { fontSize: 14, fontWeight: '800' },
  percent: { fontSize: 14, fontWeight: '900' },
  item: { borderBottomWidth: 1, paddingVertical: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  itemLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  reportButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderRadius: 10, marginTop: 11 },
  reportButtonText: { fontSize: 13, fontWeight: '900' },
  reportPicker: { marginTop: 10, borderTopWidth: 1, paddingTop: 10, gap: 9 },
  pickerTitle: { fontSize: 13, fontWeight: '800' },
  pickerAction: { fontSize: 13, fontWeight: '900' },
  notApplicable: { fontSize: 12, fontWeight: '700', marginLeft: 35, marginTop: 9 },
  error: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
  link: { fontWeight: '900', fontSize: 14 },
  saveError: { fontSize: 13, marginTop: 16 },
});
