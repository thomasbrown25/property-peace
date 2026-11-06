import { useState, useEffect } from 'react';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';
import { Box, Button, Chip, Divider, Grid, LinearProgress, Menu, MenuItem, Stack, Typography } from '@mui/material';
import {
  HomeOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  EditOutlined,
  FileAddOutlined,
  FileTextOutlined,
  ToolOutlined,
  UploadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import { propertyHeaderMetrics } from './propertyHeaderMetrics.mjs';

const glassChipSx = {
  bgcolor: 'rgba(255,255,255,0.16)',
  color: 'white',
  fontWeight: 700,
  '& .MuiChip-icon': { color: 'white' }
};
const heroButtonSx = {
  borderColor: '#fff',
  color: '#061e35',
  textTransform: 'none',
  fontWeight: 800,
  bgcolor: '#fff',
  '&:hover, &:focus-visible': { color: '#061e35', borderColor: '#fff', bgcolor: '#fff' }
};
const dateLabel = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No active lease';

function SummaryFact({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: 'white', overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PropertyHeader({ property, rentRecords = [], rentLoading = false, rentError, onEdit, onDelete }) {
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [imageError, setImageError] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState(null);
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
  const hasLongTermUnits = units.some((unit) => rentalMode(unit) !== 'shortTerm');
  const canCreateLease = hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property?.propertyType));
  const firstUnit = units[0];
  const firstLease = firstUnit?.lease ?? firstUnit?.Lease;
  const tenants = firstLease?.tenants ?? firstLease?.Tenants ?? [];
  const primaryTenant = tenants[0];
  const tenantName = primaryTenant
    ? `${primaryTenant.firstname || primaryTenant.Firstname || ''} ${primaryTenant.lastname || primaryTenant.Lastname || ''}`.trim()
    : null;
  const occupiedUnits = units.filter(
    (unit) => unit.isOccupied || unit.IsOccupied || ['occupied', 'overdue'].includes(String(unit.status ?? unit.Status ?? '').toLowerCase())
  ).length;
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
  const runAction = (action) => {
    setActionsAnchor(null);
    action();
  };

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        color: 'white',
        bgcolor: '#061e35',
        boxShadow: 'none'
      }}
    >
      {hasImage && (
        <Box
          component="img"
          src={propertyImageUrl}
          alt={title}
          onError={() => setImageError(true)}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'saturate(1.08) contrast(1.02)'
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: hasImage
            ? 'linear-gradient(90deg, rgba(8,15,28,0.92) 0%, rgba(8,15,28,0.62) 48%, rgba(8,15,28,0.2) 100%), linear-gradient(0deg, rgba(8,15,28,0.6), rgba(8,15,28,0.08))'
            : 'linear-gradient(135deg, #061e35, #163d4a)'
        }}
      />
      <Box sx={{ position: 'relative', p: { xs: 2.25, sm: 3, md: 4 }, minHeight: { md: 430 } }}>
        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, md: 7.5 }}>
            <Stack justifyContent="space-between" spacing={4} sx={{ height: '100%', minHeight: { xs: 240, md: 366 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    icon={<HomeOutlined />}
                    label={getPropertyTypeLabel(property?.propertyType) || 'Property'}
                    sx={glassChipSx}
                  />
                </Stack>
                <Box>
                  <Typography
                    variant="h2"
                    fontWeight={900}
                    sx={{ mb: 1, color: 'white', letterSpacing: '-0.04em', overflowWrap: 'anywhere' }}
                  >
                    {title}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.78)', marginTop: 3 }} />
                    <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                      {address || 'No address provided'}
                    </Typography>
                  </Stack>
                  {isSingle && tenantName && (
                    <Typography variant="body2" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.84)' }}>
                      Tenant · {tenantName}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {isSingle && beds != null && <Chip size="small" label={`${beds} beds`} sx={glassChipSx} />}
                  {isSingle && baths != null && <Chip size="small" label={`${baths} baths`} sx={glassChipSx} />}
                  {isSingle && sqft > 0 && <Chip size="small" label={`${Number(sqft).toLocaleString()} sqft`} sx={glassChipSx} />}
                  {yearBuilt > 0 && <Chip size="small" label={`Built ${yearBuilt}`} sx={glassChipSx} />}
                </Stack>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4.5 }}>
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<ThunderboltOutlined />}
                  onClick={(event) => setActionsAnchor(event.currentTarget)}
                  aria-haspopup="menu"
                  aria-controls={actionsAnchor ? 'property-actions-menu' : undefined}
                  aria-expanded={Boolean(actionsAnchor)}
                  sx={heroButtonSx}
                >
                  Actions
                </Button>
              </Box>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 2, md: 2.5 },
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(16px)'
                }}
              >
                <Stack spacing={2.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.7 }}
                      >
                        Monthly rent
                      </Typography>
                      <Typography variant="h3" fontWeight={900} sx={{ color: 'white', lineHeight: 1.1 }}>
                        {monthlyRent > 0 ? formatCurrency(monthlyRent) : '—'}
                        <Typography component="span" variant="h6" sx={{ color: 'rgba(255,255,255,0.74)', ml: 0.5 }}>
                          /mo
                        </Typography>
                      </Typography>
                      {!hasLongTermUnits && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
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
                        bgcolor: 'rgba(255,255,255,0.18)',
                        flexShrink: 0
                      }}
                    >
                      <DollarOutlined style={{ fontSize: 22 }} />
                    </Box>
                  </Stack>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.16)' }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                    <SummaryFact label="Expected this month" value={collectionValue(expected)} />
                    <SummaryFact label="Collected this month" value={collectionValue(collected)} />
                    <SummaryFact label="Remaining this month" value={collectionValue(remaining)} />
                    <SummaryFact label="Past-due rent" value={collectionValue(pastDue)} />
                    <SummaryFact
                      label={isSingle ? 'Lease ends' : 'Units'}
                      value={isSingle ? dateLabel(firstLease?.endDate ?? firstLease?.EndDate) : String(units.length)}
                    />
                    <SummaryFact
                      label={isSingle ? 'Security deposit' : 'Occupied units'}
                      value={
                        isSingle
                          ? (firstLease?.securityDeposit ?? firstLease?.SecurityDeposit) != null
                            ? formatCurrency(firstLease.securityDeposit ?? firstLease.SecurityDeposit)
                            : '—'
                          : `${occupiedUnits} / ${units.length}`
                      }
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                        Rent collection · {monthLabel}
                      </Typography>
                      <Typography variant="caption" fontWeight={800} sx={{ color: 'white' }}>
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
                        bgcolor: 'rgba(255,255,255,0.18)',
                        '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: 'success.light' }
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255,255,255,0.78)' }}>
                      {rentLoading
                        ? 'Loading rent collection…'
                        : rentError
                          ? 'Rent collection could not be loaded.'
                          : expected > 0
                            ? `${formatCurrency(collected)} of ${formatCurrency(expected)} collected`
                            : 'No rent scheduled for this month.'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Box>
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
    </Box>
  );
}
