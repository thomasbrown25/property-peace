import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';
import { normalizeWorkflowToken } from 'utils/maintenanceWorkflow';
import { maintenanceActionSelected, maintenanceActionUnavailable } from './maintenanceActionState.mjs';

const maintenanceActions = [
  { key: 'acknowledge', label: 'Acknowledge', description: 'Confirm you received this request.', status: 'Acknowledged', icon: 'check' },
  { key: 'assign', label: 'Assign', description: 'Choose a team member or vendor to handle the request.', status: 'Assigned', icon: 'team', opensDrawer: true },
  { key: 'schedule', label: 'Schedule', description: 'Create a calendar task and mark the request as scheduled.', status: 'Scheduled', icon: 'calendar', opensDrawer: true },
  { key: 'expense', label: 'Add expense', description: 'Record a cost against this request.', icon: 'dollarCircle', opensDrawer: true },
  { key: 'in-progress', label: 'Set to In Progress', description: 'Mark that work on this request has started.', status: 'InProgress', icon: 'playCircle' },
  { key: 'await-tenant', label: 'Set to Await Tenant', description: 'Mark that you’re waiting for a response from the tenant.', status: 'AwaitingTenant', icon: 'activity' },
  { key: 'resolve', label: 'Resolve', description: 'Mark this request as completed.', status: 'Resolved', icon: 'check' },
  { key: 'cancel', label: 'Cancel', description: 'Close the request as cancelled.', status: 'Cancelled', icon: 'close', destructive: true }
];

export default function MaintenanceActions({ currentStatus, busy, defaultOpen, onAcknowledge, onAssign, onSchedule, onAddExpense, onStatusChange }) {
  const currentToken = normalizeWorkflowToken(currentStatus);
  const operations = {
    acknowledge: () => currentToken === 'reported' ? onAcknowledge() : onStatusChange('Acknowledged'),
    assign: onAssign,
    schedule: onSchedule,
    expense: onAddExpense
  };
  const actions = maintenanceActions.map((action) => ({
    ...action,
    disabled: maintenanceActionUnavailable(action.key, currentStatus, busy),
    selected: maintenanceActionSelected(action.key, currentStatus),
    current: Boolean(action.status && !action.opensDrawer && normalizeWorkflowToken(action.status) === currentToken),
    working: busy === action.key || busy === `status:${action.status}`,
    onSelect: operations[action.key] ?? (() => onStatusChange(action.status))
  }));

  return <ActionsDrawer id="maintenance-actions-drawer" title="Maintenance actions" actions={actions} defaultOpen={defaultOpen} />;
}
