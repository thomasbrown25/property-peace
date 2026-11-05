import { normalizeWorkflowToken } from '../../utils/maintenanceWorkflow.js';

// Quick actions show the milestones explicitly called out in the request workflow.
// Assignment and scheduling are separate operations, not evidence that a milestone was completed.
export function maintenanceActionSelected(key, status) {
  const current = normalizeWorkflowToken(status);
  if (key === 'acknowledge') return ['acknowledged', 'assigned', 'awaitingapproval', 'scheduled', 'inprogress', 'awaitingtenant'].includes(current);
  if (key === 'in-progress') return ['inprogress', 'awaitingtenant'].includes(current);
  if (key === 'await-tenant') return current === 'awaitingtenant';
  return ({ assign: 'assigned', schedule: 'scheduled', resolve: 'resolved', cancel: 'cancelled' })[key] === current;
}

export function maintenanceActionUnavailable(key, status, busy) {
  const current = normalizeWorkflowToken(status);
  if (busy) return true;
  if (key === 'assign' || key === 'schedule') return ['resolved', 'cancelled'].includes(current) || (key === 'schedule' && current === 'scheduled');
  return ({ acknowledge: 'acknowledged', 'in-progress': 'inprogress', 'await-tenant': 'awaitingtenant', cancel: 'cancelled', resolve: 'resolved' })[key] === current;
}
