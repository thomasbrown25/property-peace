import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, MenuItem, Paper, Stack, TextField, Typography, alpha
} from '@mui/material';
import { CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, HomeOutlined, ToolOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ConversationTimelinePanel from 'components/conversation/ConversationTimelinePanel';
import MaintenanceEvidenceList from 'components/maintenance/MaintenanceEvidenceList';
import { maintenanceWorkflowAPI, maintenanceProblemMessage } from 'api/maintenanceWorkflow';
import {
  darkPageHeaderEyebrowSx,
  darkPageHeaderMetaLabelSx,
  darkPageHeaderMetaValueSx,
  darkPageHeaderTitleSx
} from 'styles/darkPageHeader.mjs';
import {
  availableMaintenanceActions, createEvidenceUploadEntries, evidenceSelection, maintenanceActorForRoute, maintenanceUserId,
  MAINTENANCE_EVIDENCE_TYPES, slaState, statusLabel, uploadPendingEvidence, workflowActivitiesFromMaintenanceDetail,
  workflowFromMaintenanceDetail, workflowProjectionWarning
} from 'utils/maintenanceWorkflow';

const NAVY = '#061e35'; const TEAL = '#16a394';
const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not set';
const iso = (value) => value ? new Date(value).toISOString() : null;
const money = (value, currency = 'USD') => value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);

function Section({ title, eyebrow, children }) {
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, boxShadow: `0 4px 18px ${alpha(NAVY, .045)}` }}><Typography variant="overline" color="text.secondary" fontWeight={800}>{eyebrow}</Typography><Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>{title}</Typography>{children}</Paper>;
}
function ActionButton({ busy, name, children, ...props }) { return <Button variant="contained" disabled={Boolean(busy) || props.disabled} {...props}>{busy === name ? <><CircularProgress size={15} color="inherit" />&nbsp; Working</> : children}</Button>; }

