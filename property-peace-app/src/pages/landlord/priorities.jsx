import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  alpha, Box, Button, Chip, Divider, FormControl, Grid,
  InputLabel, MenuItem, OutlinedInput, Select, Stack,
  ToggleButton, ToggleButtonGroup, Typography, useTheme
} from '@mui/material';
import {
  ArrowRightOutlined, FilterOutlined, WarningOutlined,
  ToolOutlined, FileTextOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { differenceInDays, parseISO } from 'date-fns';
import MainCard from 'components/MainCard';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchDashboard from 'hooks/useFetchDashboard';
import { formatCurrency } from 'utils/formatters';

const TYPE_CONFIG = {
  OVERDUE:     { label: 'Overdue',     color: 'error',   icon: <WarningOutlined /> },
  URGENT:      { label: 'Urgent',      color: 'error',   icon: <ToolOutlined /> },
  MAINTENANCE: { label: 'Maintenance', color: 'warning', icon: <ToolOutlined /> },
  LEASE:       { label: 'Lease',       color: 'warning', icon: <FileTextOutlined /> }
};

function PriorityDot({ color }) {
  return (
    <Box sx={{
      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
      bgcolor: color, boxShadow: `0 0 5px ${alpha(color, 0.45)}`
    }} />
  );
}

function PriorityRow({ item, isLast }) {
  const theme = useTheme();
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.MAINTENANCE;
  const chipColor = theme.palette[cfg.color]?.main || theme.palette.warning.main;

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          py: 1.75,
          px: 2.5,
          bgcolor: item.urgent ? alpha(theme.palette.error.main, 0.04) : 'transparent',
          transition: 'background 0.15s',
          '&:hover': {
            bgcolor: item.urgent
              ? alpha(theme.palette.error.main, 0.08)
              : alpha(theme.palette.action.hover, 0.04)
          }
        }}
      >
        {/* Left: dot + type chip + text */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0, flex: 1 }}>
          <PriorityDot color={chipColor} />
          <Box sx={{ width: 100, flexShrink: 0 }}>
            <Chip
              label={item.type}
              size="small"
              sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.5,
                bgcolor: alpha(chipColor, 0.12), color: chipColor,
                '& .MuiChip-label': { px: 0.75 }
              }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" fontWeight={600} sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
              {item.title}
            </Typography>
            {item.description && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                {item.description}
              </Typography>
            )}
            {item.propertyName && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem', display: 'block' }}>
                {item.propertyName}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Right: action button */}
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowRightOutlined style={{ fontSize: 11 }} />}
          onClick={item.onAction}
          sx={{
            textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
            px: 2, py: 0.5, flexShrink: 0, whiteSpace: 'nowrap'
          }}
        >
          {item.actionLabel}
        </Button>
      </Stack>
      {!isLast && (
        <Box sx={{ borderBottom: `1px solid rgba(0,0,0,0.08)`, mx: 0 }} />
      )}
    </>
  );
}

