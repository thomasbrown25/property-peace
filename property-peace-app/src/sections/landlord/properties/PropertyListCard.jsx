import { alpha, Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import { WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from 'utils/formatters';
import { isHighPriorityMaintenanceRequest } from 'utils/maintenanceStatus';

function getUnitSummary(property) {
  const units = property.units || property.Units || [];
  let occupied = 0, vacant = 0, overdue = 0, highMaint = 0;
  units.forEach((u) => {
    const status = (u.status || u.Status || '').toLowerCase();
    if (status === 'occupied') occupied++;
    else if (status === 'overdue') { occupied++; overdue++; }
    else if (status === 'vacant') vacant++;
  });
  const maintReqs = property.maintenanceRequests || property.MaintenanceRequests || [];
  highMaint = maintReqs.filter(isHighPriorityMaintenanceRequest).length;
  return { occupied, vacant, overdue, highMaint, total: units.length };
}

function getFirstUnit(property) {
  const units = property.units || property.Units || [];
  return units[0];
}

export default function PropertyListCard({ property }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const propertyId = property.id || property.Id;
  const { occupied, vacant, overdue, highMaint, total } = getUnitSummary(property);
  const firstUnit = getFirstUnit(property);
  const imageUrl = property.mainImageUrl || property.images?.[0]?.blobUrl || null;
  const rentAmount = firstUnit?.rentAmount || firstUnit?.RentAmount || property.targetRent || 0;
  const bedrooms = firstUnit?.bedrooms || firstUnit?.Bedrooms;
  const baths = firstUnit?.baths || firstUnit?.Baths;
  const sqft = firstUnit?.squareFeet || firstUnit?.SquareFeet;

  const isFullyOccupied = total > 0 && occupied === total && overdue === 0;
  const hasOverdue = overdue > 0;
  const hasHighMaint = highMaint > 0;
  const needsAttention = hasOverdue || hasHighMaint;

  // Attention line
  let attentionText = null;
  let attentionColor = 'text.secondary';
  if (hasOverdue) { attentionText = `${overdue} unit${overdue > 1 ? 's' : ''} overdue`; attentionColor = theme.palette.error.main; }
  else if (hasHighMaint) { attentionText = `${highMaint} high priority maintenance`; attentionColor = theme.palette.warning.main; }

  // Status label
  const statusLabel = total === 0
    ? null
    : vacant === total ? 'Vacant'
    : occupied === total && !hasOverdue ? 'Occupied'
    : hasOverdue ? 'Overdue'
    : `${occupied}/${total} occupied`;

  const statusColor = hasOverdue ? 'error' : vacant === total ? 'warning' : 'success';
  const isDark = theme.palette.mode === 'dark';
  const cardBorder = isDark ? alpha('#cbd5e1', 0.16) : alpha(theme.palette.divider, 0.18);
  const cardHoverBorder = alpha(theme.palette.primary.main, isDark ? 0.42 : 0.34);

  const addressText = [
    property.streetAddress || property.StreetAddress,
    property.city || property.City,
    property.state || property.State,
    property.zipCode || property.ZipCode
  ].filter(Boolean).join(', ');

  return (
    <Box
      onClick={() => navigate(`/landlord/property/${propertyId}`)}
      sx={{
        display: 'flex',
        gap: { xs: 1.25, sm: 1.5 },
        p: { xs: 1.1, sm: 1.25 },
        borderRadius: { xs: 2.5, sm: 2.25 },
        cursor: 'pointer',
        border: `1px solid ${cardBorder}`,
        bgcolor: isDark ? alpha('#0b1220', 0.72) : 'background.paper',
        backgroundImage: isDark
          ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha('#ffffff', 0.012)} 100%)`
          : 'none',
        boxShadow: isDark
          ? `0 10px 28px ${alpha('#000000', 0.22)}`
          : `0 6px 18px ${alpha(theme.palette.primary.main, 0.06)}`,
        transition: 'transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease',
        '&:hover': {
          transform: 'translateY(-1px)',
          bgcolor: isDark ? alpha('#111827', 0.95) : alpha(theme.palette.primary.main, 0.035),
          borderColor: cardHoverBorder,
          boxShadow: isDark
            ? `0 14px 34px ${alpha('#000000', 0.28)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.08)} inset`
            : `0 10px 24px ${alpha(theme.palette.primary.main, 0.1)}`
        }
      }}
    >
      {/* Thumbnail */}
      <Box
        sx={{
          width: { xs: 78, sm: 72 },
          height: { xs: 70, sm: 64 },
          borderRadius: { xs: 2, sm: 1.5 },
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${isDark ? alpha('#cbd5e1', 0.12) : alpha(theme.palette.divider, 0.14)}`,
          boxShadow: isDark ? `0 8px 18px ${alpha('#000000', 0.22)}` : 'none',
          ...(imageUrl && { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' })
        }}
      />

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.875rem', flex: 1, minWidth: 0, mr: 1 }}>
            {property.name || property.streetAddress}
          </Typography>
          {statusLabel && (
            <Chip label={`· ${statusLabel}`} size="small" color={statusColor} variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, border: 'none',
                bgcolor: alpha(statusColor === 'error' ? theme.palette.error.main : statusColor === 'warning' ? theme.palette.warning.main : theme.palette.success.main, 0.1),
                color: statusColor === 'error' ? theme.palette.error.main : statusColor === 'warning' ? theme.palette.warning.main : theme.palette.success.main
              }} />
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem', display: 'block', mb: 0.5 }}>
          {addressText}
        </Typography>

        <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5, mb: attentionText ? 0.5 : 0 }}>
          {bedrooms && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>🛏 {bedrooms}</Typography>}
          {baths && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>🛁 {baths}</Typography>}
          {sqft > 0 && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>· {Number(sqft).toLocaleString()} sqft</Typography>}
          {rentAmount > 0 && <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: isDark ? theme.palette.primary.light : theme.palette.primary.main }}>· {formatCurrency(rentAmount)}/mo</Typography>}
        </Stack>

        {attentionText && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <WarningOutlined style={{ fontSize: 11, color: attentionColor }} />
            <Typography variant="caption" sx={{ fontSize: '0.72rem', color: attentionColor }}>
              {attentionText}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
