import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, Typography, alpha
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { useDrawer } from 'contexts/DrawerContext';
import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ConversationTimelinePanel from 'components/conversation/ConversationTimelinePanel';
import MaintenanceActionsPanel from 'components/maintenance/MaintenanceActionsPanel';
import MaintenanceAssignmentDrawer from 'components/maintenance/MaintenanceAssignmentDrawer';
import TaskEditorDrawer from 'sections/landlord/tasks/TaskEditorDrawer';
import { createTask, fetchTasks } from 'store/task/task.action';
import { deleteTask as deleteCalendarTask } from 'api/task';
import { maintenanceWorkflowAPI, maintenanceProblemMessage } from 'api/maintenanceWorkflow';
import {
  maintenanceActorForRoute, maintenanceStatusSelectionCommand, maintenanceUserId, statusLabel, workflowFromMaintenanceDetail
} from 'utils/maintenanceWorkflow';

const NAVY = '#061e35';
const priorityLabel = (value) => {
  const label = String(value || 'Routine').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${label} priority`;
};
const priorityColor = (value) => {
  const priority = String(value || '').toLowerCase();
  if (['emergency', 'high'].includes(priority)) return 'error';
  if (['urgent', 'medium'].includes(priority)) return 'warning';
  return 'success';
};
function Section({ title, eyebrow, children }) {
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, boxShadow: `0 4px 18px ${alpha(NAVY, .045)}` }}><Typography variant="overline" color="text.secondary" fontWeight={800}>{eyebrow}</Typography><Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>{title}</Typography>{children}</Paper>;
}
export default function MaintenancePage() {
  const { maintenanceId } = useParams(); const navigate = useNavigate(); const location = useLocation(); const { user } = useAuth();
  const dispatch = useDispatch(); const drawer = useDrawer(); const { properties } = useFetchProperties();
  const { currentOrganization } = useOrganization();
  const role = maintenanceActorForRoute(user, location.pathname, currentOrganization); const userId = maintenanceUserId(user);
  const [request, setRequest] = useState(null); const [workflow, setWorkflow] = useState({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [dataWarnings, setDataWarnings] = useState([]); const [assignees, setAssignees] = useState([]);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false); const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);


  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const detail = await maintenanceWorkflowAPI.get(maintenanceId); setRequest(detail); setWorkflow(workflowFromMaintenanceDetail(detail));
    } catch (requestError) { setError(maintenanceProblemMessage(requestError, 'Maintenance request could not be loaded.')); }
    finally { setLoading(false); }
  }, [maintenanceId]);
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
        ...members.filter((member) => member.isActive !== false && member.userId && String(member.userId) !== String(userId)).map((member) => ({ key: `OrganizationMember:${member.userId}`, label: member.userName || member.userEmail || `Team member ${member.userId}`, type: 'OrganizationMember', assignedToUserId: member.userId, vendorId: null })),
        ...vendors.filter((vendor) => vendor.isActive !== false && vendor.isReadyForAssignment === true && vendor.id).map((vendor) => ({ key: `Vendor:${vendor.id}`, label: `${vendor.name || `Vendor ${vendor.id}`} · Portal ready`, type: 'Vendor', assignedToUserId: null, vendorId: vendor.id }))
      ]);
      if (warnings.length) setDataWarnings((current) => [...new Set([...current, ...warnings])]);
    });
    return () => { active = false; };
  }, [currentOrganization?.id, role, userId]);

  const run = async (name, operation, apply, message) => { setBusy(name); setError(''); setSuccess(''); try { const result = await operation(); apply?.(result); setSuccess(message); await load(); } catch (requestError) { setError(maintenanceProblemMessage(requestError)); } finally { setBusy(''); } };
  const handleStatusChange = (status) => {
    const command = maintenanceStatusSelectionCommand({ status, currentStatus: request.status, userId });
    return run(
      `status:${status}`,
      () => command.action === 'assign'
        ? maintenanceWorkflowAPI.assign(maintenanceId, command.body)
        : maintenanceWorkflowAPI.changeStatus(maintenanceId, command.status, command.expectedStatus),
      command.action === 'assign'
        ? (result) => setWorkflow((current) => ({ ...current, assignment: result }))
        : (result) => { setRequest(result); setWorkflow(workflowFromMaintenanceDetail(result)); },
      command.action === 'assign'
        ? 'Status changed to Assigned and assigned to you.'
        : `Status changed to ${statusLabel(status)}.`
    );
  };
  const scheduleInitialValues = useMemo(() => {
    if (!request) return null;
    const actionTarget = request.actionByUtc ? new Date(request.actionByUtc) : null;
    const dueDate = actionTarget && !Number.isNaN(actionTarget.getTime()) && actionTarget > new Date()
      ? actionTarget
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    return {
      title: `MR-${request.id}: ${request.title}`,
      dueDate: dueDate.toISOString(),
      category: 2,
      propertyId: request.propertyId || ''
    };
  }, [request]);
  const handleAcknowledge = () => run('acknowledge', () => maintenanceWorkflowAPI.acknowledge(maintenanceId), null, 'Request acknowledged.');
  const handleDrawerAssignment = (selected) => run(
    'assign',
    () => maintenanceWorkflowAPI.assign(maintenanceId, {
      assignedToType: selected.type,
      assignedToUserId: selected.assignedToUserId,
      vendorId: selected.vendorId,
      estimateRequired: false
    }),
    (result) => {
      setWorkflow((current) => ({ ...current, assignment: result }));
      setAssignmentDrawerOpen(false);
    },
    `Assigned to ${selected.label}.`
  );
  const handleScheduleTask = async (form) => {
    setBusy('schedule'); setError(''); setSuccess('');
    try {
      let createdTask;
      try {
        createdTask = await dispatch(createTask(form));
      } catch (taskError) {
        setError(maintenanceProblemMessage(taskError, 'Calendar task could not be created.'));
        throw taskError;
      }
      dispatch(fetchTasks());
      try {
        const result = await maintenanceWorkflowAPI.changeStatus(maintenanceId, 'Scheduled', request.status);
        setRequest(result); setWorkflow(workflowFromMaintenanceDetail(result));
        setSuccess('Calendar task added and maintenance set to Scheduled.');
        await load();
      } catch (statusError) {
        try {
          if (!createdTask?.id) throw new Error('The created task identifier was not returned.');
          await deleteCalendarTask(createdTask.id);
          dispatch(fetchTasks());
          setError(`The maintenance status could not be changed, so the new calendar task was removed: ${maintenanceProblemMessage(statusError)}`);
          throw statusError;
        } catch (cleanupError) {
          if (cleanupError === statusError) throw statusError;
          setError(`The calendar task was created, but the maintenance status could not be changed and the task could not be removed automatically: ${maintenanceProblemMessage(statusError)}`);
        }
      }
    } finally {
      setBusy('');
    }
  };
  const handleAddExpense = () => {
    const property = (properties || []).find((item) => String(item.id) === String(request.propertyId)) || null;
    drawer.openExpenseAddDrawer({
      maintenance: request,
      maintenanceRequestId: request.id,
      property,
      propertyId: request.propertyId,
      unitId: request.unitId || null,
      skipPropertyAndMaintenanceSteps: true
    });
  };


  if (loading && !request) return <Box sx={{ minHeight: 400, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!request) return <Stack spacing={2}><Button onClick={() => navigate('/landlord/maintenances')}>Back to maintenance</Button><Alert severity="error">{error || 'Request not found.'}</Alert></Stack>;

  const selectedProperty = (properties || []).find((item) => String(item.id) === String(request.propertyId));
  const propertyStreetAddress = request.propertyStreetAddress || selectedProperty?.streetAddress;

  return <Box sx={{ pb: 5 }}>
    <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Maintenance', path: '/landlord/maintenances' }, { label: `MR-${request.id}` }]} />
    <Box sx={{ mt: 2, mb: 3 }}>
      <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 800, lineHeight: 1.15 }}>
        {request.title}
      </Typography>
      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
        {propertyStreetAddress && <Typography color="text.secondary">{propertyStreetAddress}</Typography>}
        <Chip label={priorityLabel(request.priority || request.urgency)} color={priorityColor(request.priority || request.urgency)} variant="outlined" />
      </Stack>
    </Box>
    {String(request.urgency).toLowerCase() === 'emergency' && <Alert severity="error" variant="filled" sx={{ mt: 2 }}><b>Emergency escalation:</b> Contact the tenant and dispatch appropriate emergency support now. The deterministic policy has stopped troubleshooting.</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mt: 2 }}>{success}</Alert>}
    {dataWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mt: 2 }}>{warning}</Alert>)}
    <Grid container spacing={2} sx={{ mt: .25 }}>
      <Grid size={{ xs: 12, lg: role === 'manager' ? 8 : 12 }} sx={{ order: { xs: 2, lg: 1 } }}><Stack spacing={2}>
        <Section eyebrow="TRIAGE" title="Decision-ready summary"><Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{request.landlordSummary || request.description}</Typography><Divider sx={{ my: 2 }} /><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">TENANT DESCRIPTION</Typography><Typography>{request.description}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary">STATUS</Typography><Box sx={{ mt: .5 }}><Chip label={statusLabel(request.status)} variant="outlined" /></Box></Grid></Grid></Section>
        <ConversationTimelinePanel
          contextKind="maintenance"
          contextId={Number(maintenanceId)}
          title="Maintenance history"
          defaultExpanded
        />
      </Stack></Grid>
      {role === 'manager' && (
        <Grid size={{ xs: 12, lg: 4 }} sx={{ order: { xs: 1, lg: 2 } }}>
          <MaintenanceActionsPanel
            currentStatus={request.status}
            busy={busy}
            onAcknowledge={handleAcknowledge}
            onAssign={() => setAssignmentDrawerOpen(true)}
            onSchedule={() => setScheduleDrawerOpen(true)}
            onAddExpense={handleAddExpense}
            onStatusChange={handleStatusChange}
          />
        </Grid>
      )}
    </Grid>
    <MaintenanceAssignmentDrawer
      open={assignmentDrawerOpen}
      onClose={() => setAssignmentDrawerOpen(false)}
      assignees={assignees}
      currentAssignment={workflow.assignment}
      onAssign={handleDrawerAssignment}
      saving={busy === 'assign'}
    />
    <TaskEditorDrawer
      open={scheduleDrawerOpen}
      onClose={() => setScheduleDrawerOpen(false)}
      onSave={handleScheduleTask}
      properties={properties || []}
      initialValues={scheduleInitialValues}
    />
  </Box>;
}
