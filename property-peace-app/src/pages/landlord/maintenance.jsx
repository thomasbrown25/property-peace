import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { useDrawer } from 'contexts/DrawerContext';
import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ConversationTimelinePanel from 'components/conversation/ConversationTimelinePanel';
import MaintenanceActions from 'components/maintenance/MaintenanceActions';
import MaintenanceAssignmentDrawer from 'components/maintenance/MaintenanceAssignmentDrawer';
import { MaintenanceRequestHeader, MaintenanceRequestReport, MaintenanceWorkDetails } from 'sections/landlord/maintenances/MaintenanceRequestOverview';
import TaskEditorDrawer from 'sections/landlord/tasks/TaskEditorDrawer';
import { createTask, fetchTasks } from 'store/task/task.action';
import { deleteTask as deleteCalendarTask } from 'api/task';
import { maintenanceWorkflowAPI, maintenanceProblemMessage } from 'api/maintenanceWorkflow';
import {
  maintenanceActorForRoute, maintenanceStatusSelectionCommand, maintenanceUserId, statusLabel, workflowFromMaintenanceDetail
} from 'utils/maintenanceWorkflow';

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
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const detail = await maintenanceWorkflowAPI.get(maintenanceId);
      if (sequence !== loadSequence.current) return;
      setRequest(detail);
      setWorkflow(workflowFromMaintenanceDetail(detail));
    } catch (requestError) {
      if (sequence === loadSequence.current) setError(maintenanceProblemMessage(requestError, 'Maintenance request could not be loaded.'));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [maintenanceId]);
  useEffect(() => {
    load();
    return () => { loadSequence.current += 1; };
  }, [load]);
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
        ...vendors.filter((vendor) => vendor.isActive !== false && vendor.isReadyForAssignment === true && vendor.id).map((vendor) => ({ key: `Vendor:${vendor.id}`, label: `${vendor.name || `Vendor ${vendor.id}`} · Portal ready`, name: vendor.name, type: 'Vendor', assignedToUserId: null, vendorId: vendor.id }))
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


  const isCurrentRequest = request && String(request.id) === String(maintenanceId);
  if (loading && !isCurrentRequest) return <Box sx={{ minHeight: 400, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading maintenance request" /></Box>;
  if (!isCurrentRequest) return (
    <Stack spacing={2} alignItems="flex-start">
      <Button onClick={() => navigate('/landlord/maintenances')}>Back to maintenance</Button>
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error || 'Request not found.'}</Alert>
    </Stack>
  );

  const selectedProperty = (properties || []).find((item) => String(item.id) === String(request.propertyId));
  const assignment = workflow.assignment;
  const assignee = assignment && assignees.find((option) => assignment.vendorId
    ? String(option.vendorId) === String(assignment.vendorId)
    : assignment.assignedToUserId && String(option.assignedToUserId) === String(assignment.assignedToUserId));
  let assignedTo = 'Unassigned';
  if (assignment?.vendorId) assignedTo = assignee?.name || `Vendor #${assignment.vendorId}`;
  else if (userId && String(assignment?.assignedToUserId) === String(userId)) assignedTo = 'You';
  else if (assignment?.assignedToUserId) assignedTo = assignee?.label || 'Team member';

  return <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 5 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mb: 2, '& .MuiBreadcrumbs-root': { mb: 0, minWidth: 0 } }}>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Maintenance', path: '/landlord/maintenances' }, { label: `MR-${request.id}` }]} />
      {role === 'manager' && (
        <Box sx={{ flexShrink: 0 }}>
          <MaintenanceActions
            key={maintenanceId}
            currentStatus={request.status}
            busy={busy}
            defaultOpen={location.state?.openMaintenanceActions === true}
            onAcknowledge={handleAcknowledge}
            onAssign={() => setAssignmentDrawerOpen(true)}
            onSchedule={() => setScheduleDrawerOpen(true)}
            onAddExpense={handleAddExpense}
            onStatusChange={handleStatusChange}
          />
        </Box>
      )}
    </Stack>
    <MaintenanceRequestHeader request={request} property={selectedProperty} />
    <Stack spacing={2} sx={{ mt: 2.5 }}>
      {String(request.urgency).toLowerCase() === 'emergency' && (
        <Alert severity="error" variant="filled"><strong>Emergency escalation.</strong> Contact the tenant and dispatch appropriate emergency support now. Troubleshooting has stopped.</Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      {dataWarnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      <Box sx={{
        display: 'grid', alignItems: 'start', gap: 2.5,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(250px, 1fr)' },
        gridTemplateRows: { md: 'auto 1fr' },
        gridTemplateAreas: { xs: '"report" "details" "history"', md: '"report details" "history details"' }
      }}>
        <Box sx={{ gridArea: 'report', minWidth: 0 }}>
          <MaintenanceRequestReport description={request.description} landlordSummary={request.landlordSummary} />
        </Box>
        <Box sx={{ gridArea: 'details', minWidth: 0 }}>
          <MaintenanceWorkDetails request={request} property={selectedProperty} assignedTo={assignedTo} />
        </Box>
        <Box sx={{ gridArea: 'history', minWidth: 0 }}>
          <ConversationTimelinePanel contextKind="maintenance" contextId={Number(maintenanceId)} title="Maintenance history" standalone refreshKey={request.updatedAtUtc} />
        </Box>
      </Box>
    </Stack>
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
