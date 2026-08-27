export const MAINTENANCE_SIGNALS = [
  { value: 'ActiveFire', label: 'Active fire', urgency: 'emergency' },
  { value: 'GasOdor', label: 'Gas odor', urgency: 'emergency' },
  { value: 'CarbonMonoxideAlarm', label: 'Carbon monoxide alarm', urgency: 'emergency' },
  { value: 'ElectricalSparking', label: 'Electrical sparking', urgency: 'emergency' },
  { value: 'UncontrolledFlooding', label: 'Uncontrolled flooding', urgency: 'emergency' },
  { value: 'NoHeatInColdWeather', label: 'No heat in cold weather', urgency: 'urgent' },
  { value: 'NoRunningWater', label: 'No running water', urgency: 'urgent' },
  { value: 'SewageBackup', label: 'Sewage backup', urgency: 'urgent' },
  { value: 'OnlyToiletUnusable', label: 'Only toilet is unusable', urgency: 'urgent' },
  { value: 'EntryCannotBeSecured', label: 'Entry cannot be secured', urgency: 'urgent' }
];

export const MAINTENANCE_STATUSES = ['Reported', 'Acknowledged', 'AwaitingApproval', 'Assigned', 'Scheduled', 'InProgress', 'AwaitingTenant', 'Resolved', 'Cancelled'];
export const MAINTENANCE_STATUS_FLOW = [
  { value: 'Reported', label: 'Reported' },
  { value: 'Acknowledged', label: 'Acknowledged' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'AwaitingApproval', label: 'Awaiting approval' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'AwaitingTenant', label: 'Awaiting tenant' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Cancelled', label: 'Cancelled' }
];
export const MAINTENANCE_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
export const MAX_MAINTENANCE_EVIDENCE_FILES = 10;
const IMAGE_EVIDENCE_LIMIT = 10 * 1024 * 1024;
const VIDEO_EVIDENCE_LIMIT = 100 * 1024 * 1024;
export const normalizeWorkflowToken = (value) => String(value ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');
export const statusLabel = (value) => ({
  reported: 'Reported', acknowledged: 'Acknowledged', awaitingapproval: 'Awaiting approval', assigned: 'Assigned',
  scheduled: 'Scheduled', inprogress: 'In progress', awaitingtenant: 'Awaiting tenant', resolved: 'Resolved', cancelled: 'Cancelled'
}[normalizeWorkflowToken(value)] || 'Reported');

export function maintenanceStatusSelectionCommand({ status, currentStatus, userId }) {
  if (normalizeWorkflowToken(status) === 'assigned') {
    return {
      action: 'assign',
      body: { assignedToType: 'Self', assignedToUserId: userId, vendorId: null, estimateRequired: false }
    };
  }
  return { action: 'changeStatus', status, expectedStatus: currentStatus };
}

export function clearMaintenanceListFilters(filters = {}) {
  const scope = ['active', 'resolved', 'all'].includes(filters.scope) ? filters.scope : 'active';
  return {
    scope,
    search: '',
    priority: 'all',
    category: 'all',
    assignment: 'all'
  };
}

export function maintenanceScopeFromStatus(status) {
  return ['resolved', 'completed', 'closed', 'cancelled', 'canceled'].includes(normalizeWorkflowToken(status))
    ? 'resolved'
    : 'active';
}

export function maintenanceListEmptyMessage({ hasRequests, hasRefinements, scope, hasResolvedRequests }) {
  if (!hasRequests) return 'Tenant-submitted requests will appear here for review.';
  if (scope === 'active' && hasResolvedRequests) {
    return hasRefinements
      ? 'No active requests match these filters. Clear filters, or choose Resolved or All requests to view completed work.'
      : 'No active requests. Choose Resolved or All requests to view completed work.';
  }
  if (hasRefinements) return 'Try clearing or changing the current filters.';
  return `No ${scope === 'resolved' ? 'resolved ' : ''}maintenance requests are available.`;
}

export function maintenanceActorFromUser(user) {
  const rawRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  const roles = rawRoles.map((item) => normalizeWorkflowToken(typeof item === 'string' ? item : item?.roleName || item?.name));
  if (roles.includes('tenant')) return 'tenant';
  if (roles.includes('vendor')) return 'assigned';
  if (roles.includes('landlord') || roles.includes('admin')) return 'manager';
  return 'unknown';
}

const workflowRolesFromUser = (user) => {
  const rawRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  return rawRoles.map((item) => normalizeWorkflowToken(typeof item === 'string' ? item : item?.roleName || item?.name));
};

export function maintenanceActorForRoute(user, pathname = '', activeOrganization = null) {
  const roles = workflowRolesFromUser(user);
  const organizationRole = normalizeWorkflowToken(activeOrganization?.userRole || activeOrganization?.role || activeOrganization?.currentUserRole);
  const manager = roles.some((role) => ['landlord', 'admin'].includes(role)) || ['owner', 'manager', 'admin'].includes(organizationRole);
  const tenant = roles.includes('tenant');
  const vendor = roles.includes('vendor');
  if (String(pathname).startsWith('/landlord/')) return manager ? 'manager' : vendor ? 'assigned' : 'unknown';
  if (String(pathname).startsWith('/tenant/')) return tenant ? 'tenant' : 'unknown';
  if (manager) return 'manager';
  if (vendor) return 'assigned';
  if (tenant) return 'tenant';
  return 'unknown';
}

export const maintenanceUserId = (user) => Number(user?.Id ?? user?.id ?? user?.userId) || null;

export function evidenceSelection(existingFiles = [], candidateFiles = []) {
  const candidates = Array.from(candidateFiles || []);
  const errors = [];
  if (existingFiles.length + candidates.length > MAX_MAINTENANCE_EVIDENCE_FILES) errors.push('Evidence is limited to 10 files per submission.');
  for (const file of candidates) {
    if (!MAINTENANCE_EVIDENCE_TYPES.includes(file?.type)) errors.push(`${file?.name || 'File'} must be JPEG, PNG, WebP, MP4, or QuickTime.`);
    else if (file.type.startsWith('image/') && file.size > IMAGE_EVIDENCE_LIMIT) errors.push(`${file.name} exceeds the 10 MB image limit.`);
    else if (file.type.startsWith('video/') && file.size > VIDEO_EVIDENCE_LIMIT) errors.push(`${file.name} exceeds the 100 MB video limit.`);
  }
  return { accepted: errors.length ? [] : candidates, errors: [...new Set(errors)] };
}

export function createEvidenceUploadEntries(files, keyFactory = () => crypto.randomUUID()) {
  return Array.from(files || []).map((file) => ({ file, idempotencyKey: keyFactory(), status: 'pending', error: null }));
}

export async function uploadPendingEvidence(entries, upload) {
  const result = [];
  for (const entry of entries) {
    if (entry.status === 'uploaded') { result.push(entry); continue; }
    try {
      await upload(entry.file, entry.idempotencyKey);
      result.push({ ...entry, status: 'uploaded', error: null });
    } catch (error) {
      result.push({ ...entry, status: 'failed', error });
    }
  }
  return result;
}

export function workflowActivitiesFromMaintenanceDetail(detail) {
  if (Array.isArray(detail?.activityEvents)) return detail.activityEvents;
  return Array.isArray(detail?.activities) ? detail.activities : [];
}

export function workflowProjectionWarning(detail) {
  const updated = new Date(detail?.updatedAtUtc || detail?.updatedAt).getTime();
  const activities = workflowActivitiesFromMaintenanceDetail(detail);
  const latestActivity = Math.max(...activities.map((event) => new Date(event?.occurredAtUtc || event?.createdAtUtc || event?.createdAt).getTime()).filter(Number.isFinite));
  if (Number.isFinite(updated) && Number.isFinite(latestActivity) && updated > latestActivity) {
    return 'A workflow update is newer than the projected activity timeline. The timeline projection is pending; use the current status and resources above as authoritative.';
  }
  return null;
}

const latestBy = (items = [], field = 'version') => [...items].sort((a, b) => Number(b?.[field] || 0) - Number(a?.[field] || 0))[0] || null;

export function workflowFromMaintenanceDetail(detail) {
  const workOrders = Array.isArray(detail?.workOrders) ? detail.workOrders : [];
  const appointments = Array.isArray(detail?.appointments) ? detail.appointments : [];
  const completions = Array.isArray(detail?.completions) ? detail.completions : [];
  return {
    assignment: detail?.assignment || null,
    estimate: latestBy(Array.isArray(detail?.estimates) ? detail.estimates : []),
    workOrder: latestBy(workOrders.filter((item) => !['cancelled', 'canceled'].includes(normalizeWorkflowToken(item?.status)))) || latestBy(workOrders),
    appointment: latestBy(appointments.filter((item) => !['cancelled', 'canceled'].includes(normalizeWorkflowToken(item?.status)))) || latestBy(appointments),
    completion: latestBy(completions)
  };
}

export function classifySignals(signals = []) {
  const selected = new Set(signals.map(normalizeWorkflowToken));
  if (MAINTENANCE_SIGNALS.some((signal) => signal.urgency === 'emergency' && selected.has(normalizeWorkflowToken(signal.value)))) return 'Emergency';
  if (MAINTENANCE_SIGNALS.some((signal) => signal.urgency === 'urgent' && selected.has(normalizeWorkflowToken(signal.value)))) return 'Urgent';
  return 'Routine';
}

export const emergencyInstructions = (signals = []) => classifySignals(signals) === 'Emergency' ? {
  title: 'This may be an emergency',
  body: 'Move away from immediate danger. Call 911 for fire, suspected carbon monoxide, sparking, or any threat to life. For a gas odor, leave without using switches or flames and call the gas emergency line from outside. Shut off water only if it is safe and you know the valve location. Submitting this request does not replace emergency services.'
} : null;

export function buildCreateMaintenancePayload(intake) {
  const category = String(intake.category || 'General repair').trim();
  const access = intake.accessPermission === 'yes' ? 'Entry permitted' : intake.accessPermission === 'contact' ? 'Contact tenant before entry' : 'Entry not permitted without tenant present';
  const pets = intake.hasPets ? `Pets: ${String(intake.petDetails || 'Details not provided').trim()}` : 'Pets: none reported';
  return {
    propertyId: Number(intake.propertyId),
    unitId: Number(intake.unitId),
    title: `${category}: ${String(intake.description || '').trim()}`.slice(0, 100),
    description: String(intake.description || '').trim(),
    location: String(intake.location || '').trim(),
    signals: [...new Set(intake.signals || [])],
    hasPhotos: Boolean(intake.files?.length),
    preferredWindows: (intake.preferredWindows || []).slice(0, 3).filter((window) => window.startsAtUtc && window.endsAtUtc).map((window) => ({
      startsAtUtc: new Date(window.startsAtUtc).toISOString(),
      endsAtUtc: new Date(window.endsAtUtc).toISOString(),
      accessInstructions: [access, pets, window.accessInstructions].filter(Boolean).join('. ')
    }))
  };
}

export function slaState(deadline, now = new Date()) {
  if (!deadline) return { tone: 'default', label: 'No SLA set', overdue: false, milliseconds: null };
  const due = new Date(deadline); const current = new Date(now);
  if (!Number.isFinite(due.getTime()) || !Number.isFinite(current.getTime())) return { tone: 'default', label: 'Invalid SLA', overdue: false, milliseconds: null };
  const milliseconds = due - current; const hours = Math.ceil(Math.abs(milliseconds) / 3600000);
  if (milliseconds < 0) return { tone: 'error', label: `${hours}h overdue`, overdue: true, milliseconds };
  if (milliseconds <= 4 * 3600000) return { tone: 'warning', label: `${hours}h remaining`, overdue: false, milliseconds };
  return { tone: 'success', label: `${hours}h remaining`, overdue: false, milliseconds };
}

export function availableMaintenanceActions({ role, request, workflow = {}, userId = null }) {
  const status = normalizeWorkflowToken(request?.status);
  const manager = role === 'manager';
  const assigned = role === 'assigned' || Boolean(userId && Number(workflow.assignment?.assignedToUserId) === Number(userId));
  const tenant = role === 'tenant';
  const terminal = ['resolved', 'cancelled'].includes(status);
  const workOrderStatus = normalizeWorkflowToken(workflow.workOrder?.status);
  const appointmentStatus = normalizeWorkflowToken(workflow.appointment?.status);
  const completionStatus = normalizeWorkflowToken(workflow.completion?.status);
  const hasActiveWorkOrder = ['issued', 'accepted', 'inprogress'].includes(workOrderStatus);
  return {
    acknowledge: manager && status === 'reported',
    assign: manager && !['inprogress', 'awaitingtenant', 'resolved', 'cancelled'].includes(status),
    submitEstimate: (manager || assigned) && !terminal && Boolean(workflow.assignment) && !['submitted', 'approved'].includes(normalizeWorkflowToken(workflow.estimate?.status)),
    decideEstimate: manager && normalizeWorkflowToken(workflow.estimate?.status) === 'submitted',
    issueWorkOrder: manager && !terminal && Boolean(workflow.assignment) && !hasActiveWorkOrder && (!workflow.assignment.estimateRequired || normalizeWorkflowToken(workflow.estimate?.status) === 'approved'),
    cancelWorkOrder: manager && workOrderStatus === 'issued',
    schedule: (manager || assigned) && !terminal && workOrderStatus === 'issued',
    confirmAppointment: tenant && !terminal && appointmentStatus === 'proposed',
    cancelAppointment: (manager || assigned || tenant) && !terminal && ['proposed', 'confirmed'].includes(appointmentStatus),
    start: (manager || assigned) && !terminal && workOrderStatus === 'issued',
    complete: (manager || assigned) && !terminal && workOrderStatus === 'inprogress' && completionStatus !== 'submitted',
    decideCompletion: tenant && status === 'awaitingtenant' && completionStatus === 'submitted',
    staffClose: manager && status === 'awaitingtenant' && completionStatus === 'submitted' && new Date(workflow.completion.tenantConfirmationDueAtUtc) <= new Date()
  };
}

export function tenantEvidencePurpose(request) {
  const status = normalizeWorkflowToken(request?.status);
  if (status === 'reported') return 'Intake';
  if (status === 'assigned' && Number(request?.resolutionCycle) > 1) return 'Reopen';
  return null;
}

export const currentCycleTroubleshootingSteps = (request) => {
  const cycleKey = String(request?.resolutionCycle ?? '');
  return Array.isArray(request?.troubleshootingSteps)
    ? request.troubleshootingSteps.filter((step) => String(step?.resolutionCycleKey ?? '') === cycleKey)
    : [];
};

export const safeTroubleshootingStep = (category) => ({
  hvac: 'check-thermostat-settings', electrical: 'check-gfci-reset', plumbing: 'check-faucet-aerator'
}[normalizeWorkflowToken(category)] || null);
