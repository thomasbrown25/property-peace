import { getPropertyOccupancy } from 'utils/occupancy.mjs';
import { useState, useEffect } from 'react';
import { rentalMode } from 'utils/rentalMode';
import { Box, Button, Chip, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckOutlined, EnvironmentOutlined } from '@ant-design/icons';
import AppIcon from 'components/AppIcon';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
import { calculateNextPaymentDate, getNextDueDate } from 'utils/helper-methods';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useDrawer } from 'contexts/DrawerContext';
import { formatLeasedRent, getNextBillingDueDate, getPropertyBillingDueByLease, getPropertyBillingProgress, getPropertyBillingRentDue, getRentLease, propertyHeaderMetrics } from './propertyHeaderMetrics.mjs';

const photoChipSx = {
  bgcolor: (theme) => alpha(theme.palette.brand.forest, 0.88),
  color: 'common.white',
  fontWeight: 700
};
const dateLabel = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No active lease';

// Show the earliest upcoming rent date across the property's long-term leases.
const nextRentDueDate = (leases, billingDueByLease) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = leases.flatMap((lease) => {
    const start = lease.startDate ?? lease.StartDate;
    if (!start) return [];
    const frequency = String(lease.rentFrequency ?? lease.RentFrequency ?? 'Monthly').trim().toLowerCase() || 'monthly';
    const dueDay = lease.rentDueDay ?? lease.RentDueDay ?? 1;
    const billingDate = getNextBillingDueDate(lease, today);
    const leaseId = String(lease.id ?? lease.Id);
    if ((frequency === 'monthly' || billingDate !== undefined) && billingDueByLease.has(leaseId)) {
      const { date: unpaidDate } = billingDueByLease.get(leaseId);
      return unpaidDate ? [new Date(`${unpaidDate}T12:00:00`)] : [];
    }
    const next = billingDate !== undefined
      ? billingDate
      : frequency === 'monthly'
        ? calculateNextPaymentDate(start, dueDay, lease.endDate ?? lease.EndDate)
        : getNextDueDate(start, frequency, dueDay);
    if (!next) return [];
    const date = typeof next === 'string' ? new Date(`${next}T12:00:00`) : next;
    const end = lease.endDate ?? lease.EndDate;
    if (Number.isNaN(date.getTime()) || date < today || (end && date > new Date(`${String(end).slice(0, 10)}T23:59:59`))) return [];
    return [date];
  });
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
};

