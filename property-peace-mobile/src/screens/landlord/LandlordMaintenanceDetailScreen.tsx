import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, InputAccessoryView, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaintenanceAPI, { LocalMedia, MaintenanceAssigneeOption, MaintenanceAssignmentDirectorySource, MaintenanceAttachment, MaintenanceRequest, newIdempotencyKey } from '../../api/maintenanceAPI';
import { MaintenanceStackParamList } from '../../navigation/types';
import { currentCycleCompletionAttachmentIds, displayStatus, normalizeMaintenanceMediaFileName, validateMaintenanceMedia } from '../../features/maintenance/maintenanceModel';
import { useAppTheme } from '../../theme/AppTheme';

type Route = RouteProp<MaintenanceStackParamList, 'LandlordMaintenanceDetail'>;
const value = (item: any, key: string) => item?.[key] ?? item?.[key[0].toUpperCase() + key.slice(1)];
const list = (item: any, key: string): any[] => value(item, key) ?? [];
const date = (input?: string | null) => input ? new Date(input).toLocaleString() : 'Not set';
const number = (input: string) => input.trim() ? Number(input) : null;
const statusIs = (status: unknown, ...values: string[]) => values.includes(String(status).toLowerCase());
const workflowStatus = (kind: 'estimate' | 'order' | 'appointment' | 'completion', status: unknown) => {
  const names = {
    estimate: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Expired'],
    order: ['Draft', 'Issued', 'Accepted', 'In Progress', 'Completed', 'Cancelled'],
    appointment: ['Proposed', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No show'],
    completion: ['Submitted', 'Accepted', 'Disputed'],
  };
  const index = Number(status);
  return Number.isInteger(index) && index >= 1 && index <= names[kind].length ? names[kind][index - 1] : displayStatus(status as string | number);
};
const friendlyHomeName = (item: any, key: 'propertyName' | 'unitName', nestedKey: 'property' | 'unit') => String(value(item, key) ?? value(value(item, nestedKey), 'name') ?? '');
const MONEY_KEYBOARD_ACCESSORY_ID = 'maintenance-money-keyboard';

export default function LandlordMaintenanceDetailScreen() {
  const { mode, colors } = useAppTheme();
  const s = mode === 'dark' ? darkStyles : lightStyles;
  const { requestId, listItem } = useRoute<Route>().params;
  const [item, setItem] = useState<MaintenanceRequest>(listItem ?? {});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [openingEvidence, setOpeningEvidence] = useState(false);
  const [expanded, setExpanded] = useState('');
  const [assignmentOptions, setAssignmentOptions] = useState<MaintenanceAssigneeOption[]>([]);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryFailedSources, setDirectoryFailedSources] = useState<MaintenanceAssignmentDirectorySource[]>([]);
  const [assigneeType, setAssigneeType] = useState<'Self' | 'OrganizationMember' | 'Vendor'>('Self');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimateRequired, setEstimateRequired] = useState(true);
  const [scope, setScope] = useState('');
  const [amount, setAmount] = useState('');
  const [estimateRejectReason, setEstimateRejectReason] = useState('');
  const [appointmentCancelReason, setAppointmentCancelReason] = useState('');
  const [workOrderCancelReason, setWorkOrderCancelReason] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [staffCloseReason, setStaffCloseReason] = useState('');
  const [completionMedia, setCompletionMedia] = useState<LocalMedia[]>([]);
  const [uploadedCompletionAttachmentIds, setUploadedCompletionAttachmentIds] = useState<number[]>([]);
  const uploadedIdsRef = useRef<number[]>([]);
  const actionKeys = useRef<Record<string, string>>({});
  const keyFor = (action: string) => actionKeys.current[action] ?? (actionKeys.current[action] = newIdempotencyKey());
  const load = useCallback(async () => {
    try {
      setError('');
      const [detail, directory] = await Promise.all([
        MaintenanceAPI.getDetail(requestId),
        MaintenanceAPI.getAssignmentDirectory().then(data => ({ ...data, error: '' })).catch((e: any) => ({ options: [] as MaintenanceAssigneeOption[], failedSources: [] as MaintenanceAssignmentDirectorySource[], error: e?.detail || e?.message || 'Assignment directory could not be loaded.' })),
      ]);
      setItem({ ...listItem, ...detail });
      setAssignmentOptions(directory.options);
      setDirectoryFailedSources(directory.failedSources);
      setDirectoryError(directory.error);
      const ids = currentCycleCompletionAttachmentIds(detail);
      uploadedIdsRef.current = ids;
      setUploadedCompletionAttachmentIds(ids);
      const currentAssignment = value(detail, 'assignment');
      const currentType = String(value(currentAssignment, 'assignedToType') ?? '').toLowerCase();
      setAssigneeType(currentType === 'vendor' || currentType === '2' ? 'Vendor' : currentType === 'organizationmember' || currentType === '4' ? 'OrganizationMember' : 'Self');
      setAssigneeId(String(value(currentAssignment, currentType === 'vendor' || currentType === '2' ? 'vendorId' : 'assignedToUserId') ?? ''));
      setEstimateRequired(value(detail, 'estimateRequired') ?? value(currentAssignment, 'estimateRequired') ?? true);
      return true;
    } catch (e: any) {
      setError(e?.detail || e?.message || 'This request could not be loaded.');
      return false;
    } finally { setLoading(false); }
  }, [requestId, listItem]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));
  const reload = () => { setLoading(true); void load(); };
  const refreshDirectory = async () => {
    try {
      const directory = await MaintenanceAPI.getAssignmentDirectory();
      setAssignmentOptions(directory.options);
      setDirectoryFailedSources(directory.failedSources);
      setDirectoryError('');
    } catch (e: any) { setDirectoryError(e?.detail || e?.message || 'Assignment directory could not be loaded.'); }
  };

  const estimates = list(item, 'estimates');
  const workOrders = list(item, 'workOrders');
  const appointments = list(item, 'appointments');
  const completions = list(item, 'completions');
  const attachments = list(item, 'attachments');
  const activityEvents = value(item, 'activityEvents') ?? value(item, 'activities') ?? [];
  const assignment = value(item, 'assignment');
  const assigned = !!value(assignment, 'assignedToType') && !statusIs(value(assignment, 'assignedToType'), 'unassigned', '0');
  const requestStatus = value(item, 'status');
  const closed = statusIs(requestStatus, 'resolved', '4', 'cancelled', '8');
  const canAcknowledge = statusIs(requestStatus, 'reported', '0');
  const canAssign = !closed && !statusIs(requestStatus, 'inprogress', '3') && !workOrders.some(order => statusIs(value(order, 'status'), 'issued', '2', 'inprogress', '4')) && !completions.some(completion => statusIs(value(completion, 'status'), 'submitted', '1'));
  const canSubmitEstimate = assigned && !closed;
  const hasActiveWorkOrder = workOrders.some(order => statusIs(value(order, 'status'), 'issued', '2', 'inprogress', '4'));
  const canIssueWorkOrder = assigned && !closed && !hasActiveWorkOrder;
  const pendingCompletion = completions.some(completion => statusIs(value(completion, 'status'), 'submitted', '1'));
  const requiresEstimate = value(item, 'estimateRequired') ?? value(assignment, 'estimateRequired') ?? false;
  const confirmationDue = (completion: any) => {
    const time = Date.parse(String(value(completion, 'tenantConfirmationDueAtUtc') ?? ''));
    return Number.isFinite(time) && time <= Date.now();
  };
  const toggle = (key: string) => setExpanded(current => current === key ? '' : key);
  const run = async (action: string, operation: (key: string) => Promise<unknown>, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await operation(keyFor(action));
      delete actionKeys.current[action];
      setExpanded('');
      Alert.alert('Workflow updated', success);
      await load();
    } catch (e: any) { Alert.alert('Could not update workflow', e?.detail || e?.message || 'Refresh and retry. The same retry key will be reused.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const acknowledge = () => { if (canAcknowledge && !closed) void run('acknowledge', key => MaintenanceAPI.acknowledge(requestId, key), 'Request acknowledged.'); };
  const assignRequest = () => {
    if (!canAssign) return;
    const id = number(assigneeId);
    if (assigneeType !== 'Self' && (!id || !assignmentOptions.some(option => option.type === assigneeType && option.id === id))) return Alert.alert('Assignee required', `Choose an available ${assigneeType === 'Vendor' ? 'vendor' : 'team member'}.`);
    const command = { assignedToType: assigneeType, assignedToUserId: assigneeType === 'OrganizationMember' ? id : null, vendorId: assigneeType === 'Vendor' ? id : null, estimateRequired };
    const save = () => { void run(`assign-${JSON.stringify(command)}`, key => MaintenanceAPI.assignRequest(requestId, command, key), 'Assignment saved.'); };
    const previousType = String(value(assignment, 'assignedToType') ?? '').toLowerCase();
    const previousVendorId = value(assignment, 'vendorId');
    if (assigned && approvedEstimates.length && (assigneeType === 'Vendor' ? String(previousVendorId ?? '') !== String(id) : previousType === 'vendor' || previousType === '2')) {
      Alert.alert('Review approved estimates', 'Changing the vendor can make previously approved estimates unusable. A new estimate may need approval before work can be authorized.', [
        { text: 'Keep assignment', style: 'cancel' },
        { text: 'Change assignment', onPress: save },
      ]);
      return;
    }
    save();
  };
  const submitEstimate = () => {
    if (!canSubmitEstimate) return;
    const parsed = number(amount);
    if (parsed === null || !Number.isFinite(parsed) || parsed <= 0 || scope.trim().length < 3) return Alert.alert('Estimate incomplete', 'Enter a positive amount and a scope of at least 3 characters.');
    const command = { amount: parsed, currency: 'USD', scope: scope.trim(), validUntilUtc: null };
    void run(`estimate-${JSON.stringify(command)}`, key => MaintenanceAPI.submitEstimate(requestId, command, key), 'Estimate submitted.');
  };
  const approveEstimate = (estimate: any) => { if (!closed && statusIs(value(estimate, 'status'), 'submitted', '2')) void run(`approve-estimate-${value(estimate, 'id')}-${value(estimate, 'version')}`, key => MaintenanceAPI.approveEstimate(requestId, value(estimate, 'id'), value(estimate, 'version'), key), 'Estimate approved.'); };
  const rejectEstimate = (estimate: any) => {
    if (closed || !statusIs(value(estimate, 'status'), 'submitted', '2')) return;
    if (estimateRejectReason.trim().length < 5) return Alert.alert('Reason required', 'Enter a rejection reason of at least 5 characters.');
    void run(`reject-estimate-${value(estimate, 'id')}-${value(estimate, 'version')}-${estimateRejectReason.trim()}`, key => MaintenanceAPI.rejectEstimate(requestId, value(estimate, 'id'), value(estimate, 'version'), estimateRejectReason.trim(), key), 'Estimate rejected.');
  };
  const issueWorkOrder = (estimate?: any) => {
    if (!canIssueWorkOrder || (estimate && !statusIs(value(estimate, 'status'), 'approved', '3')) || (!estimate && requiresEstimate)) return;
    const workScope = (value(estimate, 'scope') || scope).trim();
    if (workScope.length < 3) return Alert.alert('Scope required', 'Enter the authorized work scope (at least 3 characters).');
    const authorizedAmount = estimate ? Number(value(estimate, 'amount')) : number(amount);
    if (authorizedAmount !== null && (!Number.isFinite(authorizedAmount) || authorizedAmount < 0)) return Alert.alert('Invalid amount', 'Enter a valid non-negative authorized amount.');
    const command = { estimateId: estimate ? value(estimate, 'id') as number : null, scope: workScope, authorizedAmount, dueAtUtc: null };
    void run(`work-order-${JSON.stringify(command)}`, key => MaintenanceAPI.issueWorkOrder(requestId, command, key), 'Work order issued.');
  };
  const startWork = (order: any) => { if (!closed && statusIs(value(order, 'status'), 'issued', '2')) void run(`start-work-${value(order, 'id')}-${value(order, 'version')}`, key => MaintenanceAPI.startWork(requestId, value(order, 'id'), value(order, 'version'), key), 'Work marked in progress.'); };
  const cancelWorkOrder = (order: any) => {
    if (closed || !statusIs(value(order, 'status'), 'issued', '2')) return;
    if (workOrderCancelReason.trim().length < 5) return Alert.alert('Cancellation reason required', 'Enter at least 5 characters.');
    void run(`cancel-work-order-${value(order, 'id')}-${value(order, 'version')}-${workOrderCancelReason.trim()}`, key => MaintenanceAPI.cancelWorkOrder(requestId, value(order, 'id'), value(order, 'version'), workOrderCancelReason.trim(), key), 'Work order cancelled.');
  };
  const cancelAppointment = (appointment: any) => {
    if (closed || !statusIs(value(appointment, 'status'), 'proposed', '1', 'confirmed', '2')) return;
    if (appointmentCancelReason.trim().length < 5) return Alert.alert('Cancellation reason required', 'Enter at least 5 characters.');
    void run(`cancel-appointment-${value(appointment, 'id')}-${value(appointment, 'version')}-${appointmentCancelReason.trim()}`, key => MaintenanceAPI.cancelAppointment(requestId, value(appointment, 'id'), value(appointment, 'version'), appointmentCancelReason.trim(), key), 'Appointment cancelled.');
  };
  const pickCompletionEvidence = async () => {
    if (busy || closed) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access in Settings to add completion evidence.');
      const evidenceCount = uploadedCompletionAttachmentIds.length + completionMedia.length;
      if (evidenceCount>=10) return Alert.alert('Evidence limit reached', 'Up to 10 photos or videos may be attached.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 10 - evidenceCount, videoMaxDuration: 60, quality: .8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled) return;
      const selected: LocalMedia[] = [];
      for (const asset of result.assets) {
        const type = asset.type === 'video' ? 'video' : 'image';
        const mimeType = asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg');
        const candidate: LocalMedia = { uri: asset.uri, fileName: normalizeMaintenanceMediaFileName(asset.fileName, mimeType), mimeType, fileSize: asset.fileSize, type, idempotencyKey: newIdempotencyKey() };
        const issue = validateMaintenanceMedia(candidate, evidenceCount + selected.length);
        if (issue) { Alert.alert('Evidence not added', issue); continue; }
        selected.push(candidate);
      }
      setCompletionMedia(old => [...old, ...selected]);
    } catch (e: any) { Alert.alert('Evidence unavailable', e?.message || 'Could not select evidence.'); }
  };
  const submitCompletion = async (order: any) => {
    if (closed || pendingCompletion || !statusIs(value(order, 'status'), 'inprogress', '4') || busyRef.current) return;
    if (resolutionNotes.trim().length < 5) return Alert.alert('Resolution notes required', 'Describe the completed repair in at least 5 characters.');
    const cost = number(finalCost);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return Alert.alert('Invalid final cost', 'Enter a valid non-negative final cost.');
    if (!completionMedia.length && !uploadedIdsRef.current.length) return Alert.alert('Completion evidence required', 'Add at least one validated photo or video of the completed repair.');
    busyRef.current = true; setBusy(true);
    try {
      const results = await Promise.allSettled(completionMedia.map(media => MaintenanceAPI.uploadAttachment(requestId, 'Completion', media)));
      const failed = completionMedia.filter((_, index) => results[index].status === 'rejected');
      const uploaded = results.filter((result): result is PromiseFulfilledResult<MaintenanceAttachment> => result.status === 'fulfilled').map(result => result.value.id);
      const ids = [...new Set([...uploadedIdsRef.current, ...uploaded])];
      uploadedIdsRef.current = ids; setUploadedCompletionAttachmentIds(ids); setCompletionMedia(failed);
      if (failed.length) throw new Error(`${failed.length} completion attachment${failed.length === 1 ? '' : 's'} failed. ${ids.length} uploaded attachment${ids.length === 1 ? ' is' : 's are'} saved; retry only the failed evidence before submitting completion.`);
      // Recover server-side current-cycle IDs as well as local upload results before final submission.
      const detail = await MaintenanceAPI.getDetail(requestId);
      const allUploadedIds = [...new Set([...currentCycleCompletionAttachmentIds(detail), ...ids])];
      uploadedIdsRef.current = allUploadedIds; setUploadedCompletionAttachmentIds(allUploadedIds);
      const command = { workOrderId: value(order, 'id') as number, resolutionNotes: resolutionNotes.trim(), completionEvidenceReference: `attachments:${allUploadedIds.join(',')}`, finalCost: cost };
      const action = `complete-${JSON.stringify(command)}`;
      await MaintenanceAPI.submitCompletion(requestId, command, keyFor(action));
      delete actionKeys.current[action];
      setCompletionMedia([]); setExpanded('');
      Alert.alert('Workflow updated', 'Completion submitted for tenant confirmation.');
      await load();
    } catch (e: any) { Alert.alert('Could not submit completion', e?.detail || e?.message || 'Retry with the same evidence. Previously uploaded evidence is retained.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const staffCloseCompletion = (completion: any) => {
    if (closed || !statusIs(value(completion, 'status'), 'submitted', '1') || !confirmationDue(completion)) return;
    if (staffCloseReason.trim().length < 5) return Alert.alert('Close reason required', 'Enter a staff close reason of at least 5 characters.');
    void run(`staff-close-${value(completion, 'id')}-${value(completion, 'version')}-${staffCloseReason.trim()}`, key => MaintenanceAPI.staffCloseCompletion(requestId, value(completion, 'id'), value(completion, 'version'), staffCloseReason.trim(), key), 'Completion closed by staff.');
  };
  const openEvidence = async (attachment: MaintenanceAttachment) => {
    let uri: string | undefined;
    setOpeningEvidence(true);
    try {
      uri = await MaintenanceAPI.downloadAttachment(requestId, attachment);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: attachment.contentType, dialogTitle: 'View or save maintenance evidence' });
      else Alert.alert('Evidence unavailable', 'Sharing is not available on this device.');
    } catch (e: any) { Alert.alert('Evidence unavailable', e?.detail || e?.message || 'The private file could not be opened.'); }
    finally { if (uri) await MaintenanceAPI.deleteDownloadedAttachment(uri).catch(() => undefined); setOpeningEvidence(false); }
  };

  const action = (key: string, label: string, form: React.ReactNode, prominent = false) => <View key={key}>
    <Action label={label} onPress={() => toggle(key)} disabled={busy} prominent={prominent} expanded={expanded === key} />
    {expanded === key ? <View style={s.form}>{form}</View> : null}
  </View>;
  const propertyName = friendlyHomeName(item, 'propertyName', 'property');
  const unitName = friendlyHomeName(item, 'unitName', 'unit');
  const homeDetails = [propertyName, unitName, value(item, 'location')].filter(Boolean).join(' · ');
  const approvedEstimates = estimates.filter(estimate => statusIs(value(estimate, 'status'), 'approved', '3'));
  const issuedOrders = workOrders.filter(order => statusIs(value(order, 'status'), 'issued', '2'));
  const inProgressOrders = workOrders.filter(order => statusIs(value(order, 'status'), 'inprogress', '4'));
  const actionableCompletions = completions.filter(completion => !closed && statusIs(value(completion, 'status'), 'submitted', '1') && confirmationDue(completion));
  const next = closed ? 'This request is closed.' : canAcknowledge ? 'Acknowledge the request to begin.' : !assigned ? 'Assign someone to handle the repair.' : pendingCompletion ? actionableCompletions.length ? 'The tenant deadline passed. Staff can close the completion with a reason.' : 'Waiting for tenant confirmation.' : inProgressOrders.length ? 'Submit repair completion with evidence.' : issuedOrders.length ? 'Start the issued work order.' : requiresEstimate && !approvedEstimates.length ? 'Review or submit an estimate.' : 'Issue a work order when ready.';

  return <SafeAreaView style={s.page} edges={['bottom']}>
    {loading ? <ActivityIndicator style={s.loading} color={mode === 'dark' ? colors.accent : '#0b5cab'} /> : error ?
      <View style={s.content}><Text style={s.error}>{error}</Text><Action label="Retry loading request" onPress={reload} /></View> :
      <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          <Text style={s.title}>{value(item, 'title') || 'Maintenance request'}</Text>
          {homeDetails ? <Text style={s.meta}>{homeDetails}</Text> : null}
          <Text style={s.statusLabel}>CURRENT STATUS</Text><Text style={s.status}>{statusIs(requestStatus, 'awaitingtenant', '5') ? 'Awaiting tenant confirmation' : displayStatus(requestStatus)}</Text>
          {value(item, 'description') ? <Text style={s.body}>{value(item, 'description')}</Text> : null}
          <Section title="Next step"><Text style={s.body}>{next}</Text>
            {canAcknowledge && !closed ? <Action label="Acknowledge request" onPress={acknowledge} disabled={busy} prominent /> : null}
            {!closed && !canAcknowledge && !assigned && canAssign ? action('assign', 'Assign repair', AssignmentForm(), true) : null}
            {!closed && !canAcknowledge && assigned && !pendingCompletion && inProgressOrders.map(order => action(`complete-${value(order, 'id')}`, 'Submit completion', CompletionForm(order), true))}
            {!closed && !canAcknowledge && assigned && !pendingCompletion && !inProgressOrders.length && issuedOrders.map(order => <Action key={value(order, 'id')} label="Start work order" onPress={() => startWork(order)} disabled={busy} prominent />)}
            {!closed && !canAcknowledge && assigned && !pendingCompletion && !hasActiveWorkOrder && requiresEstimate && !approvedEstimates.length ? action('estimate', 'Submit estimate', EstimateForm(), true) : null}
            {!closed && !canAcknowledge && assigned && !pendingCompletion && canIssueWorkOrder && approvedEstimates.length ? approvedEstimates.map(estimate => action(`issue-${value(estimate, 'id')}`, `Issue work order from approved estimate · $${Number(value(estimate, 'amount')).toFixed(2)}`, WorkOrderForm(estimate), true)) : null}
            {!closed && !canAcknowledge && assigned && !pendingCompletion && canIssueWorkOrder && !requiresEstimate && !approvedEstimates.length ? action('direct-order', 'Issue work order without estimate', WorkOrderForm(), true) : null}
            {actionableCompletions.map(completion => action(`close-${value(completion, 'id')}`, 'Close completion after tenant deadline', CloseForm(completion), true))}
          </Section>
          {canAssign && (assigned || canAcknowledge) ? <Section title="Assignment">
            {assignment ? <Text style={s.body}>{value(assignment, 'assignedToName') || value(assignment, 'assigneeName') || displayStatus(value(assignment, 'assignedToType'))}</Text> : null}
            {action('assign', assigned ? 'Change assignment' : 'Assign repair', AssignmentForm())}
          </Section> : assignment ? <Section title="Assignment"><Text style={s.body}>{value(assignment, 'assignedToName') || value(assignment, 'assigneeName') || displayStatus(value(assignment, 'assignedToType'))}</Text></Section> : null}
          {(estimates.length || (canSubmitEstimate && !canAcknowledge)) ? <Section title="Estimates">
            {approvedEstimates.length ? <Text style={s.muted}>After changing vendors, a previous approval may no longer authorize work. If issuing is rejected, submit and approve a new estimate for the current assignee.</Text> : null}
            {estimates.map((estimate: any) => <View key={value(estimate, 'id')} style={s.record}>
              <Text style={s.recordTitle}>${Number(value(estimate, 'amount')).toFixed(2)} · {workflowStatus('estimate', value(estimate, 'status'))}</Text>
              <Text style={s.muted}>{value(estimate, 'scope')}</Text>
              {!closed && statusIs(value(estimate, 'status'), 'submitted', '2') ? <>
                <Action label="Approve estimate" onPress={() => approveEstimate(estimate)} disabled={busy} />
                {action(`reject-${value(estimate, 'id')}`, 'Reject estimate', <><Field placeholder="Reason for rejection" value={estimateRejectReason} onChangeText={setEstimateRejectReason} multiline /><Action label="Confirm rejection" onPress={() => rejectEstimate(estimate)} disabled={busy} prominent /></>)}
              </> : null}
              {!closed && canIssueWorkOrder && !pendingCompletion && statusIs(value(estimate, 'status'), 'approved', '3') ? action(`issue-${value(estimate, 'id')}`, 'Issue work order from this estimate', WorkOrderForm(estimate)) : null}
            </View>)}
            {canSubmitEstimate && !canAcknowledge && !pendingCompletion ? action('estimate', 'Submit an estimate', EstimateForm()) : null}
            {canIssueWorkOrder && !canAcknowledge && !pendingCompletion && !requiresEstimate ? action('direct-order', 'Issue work order without estimate', WorkOrderForm()) : null}
          </Section> : null}
          {workOrders.length ? <Section title="Work orders">{workOrders.map((order: any) => <View key={value(order, 'id')} style={s.record}>
            <Text style={s.recordTitle}>Work order · {workflowStatus('order', value(order, 'status'))}</Text>
            <Text style={s.muted}>{value(order, 'scope')} · Due {date(value(order, 'dueAtUtc'))}</Text>
            {!closed && statusIs(value(order, 'status'), 'issued', '2') ? <>
              <Action label="Start work order" onPress={() => startWork(order)} disabled={busy} />
              {action(`cancel-work-${value(order, 'id')}`, 'Cancel work order', <><Field placeholder="Cancellation reason" value={workOrderCancelReason} onChangeText={setWorkOrderCancelReason} multiline /><Action label="Confirm cancellation" onPress={() => cancelWorkOrder(order)} disabled={busy} prominent /></>)}
            </> : null}
            {!closed && !pendingCompletion && statusIs(value(order, 'status'), 'inprogress', '4') ? action(`complete-${value(order, 'id')}`, 'Submit completion', CompletionForm(order)) : null}
          </View>)}</Section> : null}
          {appointments.length ? <Section title="Appointments"><Text style={s.muted}>Scheduling is unavailable in this app version. Appointments can be reviewed and cancelled here.</Text>{appointments.map((appointment: any) => <View key={value(appointment, 'id')} style={s.record}>
            <Text style={s.recordTitle}>Appointment · {workflowStatus('appointment', value(appointment, 'status'))}</Text>
            <Text style={s.muted}>{date(value(appointment, 'startsAtUtc'))} – {date(value(appointment, 'endsAtUtc'))}</Text>
            {!closed && statusIs(value(appointment, 'status'), 'proposed', '1', 'confirmed', '2') ? action(`cancel-appointment-${value(appointment, 'id')}`, 'Cancel appointment', <><Field placeholder="Cancellation reason" value={appointmentCancelReason} onChangeText={setAppointmentCancelReason} multiline /><Action label="Confirm cancellation" onPress={() => cancelAppointment(appointment)} disabled={busy} prominent /></>) : null}
          </View>)}</Section> : null}
          {completions.length ? <Section title="Completion">{completions.map((completion: any) => <View key={value(completion, 'id')} style={s.record}>
            <Text style={s.recordTitle}>Completion · {workflowStatus('completion', value(completion, 'status'))}</Text>
            <Text style={s.muted}>{value(completion, 'resolutionNotes')} · Tenant response due {date(value(completion, 'tenantConfirmationDueAtUtc'))}</Text>
            {!closed && statusIs(value(completion, 'status'), 'submitted', '1') && confirmationDue(completion) ? action(`close-${value(completion, 'id')}`, 'Close completion after tenant deadline', CloseForm(completion)) : null}
          </View>)}</Section> : null}
          <Section title="Evidence">{attachments.length ? attachments.map((attachment: MaintenanceAttachment) => <View key={attachment.id} style={s.record}>
            <Text style={s.recordTitle}>{attachment.fileName}</Text><Text style={s.muted}>{attachment.contentType} · {(attachment.sizeBytes / 1024 / 1024).toFixed(1)} MB</Text>
            <Action label="View or save private evidence" onPress={() => void openEvidence(attachment)} disabled={openingEvidence} />
          </View>) : <Text style={s.muted}>No evidence attached.</Text>}</Section>
          <Section title="Timeline">{activityEvents.length ? activityEvents.map((event: any, index: number) => <View key={event.id ?? index} style={s.record}>
            <Text style={s.recordTitle}>{event.summary || event.title || event.eventType || 'Workflow update'}</Text><Text style={s.muted}>{date(event.occurredAtUtc || event.createdAt)}</Text>
          </View>) : <Text style={s.muted}>No workflow events yet.</Text>}</Section>
        </ScrollView>
        {Platform.OS === 'ios' ? <InputAccessoryView nativeID={MONEY_KEYBOARD_ACCESSORY_ID}><View style={s.keyboardAccessory}><TouchableOpacity accessibilityRole="button" onPress={Keyboard.dismiss}><Text style={s.link}>Done</Text></TouchableOpacity></View></InputAccessoryView> : null}
      </KeyboardAvoidingView>}
  </SafeAreaView>;

  function AssignmentForm() { return <>
    <View style={s.row}>{(['Self', 'OrganizationMember', 'Vendor'] as const).map(type => <Action key={type} label={type === 'OrganizationMember' ? 'Team member' : type} onPress={() => { setAssigneeType(type); setAssigneeId(''); }} selected={assigneeType === type} disabled={busy} />)}</View>
    {assigneeType !== 'Self' ? <>
      {directoryFailedSources.length ? <Text style={s.error}>Some assignment options could not be loaded ({directoryFailedSources.map(source => source === 'members' ? 'team members' : 'vendors').join(' and ')}). Options shown are partial, not an authoritative empty directory.</Text> : null}
      {directoryError ? <Text style={s.error}>{directoryError}</Text> : null}
      {directoryFailedSources.length || directoryError ? <Action label="Retry assignment directory" onPress={() => void refreshDirectory()} disabled={busy} /> : null}
      {assignmentOptions.filter(option => option.type === assigneeType).map(option => <TouchableOpacity key={`${option.type}-${option.id}`} accessibilityRole="radio" accessibilityState={{ selected: assigneeId === String(option.id) }} style={s.choice} onPress={() => setAssigneeId(String(option.id))} disabled={busy}><Text style={s.recordTitle}>{assigneeId === String(option.id) ? '● ' : '○ '}{option.label}</Text>{option.detail ? <Text style={s.muted}>{option.detail}</Text> : null}</TouchableOpacity>)}
      {!directoryError && !directoryFailedSources.includes(assigneeType === 'Vendor' ? 'vendors' : 'members') && !assignmentOptions.some(option => option.type === assigneeType) ? <Text style={s.muted}>No eligible {assigneeType === 'Vendor' ? 'vendors' : 'team members'} are available.</Text> : null}
    </> : null}
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: estimateRequired }} onPress={() => setEstimateRequired(v => !v)} style={s.choice} disabled={busy}><Text style={s.recordTitle}>{estimateRequired ? '☑' : '☐'} Estimate required before work order</Text></TouchableOpacity>
    <Action label="Save assignment" onPress={assignRequest} disabled={busy} prominent />
  </>; }
  function EstimateForm() { return <><Field placeholder="Scope of work" value={scope} onChangeText={setScope} multiline /><Field placeholder="Amount (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputAccessoryViewID={MONEY_KEYBOARD_ACCESSORY_ID} /><Action label="Submit estimate" onPress={submitEstimate} disabled={busy} prominent /></>; }
  function WorkOrderForm(estimate?: any) { return <><Text style={s.muted}>{estimate ? 'Authorization uses the approved estimate amount.' : 'No estimate will be attached to this work order.'}</Text><Field placeholder="Authorized work scope" value={estimate ? String(value(estimate, 'scope') ?? '') : scope} onChangeText={setScope} editable={!estimate} multiline />{!estimate ? <Field placeholder="Authorized amount (optional, USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputAccessoryViewID={MONEY_KEYBOARD_ACCESSORY_ID} /> : null}<Action label="Issue work order" onPress={() => issueWorkOrder(estimate)} disabled={busy} prominent /></>; }
  function CompletionForm(order: any) { return <><Field placeholder="Completed repair notes" value={resolutionNotes} onChangeText={setResolutionNotes} multiline /><Field placeholder="Final cost (optional, USD)" value={finalCost} onChangeText={setFinalCost} keyboardType="decimal-pad" inputAccessoryViewID={MONEY_KEYBOARD_ACCESSORY_ID} />
    <Action label={`Add completion photo or video (${uploadedCompletionAttachmentIds.length + completionMedia.length}/10)`} onPress={() => void pickCompletionEvidence()} disabled={busy || uploadedCompletionAttachmentIds.length + completionMedia.length >= 10} />
    {uploadedCompletionAttachmentIds.length ? <Text style={s.muted}>{uploadedCompletionAttachmentIds.length} current-cycle completion attachment{uploadedCompletionAttachmentIds.length === 1 ? ' is' : 's are'} already uploaded and restored from this request.</Text> : null}
    {completionMedia.map(media => <View key={media.idempotencyKey} style={s.choice}><Text style={s.muted}>{media.fileName}</Text><Action label="Remove" onPress={() => setCompletionMedia(old => old.filter(entry => entry.idempotencyKey !== media.idempotencyKey))} disabled={busy} /></View>)}
    <Action label="Submit completion for tenant confirmation" onPress={() => void submitCompletion(order)} disabled={busy} prominent />
  </>; }
  function CloseForm(completion: any) { return <><Text style={s.muted}>The tenant confirmation deadline has passed. Give a reason for staff closure.</Text><Field placeholder="Staff close reason" value={staffCloseReason} onChangeText={setStaffCloseReason} multiline /><Action label="Confirm staff close" onPress={() => staffCloseCompletion(completion)} disabled={busy} prominent /></>; }
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { mode } = useAppTheme();
  const s = mode === 'dark' ? darkStyles : lightStyles;
  return <View style={s.sectionWrap}><Text style={s.section}>{title}</Text>{children}</View>;
};
const Field = (props: React.ComponentProps<typeof TextInput>) => {
  const { mode, colors } = useAppTheme();
  const s = mode === 'dark' ? darkStyles : lightStyles;
  return <TextInput {...props} style={[s.input, props.multiline && s.area]} placeholderTextColor={mode === 'dark' ? colors.muted : '#83919a'} textAlignVertical={props.multiline ? 'top' : 'center'} />;
};
const Action = ({ label, onPress, disabled, prominent, expanded, selected }: { label: string; onPress: () => void; disabled?: boolean; prominent?: boolean; expanded?: boolean; selected?: boolean }) => {
  const { mode } = useAppTheme();
  const s = mode === 'dark' ? darkStyles : lightStyles;
  return <TouchableOpacity accessibilityRole={selected === undefined ? 'button' : 'radio'} accessibilityState={{ disabled: !!disabled, expanded, selected }} onPress={onPress} disabled={disabled} style={[s.action, prominent && s.primary, selected && s.selectedAction, disabled && s.disabled]}><Text style={[s.link, (prominent || selected) && s.primaryText]}>{label}{expanded === undefined ? '' : expanded ? '  −' : '  +'}</Text></TouchableOpacity>;
};
const lightStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f3ee' }, content: { padding: 18, paddingBottom: 55 }, loading: { marginTop: 60 },
  link: { color: '#0b5cab', fontWeight: '900' }, eyebrow: { color: '#74848d', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 16 },
  title: { color: '#102d43', fontSize: 26, fontWeight: '900', marginTop: 4 }, statusLabel: { color: '#74848d', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 22 }, status: { color: '#0b5cab', fontSize: 20, fontWeight: '900', marginTop: 3 },
  body: { color: '#526874', lineHeight: 21, marginTop: 12 }, meta: { color: '#74848d', marginTop: 7 }, sectionWrap: { borderTopWidth: 1, borderColor: '#d3dde2', paddingTop: 18, marginTop: 24 }, section: { color: '#102d43', fontSize: 19, fontWeight: '900', marginBottom: 12 },
  record: { borderBottomWidth: 1, borderColor: '#e2e8eb', paddingVertical: 12 }, recordTitle: { color: '#19384c', fontWeight: '800' }, muted: { color: '#74848d', fontSize: 12, lineHeight: 18, marginTop: 5 },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4, marginTop: 5 }, primary: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: '#0b5cab', marginTop: 12, paddingHorizontal: 14 }, selectedAction: { backgroundColor: '#0b5cab', borderRadius: 6, paddingHorizontal: 14 }, primaryText: { color: '#fff' }, disabled: { opacity: .45 },
  form: { borderLeftWidth: 2, borderColor: '#bdcbd3', marginTop: 10, paddingLeft: 12, paddingBottom: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, choice: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8eb' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#bdcbd3', minHeight: 46, paddingHorizontal: 11, marginTop: 8, color: '#19384c' }, area: { minHeight: 76, paddingTop: 11 }, error: { color: '#a92338', lineHeight: 21, marginVertical: 10 }, keyboardAccessory: { padding: 12, alignItems: 'flex-end', backgroundColor: '#f7f3ee' },
});

