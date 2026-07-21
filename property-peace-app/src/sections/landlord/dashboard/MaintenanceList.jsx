import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { selectDashboardSummary, selectDashboardLoading } from 'store/dashboard/dashboard.selector';
import { selectProperty } from 'store/property/property.selector';
import CircularLoader from 'components/CircularLoader';
import moment from 'moment';
import { isClosedMaintenanceStatus, isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

const PRIORITY_STYLES = {
  high:   { bg: '#fdecea', color: '#c62828', label: 'HIGH' },
  medium: { bg: '#fff3e0', color: '#e65100', label: 'MED' },
  med:    { bg: '#fff3e0', color: '#e65100', label: 'MED' },
  low:    { bg: '#e8f5e9', color: '#2e7d32', label: 'LOW' }
};

function PriorityBadge({ priority }) {
  const key = (priority || '').toLowerCase();
  const style = PRIORITY_STYLES[key] || PRIORITY_STYLES.medium;
  return (
    <Box
      sx={{
        px: 0.75,
        py: 0.2,
        borderRadius: 0.75,
        bgcolor: style.bg,
        color: style.color,
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0
      }}
    >
      {style.label}
    </Box>
  );
}

export default function MaintenanceList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const dashboardSummary = useSelector(selectDashboardSummary);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const selectedProperty = useSelector(selectProperty);

  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];

  const filteredByProperty = useMemo(() => {
    if (!selectedProperty?.id) return allRequests;
    return allRequests.filter((r) => (r.propertyId || r.PropertyId) === selectedProperty.id);
  }, [allRequests, selectedProperty]);

  const statusCounts = useMemo(() => {
    let completed = 0, inProgress = 0, open = 0, high = 0;
    filteredByProperty.forEach((r) => {
      const s = (r.status || r.Status || '').toLowerCase();
      const p = (r.priority || r.Priority || '').toLowerCase();
      if (isClosedMaintenanceStatus(s)) completed++;
      else if (s === 'inprogress' || s === 'in-progress' || s === 'in progress') inProgress++;
      else if (s === 'reported') open++;
      if (p === 'high' && isOpenMaintenanceRequest(r)) high++;
    });
    return { completed, inProgress, open, high };
  }, [filteredByProperty]);

  const activeRequests = filteredByProperty.filter(isOpenMaintenanceRequest);

  const displayRequests = activeRequests.slice(0, 5);

  const STAT_ITEMS = [
    { label: 'Open',        value: statusCounts.open,       color: theme.palette.info.main },
    { label: 'Completed',   value: statusCounts.completed,   color: theme.palette.success.main },
    { label: 'In Progress', value: statusCounts.inProgress,  color: theme.palette.warning.main },
    { label: 'High',        value: statusCounts.high,        color: theme.palette.error.main }
  ];

  return (
    <MainCard
      title={
        <Box>
          <Typography
            variant="overline"
            fontWeight={700}
            sx={{ fontSize: '0.875rem', letterSpacing: 1, color: (t) => t.palette.mode === 'dark' ? t.palette.text.secondary : 'rgba(0,0,0,0.48)', display: 'block', lineHeight: 1.5 }}
          >
            MAINTENANCE QUEUE
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {statusCounts.open} open request{statusCounts.open !== 1 ? 's' : ''}
          </Typography>
        </Box>
      }
      secondary={
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          onClick={() => navigate('/landlord/maintenances')}
          sx={{ cursor: 'pointer', opacity: 0.75, '&:hover': { opacity: 1 } }}
        >
          <Typography variant="body2" fontWeight={500} color="primary" sx={{ fontSize: '0.8rem' }}>
            view all
          </Typography>
          <ArrowRightOutlined style={{ fontSize: 12, color: theme.palette.primary.main }} />
        </Stack>
      }
      contentSX={{ pt: 1.5, pb: 1 }}
      sx={{ '& .MuiCardHeader-root': { pb: 1 } }}
    >
      {/* Stats row */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {STAT_ITEMS.map((s) => (
          <Box
            key={s.label}
            onClick={() => navigate('/landlord/maintenances')}
            sx={{
              flex: 1,
              textAlign: 'center',
              py: 1,
              border: '1.5px dashed',
              borderColor: alpha(theme.palette.divider, 0.4),
              borderRadius: 1.5,
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { bgcolor: alpha(s.color, 0.05) }
            }}
          >
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2, color: s.color }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {s.label}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Request list — fixed height for exactly 5 rows */}
      <Box sx={{ height: 5 * 52 }}>
        {dashboardLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
            <CircularLoader />
          </Box>
        ) : (
          <Stack sx={{ height: '100%' }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const request = displayRequests[i];
              if (!request) {
                return (
                  <Box
                    key={`empty-${i}`}
                    sx={{
                      height: 52,
                      flexShrink: 0,
                      borderBottom: i < 4 ? `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.65 : 0.35)}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      px: 1
                    }}
                  >
                    <Box sx={{ width: '40%', height: 10, borderRadius: 1, bgcolor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.45 : 0.25) }} />
                  </Box>
                );
              }
              const priority = request.priority || request.Priority || 'medium';
              const createdAt = request.createdAt || request.CreatedAt;
              const propertyName = request.propertyName || request.PropertyName || '';
              const unitInfo = request.unitName || request.UnitName || request.unitNumber || request.UnitNumber || '';
              const locationStr = [propertyName, unitInfo].filter(Boolean).join(' · ');
              return (
                <Box
                  key={request.id || i}
                  onClick={() => navigate(`/landlord/maintenance/${request.id}`)}
                  sx={{
                    height: 52,
                    flexShrink: 0,
                    px: 1,
                    mx: -1,
                    cursor: 'pointer',
                    borderBottom: i < 4 ? `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.9 : 0.6)}` : 'none',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} sx={{ width: '100%' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={600}
                        sx={{ lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {request.title || request.Title || 'Maintenance Request'}
                      </Typography>
                      {locationStr && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {locationStr}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
                      {createdAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {moment(createdAt).format('MMM D')}
                        </Typography>
                      )}
                      <PriorityBadge priority={priority} />
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </MainCard>
  );
}
