import { Stack, Typography, useTheme } from '@mui/material';
import { CalendarOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons';
import { isHighPriorityMaintenanceRequest } from 'utils/maintenanceStatus';

const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

// The Properties page can pass its existing summary; Today uses the same source fields.
export function getPropertyOperations(property) {
  const units = read(property, 'units', 'Units') || [];
  const overdue = units.filter((unit) => String(read(unit, 'status', 'Status') || '').toLowerCase() === 'overdue').length;
  const urgentMaintenance = (read(property, 'maintenanceRequests', 'MaintenanceRequests') || []).filter(isHighPriorityMaintenanceRequest).length;
  const ends = units.map((unit) => read(read(unit, 'lease', 'Lease'), 'endDate', 'EndDate'))
    .map((value) => value ? new Date(value) : null)
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);
  const nextLeaseEnd = ends.find((date) => date >= new Date()) || ends[0] || null;
  const daysToLeaseEnd = nextLeaseEnd ? Math.ceil((nextLeaseEnd.getTime() - Date.now()) / 86400000) : null;
  return { overdue, urgentMaintenance, nextLeaseEnd, expiringSoon: daysToLeaseEnd !== null && daysToLeaseEnd >= 0 && daysToLeaseEnd <= 60 };
}

export default function PropertyOperations({ property, summary = getPropertyOperations(property) }) {
  const theme = useTheme();
  return (
    <Stack spacing={0.55}>
      {summary.overdue > 0 && (
        <Stack direction="row" spacing={0.65} alignItems="center">
          <WarningOutlined style={{ color: theme.palette.error.main, fontSize: 13 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 650, color: 'error.main' }}>{summary.overdue} overdue unit{summary.overdue === 1 ? '' : 's'}</Typography>
        </Stack>
      )}
      {summary.urgentMaintenance > 0 && (
        <Stack direction="row" spacing={0.65} alignItems="center">
          <ToolOutlined style={{ color: theme.palette.warning.main, fontSize: 13 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 650, color: 'warning.main' }}>{summary.urgentMaintenance} urgent ticket{summary.urgentMaintenance === 1 ? '' : 's'}</Typography>
        </Stack>
      )}
      <Stack direction="row" spacing={0.65} alignItems="center">
        <CalendarOutlined style={{ color: theme.palette.text.secondary, fontSize: 13 }} />
        <Typography sx={{ fontSize: '0.75rem', color: summary.expiringSoon ? 'warning.main' : 'text.secondary', fontWeight: summary.expiringSoon ? 650 : 400 }}>
          {summary.nextLeaseEnd ? `Next lease ${summary.nextLeaseEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No upcoming lease end'}
        </Typography>
      </Stack>
    </Stack>
  );
}
