import { useState } from 'react';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import RecordPaymentModal from 'components/drawers/RecordPaymentModal';
import { useDrawer } from 'contexts/DrawerContext';
import { formatCurrency } from 'utils/formatters';
import { getOwnerRentOverview } from 'utils/ownerHome';

export default function OwnerRentOverview({ summary, loading, error, emptyPortfolio = false }) {
  const { notifyFinanceMutation } = useDrawer();
  const [paymentOpen, setPaymentOpen] = useState(false);
  if (emptyPortfolio) {
    return (
      <Box component="section" aria-labelledby="owner-rent-overview-heading" sx={{ pt: { xs: 3, md: 4 } }}>
        <Typography id="owner-rent-overview-heading" component="h2" variant="h5" fontWeight={700} sx={{ mb: 1.5 }}>
          Rent overview
        </Typography>
        <Typography color="text.secondary">Add a property to start tracking rent.</Typography>
      </Box>
    );
  }

  const rent = error ? null : getOwnerRentOverview(summary);
  const periodLabel = rent?.period ? format(new Date(`${rent.period}-01T12:00:00`), 'MMMM yyyy') : 'This month';

  return (
    <Box component="section" aria-labelledby="owner-rent-overview-heading" sx={{ pt: { xs: 3, md: 4 } }}>
      <Stack direction="row" alignItems="baseline" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        <Typography id="owner-rent-overview-heading" component="h2" variant="h5" fontWeight={700}>
          Rent overview
        </Typography>
        {rent && (
          <Typography variant="body2" color="text.secondary">
            {periodLabel}
          </Typography>
        )}
      </Stack>
      <Stack
        spacing={1.25}
        sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
      >
        {rent?.expectedRent > 0 && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={0.5}>
              <Typography variant="body2" color="text.secondary">
                <Box component="strong" sx={{ fontSize: '1.125rem', color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(rent.income)}
                </Box>{' '}
                of {formatCurrency(rent.expectedRent)} collected
              </Typography>
              <Typography variant="body2" color="text.secondary" aria-hidden="true">
                {Math.round(rent.collectionPct)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              color="success"
              value={rent.collectionPct}
              aria-label={`Rent collected for ${rent.period ? periodLabel : 'this month'}`}
              sx={{ height: 5, borderRadius: 8, bgcolor: 'action.selected', '& .MuiLinearProgress-bar': { borderRadius: 8 } }}
            />
          </>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" columnGap={2}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={2}>
            <Typography variant="body2" color="text.secondary">
              {rent
                ? rent.expectedRent > 0
                  ? `${formatCurrency(rent.remainingRent)} remaining this month`
                  : 'No rent scheduled this month.'
                : !error && loading
                  ? 'Loading rent…'
                  : 'Rent data unavailable.'}
            </Typography>
            {rent?.overdue > 0 && (
              <Button
                component={RouterLink}
                to="/landlord/leases?view=overdue"
                size="small"
                color="error"
                sx={(theme) => ({
                  px: 0,
                  color: theme.palette.mode === 'dark' ? 'error.light' : 'error.dark',
                  textDecoration: 'underline',
                  textUnderlineOffset: '0.15em',
                  textTransform: 'none'
                })}
              >
                {formatCurrency(rent.overdue)} overdue
              </Button>
            )}
          </Stack>
          <Button onClick={() => setPaymentOpen(true)} size="small" sx={{ px: 0, textTransform: 'none' }}>
            Record payment
          </Button>
        </Stack>
      </Stack>
      <RecordPaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} onSuccess={notifyFinanceMutation} />
    </Box>
  );
}
