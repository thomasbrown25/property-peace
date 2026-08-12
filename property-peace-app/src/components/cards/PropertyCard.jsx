import { useMemo } from 'react';
import { alpha, Box, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { EnvironmentOutlined, MessageOutlined, DollarOutlined, ToolOutlined, EyeOutlined, MoreOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useDispatch } from 'react-redux';
import { setProperty } from 'store/property/property.action';
import { useDrawer } from 'contexts/DrawerContext';
import { formatCurrency } from 'utils/formatters';
import { normalizeRentBalance } from 'utils/rentBalance';
import { isHighPriorityMaintenanceRequest } from 'utils/maintenanceStatus';
import { differenceInDays } from 'date-fns';
import placeholderImage from 'assets/images/placeholder-house.png';

function ActionBtn({ icon, label, onClick }) {
  const theme = useTheme();
  return (
    <Box
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.4,
        py: 1.25,
        cursor: 'pointer',
        color: 'text.secondary',
        transition: 'color 0.15s',
        '&:hover': { color: theme.palette.primary.main }
      }}
    >
      <Box sx={{ fontSize: 16, display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 500 }}>{label}</Typography>
    </Box>
  );
}

export default function PropertyCard({ property, rentRecords = [] }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();

  const {
    id, name, streetAddress, city, state, zipCode,
    propertyType, units = [], maintenanceRequests = [],
    images = [], mainImageUrl
  } = property ?? {};

  const propertyId = id;
  const isSingleFamily = ['singlefamily', 'single-family'].includes((propertyType || '').toLowerCase());
  const isMultiUnit = !isSingleFamily && units.length > 1;

  const firstUnit = units[0];
  const lease = firstUnit?.lease || firstUnit?.Lease;
  const tenants = lease?.tenants || lease?.Tenants || [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;

  const leaseStartDate = lease?.startDate || lease?.StartDate;
  const leaseEndDate = lease?.endDate || lease?.EndDate;
  const leaseId = lease?.id || lease?.Id;
  const rentAmount = lease?.rentAmount || lease?.RentAmount || firstUnit?.rentAmount || firstUnit?.RentAmount || property?.targetRent || 0;
  const bedrooms = firstUnit?.bedrooms || firstUnit?.Bedrooms;
  const baths = firstUnit?.baths || firstUnit?.Baths;
  const sqft = firstUnit?.squareFeet || firstUnit?.SquareFeet;

  const propertyRent = useMemo(() => {
    const propertyRecords = (Array.isArray(rentRecords) ? rentRecords : [rentRecords]).filter((record) =>
      Number(record?.propertyId ?? record?.PropertyId) === Number(propertyId)
    );
    const leaseIds = new Set(
      units
        .map((unit) => unit?.lease?.id ?? unit?.lease?.Id ?? unit?.leaseId ?? unit?.LeaseId)
        .filter((idValue) => idValue !== undefined && idValue !== null)
        .map(String)
    );
    const matchingRecords = leaseIds.size > 0
      ? propertyRecords.filter((record) => leaseIds.has(String(record?.leaseId ?? record?.LeaseId)))
      : propertyRecords;

    const byLeaseId = new Map();
    let monthlyRent = 0;
    let rentDue = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    matchingRecords.forEach((record) => {
      const balance = normalizeRentBalance(record);
      const recordLeaseId = record?.leaseId ?? record?.LeaseId;
      if (recordLeaseId !== undefined && recordLeaseId !== null) {
        byLeaseId.set(String(recordLeaseId), { record, balance });
      }
      monthlyRent += Number(record?.rentAmount ?? record?.RentAmount) || 0;
      rentDue += balance.rentDue;
      overdueAmount += balance.overdueAmount;
      if (balance.rentDueIsOverdue) overdueCount += 1;
    });

    const displayUnits = units.slice(0, 10).map((unit, index) => {
      const unitLeaseId = unit?.lease?.id ?? unit?.lease?.Id ?? unit?.leaseId ?? unit?.LeaseId;
      const match = unitLeaseId === undefined || unitLeaseId === null ? null : byLeaseId.get(String(unitLeaseId));
      const unitName = unit?.name || unit?.Name || unit?.unitNumber || `Unit ${index + 1}`;
      const occupied = Boolean(unit?.isOccupied ?? unit?.IsOccupied)
        || ['occupied', 'overdue'].includes(String(unit?.status ?? unit?.Status ?? '').toLowerCase());
      return {
        unitName,
        occupied,
        rentDue: match?.balance.rentDue ?? 0,
        isOverdue: match?.balance.rentDueIsOverdue ?? false
      };
    });

    return { monthlyRent, rentDue, overdueAmount, overdueCount, displayUnits };
  }, [propertyId, rentRecords, units]);

  // Unit status
  // Unit status (single-unit uses first unit; multi-unit aggregates all)
  const unitStatus = (firstUnit?.status || firstUnit?.Status || '').toLowerCase();
  const isOccupied = unitStatus === 'occupied' || unitStatus === 'overdue'
    || (!unitStatus && (property?.isOccupied || property?.IsOccupied));
  const isOverdue = propertyRent.overdueCount > 0;

  // Days until lease expiry
  const daysUntilExpiry = leaseEndDate
    ? differenceInDays(new Date(leaseEndDate), new Date())
    : null;
  const leaseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

  // High maintenance count
  const highMaint = (maintenanceRequests || []).filter(isHighPriorityMaintenanceRequest).length;

  // Multi-unit aggregate counts (for attention banner and status chip)
  const multiUnitCounts = useMemo(() => {
    if (!isMultiUnit) return null;
    let vacantCount = 0, occupiedCount = 0;
    units.forEach((u) => {
      const s = (u.status || u.Status || '').toLowerCase();
      if (s === 'occupied' || s === 'overdue') occupiedCount++;
      else vacantCount++;
    });
    return { overdueCount: propertyRent.overdueCount, vacantCount, occupiedCount, total: units.length };
  }, [isMultiUnit, propertyRent.overdueCount, units]);

  // Attention banner — always shown
  const attentionBanner = isMultiUnit && multiUnitCounts
    ? multiUnitCounts.overdueCount > 0
      ? { text: `${multiUnitCounts.overdueCount} unit${multiUnitCounts.overdueCount > 1 ? 's' : ''} overdue`, color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.08), hasAction: true }
      : highMaint > 0
      ? { text: `${highMaint} high priority maintenance`, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.08), hasAction: true }
      : multiUnitCounts.vacantCount > 0
      ? { text: `${multiUnitCounts.vacantCount} unit${multiUnitCounts.vacantCount > 1 ? 's' : ''} vacant`, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.08), hasAction: false }
      : { text: '✓ All units current', color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.07), hasAction: false }
    : isOverdue
    ? { text: 'Rent overdue', color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.08), hasAction: true }
    : leaseExpiringSoon
    ? { text: `Lease ends in ${daysUntilExpiry} days`, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.08), hasAction: true }
    : highMaint > 0
    ? { text: `${highMaint} high priority maintenance`, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.08), hasAction: true }
    : { text: '✓ No issues', color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.07), hasAction: false };

  // Status chip
  const statusLabel = isMultiUnit && multiUnitCounts
    ? `${multiUnitCounts.occupiedCount + multiUnitCounts.overdueCount}/${multiUnitCounts.total} occupied`
    : isOverdue ? 'Overdue' : isOccupied ? 'Occupied' : 'Vacant';
  const statusColor = isMultiUnit && multiUnitCounts
    ? multiUnitCounts.overdueCount > 0 ? 'error' : multiUnitCounts.vacantCount > 0 ? 'warning' : 'success'
    : isOverdue ? 'error' : isOccupied ? 'success' : 'warning';
  const isDark = theme.palette.mode === 'dark';

  // Image
  const imageUrl = mainImageUrl || images?.[0]?.blobUrl || null;

  // Tenants since date
  const tenantSince = leaseStartDate
    ? new Date(leaseStartDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const displayName = name?.trim() || streetAddress?.trim() || 'Property';
  const addressStr = [streetAddress?.split(',')[0], city].filter(Boolean).join(', ');

  const handleNavigate = (e) => {
    if (e?.target?.closest('button, a, [role="button"]')) return;
    dispatch(setProperty(property));
    navigate(`/landlord/property/${propertyId}`);
  };

  const accentColor = statusColor === 'error'
    ? theme.palette.error.main
    : statusColor === 'warning'
    ? theme.palette.warning.main
    : theme.palette.success.main;

  return (
    <Box
      onClick={handleNavigate}
      sx={{
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${isDark ? alpha(accentColor, 0.34) : alpha(theme.palette.divider, 0.12)}`,
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s',
        boxShadow: isDark
          ? `0 16px 40px ${alpha(theme.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(accentColor, 0.16)}, 0 0 26px ${alpha(accentColor, 0.1)}`
          : `0 2px 8px rgba(0,0,0,0.06)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${alpha(accentColor, 0.9)} 0%, ${alpha(accentColor, 0.34)} 44%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 2
        },
        '&:hover': {
          boxShadow: isDark
            ? `0 18px 46px ${alpha(theme.palette.common.black, 0.28)}, 0 0 0 1px ${alpha(accentColor, 0.26)}, 0 0 32px ${alpha(accentColor, 0.18)}`
            : `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
          borderColor: isDark ? alpha(accentColor, 0.46) : alpha(theme.palette.primary.main, 0.24),
          transform: 'translateY(-2px)'
        },
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Attention banner — always visible */}
      <Box sx={{ px: 2, py: 0.75, bgcolor: attentionBanner.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: attentionBanner.color }}>
          {attentionBanner.text}
        </Typography>
        {attentionBanner.hasAction && (
          <Typography
            component="span"
            onClick={(e) => { e.stopPropagation(); navigate(`/landlord/property/${propertyId}`); }}
            sx={{ fontSize: '0.72rem', color: attentionBanner.color, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
          >
            resolve →
          </Typography>
        )}
      </Box>

      {/* Photo */}
      <Box sx={{ position: 'relative', height: 160, bgcolor: alpha(theme.palette.primary.main, 0.07), flexShrink: 0 }}>
        {imageUrl ? (
          <Box component="img" src={imageUrl} alt={displayName}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box component="img" src={placeholderImage} alt={displayName}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.4 }} />
        )}
        {/* Status chip overlay */}
        <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
          <Chip
            label={`• ${statusLabel}`}
            size="small"
            color={statusColor}
            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
          />
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: 1.75, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Name + more */}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, fontSize: '1rem' }}>
            {displayName}
          </Typography>
          <Box
            onClick={(e) => { e.stopPropagation(); navigate(`/landlord/property/${propertyId}`); }}
            sx={{ color: 'text.disabled', fontSize: 16, cursor: 'pointer', flexShrink: 0, ml: 0.5, mt: 0.1 }}
          >
            <MoreOutlined />
          </Box>
        </Stack>

        {/* Address */}
        {addressStr && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <EnvironmentOutlined style={{ fontSize: 11, color: theme.palette.text.disabled }} />
            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{addressStr}</Typography>
          </Stack>
        )}

        {/* Detail chips */}
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5 }}>
          {bedrooms && (
            <Chip label={`${bedrooms} beds`} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem', borderColor: 'rgba(0,0,0,0.15)' }} />
          )}
          {baths && (
            <Chip label={`${baths} baths`} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem', borderColor: 'rgba(0,0,0,0.15)' }} />
          )}
          {sqft > 0 && (
            <Chip label={`${Number(sqft).toLocaleString()} sqft`} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem', borderColor: 'rgba(0,0,0,0.15)' }} />
          )}
        </Stack>

        {/* Financial row — single unit only */}
        {!isMultiUnit && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              mt: 0.25
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.6, color: alpha('#061e35', 0.58), textTransform: 'uppercase' }}>Monthly Rent</Typography>
              <Typography fontWeight={700} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
                {rentAmount > 0 ? `${formatCurrency(rentAmount)}/mo` : '—'}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(0,0,0,0.1)' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.6, color: alpha('#061e35', 0.58), textTransform: 'uppercase' }}>Rent Due</Typography>
              <Typography fontWeight={700} color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
                {formatCurrency(propertyRent.rentDue)}
              </Typography>
            </Box>

          </Box>
        )}

        {/* Tenant + Lease — single unit only */}
        {!isMultiUnit && (
          <>
            <Divider sx={{ borderColor: 'rgba(0,0,0,0.07)' }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.6, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 0.25 }}>Tenant</Typography>
                {tenantName ? (
                  <>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem' }}>{tenantName}</Typography>
                    {tenantSince && <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>since {tenantSince}</Typography>}
                  </>
                ) : (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
                )}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.6, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 0.25 }}>Lease</Typography>
                {leaseEndDate ? (
                  <>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem' }}>
                      {new Date(leaseEndDate).toLocaleDateString('en-US', { month: 'short', d: 'numeric', year: 'numeric' })}
                    </Typography>
                    {leaseId && (
                      <Typography
                        component="span"
                        onClick={(e) => { e.stopPropagation(); navigate(`/landlord/leases/${leaseId}`); }}
                        sx={{ fontSize: '0.68rem', color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        view document →
                      </Typography>
                    )}
                  </>
                ) : (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
                )}
              </Box>
            </Box>
          </>
        )}

        {/* Canonical rent balance — multi-unit only */}
        {isMultiUnit && (
          <>
            <Divider sx={{ borderColor: 'rgba(0,0,0,0.07)' }} />
            <Box sx={{ mt: 0.25 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 0.75 }}>
                Rent Due
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mb: 1 }}>
                <Typography fontWeight={700} color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontSize: '1.05rem', lineHeight: 1 }}>
                  {formatCurrency(propertyRent.rentDue)}
                </Typography>
                {isOverdue && (
                  <Chip label="Overdue" color="error" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                )}
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                  {formatCurrency(propertyRent.monthlyRent)}/mo scheduled
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                {propertyRent.displayUnits.map((unit) => (
                  <Stack key={unit.unitName} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          bgcolor: unit.isOverdue
                            ? theme.palette.error.main
                            : unit.occupied
                              ? theme.palette.success.main
                              : 'rgba(0,0,0,0.18)'
                        }}
                      />
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                        {unit.unitName}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: unit.isOverdue ? 'error.main' : 'text.primary' }}>
                      {unit.occupied ? formatCurrency(unit.rentDue) : 'Vacant'}
                    </Typography>
                  </Stack>
                ))}
                {units.length > 10 && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>
                    +{units.length - 10} more units
                  </Typography>
                )}
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* Action bar */}
      <Divider sx={{ borderColor: 'rgba(0,0,0,0.07)' }} />
      <Stack direction="row" divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(0,0,0,0.07)' }} />}>
        <ActionBtn icon={<MessageOutlined />} label="Message" onClick={() => navigate('/landlord/messages')} />
        <ActionBtn icon={<DollarOutlined />} label="Expense" onClick={() => navigate(`/landlord/expenses`)} />
        <ActionBtn icon={<FileTextOutlined />} label="Lease" onClick={() => { dispatch(setProperty(property)); drawer.openLeaseAddDrawer(); }} />
        <ActionBtn icon={<ToolOutlined />} label="Ticket" onClick={() => navigate(`/landlord/maintenances/add?propertyId=${propertyId}`)} />
        <ActionBtn icon={<EyeOutlined />} label="Open" onClick={() => { dispatch(setProperty(property)); navigate(`/landlord/property/${propertyId}`); }} />
      </Stack>
    </Box>
  );
}