export default function MaintenancePage() {
  const { maintenanceId } = useParams(); const navigate = useNavigate(); const location = useLocation(); const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const role = maintenanceActorForRoute(user, location.pathname, currentOrganization); const userId = maintenanceUserId(user);
  const [request, setRequest] = useState(null); const [workflow, setWorkflow] = useState({}); const [cost, setCost] = useState(null);
  const [attachments, setAttachments] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [dataWarnings, setDataWarnings] = useState([]); const [assignees, setAssignees] = useState([]);
  const [assignment, setAssignment] = useState({ selection: '', estimateRequired: false });
  const [estimate, setEstimate] = useState({ amount: '', currency: 'USD', scope: '', validUntilUtc: '' }); const [rejectReason, setRejectReason] = useState('');
  const [workOrder, setWorkOrder] = useState({ scope: '', authorizedAmount: '', dueAtUtc: '' });
  const [appointment, setAppointment] = useState({ startsAtUtc: '', endsAtUtc: '', notes: '' });
  const [workOrderCancellationReason, setWorkOrderCancellationReason] = useState(''); const [appointmentCancellationReason, setAppointmentCancellationReason] = useState('');
  const [completion, setCompletion] = useState({ resolutionNotes: '', finalCost: '' }); const [completionFiles, setCompletionFiles] = useState([]); const [staffCloseReason, setStaffCloseReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const detail = await maintenanceWorkflowAPI.get(maintenanceId); setRequest(detail); setWorkflow(workflowFromMaintenanceDetail(detail));
      const warnings = [];
      const files = await maintenanceWorkflowAPI.attachments(maintenanceId).catch((attachmentError) => {
        warnings.push(maintenanceProblemMessage(attachmentError, 'Evidence could not be loaded.')); return null;
      });
      let projection = null;
      if (role === 'manager') projection = await maintenanceWorkflowAPI.costProjection(maintenanceId).catch((costError) => {
        warnings.push(maintenanceProblemMessage(costError, 'Cost projection could not be loaded.')); return null;
      });
      setAttachments(Array.isArray(files) ? files : Array.isArray(detail.attachments) ? detail.attachments : []); setCost(projection); setDataWarnings(warnings);
    } catch (requestError) { setError(maintenanceProblemMessage(requestError, 'Maintenance request could not be loaded.')); }
    finally { setLoading(false); }
  }, [maintenanceId, role]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (role !== 'manager' || !currentOrganization?.id || !userId) return;
    let active = true;
    Promise.allSettled([
      axiosServices.get(`/api/organization/members/${currentOrganization.id}`),
      axiosServices.get('/api/vendor', { params: { includeInactive: false } })
    ]).then(([memberResult, vendorResult]) => {
      if (!active) return;
      const warnings = [];
      const memberEnvelope = memberResult.status === 'fulfilled' ? memberResult.value.data : null;
      const vendorEnvelope = vendorResult.status === 'fulfilled' ? vendorResult.value.data : null;
      const members = Array.isArray(memberEnvelope?.data) ? memberEnvelope.data : [];
      const vendors = Array.isArray(vendorEnvelope?.data) ? vendorEnvelope.data : [];
      if (memberResult.status === 'rejected') warnings.push('Team members could not be loaded; team assignment is unavailable.');
      if (vendorResult.status === 'rejected') warnings.push('Vendors could not be loaded; vendor assignment is unavailable.');
      setAssignees([
        { key: `Self:${userId}`, label: 'Assign to me', type: 'Self', assignedToUserId: userId, vendorId: null },
        ...members.filter((member) => member.isActive !== false && member.userId).map((member) => ({ key: `OrganizationMember:${member.userId}`, label: member.userName || member.userEmail || `Team member ${member.userId}`, type: 'OrganizationMember', assignedToUserId: member.userId, vendorId: null })),
        ...vendors.filter((vendor) => vendor.isActive !== false && vendor.isReadyForAssignment === true && vendor.id).map((vendor) => ({ key: `Vendor:${vendor.id}`, label: `${vendor.name || `Vendor ${vendor.id}`} · Portal ready`, type: 'Vendor', assignedToUserId: null, vendorId: vendor.id }))
      ]);
      if (warnings.length) setDataWarnings((current) => [...new Set([...current, ...warnings])]);
    });
    return () => { active = false; };
  }, [currentOrganization?.id, role, userId]);
  const actions = useMemo(() => availableMaintenanceActions({ role, request, workflow, userId }), [request, role, userId, workflow]);
  const run = async (name, operation, apply, message) => { setBusy(name); setError(''); setSuccess(''); try { const result = await operation(); apply?.(result); setSuccess(message); await load(); } catch (requestError) { setError(maintenanceProblemMessage(requestError)); } finally { setBusy(''); } };

  const selectCompletionEvidence = (event) => {
    const selection = evidenceSelection([], event.target.files);
    if (selection.errors.length) { setError(selection.errors.join(' ')); setCompletionFiles([]); }
    else { setError(''); setCompletionFiles(createEvidenceUploadEntries(selection.accepted)); }
    event.target.value = '';
  };
  const submitCompletion = async () => {
    const uploaded = await uploadPendingEvidence(completionFiles, (file, key) => maintenanceWorkflowAPI.uploadAttachment(maintenanceId, 'Completion', file, key));
    setCompletionFiles(uploaded);
    const failures = uploaded.filter((item) => item.status === 'failed');
    if (failures.length) throw new Error(`Completion evidence failed to upload: ${failures.map((item) => item.file.name).join(', ')}. Retry to upload only the failed files.`);
    return maintenanceWorkflowAPI.submitCompletion(maintenanceId, { workOrderId: workflow.workOrder.id, resolutionNotes: completion.resolutionNotes, completionEvidenceReference: null, finalCost: completion.finalCost === '' ? null : Number(completion.finalCost) });
  };

  if (loading && !request) return <Box sx={{ minHeight: 400, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!request) return <Stack spacing={2}><Button onClick={() => navigate('/landlord/maintenances')}>Back to maintenance</Button><Alert severity="error">{error || 'Request not found.'}</Alert></Stack>;
  const ack = slaState(request.acknowledgeByUtc); const actionSla = slaState(request.actionByUtc);
  const urgencyColor = String(request.urgency).toLowerCase() === 'emergency' ? 'error' : String(request.urgency).toLowerCase() === 'urgent' ? 'warning' : 'success';
  const unavailableWorkflowData = !request.assignment && !request.latestEstimate && !request.activeWorkOrder && !request.latestAppointment && !request.latestCompletion;

  return <Box sx={{ pb: 5 }}>
    <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Maintenance', path: '/landlord/maintenances' }, { label: `MR-${request.id}` }]} />
    <Paper sx={{ mt: 2, p: { xs: 2.25, md: 3 }, borderRadius: 2, color: '#fff', background: `linear-gradient(125deg, ${NAVY}, #0b3855)` }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}><Box><Typography variant="caption" sx={darkPageHeaderEyebrowSx}>MR-{request.id} · PROPERTY {request.propertyId}{request.unitId ? ` / UNIT ${request.unitId}` : ''}</Typography><Typography variant="h3" sx={{ ...darkPageHeaderTitleSx, mt: .5, fontWeight: 800 }}>{request.title}</Typography><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}><Chip label={request.urgency} color={urgencyColor} /><Chip label={statusLabel(request.status)} sx={{ bgcolor: '#fff', color: NAVY }} /><Chip label={request.location || 'Location missing'} variant="outlined" sx={{ color: '#fff', borderColor: alpha('#fff', .45) }} /></Stack></Box><Box sx={{ minWidth: { md: 250 } }}><Typography variant="caption" sx={darkPageHeaderMetaLabelSx}>ROLE-AWARE ACCESS</Typography><Typography sx={darkPageHeaderMetaValueSx}>{role === 'manager' ? 'Landlord / maintenance manager' : 'Assigned team member'}</Typography></Box></Stack></Paper>
    {String(request.urgency).toLowerCase() === 'emergency' && <Alert severity="error" variant="filled" sx={{ mt: 2 }}><b>Emergency escalation:</b> Contact the tenant and dispatch appropriate emergency support now. The deterministic policy has stopped troubleshooting.</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mt: 2 }}>{success}</Alert>}
    {dataWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mt: 2 }}>{warning}</Alert>)}
    <Grid container spacing={2} sx={{ mt: .25 }}>
      <Grid size={{ xs: 12, lg: 8 }}><Stack spacing={2}>
        <Section eyebrow="TRIAGE" title="Decision-ready summary"><Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{request.landlordSummary || request.description}</Typography><Divider sx={{ my: 2 }} /><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">TENANT DESCRIPTION</Typography><Typography>{request.description}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">MISSING INFORMATION</Typography>{request.missingInformation?.length ? <Stack spacing={.5}>{request.missingInformation.map((item) => <Chip key={item} label={item} color="warning" variant="outlined" sx={{ alignSelf: 'flex-start' }} />)}</Stack> : <Typography color="success.main" fontWeight={700}>Checklist complete</Typography>}</Grid></Grid></Section>
        <Section eyebrow="WORKFLOW" title="Explicit maintenance actions">
          {role === 'manager' && actions.acknowledge && <Box sx={{ mb: 2 }}><ActionButton busy={busy} name="ack" onClick={() => run('ack', () => maintenanceWorkflowAPI.acknowledge(maintenanceId), null, 'Request acknowledged.')}>Acknowledge request</ActionButton></Box>}
          {actions.assign && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>1. Assignment</Typography><TextField select fullWidth label="Team member or vendor" value={assignment.selection} onChange={(event) => setAssignment({ ...assignment, selection: event.target.value })} sx={{ mt: 1 }}>{assignees.map((option) => <MenuItem key={option.key} value={option.key}>{option.label} · {option.type === 'Vendor' ? 'Vendor' : 'Team'}</MenuItem>)}</TextField>{!assignees.length && <Alert severity="warning" sx={{ mt: 1 }}>No verified assignees are available. Reload the organization team and vendor data before assigning.</Alert>}<Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}><Button variant={assignment.estimateRequired ? 'contained' : 'outlined'} onClick={() => setAssignment({ ...assignment, estimateRequired: !assignment.estimateRequired })}>Estimate {assignment.estimateRequired ? 'required' : 'not required'}</Button><ActionButton busy={busy} name="assign" disabled={!assignment.selection} onClick={() => { const selected = assignees.find((option) => option.key === assignment.selection); return run('assign', () => maintenanceWorkflowAPI.assign(maintenanceId, { assignedToType: selected.type, assignedToUserId: selected.assignedToUserId, vendorId: selected.vendorId, estimateRequired: assignment.estimateRequired }), (result) => setWorkflow((current) => ({ ...current, assignment: result })), 'Assignment saved.'); }}>Assign</ActionButton></Stack></Box>}
          {actions.submitEstimate && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>2. Submit estimate</Typography><Stack spacing={1} sx={{ mt: 1 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Amount" type="number" value={estimate.amount} onChange={(event) => setEstimate({ ...estimate, amount: event.target.value })} /><TextField label="Currency" value={estimate.currency} onChange={(event) => setEstimate({ ...estimate, currency: event.target.value.toUpperCase().slice(0, 3) })} /><TextField label="Valid until" type="datetime-local" value={estimate.validUntilUtc} onChange={(event) => setEstimate({ ...estimate, validUntilUtc: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack><TextField label="Scope" multiline minRows={2} value={estimate.scope} onChange={(event) => setEstimate({ ...estimate, scope: event.target.value })} /><ActionButton busy={busy} name="estimate" disabled={!(Number(estimate.amount) > 0 && estimate.currency.length === 3 && estimate.scope.trim())} onClick={() => run('estimate', () => maintenanceWorkflowAPI.submitEstimate(maintenanceId, { amount: Number(estimate.amount), currency: estimate.currency, scope: estimate.scope, validUntilUtc: iso(estimate.validUntilUtc) }), (result) => setWorkflow((current) => ({ ...current, estimate: result })), 'Estimate submitted.')}>Submit estimate</ActionButton></Stack></Box>}
          {actions.decideEstimate && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>Estimate decision · {money(workflow.estimate.amount, workflow.estimate.currency)}</Typography><Typography variant="body2" sx={{ my: 1 }}>{workflow.estimate.scope}</Typography><TextField fullWidth size="small" label="Rejection reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /><Stack direction="row" spacing={1} sx={{ mt: 1 }}><ActionButton busy={busy} name="approve" color="success" onClick={() => run('approve', () => maintenanceWorkflowAPI.approveEstimate(maintenanceId, workflow.estimate.id, workflow.estimate.version), (result) => setWorkflow((current) => ({ ...current, estimate: result })), 'Estimate approved.')}>Approve</ActionButton><ActionButton busy={busy} name="reject" color="error" variant="outlined" disabled={!rejectReason.trim()} onClick={() => run('reject', () => maintenanceWorkflowAPI.rejectEstimate(maintenanceId, workflow.estimate.id, workflow.estimate.version, rejectReason), (result) => setWorkflow((current) => ({ ...current, estimate: result })), 'Estimate rejected.')}>Reject</ActionButton></Stack></Box>}
          {actions.issueWorkOrder && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>3. Issue work order</Typography><Stack spacing={1} sx={{ mt: 1 }}><TextField label="Authorized scope" multiline minRows={2} value={workOrder.scope} onChange={(event) => setWorkOrder({ ...workOrder, scope: event.target.value })} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Authorized amount" type="number" value={workOrder.authorizedAmount} onChange={(event) => setWorkOrder({ ...workOrder, authorizedAmount: event.target.value })} /><TextField label="Due" type="datetime-local" value={workOrder.dueAtUtc} onChange={(event) => setWorkOrder({ ...workOrder, dueAtUtc: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack><ActionButton busy={busy} name="workorder" disabled={!workOrder.scope.trim()} onClick={() => run('workorder', () => maintenanceWorkflowAPI.issueWorkOrder(maintenanceId, { estimateId: workflow.estimate?.status === 'Approved' ? workflow.estimate.id : null, scope: workOrder.scope, authorizedAmount: workOrder.authorizedAmount === '' ? null : Number(workOrder.authorizedAmount), dueAtUtc: iso(workOrder.dueAtUtc) }), (result) => setWorkflow((current) => ({ ...current, workOrder: result })), 'Work order issued.')}>Issue work order</ActionButton></Stack></Box>}
          {actions.schedule && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>4. Appointment</Typography><Stack spacing={1} sx={{ mt: 1 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Starts" type="datetime-local" value={appointment.startsAtUtc} onChange={(event) => setAppointment({ ...appointment, startsAtUtc: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Ends" type="datetime-local" value={appointment.endsAtUtc} onChange={(event) => setAppointment({ ...appointment, endsAtUtc: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack><TextField label="Notes" value={appointment.notes} onChange={(event) => setAppointment({ ...appointment, notes: event.target.value })} /><ActionButton busy={busy} name="appointment" disabled={!appointment.startsAtUtc || !appointment.endsAtUtc || new Date(appointment.endsAtUtc) <= new Date(appointment.startsAtUtc)} onClick={() => run('appointment', () => maintenanceWorkflowAPI.proposeAppointment(maintenanceId, { workOrderId: workflow.workOrder.id, startsAtUtc: iso(appointment.startsAtUtc), endsAtUtc: iso(appointment.endsAtUtc), notes: appointment.notes || null }), (result) => setWorkflow((current) => ({ ...current, appointment: result })), 'Appointment proposed to tenant.')}>Propose appointment</ActionButton></Stack></Box>}
          {actions.cancelWorkOrder && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>Cancel active work order</Typography><TextField fullWidth size="small" label="Cancellation reason" value={workOrderCancellationReason} onChange={(event) => setWorkOrderCancellationReason(event.target.value)} sx={{ my: 1 }} /><ActionButton busy={busy} name="cancel-work-order" color="error" variant="outlined" disabled={!workOrderCancellationReason.trim()} onClick={() => run('cancel-work-order', () => maintenanceWorkflowAPI.cancelWorkOrder(maintenanceId, workflow.workOrder.id, workflow.workOrder.version, workOrderCancellationReason), null, 'Work order cancelled.')}>Cancel work order</ActionButton></Box>}
          {actions.cancelAppointment && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}><Typography fontWeight={800}>Cancel active appointment</Typography><TextField fullWidth size="small" label="Cancellation reason" value={appointmentCancellationReason} onChange={(event) => setAppointmentCancellationReason(event.target.value)} sx={{ my: 1 }} /><ActionButton busy={busy} name="cancel-appointment" color="error" variant="outlined" disabled={!appointmentCancellationReason.trim()} onClick={() => run('cancel-appointment', () => maintenanceWorkflowAPI.cancelAppointment(maintenanceId, workflow.appointment.id, workflow.appointment.version, appointmentCancellationReason), null, 'Appointment cancelled.')}>Cancel appointment</ActionButton></Box>}
          {actions.start && <Box sx={{ mb: 2 }}><ActionButton busy={busy} name="start" onClick={() => run('start', () => maintenanceWorkflowAPI.startWork(maintenanceId, workflow.workOrder.id, workflow.workOrder.version), (result) => setWorkflow((current) => ({ ...current, workOrder: result })), 'Work started.')}>5. Start work</ActionButton></Box>}
          {actions.complete && <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}><Typography fontWeight={800}>6. Completion, evidence, and cost</Typography><Alert severity="info" sx={{ my: 1 }}>At least one completion photo or video is required. Up to 10 JPEG/PNG/WebP images (10 MB each) or MP4/QuickTime videos (100 MB each).</Alert><Stack spacing={1}><Button component="label" variant="outlined" startIcon={<UploadOutlined />}>Choose completion evidence<input hidden type="file" multiple accept={MAINTENANCE_EVIDENCE_TYPES.join(',')} onChange={selectCompletionEvidence} /></Button>{completionFiles.length > 0 && <Typography variant="caption">{completionFiles.map((item) => `${item.file.name}${item.status === 'uploaded' ? ' (uploaded)' : item.status === 'failed' ? ' (retry needed)' : ''}`).join(', ')}</Typography>}<TextField label="Resolution notes" multiline minRows={3} value={completion.resolutionNotes} onChange={(event) => setCompletion({ ...completion, resolutionNotes: event.target.value })} /><TextField label="Final cost" type="number" value={completion.finalCost} onChange={(event) => setCompletion({ ...completion, finalCost: event.target.value })} /><ActionButton busy={busy} name="completion" disabled={!completion.resolutionNotes.trim() || !completionFiles.length} onClick={() => run('completion', submitCompletion, (result) => setWorkflow((current) => ({ ...current, completion: result })), 'Completion submitted for tenant confirmation.')}>Submit completion</ActionButton></Stack></Box>}
          {actions.staffClose && <Box sx={{ mt: 2 }}><TextField fullWidth label="Staff-close reason" value={staffCloseReason} onChange={(event) => setStaffCloseReason(event.target.value)} /><ActionButton busy={busy} name="staffclose" disabled={!staffCloseReason.trim()} onClick={() => run('staffclose', () => maintenanceWorkflowAPI.staffCloseCompletion(maintenanceId, workflow.completion.id, workflow.completion.version, staffCloseReason), null, 'Completion closed after tenant response window.')} sx={{ mt: 1 }}>Staff close</ActionButton></Box>}
          {!Object.values(actions).some(Boolean) && <Alert severity="info">No workflow action is valid for your role and the current state.</Alert>}
          {unavailableWorkflowData && !['Reported', 'Acknowledged'].includes(statusLabel(request.status)) && <Alert severity="warning" sx={{ mt: 2 }}>The canonical detail response contains no assignment, estimate, work order, appointment, or completion resources for this request. Controls requiring those identifiers are intentionally hidden.</Alert>}
        </Section>
        <Section eyebrow="WORKFLOW HISTORY" title="Maintenance activity"><Stack spacing={1}>{workflowActivitiesFromMaintenanceDetail(request).length ? workflowActivitiesFromMaintenanceDetail(request).map((event, index) => <Box key={event.id || `${event.eventType || event.type}-${index}`} sx={{ py: .75, borderBottom: '1px solid', borderColor: 'divider' }}><Typography fontWeight={700}>{event.title || event.eventType || event.type || 'Maintenance updated'}</Typography><Typography variant="caption" color="text.secondary">{dateTime(event.occurredAtUtc || event.createdAtUtc || event.createdAt)}</Typography>{event.summary && <Typography variant="body2">{event.summary}</Typography>}</Box>) : <Typography variant="body2" color="text.secondary">No canonical workflow activity was returned with this detail response.</Typography>}</Stack></Section>
        <ConversationTimelinePanel contextKind="maintenance" contextId={Number(maintenanceId)} />
      </Stack></Grid>
      <Grid size={{ xs: 12, lg: 4 }}><Stack spacing={2}>
        <Section eyebrow="SLA AGING" title="Response clock"><Stack spacing={1.5}><Box><Stack direction="row" spacing={1}><ClockCircleOutlined /><Typography fontWeight={750}>Acknowledge</Typography></Stack><Typography>{dateTime(request.acknowledgeByUtc)}</Typography><Chip size="small" label={ack.label} color={ack.tone === 'default' ? undefined : ack.tone} /></Box><Divider /><Box><Typography fontWeight={750}>Action target</Typography><Typography>{dateTime(request.actionByUtc)}</Typography><Chip size="small" label={actionSla.label} color={actionSla.tone === 'default' ? undefined : actionSla.tone} /></Box></Stack></Section>
        <Section eyebrow="WORK SUMMARY" title="Current resources"><Stack spacing={1}><Stack direction="row" spacing={1}><UserOutlined /><Typography>{workflow.assignment ? `${workflow.assignment.assignedToType} · user ${workflow.assignment.assignedToUserId}` : 'Unassigned / unavailable'}</Typography></Stack><Stack direction="row" spacing={1}><ToolOutlined /><Typography>{workflow.workOrder ? `${workflow.workOrder.status} · ${workflow.workOrder.scope}` : 'No work order loaded'}</Typography></Stack><Stack direction="row" spacing={1}><HomeOutlined /><Typography>{request.preferredWindows?.length || 0} preferred tenant time(s)</Typography></Stack></Stack></Section>
        {role === 'manager' && <Section eyebrow="COSTS" title="Projection"><Grid container spacing={1}><Grid size={6}><Typography variant="caption">APPROVED</Typography><Typography variant="h6">{money(cost?.approvedEstimate)}</Typography></Grid><Grid size={6}><Typography variant="caption">ACTUAL</Typography><Typography variant="h6">{money(cost?.actualTotal || 0)}</Typography></Grid><Grid size={12}><Divider sx={{ my: 1 }} /><Typography variant="caption">VARIANCE</Typography><Typography fontWeight={800}>{money(cost?.variance)}</Typography></Grid></Grid></Section>}
        <Section eyebrow="EVIDENCE" title={`${attachments.length} recorded file(s)`}><MaintenanceEvidenceList maintenanceId={maintenanceId} attachments={attachments} /></Section>
      </Stack></Grid>
    </Grid>
  </Box>;
}
