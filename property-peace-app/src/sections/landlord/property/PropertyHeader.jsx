import { getPropertyOccupancy } from 'utils/occupancy.mjs';
import { useState, useEffect } from 'react';
import { rentalMode } from 'utils/rentalMode';
import { Box, Button, Chip, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { HomeOutlined, EnvironmentOutlined, DollarOutlined } from '@ant-design/icons';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
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
  const hasLongTermUnits = longTermUnits.length > 0;
  const firstUnit = units[0];
  const firstLease = firstUnit?.lease ?? firstUnit?.Lease;
  const tenants = firstLease?.tenants ?? firstLease?.Tenants ?? [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;
  const { occupiedUnits } = getPropertyOccupancy(property);
  const { expected, collected, remaining, percent, scheduledRent, pastDue } = propertyHeaderMetrics(rentRecords, propertyId);
  const collectionAvailable = !rentLoading && !rentError && propertyId != null;
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
                    <SummaryFact label="Expected this month" value={collectionValue(expected)} />
                    <SummaryFact label="Collected this month" value={collectionValue(collected)} />
                    <SummaryFact label="Remaining this month" value={collectionValue(remaining)} />
                    <SummaryFact label="Past-due rent" value={collectionValue(pastDue)} />
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
                      <Typography variant="caption" fontWeight={800} sx={{ color: 'text.primary' }}>
                        {collectionAvailable && expected > 0 ? `${Math.round(percent)}%` : '—'}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      aria-label={`Rent collection for ${monthLabel}`}
                      variant={rentLoading ? 'indeterminate' : 'determinate'}
                      value={collectionAvailable ? percent : 0}
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: 'brand.ivory',
                        '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: 'brand.mint' }
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      {rentLoading
                        ? 'Loading rent collection…'
                        : rentError || propertyId == null
                          ? 'Rent collection is unavailable.'
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
