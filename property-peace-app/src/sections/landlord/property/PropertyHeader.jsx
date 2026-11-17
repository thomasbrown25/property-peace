import { getPropertyOccupancy } from 'utils/occupancy.mjs';
import { useState, useEffect } from 'react';
import { rentalMode } from 'utils/rentalMode';
import { Box, Button, Chip, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { HomeOutlined, EnvironmentOutlined, DollarOutlined } from '@ant-design/icons';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
import { calculateNextPaymentDate, getNextDueDate } from 'utils/helper-methods';
import { useDrawer } from 'contexts/DrawerContext';
import { propertyHeaderMetrics } from './propertyHeaderMetrics.mjs';

const photoChipSx = {
  bgcolor: (theme) => alpha(theme.palette.brand.forest, 0.88),
  color: 'common.white',
  fontWeight: 700,
  '& .MuiChip-icon': { color: 'brand.mint' }
};
const dateLabel = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No active lease';

// Show the earliest upcoming rent date across the property's long-term leases.
const nextRentDueDate = (units) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = units.flatMap((unit) => {
    const lease = unit.lease ?? unit.Lease;
    if (!lease || lease.isActive === false || lease.IsActive === false) return [];
    const start = lease.startDate ?? lease.StartDate;
    if (!start) return [];
    const frequency = lease.rentFrequency ?? lease.RentFrequency ?? 'Monthly';
    const dueDay = lease.rentDueDay ?? lease.RentDueDay ?? 1;
    const next = String(frequency).toLowerCase() === 'monthly'
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

export default function PropertyHeader({ property, rentRecords = [], rentLoading = false, rentError }) {
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
  const nextDue = nextRentDueDate(longTermUnits);
  const hasLongTermUnits = longTermUnits.length > 0;
  const firstUnit = units[0];
  const firstLease = firstUnit?.lease ?? firstUnit?.Lease;
  const tenants = firstLease?.tenants ?? firstLease?.Tenants ?? [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;
  const { occupiedUnits } = getPropertyOccupancy(property);
  const { expected, collected, remaining, dueAmount, percent, overduePercent, scheduledRent, pastDue } = propertyHeaderMetrics(rentRecords, propertyId);
  const collectionAvailable = !rentLoading && !rentError && propertyId != null;
  const showingOverdue = collectionAvailable && overduePercent < 0;
  const progressPercent = showingOverdue ? overduePercent : percent;
  const collectionValue = (value) => (collectionAvailable ? formatCurrency(value) : '—');
  const monthlyRent =
    scheduledRent ||
    longTermUnits.reduce((sum, unit) => {
      const lease = unit.lease ?? unit.Lease;
      return sum + (Number(lease?.rentAmount ?? lease?.RentAmount ?? unit.rentAmount ?? unit.RentAmount) || 0);
    }, 0);
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
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
                icon={<HomeOutlined />}
                label={getPropertyTypeLabel(property?.propertyType) || 'Property'}
                sx={{ ...photoChipSx, alignSelf: 'flex-start' }}
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
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                  {isSingle && beds != null && <Chip size="small" label={`${beds} beds`} sx={photoChipSx} />}
                  {isSingle && baths != null && <Chip size="small" label={`${baths} baths`} sx={photoChipSx} />}
                  {isSingle && sqft > 0 && <Chip size="small" label={`${Number(sqft).toLocaleString()} sqft`} sx={photoChipSx} />}
                  {yearBuilt > 0 && <Chip size="small" label={`Built ${yearBuilt}`} sx={photoChipSx} />}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ height: '100%', minHeight: 300, boxSizing: 'border-box', p: { xs: 2, sm: 2.5 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={1.5}>
              <Box>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7 }}
                      >
                        Monthly rent
                      </Typography>
                      <Typography variant="h3" fontWeight={900} sx={{ color: 'text.primary', lineHeight: 1.1 }}>
                        {monthlyRent > 0 ? formatCurrency(monthlyRent) : '—'}
                        <Typography component="span" variant="h6" sx={{ color: 'text.secondary', ml: 0.5 }}>
                          /mo
                        </Typography>
                      </Typography>
                      {!hasLongTermUnits && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          No long-term rent scheduled
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'brand.ivory',
                        color: 'brand.teal',
                        flexShrink: 0
                      }}
                    >
                      <DollarOutlined style={{ fontSize: 22 }} />
                    </Box>
                  </Stack>
                  <Divider />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                    <SummaryFact label="Remaining this month" value={collectionValue(remaining)} />
                    <SummaryFact label="Collected this month" value={collectionValue(collected)} />
                    <SummaryFact label="Next due date" value={nextDue ? dateLabel(nextDue) : '—'} />
                    <SummaryFact label="Due amount" value={collectionValue(dueAmount)} />
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
                        Rent collection · {monthLabel}
                      </Typography>
                      <Typography variant="caption" fontWeight={800} sx={{ color: showingOverdue ? 'error.main' : 'text.primary' }}>
                        {collectionAvailable && (expected > 0 || showingOverdue) ? `${Math.round(progressPercent)}%` : '—'}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      aria-label={`Rent collection for ${monthLabel}`}
                      variant={rentLoading ? 'indeterminate' : 'determinate'}
                      value={collectionAvailable ? Math.abs(progressPercent) : 0}
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: showingOverdue ? (theme) => alpha(theme.palette.error.main, 0.16) : 'brand.mint',
                        '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: showingOverdue ? 'error.main' : 'brand.teal' }
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      {rentLoading
                        ? 'Loading rent collection…'
                        : rentError || propertyId == null
                          ? 'Rent collection is unavailable.'
                          : showingOverdue
                            ? `${formatCurrency(pastDue)} overdue · ${formatCurrency(collected)} of ${formatCurrency(expected)} collected this month`
                            : expected > 0
                              ? `${formatCurrency(collected)} of ${formatCurrency(expected)} collected`
                              : 'No rent scheduled for this month.'}
                    </Typography>
                  </Box>
                  {hasLongTermUnits && (
                    <Button
                      variant="contained"
                      startIcon={<DollarOutlined />}
                      onClick={() => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } })}
                      sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                    >
                      Record a payment
                    </Button>
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
