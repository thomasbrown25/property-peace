import { useMemo } from 'react';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyMonthlyRent({ property }) {
  const theme = useTheme();
  const units = property?.units || property?.Units || [];

  const { paidTotal, lateTotal, occupiedTotal, totalPotential, displayUnits } = useMemo(() => {
    let paidTotal = 0, lateTotal = 0, totalPotential = 0;
    const displayUnits = units.slice(0, 10).map((u, idx) => {
      const lease = u.lease || u.Lease;
      const hasLease = Boolean(lease?.id || lease?.Id);
      const status = (u.status || u.Status || '').toLowerCase();
      const rent = lease?.rentAmount || lease?.RentAmount || u.rentAmount || u.RentAmount || 0;
      const unitName = u.name || u.Name || `Unit ${idx + 1}`;
      const isPaid = hasLease && status === 'occupied';
      const isLate = hasLease && status === 'overdue';
      if (isPaid) paidTotal += rent;
      if (isLate) lateTotal += rent;
      totalPotential += rent;
      return { unitName, isPaid, isLate, isVacant: !isPaid && !isLate, rent };
    });
    units.slice(10).forEach((u) => {
      const lease = u.lease || u.Lease;
      const hasLease = Boolean(lease?.id || lease?.Id);
      const status = (u.status || u.Status || '').toLowerCase();
      const rent = lease?.rentAmount || lease?.RentAmount || u.rentAmount || u.RentAmount || 0;
      if (hasLease && status === 'occupied') paidTotal += rent;
      if (hasLease && status === 'overdue') lateTotal += rent;
      totalPotential += rent;
    });
    return { paidTotal, lateTotal, occupiedTotal: paidTotal + lateTotal, totalPotential, displayUnits };
  }, [units]);

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary' }}>
          THIS MONTH'S RENT
        </Typography>
      }
      contentSX={{ pt: 1 }}
      sx={propertyAccentCardSx(theme.palette.success.main, { '& .MuiCardHeader-root': { pb: 1 } })}
    >
      {/* Amount row */}
      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.75 }}>
        <Typography fontWeight={700} sx={{ fontSize: '1.3rem', lineHeight: 1 }}>
          {formatCurrency(occupiedTotal)}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', fontWeight: 500 }}>
          / {formatCurrency(totalPotential)}
        </Typography>
      </Stack>

      {/* Progress bar */}
      <Box sx={{ height: 6, borderRadius: 99, bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.14 : 0.07), overflow: 'hidden', mb: 1.5, display: 'flex' }}>
        {totalPotential > 0 && (
          <>
            <Box sx={{ width: `${(paidTotal / totalPotential) * 100}%`, bgcolor: theme.palette.success.main }} />
            <Box sx={{ width: `${(lateTotal / totalPotential) * 100}%`, bgcolor: theme.palette.error.main }} />
          </>
        )}
      </Box>

      {/* Unit rows */}
      <Stack spacing={0.6}>
        {displayUnits.map((u, idx) => (
          <Stack key={idx} direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                bgcolor: u.isPaid ? theme.palette.success.main : u.isLate ? theme.palette.error.main : alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.24 : 0.18)
              }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                {u.unitName}
                <Box component="span" sx={{ mx: 0.4, color: 'text.disabled' }}>·</Box>
                <Box component="span" sx={{
                  color: u.isPaid ? theme.palette.success.main : u.isLate ? theme.palette.error.main : 'text.secondary',
                  fontWeight: 600
                }}>
                  {u.isPaid ? 'paid' : u.isLate ? 'late' : 'vacant'}
                </Box>
              </Typography>
            </Stack>
            <Typography sx={{
              fontSize: '0.78rem', fontWeight: 700,
              color: u.isVacant ? 'text.disabled' : u.isLate ? theme.palette.error.main : 'text.primary'
            }}>
              {u.rent > 0 ? formatCurrency(u.rent) : '—'}
            </Typography>
          </Stack>
        ))}
        {units.length > 10 && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>
            +{units.length - 10} more units
          </Typography>
        )}
      </Stack>
    </MainCard>
  );
}