const darkStyles = StyleSheet.create({
  ...lightStyles,
  page: { ...lightStyles.page, backgroundColor: '#101923' },
  link: { ...lightStyles.link, color: '#72b6ff' },
  eyebrow: { ...lightStyles.eyebrow, color: '#b4c3d0' },
  title: { ...lightStyles.title, color: '#f2f6fa' },
  statusLabel: { ...lightStyles.statusLabel, color: '#b4c3d0' },
  status: { ...lightStyles.status, color: '#72b6ff' },
  body: { ...lightStyles.body, color: '#dbe5ee' },
  meta: { ...lightStyles.meta, color: '#b4c3d0' },
  sectionWrap: { ...lightStyles.sectionWrap, borderColor: '#35495b' },
  section: { ...lightStyles.section, color: '#f2f6fa' },
  record: { ...lightStyles.record, borderColor: '#35495b' },
  recordTitle: { ...lightStyles.recordTitle, color: '#f2f6fa' },
  muted: { ...lightStyles.muted, color: '#b4c3d0' },
  primary: { ...lightStyles.primary, backgroundColor: '#2475cf' },
  selectedAction: { ...lightStyles.selectedAction, backgroundColor: '#2475cf' },
  form: { ...lightStyles.form, borderColor: '#51697e' },
  choice: { ...lightStyles.choice, borderColor: '#35495b' },
  input: { ...lightStyles.input, backgroundColor: '#1b2937', borderColor: '#51697e', color: '#f2f6fa' },
  error: { ...lightStyles.error, color: '#ff9e98' },
  keyboardAccessory: { ...lightStyles.keyboardAccessory, backgroundColor: '#1b2937' },
});
