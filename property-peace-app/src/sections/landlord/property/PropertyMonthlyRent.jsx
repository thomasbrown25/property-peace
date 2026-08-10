import { useMemo } from 'react';
import { alpha, Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { normalizeRentBalance } from 'utils/rentBalance';
import { propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyMonthlyRent({ property, rentRecords = [] }) {
  const theme = useTheme();
  const units = property?.units || property?.Units || [];

  const { rentDue, monthlyRent, isOverdue, displayUnits } = useMemo(() => {
    const recordsByLeaseId = new Map();
    let totalRentDue = 0;
    let totalMonthlyRent = 0;
    let anyOverdue = false;

    rentRecords.forEach((record) => {
      const leaseId = record?.leaseId ?? record?.LeaseId;
      if (leaseId === undefined || leaseId === null) return;
      const balance = normalizeRentBalance(record);
      recordsByLeaseId.set(String(leaseId), balance);
      totalRentDue += balance.rentDue;
      totalMonthlyRent += Number(record?.rentAmount ?? record?.RentAmount) || 0;
      anyOverdue ||= balance.rentDueIsOverdue;
    });

    const rows = units.slice(0, 10).map((unit, index) => {
      const lease = unit?.lease || unit?.Lease;
      const leaseId = lease?.id ?? lease?.Id ?? unit?.leaseId ?? unit?.LeaseId;
      const balance = leaseId === undefined || leaseId === null
        ? normalizeRentBalance(null)
        : recordsByLeaseId.get(String(leaseId)) ?? normalizeRentBalance(null);
      const status = String(unit?.status ?? unit?.Status ?? '').toLowerCase();
      const occupied = Boolean(leaseId) || ['occupied', 'overdue'].includes(status);

      return {
        unitName: unit?.name || unit?.Name || `Unit ${index + 1}`,
        occupied,
        ...balance
      };
    });

    return {
      rentDue: totalRentDue,
      monthlyRent: totalMonthlyRent,
      isOverdue: anyOverdue,
      displayUnits: rows
    };
  }, [rentRecords, units]);

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary' }}>
          RENT DUE
        </Typography>
      }
      secondary={isOverdue ? <Chip label="Overdue" color="error" size="small" /> : null}
      contentSX={{ pt: 1 }}
      sx={propertyAccentCardSx(isOverdue ? theme.palette.error.main : theme.palette.success.main, { '& .MuiCardHeader-root': { pb: 1 } })}
    >
      <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mb: 1.5 }}>
        <Typography fontWeight={700} color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontSize: '1.3rem', lineHeight: 1 }}>
          {formatCurrency(rentDue)}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 }}>
          {formatCurrency(monthlyRent)}/mo scheduled
        </Typography>
      </Stack>

      <Stack spacing={0.6}>
        {displayUnits.map((unit) => (
          <Stack key={unit.unitName} direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: unit.rentDueIsOverdue
                    ? theme.palette.error.main
                    : unit.occupied
                      ? theme.palette.success.main
                      : alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.24 : 0.18)
                }}
              />
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                {unit.unitName}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: unit.rentDueIsOverdue ? 'error.main' : 'text.primary' }}>
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
    </MainCard>
  );
}
