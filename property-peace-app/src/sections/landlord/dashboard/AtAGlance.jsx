import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, Chip, Grid, Stack, Typography, useTheme } from '@mui/material';
import { HomeOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { differenceInDays, isToday, isFuture, parseISO } from 'date-fns';

// Muted distinct placeholder colors per property index
const CARD_COLORS = ['#4a6fa5', '#b07d50', '#5a8a6a', '#8a5a6a', '#6a7a8a', '#7a6a4a'];

function getUnitStatus(unit) {
  const status = unit.status || unit.Status;
  if (status) return status.toLowerCase();
  const lease = unit.lease || unit.Lease;
  if (!lease || (!lease.isActive && !lease.IsActive)) return 'vacant';
  return 'occupied';
}

const STATUS_CONFIG = {
  occupied: { label: 'Occupied', color: 'success' },
  overdue:  { label: 'Overdue',  color: 'error' },
  draft:    { label: 'Draft',    color: 'info' },
  vacant:   { label: 'Vacant',   color: 'warning' }
};

function getImageUrl(property) {
  return property.mainImageUrl || property.MainImageUrl
    || property.images?.[0]?.blobUrl || property.Images?.[0]?.BlobUrl
    || null;
}

// ── Single-unit property card ─────────────────────────────────────────────────
function UnitCard({ unit, property, colorIdx }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const lease = unit.lease || unit.Lease;
  const status = getUnitStatus(unit);
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['vacant'];
  const bg = CARD_COLORS[colorIdx % CARD_COLORS.length];

  const tenantName = unit.tenantName || unit.TenantName
    || lease?.tenants?.[0]?.firstname
    ? `${lease?.tenants?.[0]?.firstname || ''} ${lease?.tenants?.[0]?.lastname || ''}`.trim()
    : null;

  const rentAmount = lease?.rentAmount || lease?.RentAmount;

  let paymentLine = null;
  let paymentColor = 'text.secondary';
  if (status === 'occupied') {
    const rentDue = lease?.rentDueDate || lease?.RentDueDate;
    if (rentDue) {
      const dueDate = parseISO(rentDue);
      if (isToday(dueDate)) {
        paymentLine = 'Due today';
        paymentColor = 'warning.main';
      } else if (isFuture(dueDate)) {
        paymentLine = `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else {
        paymentLine = 'Paid';
        paymentColor = 'success.main';
      }
    } else {
      paymentLine = 'Paid';
      paymentColor = 'success.main';
    }
  } else if (status === 'overdue') {
    const rentDue = lease?.rentDueDate || lease?.RentDueDate;
    const days = rentDue ? differenceInDays(new Date(), parseISO(rentDue)) : null;
    paymentLine = days != null && days > 0 ? `Late by ${days} day${days !== 1 ? 's' : ''}` : 'Overdue';
    paymentColor = 'error.main';
  } else if (status === 'draft') {
    paymentLine = 'Lease in draft';
  } else {
    paymentLine = 'Ready to list';
  }

  const imageUrl = getImageUrl(property);

  return (
    <Box
      onClick={() => navigate(`/landlord/property/${property.id || property.Id}`)}
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.1)}` }
      }}
    >
      <Box
        sx={{
          height: 90,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: bg,
          ...(imageUrl && {
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }),
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          p: 1
        }}
      >
        {imageUrl && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', pointerEvents: 'none' }} />
        )}
        <Chip
          label={cfg.label}
          size="small"
          color={cfg.color}
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, position: 'relative', zIndex: 1, '& .MuiChip-label': { px: 0.75 } }}
        />
        <Chip
          label="Photo"
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            position: 'relative',
            zIndex: 1,
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
            '& .MuiChip-label': { px: 0.75 }
          }}
        />
      </Box>

      <Box sx={{ p: 1.25, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ fontSize: '0.85rem' }}>
          {property.name || property.Name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 1, fontSize: '0.72rem' }}>
          {unit.name || unit.Name || 'Whole property'}
        </Typography>

        <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
          <Box>
            {tenantName ? (
              <Typography variant="caption" fontWeight={500} noWrap sx={{ display: 'block', fontSize: '0.75rem' }}>
                {tenantName}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>—</Typography>
            )}
            <Typography variant="caption" color={paymentColor} noWrap sx={{ fontSize: '0.72rem', fontWeight: paymentColor !== 'text.secondary' ? 600 : 400 }}>
              {paymentLine}
            </Typography>
          </Box>
          {rentAmount ? (
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem', flexShrink: 0, ml: 1 }}>
              {formatCurrency(rentAmount)}
              <Typography component="span" variant="caption" color="text.secondary" fontWeight={400}>/mo</Typography>
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ── Multi-unit property card ──────────────────────────────────────────────────
function MultiUnitPropertyCard({ property, colorIdx }) {
  const theme = useTheme();
  const navigate = useNavigate();

  const units = property.units || property.Units || [];
  const unitCount = units.length;

  const occupied = units.filter(u => getUnitStatus(u) === 'occupied').length;
  const overdue  = units.filter(u => getUnitStatus(u) === 'overdue').length;
  const vacant   = units.filter(u => ['vacant', 'draft'].includes(getUnitStatus(u))).length;

  const totalRent = units.reduce((sum, u) => {
    const lease = u.lease || u.Lease;
    return sum + (parseFloat(lease?.rentAmount || lease?.RentAmount || 0));
  }, 0);

  const bg = CARD_COLORS[colorIdx % CARD_COLORS.length];
  const imageUrl = getImageUrl(property);

  let statusLabel, statusColor;
  if (overdue > 0)       { statusLabel = `${overdue} overdue`;     statusColor = 'error'; }
  else if (vacant > 0)   { statusLabel = `${vacant} vacant`;       statusColor = 'warning'; }
  else                   { statusLabel = 'All occupied';            statusColor = 'success'; }

  const breakdown = [
    occupied > 0 && `${occupied} occupied`,
    overdue  > 0 && `${overdue} overdue`,
    vacant   > 0 && `${vacant} vacant`,
  ].filter(Boolean).join(' · ');

  return (
    <Box
      onClick={() => navigate(`/landlord/property/${property.id || property.Id}`)}
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.1)}` }
      }}
    >
      <Box
        sx={{
          height: 90,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: bg,
          ...(imageUrl && {
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }),
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          p: 1
        }}
      >
        {imageUrl && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.18)', pointerEvents: 'none' }} />
        )}
        <Chip
          label={statusLabel}
          size="small"
          color={statusColor}
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, position: 'relative', zIndex: 1, '& .MuiChip-label': { px: 0.75 } }}
        />
        <Chip
          label={`${unitCount} units`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            position: 'relative',
            zIndex: 1,
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
            '& .MuiChip-label': { px: 0.75 }
          }}
        />
      </Box>

      <Box sx={{ p: 1.25, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ fontSize: '0.85rem' }}>
          {property.name || property.Name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 1, fontSize: '0.72rem' }}>
          {occupied}/{unitCount} occupied
        </Typography>

        <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem' }}>
            {breakdown}
          </Typography>
          {totalRent > 0 ? (
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem', flexShrink: 0, ml: 1 }}>
              {formatCurrency(totalRent)}
              <Typography component="span" variant="caption" color="text.secondary" fontWeight={400}>/mo</Typography>
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AtAGlance({ properties = [], onAddProperty }) {
  const navigate = useNavigate();
  const theme = useTheme();

  // One item per property: multi-unit → summary card, single-unit → unit card
  const items = useMemo(() => {
    const result = [];
    let colorIdx = 0;
    (properties || []).forEach((p) => {
      const propertyUnits = p.units || p.Units || [];
      if (propertyUnits.length > 1) {
        result.push({ type: 'property', property: p, colorIdx: colorIdx++ });
      } else {
        const unit = propertyUnits[0] || { status: 'vacant', name: 'Whole property' };
        result.push({ type: 'unit', unit, property: p, colorIdx: colorIdx++ });
      }
    });
    return result.slice(0, 2);
  }, [properties]);

  const totalUnits = useMemo(
    () => (properties || []).reduce((sum, p) => sum + (p.units || p.Units || []).length, 0),
    [properties]
  );

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, color: 'text.primary' }}>
            At a glance
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', lineHeight: 1.3 }}>
            Properties · {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
          </Typography>
        </Box>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          onClick={onAddProperty}
          sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary', whiteSpace: 'nowrap', '&:hover': { color: 'text.primary' } }}
        >
          + Add Property
        </Button>
      }
      contentSX={{ pt: 1 }}
      sx={{ '& .MuiCardHeader-root': { pb: 1 }, height: { xs: 'auto', md: '100%' } }}
    >
      {items.length === 0 ? (
        <Box sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
            <HomeOutlined style={{ fontSize: 26, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            No properties yet. Add a property to get started.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5}>
          {items.map(({ type, unit, property, colorIdx }) => (
            <Grid key={property.id || property.Id} size={{ xs: 12, sm: 6 }}>
              {type === 'property'
                ? <MultiUnitPropertyCard property={property} colorIdx={colorIdx} />
                : <UnitCard unit={unit} property={property} colorIdx={colorIdx} />
              }
            </Grid>
          ))}
        </Grid>
      )}
    </MainCard>
  );
}
