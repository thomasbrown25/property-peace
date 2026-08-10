import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeftOutlined, CheckCircleOutlined, ReloadOutlined, SafetyCertificateOutlined, ToolOutlined, UploadOutlined } from '@ant-design/icons';
import ConversationTimelinePanel from 'components/conversation/ConversationTimelinePanel';
import { maintenanceWorkflowAPI, maintenanceProblemMessage } from 'api/maintenanceWorkflow';
import MaintenanceEvidenceList from 'components/maintenance/MaintenanceEvidenceList';
import {
  availableMaintenanceActions, createEvidenceUploadEntries, currentCycleTroubleshootingSteps, evidenceSelection, MAINTENANCE_EVIDENCE_TYPES, safeTroubleshootingStep,
  slaState, statusLabel, tenantEvidencePurpose, uploadPendingEvidence, workflowActivitiesFromMaintenanceDetail, workflowFromMaintenanceDetail
} from 'utils/maintenanceWorkflow';

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not set';
const categoryFrom = (request) => String(request?.title || '').includes(':') ? request.title.split(':')[0] : 'General repair';

export default function TenantMaintenanceDetail({ maintenanceId, onBack }) {
  const [request, setRequest] = useState(null); const [attachments, setAttachments] = useState([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [warning, setWarning] = useState(''); const [busy, setBusy] = useState(''); const [reason, setReason] = useState(''); const [lastAction, setLastAction] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const detail = await maintenanceWorkflowAPI.get(maintenanceId); setRequest(detail); setWarning('');
      try { const files = await maintenanceWorkflowAPI.attachments(maintenanceId); setAttachments(Array.isArray(files) ? files : []); }
      catch (attachmentError) { setAttachments(Array.isArray(detail.attachments) ? detail.attachments : []); setWarning(maintenanceProblemMessage(attachmentError, 'Evidence could not be refreshed. Previously loaded evidence is shown.')); }
    }
    catch (requestError) { setError(maintenanceProblemMessage(requestError, 'Maintenance request could not be loaded.')); }
    finally { setLoading(false); }
  }, [maintenanceId]);
  useEffect(() => { load(); }, [load]);

  const workflow = useMemo(() => workflowFromMaintenanceDetail(request), [request]);
  const actions = availableMaintenanceActions({ role: 'tenant', request, workflow }); const category = categoryFrom(request);
  const run = async (key, operation, success) => { setBusy(key); setError(''); try { await operation(); setLastAction(success); setReason(''); await load(); } catch (requestError) { setError(maintenanceProblemMessage(requestError)); } finally { setBusy(''); } };
  const troubleshoot = async () => {
    const code = safeTroubleshootingStep(category); if (!code) return;
    const count = currentCycleTroubleshootingSteps(request).length;
    await run('troubleshoot', () => maintenanceWorkflowAPI.troubleshoot(maintenanceId, { resolutionCycleKey: String(request.resolutionCycle), stepKey: `${code}-${count + 1}`, stepCode: code, isWorsening: false, hasNewEmergency: false }), 'A safe troubleshooting step was added. Stop immediately if conditions worsen.');
  };
  const selectEvidence = (event) => {
    const selection = evidenceSelection(evidenceFiles.map((entry) => entry.file), event.target.files);
    if (selection.errors.length) setError(selection.errors.join(' '));
    else { setError(''); setEvidenceFiles((current) => [...current, ...createEvidenceUploadEntries(selection.accepted)]); }
    event.target.value = '';
  };
  const uploadEvidence = async () => {
    const purpose = tenantEvidencePurpose(request); if (!purpose) return;
    setBusy('upload'); setError('');
    const uploaded = await uploadPendingEvidence(evidenceFiles, (file, key) => maintenanceWorkflowAPI.uploadAttachment(maintenanceId, purpose, file, key));
    setEvidenceFiles(uploaded);
    const failures = uploaded.filter((entry) => entry.status === 'failed');
    if (failures.length) setError(`Evidence failed to upload: ${failures.map((entry) => entry.file.name).join(', ')}. Retry uploads only the failed files.`);
    else { setEvidenceFiles([]); setLastAction('Evidence uploaded.'); await load(); }
    setBusy('');
  };

  if (loading && !request) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!request) return <Stack spacing={2}><Button startIcon={<ArrowLeftOutlined />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>Back</Button><Alert severity="error">{error || 'Maintenance request not found.'}</Alert></Stack>;
  const ack = slaState(request.acknowledgeByUtc); const action = slaState(request.actionByUtc);
  const isEmergency = String(request.urgency).toLowerCase() === 'emergency'; const troubleshootingSteps = currentCycleTroubleshootingSteps(request); const canTroubleshoot = !isEmergency && !request.stopTroubleshooting && safeTroubleshootingStep(category) && troubleshootingSteps.length < 3;
  const evidencePurpose = tenantEvidencePurpose(request);

  return <Box sx={{ pb: 6 }}>
    <Button startIcon={<ArrowLeftOutlined />} onClick={onBack} sx={{ mb: 1.5 }}>All maintenance</Button>
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: '#061e35', color: '#fff' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}><Box><Typography variant="caption" sx={{ color: '#65d6c4', fontWeight: 800 }}>MR-{request.id} · {category}</Typography><Typography variant="h3" color="inherit" fontWeight={800} sx={{ mt: .5 }}>{request.title}</Typography><Typography sx={{ mt: .75, opacity: .75 }}>{request.location || 'Location not provided'}</Typography></Box><Stack direction="row" spacing={1} alignItems="flex-start"><Chip label={request.urgency || 'Routine'} color={isEmergency ? 'error' : String(request.urgency).toLowerCase() === 'urgent' ? 'warning' : 'success'} /><Chip label={statusLabel(request.status)} sx={{ bgcolor: '#fff', color: '#061e35' }} /></Stack></Stack></Paper>
    {isEmergency && <Alert severity="error" variant="filled" sx={{ mt: 2 }}><b>Emergency request:</b> Move away from danger and call 911 for a threat to life, fire, carbon monoxide, or sparking. For gas odor, leave and call the gas emergency line from outside. The maintenance workflow does not replace emergency services.</Alert>}
    {lastAction && <Alert severity="success" onClose={() => setLastAction('')} sx={{ mt: 2 }}>{lastAction}</Alert>}{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{warning && <Alert severity="warning" sx={{ mt: 2 }}>{warning}</Alert>}
    <Grid container spacing={2} sx={{ mt: .25 }}>
      <Grid size={{ xs: 12, lg: 8 }}><Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}><Typography variant="overline" color="text.secondary" fontWeight={800}>Issue details</Typography><Typography sx={{ mt: .75, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{request.description}</Typography><Divider sx={{ my: 2 }} /><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">EXACT LOCATION</Typography><Typography fontWeight={650}>{request.location || 'Not provided'}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">PREFERRED ACCESS</Typography>{request.preferredWindows?.length ? request.preferredWindows.map((window) => <Typography key={window.id} variant="body2">{formatDate(window.startsAtUtc)} – {formatDate(window.endsAtUtc)}</Typography>) : <Typography>None provided</Typography>}</Grid></Grid></Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Evidence</Typography><Typography variant="body2" color="text.secondary">{attachments.length} photo/video file(s) recorded</Typography></Box>{evidencePurpose && <Stack direction="row" spacing={1}><Button component="label" variant="outlined" startIcon={<UploadOutlined />} disabled={busy === 'upload'}>Choose files<input hidden type="file" multiple accept={MAINTENANCE_EVIDENCE_TYPES.join(',')} onChange={selectEvidence} /></Button><Button variant="contained" onClick={uploadEvidence} disabled={busy === 'upload' || !evidenceFiles.some((entry) => entry.status !== 'uploaded')}>{busy === 'upload' ? 'Uploading' : evidenceFiles.some((entry) => entry.status === 'failed') ? 'Retry failed' : `Upload ${evidencePurpose.toLowerCase()} evidence`}</Button></Stack>}</Stack>{!evidencePurpose && <Alert severity="info" sx={{ my: 1 }}>New tenant evidence is accepted only during intake or immediately after a reopened repair. Existing evidence remains available below.</Alert>}{evidenceFiles.length > 0 && <Typography variant="caption" display="block" sx={{ my: 1 }}>{evidenceFiles.map((entry) => `${entry.file.name}${entry.status === 'uploaded' ? ' (uploaded)' : entry.status === 'failed' ? ' (retry needed)' : ''}`).join(', ')}</Typography>}<MaintenanceEvidenceList maintenanceId={maintenanceId} attachments={attachments} /></Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}><Typography variant="overline" color="text.secondary" fontWeight={800}>Safe troubleshooting</Typography>{request.stopTroubleshooting || isEmergency ? <Alert severity="warning" sx={{ mt: 1 }}>Troubleshooting is disabled for safety. Wait for the property team and use emergency services when needed.</Alert> : <><Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>Only server-allowlisted, non-invasive steps are offered, with a strict maximum of three per resolution cycle.</Typography>{troubleshootingSteps.map((item) => <Box key={item.id} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}><Typography fontWeight={700}>{item.sequence}. {item.instruction}</Typography><Chip size="small" label={item.outcome} variant="outlined" sx={{ mt: .5 }} />{String(item.outcome).toLowerCase() === 'pending' && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>{[['Completed', 'It worked'], ['Failed', 'Did not work'], ['Skipped', 'Could not try'], ['StoppedForSafety', 'Conditions worsened']].map(([outcome, label]) => <Button key={outcome} size="small" color={outcome === 'StoppedForSafety' ? 'error' : 'primary'} variant="outlined" disabled={Boolean(busy)} onClick={() => run(`outcome-${item.id}`, () => maintenanceWorkflowAPI.recordTroubleshootingOutcome(maintenanceId, item.id, { outcome, tenantResponse: null }), `Troubleshooting outcome recorded: ${label}.`)}>{label}</Button>)}</Stack>}</Box>)}{canTroubleshoot ? <Button startIcon={<SafetyCertificateOutlined />} onClick={troubleshoot} disabled={busy === 'troubleshoot' || troubleshootingSteps.some((item) => String(item.outcome).toLowerCase() === 'pending')} sx={{ mt: 1 }}>Show next safe step</Button> : !safeTroubleshootingStep(category) ? <Typography variant="body2">No safe self-service step is available for this category.</Typography> : <Typography variant="body2">The troubleshooting limit has been reached.</Typography>}</>}</Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}><Typography variant="overline" color="text.secondary" fontWeight={800}>Maintenance activity</Typography><Stack spacing={1} sx={{ mt: 1 }}>{workflowActivitiesFromMaintenanceDetail(request).length ? workflowActivitiesFromMaintenanceDetail(request).map((event, index) => <Box key={event.id || `${event.eventType || event.type}-${index}`} sx={{ py: .75, borderBottom: '1px solid', borderColor: 'divider' }}><Typography fontWeight={700}>{event.title || event.eventType || event.type || 'Maintenance updated'}</Typography><Typography variant="caption" color="text.secondary">{formatDate(event.occurredAtUtc || event.createdAtUtc || event.createdAt)}</Typography>{event.summary && <Typography variant="body2">{event.summary}</Typography>}</Box>) : <Typography variant="body2" color="text.secondary">No canonical workflow activity was returned with this detail response.</Typography>}</Stack></Paper>
        <ConversationTimelinePanel contextKind="maintenance" contextId={Number(maintenanceId)} />
      </Stack></Grid>
      <Grid size={{ xs: 12, lg: 4 }}><Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography variant="overline" color="text.secondary" fontWeight={800}>Response targets</Typography><Stack spacing={1.25} sx={{ mt: 1 }}><Box><Typography variant="caption">ACKNOWLEDGE BY</Typography><Typography fontWeight={700}>{formatDate(request.acknowledgeByUtc)}</Typography><Chip size="small" color={ack.tone === 'default' ? undefined : ack.tone} label={ack.label} /></Box><Divider /><Box><Typography variant="caption">ACTION BY</Typography><Typography fontWeight={700}>{formatDate(request.actionByUtc)}</Typography><Chip size="small" color={action.tone === 'default' ? undefined : action.tone} label={action.label} /></Box></Stack></Paper>
        {actions.confirmAppointment && <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography fontWeight={750}>Appointment proposed</Typography><Typography variant="body2" sx={{ my: 1 }}>{formatDate(workflow.appointment.startsAtUtc)} – {formatDate(workflow.appointment.endsAtUtc)}</Typography><Button variant="contained" onClick={() => run('appointment', () => maintenanceWorkflowAPI.confirmAppointment(maintenanceId, workflow.appointment.id, workflow.appointment.version), 'Appointment confirmed.')} disabled={busy === 'appointment'}>Confirm appointment</Button></Paper>}
        {actions.cancelAppointment && <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography fontWeight={750}>Cannot make this appointment?</Typography><TextField fullWidth size="small" label="Cancellation reason" value={reason} onChange={(event) => setReason(event.target.value)} sx={{ my: 1 }} /><Button color="error" variant="outlined" disabled={!reason.trim() || Boolean(busy)} onClick={() => run('cancel-appointment', () => maintenanceWorkflowAPI.cancelAppointment(maintenanceId, workflow.appointment.id, workflow.appointment.version, reason), 'Appointment cancelled.')}>Cancel appointment</Button></Paper>}
        {actions.decideCompletion && <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography fontWeight={800}>Is the repair complete?</Typography><Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{workflow.completion.resolutionNotes}</Typography><Stack spacing={1}><Button variant="contained" color="success" startIcon={<CheckCircleOutlined />} onClick={() => run('complete', () => maintenanceWorkflowAPI.confirmCompletion(maintenanceId, workflow.completion.id, workflow.completion.version), 'Repair confirmed complete.')} disabled={Boolean(busy)}>Yes, it is fixed</Button><TextField size="small" label="What is still wrong?" multiline minRows={2} value={reason} onChange={(event) => setReason(event.target.value)} /><Button variant="outlined" color="error" startIcon={<ReloadOutlined />} onClick={() => run('reopen', () => maintenanceWorkflowAPI.reopenCompletion(maintenanceId, workflow.completion.id, workflow.completion.version, reason), 'Request reopened for more work.')} disabled={!reason.trim() || Boolean(busy)}>Still not fixed</Button></Stack></Paper>}
        {statusLabel(request.status) === 'Awaiting tenant' && !workflow.completion && <Alert severity="warning">Completion confirmation is pending, but the canonical detail response contains no completion identifier. Confirmation controls are hidden rather than guessing an identifier.</Alert>}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}><ToolOutlined /><Typography fontWeight={750} sx={{ mt: .75 }}>Current status</Typography><Typography variant="body2">{statusLabel(request.status)}</Typography></Paper>
      </Stack></Grid>
    </Grid>
  </Box>;
}