function SummaryFact({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PropertyHeader({ property, onlinePaymentAction, rentRecords = [], rentLoading = false, rentError }) {
  const drawer = useDrawer();
  const [imageError, setImageError] = useState(false);
  const propertyId = property?.id ?? property?.Id;
  const images = property?.images ?? property?.Images ?? [];
  const propertyImageUrl =
    property?.mainImageUrl ||
    property?.MainImageUrl ||
    images.find((image) => image.isCoverPhoto || image.IsCoverPhoto)?.blobUrl ||
    images[0]?.blobUrl ||
    images[0]?.BlobUrl;
  const hasImage = Boolean(propertyImageUrl && !imageError);
  useEffect(() => {
    setImageError(false);
  }, [propertyId, propertyImageUrl]);

  const units = property?.units ?? property?.Units ?? [];
  const longTermUnits = units.filter((unit) => rentalMode(unit) !== 'shortTerm');
  const rentLeases = longTermUnits.map(getRentLease).filter(Boolean);
  const billingDueByLease = getPropertyBillingDueByLease(rentRecords, propertyId);
  const nextDue = nextRentDueDate(rentLeases, billingDueByLease);
  const hasLongTermUnits = longTermUnits.length > 0;
  const hasRentLease = rentLeases.length > 0;
  const firstUnit = units[0];
  const firstLease = firstUnit?.lease ?? firstUnit?.Lease;
  const tenants = firstLease?.tenants ?? firstLease?.Tenants ?? [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;
  const { occupiedUnits } = getPropertyOccupancy(property);
  const monthly = propertyHeaderMetrics(rentRecords, propertyId);
  const billingProgress = getPropertyBillingProgress(rentRecords, propertyId);
  const { expected, collected, remaining, percent } = billingProgress ?? monthly;
  const { dueAmount, overduePercent, pastDue } = monthly;
  const period = billingProgress?.period ?? 'month';
  const collectionAvailable = !rentLoading && !rentError && propertyId != null;
  const paidInFull = collectionAvailable && hasRentLease && rentLeases.every((lease) =>
    billingDueByLease.get(String(lease.id ?? lease.Id))?.paidInFull);
  const nextDueLabel = nextDue ? dateLabel(nextDue) : paidInFull ? 'Paid in full' : hasRentLease ? '—' : 'No lease';
  const billingRentDue = getPropertyBillingRentDue(rentRecords, propertyId);
  const rentPaid = collectionAvailable && billingRentDue === 0;
  const showingOverdue = collectionAvailable && !billingProgress && overduePercent < 0;
  const progressPercent = showingOverdue ? overduePercent : percent;
  const collectionValue = (value) => (collectionAvailable ? formatCurrency(value) : '—');
  const title = property?.name?.trim() || property?.streetAddress || 'Property';
  const address = [
    property?.streetAddress?.split(',')[0]?.trim(),
    property?.city,
    [property?.state, property?.zipCode].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(', ');
  const beds = firstUnit?.bedrooms ?? firstUnit?.Bedrooms;
  const baths = firstUnit?.baths ?? firstUnit?.Baths;
  const sqft = firstUnit?.squareFeet ?? firstUnit?.SquareFeet;
  const yearBuilt = property?.yearBuilt ?? property?.YearBuilt;
  const isSingle = units.length <= 1;
  const propertyType = property?.propertyType ?? property?.PropertyType;
  const propertyIcon = isDetachedSingleUnitType(propertyType) ? 'house' : 'properties';
  const isSingleFamily = String(propertyType ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'singlefamily';
  const collectionPeriodLabel = billingProgress
    ? `Current ${period}`
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Box>
      <Grid container spacing={2} alignItems="stretch">
        <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex' }}>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              width: '100%',
              height: '100%',
              minHeight: 300,
              bgcolor: 'brand.forest',
              color: 'common.white'
            }}
          >
            {hasImage && (
              <Box
                component="img"
                src={propertyImageUrl}
                alt={title}
                onError={() => setImageError(true)}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: (theme) =>
                  `linear-gradient(0deg, ${alpha(theme.palette.brand.forest, 0.92)} 0%, ${alpha(theme.palette.brand.forest, 0.52)} 38%, transparent 75%)`
              }}
            />
            <Stack justifyContent="space-between" sx={{ position: 'relative', height: '100%', minHeight: 300, boxSizing: 'border-box', p: { xs: 2, sm: 2.5 } }}>
              <Chip
                size="small"
                icon={<AppIcon name={propertyIcon} size={18} />}
                label={getPropertyTypeLabel(propertyType) || 'Property'}
                sx={{
                  alignSelf: 'flex-start',
                  height: 30,
                  px: 0.5,
                  fontWeight: 700,
                  '&.MuiChip-filledDefault': { bgcolor: 'brand.forest', color: 'common.white' }
                }}
              />
              <Box>
                <Typography
                  variant="h2"
                  fontWeight={900}
                  sx={{ mb: 0.5, color: 'common.white', letterSpacing: '-0.04em', overflowWrap: 'anywhere', fontSize: { xs: '1.75rem', sm: '2.25rem' } }}
                >
                  {title}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <EnvironmentOutlined style={{ marginTop: 3, flexShrink: 0 }} />
                  <Typography variant="body1" sx={{ color: 'common.white' }}>
                    {address || 'No address provided'}
                  </Typography>
                </Stack>
                {isSingle && tenantName && (
                  <Typography variant="body2" sx={{ mt: 1, color: 'common.white' }}>
                    Tenant · {tenantName}
                  </Typography>
                )}
                {!isSingleFamily && (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                    {isSingle && beds != null && <Chip size="small" label={`${beds} beds`} sx={photoChipSx} />}
                    {isSingle && baths != null && <Chip size="small" label={`${baths} baths`} sx={photoChipSx} />}
                    {isSingle && sqft > 0 && <Chip size="small" label={`${Number(sqft).toLocaleString()} sqft`} sx={photoChipSx} />}
                    {yearBuilt > 0 && <Chip size="small" label={`Built ${yearBuilt}`} sx={photoChipSx} />}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ height: '100%', minHeight: 300, boxSizing: 'border-box', p: { xs: 2, sm: 2.5 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={1.5}>
              <Box>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'brand.teal',
                        flexShrink: 0
                      }}
                    >
                      <AppIcon name="moneys" size={26} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                        Due amount
                      </Typography>
                      <Typography variant="h3" fontWeight={900} sx={{ color: 'text.primary', lineHeight: 1.1, overflowWrap: 'anywhere' }}>
                        {collectionValue(billingRentDue ?? dueAmount)}
                      </Typography>
                      {!hasLongTermUnits && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          No long-term rent scheduled
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Divider />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                    <SummaryFact label={`Remaining this ${period}`} value={collectionValue(remaining)} />
                    <SummaryFact label={`Collected this ${period}`} value={collectionValue(collected)} />
                    <SummaryFact label="Next due date" value={nextDueLabel} />
                    <SummaryFact label="Leased rent" value={hasRentLease ? formatLeasedRent(longTermUnits) : 'No lease'} />
                    <SummaryFact
                      label={isSingle ? 'Lease start' : 'Units'}
                      value={isSingle ? dateLabel(firstLease?.startDate ?? firstLease?.StartDate) : String(units.length)}
                    />
                    <SummaryFact
                      label={isSingle ? 'Lease end' : 'Occupied units'}
                      value={isSingle ? dateLabel(firstLease?.endDate ?? firstLease?.EndDate) : `${occupiedUnits} / ${units.length}`}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Rent collection · {collectionPeriodLabel}
                      </Typography>
                      <Typography variant="caption" fontWeight={800} sx={{ color: showingOverdue ? 'error.main' : 'text.primary' }}>
                        {collectionAvailable && (expected > 0 || showingOverdue) ? `${Math.round(progressPercent)}%` : '—'}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      aria-label={`Rent collection for ${collectionPeriodLabel}`}
                      variant={rentLoading ? 'indeterminate' : 'determinate'}
                      value={collectionAvailable ? Math.abs(progressPercent) : 0}
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: showingOverdue ? (theme) => alpha(theme.palette.error.main, 0.16) : 'brand.mint',
                        '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: showingOverdue ? 'error.main' : 'brand.teal' }
                      }}
                    />
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1, gap: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {rentLoading
                          ? 'Loading rent collection…'
                          : rentError || propertyId == null
                            ? 'Rent collection is unavailable.'
                            : showingOverdue
                              ? `${formatCurrency(pastDue)} overdue · ${formatCurrency(collected)} of ${formatCurrency(expected)} collected this month`
                              : expected > 0
                                ? `${formatCurrency(collected)} of ${formatCurrency(expected)} collected`
                                : `No rent scheduled for this ${period}.`}
                      </Typography>
                      {rentPaid && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'success.main', flexShrink: 0 }}>
                          <CheckOutlined aria-hidden="true" />
                          <Typography variant="body2" fontWeight={700}>Paid</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  {hasLongTermUnits && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button
                        variant="contained"
                        startIcon={<AppIcon name="dollarCircle" />}
                        onClick={() => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } })}
                        sx={{ textTransform: 'none' }}
                      >
                        Record a payment
                      </Button>
                      {onlinePaymentAction?.showInRentCard && (
                        <Button
                          variant="outlined"
                          startIcon={<AppIcon name={onlinePaymentAction.icon} />}
                          onClick={onlinePaymentAction.onSelect}
                          sx={{ textTransform: 'none' }}
                        >
                          {onlinePaymentAction.label}
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
