import PropTypes from 'prop-types';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { alpha, Avatar, Box, Chip, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const formatDate = (value) => {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Date not set';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function UpcomingRow({ entry, onRecord, onToggle, onDelete, busy = false }) {
  const theme = useTheme();
  const recurring = entry.type === 'Recurring';
  const name = entry.name || 'Untitled expense';
  const propertyName = entry.propertyName || 'Property not recorded';
  const unitName = entry.unitName && entry.unitName !== 'Property level' ? entry.unitName : '';
  const timingLabel = recurring ? 'Next due' : 'Due date';
  const toggleLabel = entry.isPaused ? 'Resume schedule' : 'Pause schedule';
  const deleteLabel = recurring ? 'Delete recurring schedule' : 'Delete one-time expense';

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.45fr) minmax(180px, 1fr) minmax(145px, .8fr) minmax(105px, .58fr) minmax(130px, .7fr)',
        gap: { xs: 1.2, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
          {recurring ? <ReloadOutlined /> : <ClockCircleOutlined />}
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{name}</Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.35 }}>
            <Chip
              label={entry.type}
              size="small"
              color={recurring ? 'primary' : 'info'}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
            <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {entry.category || 'Uncategorized'}
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Box sx={{ mt: { xs: 1.05, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>Property:</Typography>
        <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{propertyName}</Typography>
        {unitName && <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{unitName}</Typography>}
      </Box>

      <Box sx={{ mt: { xs: 0.8, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>{timingLabel}:</Typography>
        <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{formatDate(entry.actionDate)}</Typography>
        {recurring && (
          <Stack direction="row" spacing={0.6} sx={{ mt: 0.45 }}>
            <Chip
              label={entry.isPaused ? 'Paused' : entry.frequency || 'Active'}
              size="small"
              color={entry.isPaused ? 'warning' : 'success'}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          </Stack>
        )}
      </Box>

      <Typography sx={{ mt: { xs: 0.8, md: 0 }, fontSize: '0.92rem', fontWeight: 750, textAlign: { md: 'right' } }}>
        <Box component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', fontWeight: 400, color: 'text.secondary' }}>Amount:</Box>
        {money.format(Number(entry.amount) || 0)}
      </Typography>

      <Stack direction="row" spacing={0.4} justifyContent={{ xs: 'flex-end', md: 'flex-start' }} sx={{ mt: { xs: 0.75, md: 0 } }}>
        <Tooltip title="Record as paid">
          <span><IconButton size="small" color="success" disabled={busy} aria-label={`Record ${name} as paid`} onClick={() => onRecord(entry)}><CheckCircleOutlined /></IconButton></span>
        </Tooltip>
        {recurring && (
          <Tooltip title={toggleLabel}>
            <span><IconButton size="small" disabled={busy} aria-label={`${toggleLabel} for ${name}`} onClick={() => onToggle(entry)}>{entry.isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}</IconButton></span>
          </Tooltip>
        )}
        <Tooltip title={deleteLabel}>
          <span><IconButton size="small" color="error" disabled={busy} aria-label={`${deleteLabel}: ${name}`} onClick={() => onDelete(entry)}><DeleteOutlined /></IconButton></span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

UpcomingRow.propTypes = {
  entry: PropTypes.shape({
    key: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['Recurring', 'One-time']).isRequired,
    name: PropTypes.string,
    category: PropTypes.string,
    propertyName: PropTypes.string,
    unitName: PropTypes.string,
    amount: PropTypes.number,
    actionDate: PropTypes.string,
    frequency: PropTypes.string,
    isPaused: PropTypes.bool,
    source: PropTypes.object.isRequired
  }).isRequired,
  onRecord: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  busy: PropTypes.bool
};
