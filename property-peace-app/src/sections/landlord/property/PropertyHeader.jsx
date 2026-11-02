import { useState, useEffect, useMemo } from 'react';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';
import {
  alpha, Box, Button, Chip, Divider, Menu, MenuItem,
  Stack, Typography, useTheme
} from '@mui/material';
import {
  HomeOutlined, EnvironmentOutlined, DollarOutlined, ThunderboltOutlined,
  EditOutlined, FileAddOutlined, FileTextOutlined, ToolOutlined,
  UploadOutlined, DeleteOutlined
} from '@ant-design/icons';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import { useSelector } from 'react-redux';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectExpenses } from 'store/expense/expense.selector';
import { differenceInDays, differenceInMonths, parseISO } from 'date-fns';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import useFetchDashboardSummary from 'hooks/useFetchDashboard';
import useFetchExpenses from 'hooks/useFetchExpenses';
import { isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

function StatTile({ label, value, sub, valueColor, sx }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, px: { xs: 0.75, sm: 2 }, py: { xs: 1, sm: 1.5 }, ...sx }}>
      <Typography sx={{ display: 'block', fontSize: { xs: '0.52rem', sm: '0.62rem' }, lineHeight: 1.25, fontWeight: 700, letterSpacing: { xs: 0.45, sm: 0.8 }, color: 'text.secondary', textTransform: 'uppercase', mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ lineHeight: 1.2, color: valueColor || 'text.primary', fontSize: { xs: '0.84rem', sm: '1rem' }, mb: 0.15, fontWeight: 800 }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, lineHeight: 1.25, color: 'text.secondary' }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export default function PropertyHeader({ property, onEdit, onDelete, onDeactivate, onReactivate, onRefresh, refreshing = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [imageError, setImageError] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState(null);

  const propertyId = property?.id || property?.Id;

  // Ensure data is loaded even when navigating directly to this page or refreshing
  useFetchAllPayments();
  useFetchDashboardSummary();
  useFetchExpenses({});

  const propertyImageUrl = property?.mainImageUrl || property?.images?.[0]?.blobUrl || null;
  const hasImage = propertyImageUrl && !imageError;

  useEffect(() => { setImageError(false); }, [property?.id, property?.mainImageUrl]);

  // Unit / lease data
  const units = property?.units || property?.Units || [];
  const hasLongTermUnits = units.some(unit => rentalMode(unit) !== 'shortTerm');
  const canCreateLease = hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property?.propertyType));
  const runAction = (action) => {
    setActionsAnchor(null);
    action();
  };
  const firstUnit = units[0];
  const unitStatus = (firstUnit?.status || firstUnit?.Status || '').toLowerCase();

  const firstLease = firstUnit?.lease || firstUnit?.Lease;
  const tenants = firstLease?.tenants || firstLease?.Tenants || [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;

  const leaseEndDate = firstLease?.endDate || firstLease?.EndDate;
  const monthsRemaining = leaseEndDate ? Math.max(0, differenceInMonths(parseISO(leaseEndDate), new Date())) : null;
  const daysUntilRenewal = leaseEndDate ? Math.max(0, differenceInDays(parseISO(leaseEndDate), new Date())) : null;

  const rentAmount = firstUnit?.rentAmount || firstUnit?.RentAmount
    || firstLease?.rentAmount || firstLease?.RentAmount
    || property?.targetRent || property?.TargetRent
    || 0;
  const bedrooms = firstUnit?.bedrooms || firstUnit?.Bedrooms || null;
  const baths = firstUnit?.baths || firstUnit?.Baths || null;
  const sqft = firstUnit?.squareFeet || firstUnit?.SquareFeet || null;
  const yearBuilt = property?.yearBuilt || property?.YearBuilt || null;
  const propertyTypeLabel = getPropertyTypeLabel(property?.propertyType) || 'Property';

  // Address
  const mainHeader = property?.name?.trim() || property?.streetAddress || 'Property';
  const addressLine = (() => {
    const parts = [];
    if (property?.streetAddress) parts.push(property.streetAddress.split(',')[0].trim());
    if (property?.city) parts.push(property.city);
    if (property?.state) parts.push(property.zipCode ? `${property.state} ${property.zipCode}` : property.state);
    return parts.join(' · ').toUpperCase();
  })();

  // Maintenance
  const dashboardSummary = useSelector(selectDashboardSummary);
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  const propertyRequests = allRequests.filter(
    (r) => isOpenMaintenanceRequest(r) && ((r.propertyId || r.PropertyId) === propertyId)
  );
  const openMaint = propertyRequests.length;
  const highMaint = propertyRequests.filter((r) => (r.priority || '').toLowerCase() === 'high').length;
  const lowMaint = Math.max(0, openMaint - highMaint);

  // YTD rent
  const allPayments = useSelector(selectAllPayments);
  const ytdRent = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    return (allPayments || [])
      .filter((p) => {
        const raw = p.paymentDate || p.PaymentDate;
        if (!raw) return false;
        if ((p.propertyId || p.PropertyId) !== propertyId) return false;
        return new Date(raw) >= yearStart;
      })
      .reduce((sum, p) => sum + (parseFloat(p.amount || p.Amount) || 0), 0);
  }, [allPayments, propertyId]);

  // YTD expenses
  const allExpenses = useSelector(selectExpenses);
  const ytdExpenses = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    return (allExpenses || [])
      .filter((e) => {
        const raw = e.date || e.Date || e.expenseDate || e.ExpenseDate;
        if (!raw) return false;
        if ((e.propertyId || e.PropertyId) !== propertyId) return false;
        return new Date(raw) >= yearStart;
      })
      .reduce((sum, e) => sum + (parseFloat(e.amount || e.Amount) || 0), 0);
  }, [allExpenses, propertyId]);

  const netThisYear = ytdRent - ytdExpenses;
  const marginPct = ytdRent > 0 ? ((netThisYear / ytdRent) * 100).toFixed(1) : null;
  const currentMonth = new Date().getMonth() + 1;

  const borderColor = theme.palette.mode === 'dark' ? alpha('#cbd5e1', 0.22) : alpha(theme.palette.divider, 0.14);
  const softDivider = theme.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(theme.palette.divider, 0.24);
  const mutedChipBg = theme.palette.mode === 'dark' ? alpha('#ffffff', 0.07) : theme.palette.grey[100];

  return (
    <Box
      sx={{
        borderRadius: 2.25,
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08)}`,
        bgcolor: 'background.paper',
        mb: 3,
        ...(theme.palette.mode === 'dark' && {
          backgroundColor: '#111827',
          backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0.005)} 100%)`
        })
      }}
    >

      {/* ── Main row ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ minHeight: { md: 190 } }}>

        {/* Image panel — chips overlaid at top */}
        <Box sx={{ width: { xs: '100%', md: 340 }, height: { xs: 150, sm: 180, md: 190 }, maxHeight: { md: 190 }, flexShrink: 0, position: 'relative', overflow: 'hidden', bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
          {hasImage ? (
            <Box component="img" src={propertyImageUrl} alt={mainHeader} onError={() => setImageError(true)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HomeOutlined style={{ fontSize: 52, color: alpha(theme.palette.primary.main, 0.25) }} />
            </Box>
          )}
          {/* Property type and overdue status overlaid on image */}
          <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', top: 10, left: 10, flexWrap: 'wrap' }}>
            {unitStatus === 'overdue' && (
              <Chip label="Overdue" size="small" color="error"
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
            )}
            <Chip label={propertyTypeLabel} size="small"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: theme.palette.primary.main, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
          </Stack>
        </Box>

        {/* Content panel */}
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: { md: `1px solid ${softDivider}` } }}>
          {/* Top: address + name + tenant */}
          <Box>
            {addressLine && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                <EnvironmentOutlined style={{ fontSize: 11, color: theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.primary.main }} />
                <Typography sx={{ fontSize: '0.62rem', color: theme.palette.mode === 'dark' ? 'text.primary' : 'primary.main', letterSpacing: 0.8, fontWeight: 700 }}>{addressLine}</Typography>
              </Stack>
            )}
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2, mb: 0.75 }}>{mainHeader}</Typography>
            {tenantName && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Tenant <Box component="span" fontWeight={600} sx={{ color: 'text.primary' }}>{tenantName}</Box>
                {monthsRemaining !== null && ` · ${monthsRemaining} month${monthsRemaining !== 1 ? 's' : ''} remaining on lease`}
              </Typography>
            )}
          </Box>

          {/* Bottom: detail chips */}
          <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75, mt: 1.5 }}>
            {bedrooms && <Chip label={`${bedrooms} beds`} size="small" sx={{ height: 26, fontSize: '0.75rem', bgcolor: mutedChipBg, color: 'text.primary', border: 'none' }} />}
            {baths && <Chip label={`${baths} baths`} size="small" sx={{ height: 26, fontSize: '0.75rem', bgcolor: mutedChipBg, color: 'text.primary', border: 'none' }} />}
            {sqft > 0 && <Chip label={`${Number(sqft).toLocaleString()} sqft`} size="small" sx={{ height: 26, fontSize: '0.75rem', bgcolor: mutedChipBg, color: 'text.primary', border: 'none' }} />}
            <Chip
              icon={<HomeOutlined style={{ fontSize: 11 }} />}
              label={yearBuilt > 0 ? `Built ${yearBuilt}` : 'Built —'}
              size="small"
              sx={{ height: 26, fontSize: '0.75rem', bgcolor: mutedChipBg, color: 'text.primary', border: 'none', '& .MuiChip-icon': { fontSize: 11, ml: 0.75 } }}
            />
            <Chip
              icon={<DollarOutlined style={{ fontSize: 11, color: theme.palette.success.main }} />}
              label={rentAmount > 0 ? `${formatCurrency(rentAmount)}/mo` : '— /mo'}
              size="small"
              sx={{ height: 26, fontSize: '0.75rem', fontWeight: 700, bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, border: 'none', '& .MuiChip-icon': { fontSize: 11, ml: 0.75, color: theme.palette.success.main } }}
            />
          </Stack>
        </Box>

        {/* Property actions, available on desktop and mobile */}
        <Stack justifyContent="flex-start" spacing={1.25} sx={{ px: 2.5, py: 2.5, flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<ThunderboltOutlined style={{ fontSize: 13 }} />}
            onClick={(event) => setActionsAnchor(event.currentTarget)}
            aria-haspopup="menu"
            aria-controls={actionsAnchor ? 'property-actions-menu' : undefined}
            aria-expanded={Boolean(actionsAnchor)}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3, fontSize: '0.875rem', whiteSpace: 'nowrap', borderColor: softDivider }}
          >
            Actions
          </Button>
          <Menu id="property-actions-menu" anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}>
            <MenuItem onClick={() => runAction(() => onEdit?.(property))}>
              <EditOutlined style={{ marginRight: 12 }} /> Edit property
            </MenuItem>
            <MenuItem disabled={!canCreateLease} onClick={() => runAction(() => drawer.openLeaseAddDrawer(null, property))}>
              <FileAddOutlined style={{ marginRight: 12 }} /> Create a lease
            </MenuItem>
            <MenuItem onClick={() => runAction(() => navigate('/landlord/leases'))}>
              <FileTextOutlined style={{ marginRight: 12 }} /> View leases
            </MenuItem>
            <MenuItem disabled={!hasLongTermUnits} onClick={() => runAction(() => drawer.openPaymentAddDrawer())}>
              <DollarOutlined style={{ marginRight: 12 }} /> Record a payment
            </MenuItem>
            <MenuItem onClick={() => runAction(() => drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name }))}>
              <ToolOutlined style={{ marginRight: 12 }} /> Create maintenance ticket
            </MenuItem>
            <MenuItem onClick={() => runAction(() => navigate('/landlord/documents'))}>
              <UploadOutlined style={{ marginRight: 12 }} /> Upload document
            </MenuItem>
            <Divider />
            <MenuItem sx={{ color: 'error.main' }} onClick={() => runAction(() => onDelete?.())}>
              <DeleteOutlined style={{ marginRight: 12 }} /> Delete property
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* ── Metrics bar ── */}
      <Box sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.025) : '#f7f8fa', borderTop: `1px solid ${softDivider}` }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(6, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' },
            '& > :nth-of-type(-n+3)': { gridColumn: { xs: 'span 2', sm: 'span 1' } },
            '& > :nth-of-type(n+4)': { gridColumn: { xs: 'span 3', sm: 'span 1' } }
          }}
        >
          <StatTile
            label="Rent Collected YTD"
            value={formatCurrency(ytdRent)}
            sub={`${currentMonth} of 12 months`}
            valueColor={ytdRent > 0 ? theme.palette.success.main : undefined}
            sx={{ borderRight: `1px solid ${softDivider}`, borderBottom: { xs: `1px solid ${softDivider}`, sm: 'none' } }}
          />
          <StatTile
            label="Expenses YTD"
            value={ytdExpenses > 0 ? formatCurrency(ytdExpenses) : '—'}
            sub={ytdExpenses > 0 ? 'year to date' : 'no expenses recorded'}
            sx={{ borderRight: `1px solid ${softDivider}`, borderBottom: { xs: `1px solid ${softDivider}`, sm: 'none' } }}
          />
          <StatTile
            label="Net This Year"
            value={ytdRent > 0 || ytdExpenses > 0 ? formatCurrency(netThisYear) : '—'}
            sub={marginPct !== null ? `${marginPct}% margin` : undefined}
            valueColor={netThisYear >= 0 ? theme.palette.success.main : theme.palette.error.main}
            sx={{ borderRight: { sm: `1px solid ${softDivider}` }, borderBottom: { xs: `1px solid ${softDivider}`, sm: 'none' } }}
          />
          <StatTile
            label="Open Maintenance"
            value={String(openMaint)}
            sub={openMaint > 0 ? `${highMaint} high · ${lowMaint} low` : 'All clear'}
            valueColor={highMaint > 0 ? theme.palette.error.main : undefined}
            sx={{ borderRight: `1px solid ${softDivider}` }}
          />
          <StatTile
            label="Days Until Renewal"
            value={daysUntilRenewal !== null ? String(daysUntilRenewal) : '—'}
            sub={leaseEndDate
              ? new Date(leaseEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'No active lease'}
            valueColor={daysUntilRenewal !== null && daysUntilRenewal <= 60 ? theme.palette.warning.main : undefined}
          />
        </Box>
      </Box>

    </Box>
  );
}
