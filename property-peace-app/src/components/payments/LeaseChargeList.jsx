import PropTypes from 'prop-types';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { formatCurrency, formatDate } from 'utils/formatters';
import { chargePresentation } from 'utils/leaseCharges';
import { feeCheckoutSelection } from 'utils/feeCheckout';

export default function LeaseChargeList({ charges, rentBalance, loading, error, onRetry, onPayFee, canPayFee = false }) {
  const otherCharges = charges.filter((item) => String(item.type || '').toLowerCase() !== 'rent');
  const fees = otherCharges.filter((item) => String(item.type || '').toLowerCase() === 'fee');
  const deposits = otherCharges.filter((item) => String(item.type || '').toLowerCase() === 'deposit');
  const additionalCharges = otherCharges.filter((item) => !['fee', 'deposit'].includes(String(item.type || '').toLowerCase()));
  const sections = [['Fees', fees], ['Deposits · read-only', deposits], ['Other charges', additionalCharges]];
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>Lease balances</Typography>
          {onRetry && <Button size="small" onClick={onRetry}>Refresh balances</Button>}
        </Stack>
        <Typography variant="caption" color="text.secondary">Rent is one accumulated lease balance. Fees are listed separately; deposits are read-only. Submitted payments reduce balances only after final confirmation. Rent checkout applies oldest-first across the lease.</Typography>
      </Box>
      <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={700}>Accumulated rent balance</Typography>
        <Typography variant="h6" fontWeight={700}>{rentBalance == null ? 'Unavailable' : formatCurrency(rentBalance)}</Typography>
        <Typography variant="caption" color="text.secondary">All accrued unpaid rent for this lease. Pay rent using the lease-wide Make Payment action below.</Typography>
      </Box>
      {loading ? <Box role="status" aria-label="Loading charges" sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={26} /></Box>
        : error ? <Alert severity="warning" action={onRetry && <Button color="inherit" onClick={onRetry}>Try again</Button>} sx={{ m: 2 }}>
          {error} Charges could not be loaded; this does not mean the balance is zero.
        </Alert>
          : otherCharges.length === 0 ? <Typography color="text.secondary" sx={{ p: 3 }}>No separate fees or deposits have been recorded for this lease.</Typography>
            : <Stack>
              {sections.filter(([, items]) => items.length > 0).map(([heading, items]) => <Box key={heading}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ px: 2.5, py: 1.5, bgcolor: 'action.hover' }}>{heading}</Typography>
                <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {items.map((item) => {
                const charge = { ...chargePresentation(item), canPayFee: Boolean(feeCheckoutSelection(item)) };
                return <Box key={charge.chargeId} sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={700}>{charge.isPooledDeposit ? 'Combined deposits' : charge.title || 'Untitled charge'}</Typography>
                      <Chip label={charge.type || 'Other'} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {charge.isPooledDeposit
                        ? (charge.dueDate ? `Lease start ${formatDate(charge.dueDate)}` : 'Lease start date not set')
                        : (charge.dueDate ? `Due ${formatDate(charge.dueDate)}` : 'Due date not set')}
                    </Typography>
                    {charge.isPooledDeposit && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Lease deposits are combined here; receipts are credited to the combined balance, not to individual deposit types.
                    </Typography>}
                    {!charge.canPayFee && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {String(charge.type).toLowerCase() === 'deposit' ? 'Deposits cannot be paid online here.' : 'This charge cannot be selected for online payment.'}
                    </Typography>}
                  </Box>
                  <Stack direction="row" spacing={{ xs: 2, sm: 4 }} flexWrap="wrap" sx={{ mt: 1.5 }}>
                    {[['Original', charge.amount], ['Paid', charge.paid], ['Remaining', charge.remaining]].map(([label, value]) =>
                      <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={label === 'Remaining' ? 700 : 500}>{value == null ? '—' : formatCurrency(value)}</Typography></Box>)}
                  </Stack>
                  {onPayFee && charge.canPayFee && <Button sx={{ mt: 1.5 }} variant="outlined" size="small" disabled={!canPayFee} onClick={() => onPayFee(item)}>
                    Pay fee
                  </Button>}
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">Payment activity</Typography>
                    {charge.payments?.length ? <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {charge.payments.map((payment) => <Stack key={payment.id} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.5, borderTop: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary">{payment.paymentDate ? formatDate(payment.paymentDate) : 'Date unavailable'} · {payment.status || 'Status unavailable'}</Typography>
                        <Typography variant="caption" fontWeight={700}>{payment.amount == null ? '—' : formatCurrency(payment.amount)}</Typography>
                      </Stack>)}
                    </Stack> : <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>No payment activity for this charge.</Typography>}
                  </Box>
                </Box>;
              })}
                </Stack>
              </Box>)}
            </Stack>}
    </Paper>
  );
}

LeaseChargeList.propTypes = {
  charges: PropTypes.arrayOf(PropTypes.object).isRequired,
  rentBalance: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  onPayFee: PropTypes.func,
  canPayFee: PropTypes.bool
};
