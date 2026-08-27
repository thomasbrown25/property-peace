import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, Chip, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined, ToolOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';

const STATUS_DETAILS = {
  reported: { label: 'Reported', color: 'info' },
  acknowledged: { label: 'Acknowledged', color: 'primary' },
  assigned: { label: 'Assigned', color: 'primary' },
  scheduled: { label: 'Scheduled', color: 'warning' },
  inprogress: { label: 'In progress', color: 'warning' },
  awaitingtenant: { label: 'Awaiting tenant', color: 'default' },
  awaitingapproval: { label: 'Awaiting approval', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'default' }
};

const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');

function statusDetails(value) {
  const normalized = normalize(value);
  return (
    STATUS_DETAILS[normalized] || {
      label: value ? String(value).replace(/([a-z])([A-Z])/g, '$1 $2') : 'Reported',
      color: 'default'
    }
  );
}

function timeValue(request) {
  const value = read(request, 'createdAt', 'CreatedAt');
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function locationLabel(request) {
  return [read(request, 'propertyName', 'PropertyName'), read(request, 'unitName', 'UnitName')].filter(Boolean).join(' · ');
}

function MaintenanceRow({ request, isLast, onClick }) {
  const theme = useTheme();
  const status = statusDetails(read(request, 'status', 'Status'));
  const title = read(request, 'title', 'Title') || 'Maintenance request';
  const location = locationLabel(request);

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`Open maintenance request: ${title}`}
      sx={{
        width: '100%',
        minHeight: 62,
        px: 0.5,
        py: 1.1,
        border: 0,
        borderBottom: isLast ? 0 : `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        bgcolor: 'transparent',
        color: 'text.primary',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background-color 150ms ease, transform 150ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.055), transform: 'translateX(2px)' },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`, outlineOffset: -2, borderRadius: 1 }
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.25}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
            {location || 'Portfolio request'}
          </Typography>
        </Box>
        <Chip label={status.label} color={status.color} size="small" variant="outlined" sx={{ flexShrink: 0, fontWeight: 650 }} />
      </Stack>
    </Box>
  );
}

export default function Maintenance({ requests = [], isLoading = false, hasError = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const latestRequests = useMemo(() => [...requests].sort((a, b) => timeValue(b) - timeValue(a)).slice(0, 3), [requests]);

  return (
    <MainCard
      accentColor={theme.palette.warning.main}
      accentShadow
      title={
        <Stack direction="row" spacing={1} alignItems="center">
          <ToolOutlined style={{ color: theme.palette.warning.main }} />
          <Typography variant="h5" fontWeight={700}>
            Maintenance
          </Typography>
        </Stack>
      }
      secondary={
        <Button
          size="small"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/maintenances')}
          sx={{ color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          View all
        </Button>
      }
      sx={{ height: '100%' }}
      contentSX={{ pt: 0.75, pb: 1 }}
    >
      <Box aria-busy={isLoading} aria-live="polite">
        {isLoading ? (
          <Stack spacing={0.5} role="status" aria-label="Loading maintenance requests">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={57} />
            ))}
          </Stack>
        ) : hasError ? (
          <Box role="alert" sx={{ minHeight: 184, display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Unable to load maintenance
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Open Maintenance to try again.
              </Typography>
            </Box>
          </Box>
        ) : latestRequests.length ? (
          latestRequests.map((request, index) => (
            <MaintenanceRow
              key={read(request, 'id', 'Id') ?? index}
              request={request}
              isLast={index === latestRequests.length - 1}
              onClick={() => navigate(`/landlord/maintenance/${read(request, 'id', 'Id')}`)}
            />
          ))
        ) : (
          <Box sx={{ minHeight: 184, display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                No current maintenance requests
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New requests and their status will appear here.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </MainCard>
  );
}
