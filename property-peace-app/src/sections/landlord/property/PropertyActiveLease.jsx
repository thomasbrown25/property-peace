import { alpha, Box, Button, Chip, Divider, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import { FileTextOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatCurrency } from 'utils/formatters';
import { useDrawer } from 'contexts/DrawerContext';
import { isStartedActiveLease } from 'utils/leaseStatus';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyActiveLease({ property }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const drawer = useDrawer();

  const units = property?.units || property?.Units || [];
  const firstUnit = units[0];
  const lease = firstUnit?.lease || firstUnit?.Lease;
  const isActive = isStartedActiveLease(lease);

  if (!isActive) {
    return (
      <MainCard
        title={
          <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary' }}>
            LEASE
          </Typography>
        }
        contentSX={{ pt: 1 }}
        sx={propertyAccentCardSx(theme.palette.primary.main, { '& .MuiCardHeader-root': { pb: 1 } })}
      >
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No active lease on this property.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => drawer.openLeaseAddDrawer()}
          sx={darkModeActionButtonSx(theme.palette.primary.main, { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, mt: 1 })}
        >
          Create lease
        </Button>
      </MainCard>
    );
  }

  const leaseId = lease.id || lease.Id;
  const startDate = lease.startDate || lease.StartDate;
  const endDate = lease.endDate || lease.EndDate;
  const rentAmount = lease.rentAmount || lease.RentAmount || firstUnit?.rentAmount || firstUnit?.RentAmount || 0;
  const deposit = lease.securityDeposit || lease.SecurityDeposit || 0;
  const lateFee = lease.lateFee || lease.LateFee || 0;
  const autoRenew = lease.autoRenew || lease.AutoRenew || false;
  const leaseLength = lease.leaseLength || lease.LeaseLength || null;

  // Pets from tenants
  const tenants = lease.tenants || lease.Tenants || [];
  const petsInfo = tenants.reduce((acc, t) => {
    const pets = t.pets || t.Pets || [];
    return acc + pets.length;
  }, 0);

  // Progress
  let progress = 0;
  let monthsIn = 0;
  let monthsRemaining = 0;
  if (startDate && endDate && isActive) {
    const total = differenceInDays(parseISO(endDate), parseISO(startDate));
    const elapsed = differenceInDays(new Date(), parseISO(startDate));
    progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const totalMonths = leaseLength || Math.round(total / 30);
    monthsIn = Math.floor((elapsed / total) * totalMonths);
    monthsRemaining = Math.max(0, totalMonths - monthsIn);
  }

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary' }}>
          LEASE
        </Typography>
      }
      secondary={
        <Chip label="Active" size="small" color="success"
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }} />
      }
      contentSX={{ pt: 1 }}
      sx={propertyAccentCardSx(theme.palette.primary.main, { '& .MuiCardHeader-root': { pb: 1 } })}
    >
      {/* Date range */}
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.25, fontSize: '1rem' }}>
        {startDate ? format(parseISO(startDate), 'MMM d, yyyy') : '—'}
        {' → '}
        {endDate ? format(parseISO(endDate), 'MMM d, yyyy') : '—'}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontSize: '0.78rem' }}>
        {leaseLength ? `${leaseLength} month term` : ''}
        {leaseLength && ` · auto-renew ${autoRenew ? 'on' : 'off'}`}
      </Typography>

      {/* Progress bar */}
      {isActive && startDate && endDate && (
        <Box sx={{ mb: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(to right, ${theme.palette.primary.dark}, ${alpha(theme.palette.primary.light, 0.85)})`
              }
            }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {monthsIn} month{monthsIn !== 1 ? 's' : ''} in
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {monthsRemaining} month{monthsRemaining !== 1 ? 's' : ''} remaining
            </Typography>
          </Stack>
        </Box>
      )}

      <Divider sx={{ mb: 1.5, borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.18) }} />

      {/* Financials grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>Rent</Typography>
          <Typography variant="body2" fontWeight={700}>{rentAmount > 0 ? `${formatCurrency(rentAmount)}/mo` : '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>Deposit</Typography>
          <Typography variant="body2" fontWeight={700}>{deposit > 0 ? formatCurrency(deposit) : '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>Late fee</Typography>
          <Typography variant="body2" fontWeight={700}>{lateFee > 0 ? formatCurrency(lateFee) : '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>Pets</Typography>
          <Typography variant="body2" fontWeight={700}>{petsInfo > 0 ? `${petsInfo} cat${petsInfo !== 1 ? 's' : ''}` : 'None'}</Typography>
        </Box>
      </Box>

      <Button
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<FileTextOutlined style={{ fontSize: 13 }} />}
        onClick={() => leaseId && navigate(`/landlord/leases/${leaseId}`)}
        sx={darkModeActionButtonSx(theme.palette.primary.main, { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem' })}
      >
        View lease
      </Button>
    </MainCard>
  );
}
