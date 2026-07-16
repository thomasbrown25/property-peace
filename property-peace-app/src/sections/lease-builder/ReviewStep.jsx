import PropTypes from 'prop-types';
import moment from 'moment';

// material-ui
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  Chip
} from '@mui/material';

// ==============================|| REVIEW STEP ||============================== //

export default function ReviewStep({ 
  selectedProperty, 
  selectedUnit, 
  selectedTenants, 
  leaseTerms, 
  fees 
}) {
  const formatCurrency = (amount) => {
    if (amount == null || amount === '') return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return moment(date).format('MMM DD, YYYY');
  };

  const calculateLeaseDuration = () => {
    if (!leaseTerms.startDate || !leaseTerms.endDate) return 'N/A';
    const start = moment(leaseTerms.startDate);
    const end = moment(leaseTerms.endDate);
    const months = end.diff(start, 'months', true);
    const days = end.diff(start, 'days');
    return `${days} days (${Math.round(months)} months)`;
  };

  const getRentIncreaseText = () => {
    if (!leaseTerms.rentIncreaseType) return 'None';
    const value = leaseTerms.rentIncreaseValue;
    const interval = leaseTerms.rentIncreaseInterval;
    
    if (!value || !interval) return 'Not configured';
    
    const valueText = leaseTerms.rentIncreaseType === 'percentage' 
      ? `${value}%` 
      : formatCurrency(value);
    
    const intervalText = interval === 1 
      ? 'Monthly' 
      : interval === 2 
        ? 'Every 2 months'
        : interval === 3
          ? 'Quarterly'
          : interval === 6
            ? 'Semi-annually'
            : interval === 12
              ? 'Annually'
              : `Every ${interval} months`;
    
    return `${valueText} ${intervalText}`;
  };

  const totalFeesAmount = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Review & Confirm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review all the details below before creating the lease.
      </Typography>

      <Grid container spacing={3}>
        {/* Property & Unit */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Property & Unit
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Property
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedProperty?.name || 'Not selected'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Unit
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedUnit?.name || 'Not selected'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Tenants */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Tenants
              </Typography>
              {selectedTenants && selectedTenants.length > 0 ? (
                <Stack spacing={1}>
                  {selectedTenants.map((tenant, index) => (
                    <Typography key={index} variant="body1">
                      {tenant.firstname || tenant.Firstname || ''} {tenant.lastname || tenant.Lastname || ''}
                      {tenant.email || tenant.Email ? ` (${tenant.email || tenant.Email})` : ''}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tenants selected
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lease Terms */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Lease Terms
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatDate(leaseTerms.startDate)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatDate(leaseTerms.endDate)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {calculateLeaseDuration()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Rent
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatCurrency(leaseTerms.monthlyRent)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Security Deposit
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatCurrency(leaseTerms.securityDeposit)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Rent Due Day
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    Day {leaseTerms.rentDueDay || 1} of each month
                  </Typography>
                </Grid>
                {leaseTerms.rentIncreaseType && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      Automatic Rent Increase
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {getRentIncreaseText()}
                    </Typography>
                  </Grid>
                )}
                {leaseTerms.markPastPaymentsAsPaid && (
                  <Grid size={{ xs: 12 }}>
                    <Chip 
                      label="Mark past payments as paid" 
                      color="info" 
                      size="small" 
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Fees */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Fees
              </Typography>
              {fees && fees.length > 0 ? (
                <Stack spacing={2}>
                  {fees.map((fee, index) => (
                    <Box key={fee.id || index}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {fee.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Due: {formatDate(fee.dueDate)}
                          </Typography>
                        </Box>
                        <Typography variant="body1" fontWeight={600}>
                          {formatCurrency(fee.amount)}
                        </Typography>
                      </Stack>
                      {index < fees.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={600}>
                      Total Fees
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {formatCurrency(totalFeesAmount)}
                    </Typography>
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No fees added
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

ReviewStep.propTypes = {
  selectedProperty: PropTypes.object,
  selectedUnit: PropTypes.object,
  selectedTenants: PropTypes.array,
  leaseTerms: PropTypes.object.isRequired,
  fees: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      amount: PropTypes.number,
      dueDate: PropTypes.instanceOf(Date)
    })
  ).isRequired
};
