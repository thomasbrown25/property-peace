import { Box, Typography } from '@mui/material';
import { formatCurrency } from 'utils/formatters';
import { getPropertyOverdueRent } from 'utils/ownerHome';

export default function PropertyRentStatusCard({ propertyId, rentRecords, loading, error }) {
  const overdue = getPropertyOverdueRent(propertyId, rentRecords, Boolean(loading || error || !Array.isArray(rentRecords)));
  const hasRent = rentRecords?.some(record => String(record.propertyId ?? record.PropertyId) === String(propertyId));
  const status = error ? 'Rent data unavailable' : overdue === null ? 'Loading rent…' : overdue > 0 ? 'Overdue' : hasRent ? 'Up to date' : 'No rent scheduled';

  return (
    <Box component="section" aria-label="Rent status overview" sx={{
      display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', columnGap: 1.5, alignItems: 'baseline'
    }}>
      <Typography variant="body2" color="text.secondary">Rent status:</Typography>
      <Typography variant="body1" fontWeight={700} color={overdue > 0 ? 'error.main' : overdue === 0 && hasRent ? 'success.main' : 'text.secondary'} aria-live="polite"
        title={overdue > 0 ? 'Total overdue rent across this property’s leases' : undefined}>
        {overdue > 0 ? `${formatCurrency(overdue)} overdue` : status}
      </Typography>
    </Box>
  );
}
