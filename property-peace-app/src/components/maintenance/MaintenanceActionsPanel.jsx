import { Button, Chip, CircularProgress, Paper, Stack, Typography, alpha } from '@mui/material';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { normalizeWorkflowToken, statusLabel } from 'utils/maintenanceWorkflow';

const NAVY = '#061e35';

export const MAINTENANCE_DETAIL_ACTIONS = [
  { key: 'acknowledge', label: 'Acknowledge', status: 'Acknowledged', icon: CheckCircleOutlined },
  { key: 'assign', label: 'Assign', status: 'Assigned', icon: TeamOutlined, drawer: 'assignment' },
  { key: 'schedule', label: 'Schedule', status: 'Scheduled', icon: CalendarOutlined, drawer: 'schedule' },
  { key: 'expense', label: 'Add Expense', icon: DollarOutlined, drawer: 'expense' },
  { key: 'in-progress', label: 'Set to In Progress', status: 'InProgress', icon: PlayCircleOutlined },
  { key: 'await-tenant', label: 'Set to Await Tenant', status: 'AwaitingTenant', icon: ClockCircleOutlined },
  { key: 'cancel', label: 'Cancel', status: 'Cancelled', icon: CloseCircleOutlined, color: 'error' },
  { key: 'resolve', label: 'Resolve', status: 'Resolved', icon: CheckCircleOutlined, color: 'success' }
];

export default function MaintenanceActionsPanel({ currentStatus, busy, onAcknowledge, onAssign, onSchedule, onAddExpense, onStatusChange }) {
  const currentToken = normalizeWorkflowToken(currentStatus);

  const runAction = (action) => {
    if (action.key === 'acknowledge') return onAcknowledge();
    if (action.key === 'assign') return onAssign();
    if (action.key === 'schedule') return onSchedule();
    if (action.key === 'expense') return onAddExpense();
    return onStatusChange(action.status);
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="maintenance-actions-heading"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        boxShadow: `0 8px 28px ${alpha(NAVY, 0.07)}`,
        position: { lg: 'sticky' },
        top: { lg: 88 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5} sx={{ mb: 2 }}>
        <Stack spacing={0.25}>
          <Typography variant="overline" color="text.secondary" fontWeight={800}>QUICK ACTIONS</Typography>
          <Typography id="maintenance-actions-heading" variant="h5" fontWeight={850}>Actions</Typography>
        </Stack>
        <Chip size="small" label={statusLabel(currentStatus)} sx={{ fontWeight: 750 }} />
      </Stack>

      <Stack spacing={1}>
        {MAINTENANCE_DETAIL_ACTIONS.map((action) => {
          const Icon = action.icon;
          const isCurrentStatus = action.status && !action.drawer && normalizeWorkflowToken(action.status) === currentToken;
          const acknowledgeUnavailable = action.key === 'acknowledge' && currentToken !== 'reported';
          const assignmentUnavailable = ['inprogress', 'resolved', 'cancelled'].includes(currentToken) && action.key === 'assign';
          const scheduleUnavailable = ['scheduled', 'resolved', 'cancelled'].includes(currentToken) && action.key === 'schedule';
          const disabled = Boolean(busy) || isCurrentStatus || acknowledgeUnavailable || assignmentUnavailable || scheduleUnavailable;
          const isWorking = busy === action.key || busy === `status:${action.status}`;

          return (
            <Button
              key={action.key}
              type="button"
              fullWidth
              variant={action.key === 'acknowledge' ? 'contained' : 'outlined'}
              color={action.color || 'primary'}
              startIcon={isWorking ? <CircularProgress size={15} color="inherit" /> : <Icon />}
              disabled={disabled}
              aria-current={isCurrentStatus ? 'step' : undefined}
              onClick={() => runAction(action)}
              sx={{
                minHeight: 44,
                justifyContent: 'flex-start',
                px: 1.75,
                textTransform: 'none',
                fontWeight: 780,
                borderColor: action.key === 'cancel' ? 'error.light' : undefined
              }}
            >
              {isWorking ? 'Working…' : action.label}
            </Button>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2, color: 'text.secondary' }}>
        <PauseCircleOutlined />
        <Typography variant="caption">Assignment, scheduling, and expenses open with this request prefilled.</Typography>
      </Stack>
    </Paper>
  );
}
