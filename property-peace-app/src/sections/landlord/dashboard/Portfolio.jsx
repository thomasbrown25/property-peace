import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, Grid, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined, DollarCircleOutlined, HomeOutlined, WarningOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { isHighPriorityMaintenanceRequest } from 'utils/maintenanceStatus';

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getUnits = (property) => read(property, 'units', 'Units') || [];
const getMaintenance = (property) => read(property, 'maintenanceRequests', 'MaintenanceRequests') || [];
const getLease = (unit) => read(unit, 'lease', 'Lease');
const getUnitStatus = (unit) => String(read(unit, 'status', 'Status') || '').toLowerCase();
const isOccupiedUnit = (unit) => ['occupied', 'overdue'].includes(getUnitStatus(unit));
const isOverdueUnit = (unit) => getUnitStatus(unit) === 'overdue';
const isActiveProperty = (property) => read(property, 'isActive', 'IsActive') !== false;

function getRentAmount(unit) {
  const lease = getLease(unit);
  return Number(read(lease, 'rentAmount', 'RentAmount') || read(unit, 'rentAmount', 'RentAmount') || 0);
}

function hasExpiringLease(unit) {
  const lease = getLease(unit);
  const rawEndDate = read(lease, 'endDate', 'EndDate');
  if (!rawEndDate) return false;

  const endDate = new Date(rawEndDate);
  if (Number.isNaN(endDate.getTime())) return false;

  const daysToLeaseEnd = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
  return daysToLeaseEnd >= 0 && daysToLeaseEnd <= 60;
}

export function getPortfolioMetrics(properties = []) {
  const activeProperties = properties.filter(isActiveProperty);
  const units = activeProperties.flatMap(getUnits);
  const occupiedUnits = units.filter(isOccupiedUnit).length;
  const vacantUnits = Math.max(units.length - occupiedUnits, 0);
  const monthlyRent = units.reduce((total, unit) => total + getRentAmount(unit), 0);
  const needsAttention = activeProperties.filter((property) => {
    const propertyUnits = getUnits(property);
    const hasOverdueUnit = propertyUnits.some(isOverdueUnit);
    const hasUrgentMaintenance = getMaintenance(property).some(isHighPriorityMaintenanceRequest);
    const hasLeaseExpiringSoon = propertyUnits.some(hasExpiringLease);
    return hasOverdueUnit || hasUrgentMaintenance || hasLeaseExpiringSoon;
  }).length;

  return {
    occupancy: units.length ? Math.round((occupiedUnits / units.length) * 100) : 0,
    occupiedUnits,
    totalUnits: units.length,
    vacantUnits,
    monthlyRent,
    needsAttention
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function PortfolioStat({ label, value, helper, color, icon, loading }) {
  const theme = useTheme();
  const overviewTextColor = theme.palette.mode === 'dark' ? theme.palette.common.white : 'text.primary';

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 116,
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.3 : 0.16)}`,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.08 : 0.035),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="caption" sx={{ color: overviewTextColor, fontWeight: 700, letterSpacing: 0.45, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.25,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color,
            bgcolor: alpha(color, 0.12)
          }}
        >
          {icon}
        </Box>
      </Stack>

      <Box sx={{ mt: 1.25 }}>
        {loading ? (
          <>
            <Skeleton width="55%" height={34} />
            <Skeleton width="78%" height={18} />
          </>
        ) : (
          <>
            <Typography variant="h4" fontWeight={750} sx={{ color: overviewTextColor, lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {helper}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function Portfolio({ properties = [], isLoading = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const metrics = useMemo(() => getPortfolioMetrics(properties), [properties]);
  const headerTextColor = theme.palette.mode === 'dark' ? theme.palette.common.white : '#061e35';
  const stats = [
    {
      label: 'Portfolio occupancy',
      value: `${metrics.occupancy}%`,
      helper: `${metrics.occupiedUnits} of ${metrics.totalUnits} units occupied`,
      color: theme.palette.success.main,
      icon: <HomeOutlined />
    },
    {
      label: 'Vacant units',
      value: metrics.vacantUnits,
      helper: 'Across active properties',
      color: theme.palette.warning.main,
      icon: <HomeOutlined />
    },
    {
      label: 'Monthly rent',
      value: formatMoney(metrics.monthlyRent),
      helper: 'Scheduled rent, not collections',
      color: theme.palette.primary.main,
      icon: <DollarCircleOutlined />
    },
    {
      label: 'Needs attention',
      value: metrics.needsAttention,
      helper: 'Overdue, urgent, or expiring',
      color: theme.palette.error.main,
      icon: <WarningOutlined />
    }
  ];

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Typography variant="h5" fontWeight={700} sx={{ color: headerTextColor }}>
          Portfolio
        </Typography>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/properties')}
          sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          View properties
        </Button>
      }
      contentSX={{ pt: 1.5 }}
    >
      <Grid container spacing={1.5}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 6, lg: 3 }}>
            <PortfolioStat {...stat} loading={isLoading} />
          </Grid>
        ))}
      </Grid>
    </MainCard>
  );
}