export default function PrioritiesPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useFetchProperties();
  useFetchDashboard();

  const properties = useSelector(selectProperties);
  const dashboardSummary = useSelector(selectDashboardSummary);
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];

  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');

  const propertyOptions = useMemo(() =>
    (properties || []).map((p) => ({ id: p.id || p.Id, name: p.name || p.Name })),
    [properties]
  );

  const allPriorities = useMemo(() => {
    const items = [];

    // Overdue rent
    (properties || []).forEach((p) => {
      const pId = p.id || p.Id;
      const pName = p.name || p.Name;
      (p.units || p.Units || []).forEach((u) => {
        const unitStatus = (u.status || u.Status || '').toLowerCase();
        if (unitStatus !== 'overdue') return;
        const lease = u.lease || u.Lease;
        const tenantName = u.tenantName || u.TenantName || lease?.tenants?.[0]?.firstname || '';
        const propertyLabel = `${pName}${u.name || u.Name ? `, ${u.name || u.Name}` : ''}`;
        const rentDue = lease?.rentDueDate || lease?.RentDueDate;
        const daysOverdue = rentDue ? differenceInDays(new Date(), parseISO(rentDue)) : null;
        const overdueAmt = lease?.overdueAmount || lease?.OverdueAmount;
        items.push({
          id: `overdue-${lease?.id || lease?.Id}`,
          propertyId: pId, propertyName: pName,
          type: 'OVERDUE', urgent: true,
          title: `Rent overdue · ${propertyLabel}`,
          description: [
            tenantName,
            daysOverdue ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} late` : null,
            overdueAmt ? formatCurrency(overdueAmt) : null
          ].filter(Boolean).join(' · '),
          actionLabel: 'Review',
          onAction: () => navigate('/landlord/accounting')
        });
      });
    });

    // High priority maintenance
    allRequests
      .filter((r) =>
        (r.priority || '').toLowerCase() === 'high' &&
        !['completed', 'cancelled'].includes((r.status || '').toLowerCase())
      )
      .forEach((m) => {
        items.push({
          id: `maint-high-${m.id || m.Id}`,
          propertyId: m.propertyId || m.PropertyId,
          propertyName: m.propertyName || m.PropertyName || '',
          type: 'URGENT', urgent: true,
          title: m.title || m.Title || 'Maintenance request',
          description: [
            m.propertyName || m.PropertyName,
            m.unitName || m.UnitName
          ].filter(Boolean).join(' · ') || 'Vendor not yet assigned',
          actionLabel: 'View ticket',
          onAction: () => navigate(`/landlord/maintenances`)
        });
      });

    // Medium + low maintenance
    allRequests
      .filter((r) =>
        ['medium', 'low'].includes((r.priority || '').toLowerCase()) &&
        !['completed', 'cancelled'].includes((r.status || '').toLowerCase())
      )
      .forEach((m) => {
        items.push({
          id: `maint-${m.id || m.Id}`,
          propertyId: m.propertyId || m.PropertyId,
          propertyName: m.propertyName || m.PropertyName || '',
          type: 'MAINTENANCE', urgent: false,
          title: m.title || m.Title || 'Maintenance request',
          description: [m.propertyName || m.PropertyName, m.unitName || m.UnitName].filter(Boolean).join(' · '),
          actionLabel: 'View ticket',
          onAction: () => navigate('/landlord/maintenances')
        });
      });

    // Expiring leases ≤60 days
    (properties || []).forEach((p) => {
      const pId = p.id || p.Id;
      const pName = p.name || p.Name;
      (p.units || p.Units || []).forEach((u) => {
        const unitStatus = (u.status || u.Status || '').toLowerCase();
        if (unitStatus !== 'occupied') return;
        const lease = u.lease || u.Lease;
        const endDate = lease?.endDate || lease?.EndDate;
        if (!endDate) return;
        const daysUntilEnd = differenceInDays(parseISO(endDate), new Date());
        if (daysUntilEnd < 0 || daysUntilEnd > 60) return;
        const propertyLabel = `${pName}${u.name || u.Name ? ` · ${u.name || u.Name}` : ''}`;
        items.push({
          id: `lease-${lease.id || lease.Id}`,
          propertyId: pId, propertyName: pName,
          type: 'LEASE', urgent: false,
          title: `Lease expires in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} · ${propertyLabel}`,
          description: 'Suggest renewal terms',
          actionLabel: 'Send renewal',
          onAction: () => navigate('/landlord/leases?view=renewals')
        });
      });
    });

    return items;
  }, [allRequests, properties, navigate]);

  const filtered = useMemo(() => {
    return allPriorities.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (selectedPropertyId !== 'all' && item.propertyId !== selectedPropertyId) return false;
      return true;
    });
  }, [allPriorities, typeFilter, selectedPropertyId]);

  const counts = useMemo(() => ({
    all: allPriorities.length,
    OVERDUE: allPriorities.filter((i) => i.type === 'OVERDUE').length,
    URGENT: allPriorities.filter((i) => i.type === 'URGENT').length,
    MAINTENANCE: allPriorities.filter((i) => i.type === 'MAINTENANCE').length,
    LEASE: allPriorities.filter((i) => i.type === 'LEASE').length
  }), [allPriorities]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Priorities</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} need your attention
          </Typography>
        </Box>
        {counts.all === 0 && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'success.main' }}>
            <CheckCircleOutlined style={{ fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} color="success.main">All clear</Typography>
          </Stack>
        )}
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems="flex-start">
        {/* Type toggle */}
        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={(_, val) => { if (val) setTypeFilter(val); }}
          size="small"
          sx={{
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              px: 1.5,
              borderRadius: '50px !important',
              border: '1px solid !important',
              borderColor: `${alpha(theme.palette.divider, 0.5)} !important`,
              mr: 0.5,
              mb: 0.5
            },
            '& .Mui-selected': {
              bgcolor: `${theme.palette.primary.main} !important`,
              color: '#fff !important',
              borderColor: `${theme.palette.primary.main} !important`
            }
          }}
        >
          <ToggleButton value="all">All ({counts.all})</ToggleButton>
          {counts.OVERDUE > 0 && <ToggleButton value="OVERDUE">Overdue ({counts.OVERDUE})</ToggleButton>}
          {counts.URGENT > 0 && <ToggleButton value="URGENT">Urgent ({counts.URGENT})</ToggleButton>}
          {counts.MAINTENANCE > 0 && <ToggleButton value="MAINTENANCE">Maintenance ({counts.MAINTENANCE})</ToggleButton>}
          {counts.LEASE > 0 && <ToggleButton value="LEASE">Lease ({counts.LEASE})</ToggleButton>}
        </ToggleButtonGroup>

        {/* Property filter */}
        {propertyOptions.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Property</InputLabel>
            <Select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              input={<OutlinedInput label="Property" />}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="all">All properties</MenuItem>
              {propertyOptions.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      {/* List */}
      <MainCard sx={{ p: 0 }} content={false}>
        {filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 40, color: theme.palette.success.main, marginBottom: 12 }} />
            <Typography variant="h6" color="text.secondary">
              {allPriorities.length === 0 ? 'No open priorities — everything looks good.' : 'No items match the current filters.'}
            </Typography>
          </Box>
        ) : (
          filtered.map((item, idx) => (
            <PriorityRow key={item.id} item={item} isLast={idx === filtered.length - 1} />
          ))
        )}
      </MainCard>
    </Box>
  );
}
