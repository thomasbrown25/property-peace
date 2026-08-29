import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Button,
  Stack,
  InputAdornment,
  Typography,
  Box,
  Paper,
  Divider,
  Chip,
  alpha,
  CircularProgress,
  Alert
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { NumericFormat } from 'react-number-format';

// icons
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { useModal } from 'contexts/ModalContext';
import { formatCurrency } from 'utils/formatters';
import { getTenantPaymentSubmissionCopy } from 'utils/paymentSafety';
import { normalizeRentBalance } from 'utils/rentBalance';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import useRentPaymentActionReadiness from 'hooks/useRentPaymentActionReadiness';
import moment from 'moment';

// Initialize Stripe
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    // We'll fetch the publishable key from the API
    stripePromise = loadStripe(''); // Will be set dynamically
  }
  return stripePromise;
};

const onlinePaymentErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 403 || status === 409) return 'Online rent payments are not available right now. Please close this window and refresh.';
  return error?.response?.data?.message || fallback;
};

// Helper function to format date as local string (YYYY-MM-DDTHH:mm:ss)
const formatLocalDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

// Helper function to calculate overdue amount (matches payments/dashboard calculation)
function calculateOverdueAmount(rent, payments, today) {
  if (!rent || !rent.startDate) return 0;

  const leaseStart = moment(rent.startDate);
  const leaseEnd = rent.endDate ? moment(rent.endDate) : null;
  const effectiveEnd = leaseEnd && leaseEnd.isBefore(today) ? leaseEnd : today;

  // Calculate first due date
  const rentDueDay = rent.rentDueDay || 1;
  let firstDueDate = moment(rent.startDate);
  if (leaseStart.date() !== rentDueDay) {
    firstDueDate = moment(rent.startDate).date(rentDueDay);
    if (firstDueDate.isBefore(leaseStart)) {
      firstDueDate = firstDueDate.add(1, 'month');
    }
  }

  // Only calculate if we've reached the first due date
  if (today.isBefore(firstDueDate, 'day')) {
    return 0;
  }

  // Include current month only when today is strictly after the due day (overdue = today > dueDay).
  const includeCurrentMonth = today.date() > rentDueDay;

  // Calculate months elapsed from first due date
  let monthsElapsed =
    (effectiveEnd.year() - firstDueDate.year()) * 12 + (effectiveEnd.month() - firstDueDate.month()) + (includeCurrentMonth ? 1 : 0);

  if (monthsElapsed < 0) monthsElapsed = 0;

  // Expected total rent up to now
  const expectedSoFar = monthsElapsed * (rent.rentAmount || 0);

  // Total payments made for this lease
  const leasePayments = (payments || [])
    .filter((p) => p.leaseId === rent.leaseId || p.LeaseId === rent.leaseId)
    .reduce((sum, p) => sum + (p.amount || p.Amount || 0), 0);

  // Overdue = expected – paid
  const overdue = Math.max(expectedSoFar - leasePayments, 0);

  return Math.round(overdue * 100) / 100; // Round to 2 decimal places
}

// Payment Form Component for Landlords (no Stripe)
function LandlordPaymentForm({ rent, onSuccess, onClose }) {
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [amount, setAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const { rentDue, rentDueIsOverdue } = normalizeRentBalance(rent);
  const totalDue = rent?.isDeposit || rent?.isFee ? rent?.rentAmount || rent?.RentAmount || 0 : rentDue;

  // Format property display
  const propertyDisplay =
    rent?.propertyType?.toLowerCase() === 'singlefamily'
      ? rent?.propertyName
      : rent?.unitName
        ? `${rent?.propertyName} – ${rent?.unitName}`
        : rent?.propertyName || 'N/A';

  // Parse currency string back to number
  const parseCurrencyToNumber = (value) => {
    if (!value) return 0;
    // Remove currency symbols, commas, and spaces
    const cleaned = value.toString().replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // when rent changes, reset defaults
  useEffect(() => {
    if (rent) {
      // Default to total due (overdue + monthly)
      const initialAmount = totalDue;
      setAmount(initialAmount);
      setPaymentDate(new Date());
      setError(null);
    }
  }, [rent, totalDue]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setProcessing(true);
    setError(null);

    try {
      // For landlords: directly record payment without Stripe
      // Check if this is a deposit payment
      if (rent?.isDeposit) {
        // For deposits, create a deposit record instead of a payment record
        const depositResponse = await axiosServices.post('/api/deposit', {
          leaseId: rent.leaseId,
          amount: parseFloat(amount),
          receivedDate: formatLocalDateTime(paymentDate),
          notes: `Deposit marked as paid - Amount: ${formatCurrency(parseFloat(amount))}`
        });

        if (depositResponse.data && depositResponse.data.success) {
          openSnackbar({
            open: true,
            message: 'Deposit marked as paid successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          onSuccess();
          onClose();
        } else {
          setError(depositResponse.data?.message || 'Failed to record deposit. Please try again.');
        }
      } else if (rent?.isFee) {
        // For fee payments, use the rent-collection payment endpoint with fee reference
        const feeName = rent?.feeName || 'Fee';
        const response = await axiosServices.post('/api/rent-collection/payment', {
          leaseId: rent.leaseId,
          amount: parseFloat(amount),
          paymentDate: formatLocalDateTime(paymentDate),
          reference: `${feeName} payment - Amount: ${formatCurrency(parseFloat(amount))}`,
          feeId: rent?.feeId || null // Link payment to specific fee for partial payment tracking
        });

        if (response.data && response.data.success) {
          openSnackbar({
            open: true,
            message: `${feeName} marked as paid successfully!`,
            variant: 'alert',
            alert: { color: 'success' }
          });
          onSuccess();
          onClose();
        } else {
          setError(response.data?.message || 'Failed to record fee payment. Please try again.');
        }
      } else {
        // For regular rent payments
        const response = await axiosServices.post('/api/rent-collection/payment', {
          leaseId: rent.leaseId,
          amount: parseFloat(amount),
          paymentDate: formatLocalDateTime(paymentDate)
        });

        if (response.data && response.data.success) {
          openSnackbar({
            open: true,
            message: 'Payment recorded successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          onSuccess();
          onClose();
        } else {
          setError(response.data?.message || 'Failed to record payment. Please try again.');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={4} sx={{ px: 3, py: 2 }}>
        {/* Property/Unit Info */}
        <Box
          sx={{
            p: 3,
            borderRadius: 1.5,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <HomeOutlined style={{ fontSize: 20, color: '#1877F2' }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Property / Unit
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {propertyDisplay}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Info message for landlords */}
        <Alert severity="info" sx={{ borderRadius: 1.5 }}>
          As a landlord, you're recording a payment that has been received. No payment processing will occur.
        </Alert>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        {/* Summary Card */}
        <Paper
          variant="outlined"
          sx={{
            p: 3.5,
            borderRadius: 1.5,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
            border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 2.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            {rent?.isDeposit ? 'Deposit Summary' : rent?.isFee ? `${rent?.feeName || 'Fee'} Summary` : 'Payment Summary'}
          </Typography>
          <Stack spacing={2}>
            {!rent?.isDeposit && !rent?.isFee && (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Rent Due
                    </Typography>
                    {rentDueIsOverdue && (
                      <Chip label="Overdue" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                    )}
                  </Stack>
                  <Typography variant="body1" fontWeight={600} color={rentDueIsOverdue ? 'error.main' : 'text.primary'}>
                    {formatCurrency(rentDue)}
                  </Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
              </>
            )}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                pt: 1,
                mt: 1,
                borderTop: (theme) => `2px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                {rent?.isDeposit ? 'Deposit Amount' : rent?.isFee ? 'Fee Amount' : 'Total Due'}
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color={rent?.isDeposit ? 'warning.main' : rentDueIsOverdue ? 'error.main' : 'success.main'}
                sx={{
                  fontSize: '1.5rem'
                }}
              >
                {formatCurrency(totalDue)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* Payment Date */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Payment Date"
            value={paymentDate}
            onChange={(newDate) => setPaymentDate(newDate)}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'medium',
                InputProps: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonthOutlinedIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                },
                sx: {
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1
                  }
                }
              }
            }}
          />
        </LocalizationProvider>

        {/* Payment Amount */}
        <NumericFormat
          customInput={TextField}
          label="Payment Amount"
          value={amount}
          onValueChange={(values) => {
            setAmount(values.floatValue || 0);
          }}
          fullWidth
          size="medium"
          thousandSeparator
          prefix="$"
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DollarOutlined style={{ fontSize: 20, color: '#41a541' }} />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1
            }
          }}
          placeholder="Enter amount"
        />
      </Stack>

      <DialogActions
        sx={{
          px: 3,
          py: 3,
          borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          gap: 2,
          mt: 2
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          disabled={processing}
          sx={{
            minWidth: 100,
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            px: 3
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="success"
          disabled={!amount || parseFloat(amount) <= 0 || processing}
          sx={{
            minWidth: 120,
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
            '&:hover': {
              boxShadow: (theme) => `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`
            }
          }}
        >
          {processing ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} color="inherit" />
              <span>Recording...</span>
            </Stack>
          ) : (
            'Record Payment'
          )}
        </Button>
      </DialogActions>
    </form>
  );
}

// Payment Form Component for Tenants (with Stripe Payment Element)
function TenantPaymentElementCheckout({
  rent,
  amount,
  setAmount,
  paymentDate,
  clientSecret,
  intentAmount,
  totalDue,
  propertyDisplay,
  onSuccess,
  onClose,
  setError
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const numericAmount = Number(amount || 0);
  const numericIntentAmount = Number(intentAmount || 0);
  const amountExceedsDue = totalDue > 0 && numericAmount > totalDue;
  const amountInvalid = !numericAmount || numericAmount <= 0 || amountExceedsDue;
  const intentMatchesAmount = Math.round(numericIntentAmount * 100) === Math.round(numericAmount * 100);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('Payment system not ready. Please wait a moment and try again.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Please check your payment details.');
        setProcessing(false);
        return;
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
          payment_method_data: {
            billing_details: {
              name: `${rent?.tenantFirstName || ''} ${rent?.tenantLastName || ''}`.trim() || 'Tenant'
            }
          }
        }
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        // Browser confirmation is not authoritative. Stripe's signed webhook records and
        // allocates the payment using the durable server-side rent-payment aggregate.
        onSuccess({
          amount: parseFloat(amount),
          status: paymentIntent.status,
          propertyDisplay
        });
      } else {
        setError(`Payment status: ${paymentIntent?.status || 'unknown'}`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={4} sx={{ px: 3, py: 2 }}>
        <PaymentSummary rent={rent} amount={amount} setAmount={setAmount} disabled={processing} showPropertyUnitInfo />

        <Box
          sx={{
            p: 3,
            borderRadius: 1.5,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6)
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
            Payment Method
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
            Want to pay by ACH? Choose <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>US bank account</Box> or{' '}
            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>Try paying by bank</Box> options below to securely connect a bank account.
          </Typography>
          <PaymentElement />
          {!intentMatchesAmount && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 1.5 }}>
              Updating secure payment form for {formatCurrency(numericAmount)}...
            </Alert>
          )}
        </Box>
      </Stack>

      <DialogActions sx={{ px: 3, py: 3, borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`, gap: 2, mt: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          disabled={processing}
          sx={{ minWidth: 100, borderRadius: 1.5, textTransform: 'none', fontWeight: 600, px: 3 }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="success"
          disabled={amountInvalid || !intentMatchesAmount || !stripe || !elements || processing}
          sx={{
            minWidth: 120,
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`
          }}
        >
          {processing ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} color="inherit" />
              <span>Processing...</span>
            </Stack>
          ) : (
            `Pay ${formatCurrency(numericAmount)}`
          )}
        </Button>
      </DialogActions>
    </form>
  );
}

function PaymentSummary({ rent, amount, setAmount, disabled = false, showPropertyUnitInfo = false }) {
  const isTotalPayment = rent?.isTotalPayment === true;
  const propertyName = rent?.propertyName || rent?.PropertyName || 'N/A';
  const unitName = rent?.unitName || rent?.UnitName || '';
  const normalizedPropertyType = String(rent?.propertyType || rent?.PropertyType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedUnitName = String(unitName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const isSingleFamily = normalizedPropertyType === 'singlefamily' || normalizedUnitName === 'unit1';
  const { rentDue, rentDueIsOverdue } = normalizeRentBalance(rent);
  const totalDue = isTotalPayment
    ? (rent?.totalAmountDue ?? 0)
    : rent?.isFee
      ? rent?.rentAmount || rent?.RentAmount || 0
      : rentDue;
  const numericAmount = Number(amount || 0);
  const amountExceedsDue = totalDue > 0 && numericAmount > totalDue;
  const canEditAmount = typeof setAmount === 'function';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3.5,
        borderRadius: 1.5,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
        border: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 2.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {rent?.isDeposit ? 'Deposit Summary' : rent?.isFee ? `${rent?.feeName || 'Fee'} Summary` : 'Payment Summary'}
      </Typography>
      <Stack spacing={2}>
        {showPropertyUnitInfo && (
          <>
            <Stack spacing={0.5} alignItems="flex-start">
              <Typography variant="body2" color="text.primary" fontWeight={600}>
                {propertyName}
              </Typography>
              {!isSingleFamily && unitName && (
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {unitName}
                </Typography>
              )}
            </Stack>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}
        {isTotalPayment && rent?.allocationOrder?.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
              Payments are applied in this order:
            </Typography>
            <Stack spacing={1.25}>
              {rent.allocationOrder.map((item, i) => {
                const itemAmount = Number(item.amount ?? item.Amount ?? 0);
                const itemDueDate = item.dueDate || item.DueDate;
                return (
                  <Stack
                    key={`${item.type || item.label || 'item'}-${item.feeId || i}`}
                    direction="row"
                    spacing={2}
                    alignItems="flex-start"
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: '50%',
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" color="text.primary" fontWeight={600}>
                          {item.label || 'Amount due'}
                        </Typography>
                        {itemDueDate && (
                          <Typography variant="caption" color="text.secondary">
                            Due {moment(itemDueDate).format('MMM D, YYYY')}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    <Typography
                      variant="body1"
                      fontWeight={600}
                      color={itemAmount > 0 ? 'text.primary' : 'text.secondary'}
                      sx={{ flexShrink: 0 }}
                    >
                      {formatCurrency(itemAmount)}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}
        {!rent?.isDeposit && !rent?.isFee && !isTotalPayment && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Rent Due
                </Typography>
                {rentDueIsOverdue && (
                  <Chip label="Overdue" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                )}
              </Stack>
              <Typography variant="body1" fontWeight={600} color={rentDueIsOverdue ? 'error.main' : 'text.primary'}>
                {formatCurrency(rentDue)}
              </Typography>
            </Stack>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 1, mt: 1, borderTop: (theme) => `2px solid ${alpha(theme.palette.primary.main, 0.2)}` }}
        >
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            {rent?.isDeposit ? 'Deposit Amount' : rent?.isFee ? 'Fee Amount' : 'Total Due'}
          </Typography>
          <Typography
            variant="h6"
            fontWeight={700}
            color={rent?.isDeposit ? 'warning.main' : rentDueIsOverdue ? 'error.main' : 'success.main'}
            sx={{ fontSize: '1.5rem' }}
          >
            {formatCurrency(totalDue)}
          </Typography>
        </Stack>
        {canEditAmount && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Payment Amount
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enter a partial amount or pay the full balance due.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  color="primary"
                  onClick={() => setAmount(totalDue)}
                  disabled={disabled || !totalDue || numericAmount === totalDue}
                  sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
                >
                  Pay full balance
                </Button>
              </Stack>
              <NumericFormat
                customInput={TextField}
                value={amount}
                onValueChange={(values) => setAmount(values.floatValue || 0)}
                fullWidth
                size="medium"
                thousandSeparator
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                disabled={disabled}
                error={amountExceedsDue || !numericAmount || numericAmount <= 0}
                helperText={
                  amountExceedsDue
                    ? `Amount cannot exceed the current balance due of ${formatCurrency(totalDue)}.`
                    : `Current balance due: ${formatCurrency(totalDue)}`
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DollarOutlined style={{ fontSize: 20, color: '#41a541' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1
                  }
                }}
                placeholder="Enter amount"
              />
            </Stack>
          </>
        )}
        {!canEditAmount && !rent?.isDeposit && !rent?.isFee && amount > 0 && amount < totalDue && (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Amount to Pay Now
            </Typography>
            <Typography variant="body1" fontWeight={700} color="success.main">
              {formatCurrency(amount)}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function TenantPaymentSubmitted({ payment, onClose }) {
  const copy = getTenantPaymentSubmissionCopy(payment);

  return (
    <>
      <Box sx={{ px: 4, py: 5 }}>
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.12),
              color: 'info.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.info.main, 0.18)}`
            }}
          >
            <DollarOutlined style={{ fontSize: 48 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
              {copy.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.65 }}>
              {copy.message}
            </Typography>
            <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mt: 2 }}>
              Amount submitted: {formatCurrency(payment?.amount || 0)}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <DialogActions sx={{ px: 3, py: 3, borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`, gap: 1.5 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
        <Button onClick={onClose} variant="contained" color="primary" sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}>
          Done
        </Button>
      </DialogActions>
    </>
  );
}

function TenantPaymentForm({ rent, onSuccess, onClose }) {
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [amount, setAmount] = useState(0);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [intentAmount, setIntentAmount] = useState(0);
  const [error, setError] = useState(null);
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const paymentIntentRequestRef = useRef(0);
  const paymentOperationIdRef = useRef(crypto.randomUUID());

  const isTotalPayment = rent?.isTotalPayment === true;
  const { rentDue, rentDueIsOverdue } = normalizeRentBalance(rent);
  const totalDue = isTotalPayment
    ? (rent?.totalAmountDue ?? 0)
    : rent?.isFee
      ? rent?.rentAmount || rent?.RentAmount || 0
      : rentDue;
  const propertyDisplay = isTotalPayment
    ? rent?.unitName
      ? `${rent?.propertyName || ''} – ${rent?.unitName}`.trim()
      : rent?.propertyName || 'N/A'
    : rent?.propertyType?.toLowerCase() === 'singlefamily'
      ? rent?.propertyName
      : rent?.unitName
        ? `${rent?.propertyName} – ${rent?.unitName}`
        : rent?.propertyName || 'N/A';

  useEffect(() => {
    if (rent) {
      setAmount(totalDue);
      setPaymentDate(new Date());
      setError(null);
      setClientSecret(null);
      setPaymentIntentId(null);
      setIntentAmount(0);
      setSubmittedPayment(null);
      paymentOperationIdRef.current = crypto.randomUUID();
    }
  }, [rent, totalDue]);

  const handleSubmitted = (payment) => {
    setSubmittedPayment(payment);
    onSuccess();
  };

  useEffect(() => {
    if (submittedPayment) return;

    const syncPaymentIntentAmount = async () => {
      const requestedAmount = parseFloat(amount);
      const exceedsDue = totalDue > 0 && requestedAmount > totalDue;

      if (!rent?.leaseId || !requestedAmount || requestedAmount <= 0 || exceedsDue) {
        setError(null);
        return;
      }

      if (paymentIntentId && Math.round(Number(intentAmount || 0) * 100) === Math.round(requestedAmount * 100)) {
        return;
      }

      const requestId = paymentIntentRequestRef.current + 1;
      paymentIntentRequestRef.current = requestId;

      try {
        const payload = {
          leaseId: rent.leaseId,
          amount: requestedAmount,
          operationId: paymentOperationIdRef.current,
          description: `Payment for ${propertyDisplay}`
        };

        const response = paymentIntentId
          ? await axiosServices.post('/api/stripe/update-payment-intent', {
              ...payload,
              paymentIntentId
            })
          : await axiosServices.post('/api/stripe/create-payment-intent', payload);

        if (requestId !== paymentIntentRequestRef.current) return;

        if (response.data && response.data.success && response.data.data) {
          if (!clientSecret) setClientSecret(response.data.data.clientSecret);
          if (!paymentIntentId) setPaymentIntentId(response.data.data.paymentIntentId);
          setIntentAmount(requestedAmount);
          setError(null);
        } else {
          setError(response.data?.message || 'Failed to initialize payment');
          setIntentAmount(0);
        }
      } catch (err) {
        if (requestId !== paymentIntentRequestRef.current) return;
        console.error('Error syncing payment intent amount:', err);
        setError(onlinePaymentErrorMessage(err, 'Failed to update payment amount. Please try again.'));
        setIntentAmount(0);
      }
    };

    syncPaymentIntentAmount();
  }, [rent?.leaseId, amount, propertyDisplay, totalDue, paymentIntentId, clientSecret, intentAmount, submittedPayment]);

  const elementsOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            borderRadius: '8px',
            fontFamily: 'Inter, Roboto, sans-serif'
          }
        }
      }
    : null;

  if (submittedPayment) {
    return <TenantPaymentSubmitted payment={submittedPayment} onClose={onClose} />;
  }

  if (!clientSecret) {
    return (
      <Stack spacing={3} sx={{ px: 3, py: 3 }}>
        <PaymentSummary rent={rent} amount={amount} setAmount={setAmount} showPropertyUnitInfo />
        {error && (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}
        {!error && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Initializing secure payment form...
            </Typography>
          </Stack>
        )}
      </Stack>
    );
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions} key={clientSecret}>
      <TenantPaymentElementCheckout
        rent={rent}
        amount={amount}
        setAmount={setAmount}
        paymentDate={paymentDate}
        clientSecret={clientSecret}
        intentAmount={intentAmount}
        totalDue={totalDue}
        propertyDisplay={propertyDisplay}
        onSuccess={handleSubmitted}
        onClose={onClose}
        setError={setError}
      />
      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 2, borderRadius: 1.5 }}>
          {error}
        </Alert>
      )}
    </Elements>
  );
}

// Main Payment Modal Component
export default function PaymentModal({ rent, defaultAmount, onClose: onCloseProp, onSuccess: onSuccessProp, presentation = 'dialog' }) {
  const modal = useModal();
  const auth = useAuth();
  const userRoles = Array.isArray(auth?.user?.Roles) ? auth?.user?.Roles : Array.isArray(auth?.user?.roles) ? auth?.user?.roles : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const isLandlord = normalizedRoles.includes('landlord');
  const { canInvoke, isLoading: readinessLoading } = useRentPaymentActionReadiness('Pay', !isLandlord);
  const [publishableKey, setPublishableKey] = useState(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const open = modal.openPayment;
  const useDrawerShell = presentation === 'drawer';
  const title = rent?.isDeposit
    ? isLandlord
      ? 'Record Deposit Payment'
      : 'Pay Deposit'
    : rent?.isFee
      ? isLandlord
        ? `Record ${rent?.feeName || 'Fee'} Payment`
        : `Pay ${rent?.feeName || 'Fee'}`
      : isLandlord
        ? 'Record Payment'
        : 'Make Payment';

  useEffect(() => {
    // Skip Stripe setup for landlords
    if (isLandlord) {
      setLoadingKey(false);
      return;
    }

    const fetchPublishableKey = async () => {
      try {
        const response = await axiosServices.get('/api/stripe/publishable-key');
        if (response.data && response.data.publishableKey) {
          setPublishableKey(response.data.publishableKey);
          stripePromise = loadStripe(response.data.publishableKey);
        } else {
          console.error('Failed to get publishable key');
        }
      } catch (error) {
        console.error('Error fetching publishable key:', error);
      } finally {
        setLoadingKey(false);
      }
    };

    if (!open || !canInvoke) return;
    fetchPublishableKey();
  }, [open, isLandlord, canInvoke]);

  const handleClose = () => {
    if (onCloseProp) {
      onCloseProp();
    } else {
      modal.closePaymentModal();
    }
  };

  useEffect(() => {
    if (open && !isLandlord && !canInvoke && !readinessLoading) {
      if (onCloseProp) onCloseProp();
      else modal.closePaymentModal();
    }
  }, [open, isLandlord, canInvoke, readinessLoading, onCloseProp, modal]);

  const handleSuccess = () => {
    // Call onSuccess callback if provided (for refreshing data)
    if (onSuccessProp) {
      onSuccessProp();
    }
    // Close the modal
    if (onCloseProp) {
      onCloseProp();
    } else {
      modal.closePaymentModal();
    }
  };

  const handleTenantSuccess = () => {
    if (onSuccessProp) {
      onSuccessProp();
    }
  };

  const content = !isLandlord && !readinessLoading && !canInvoke ? (
    <Box sx={{ p: 3 }}><Alert severity="warning">Online rent payments are not available right now.</Alert></Box>
  ) : loadingKey || (!isLandlord && readinessLoading) ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
      <CircularProgress />
    </Box>
  ) : !isLandlord && !publishableKey ? (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">Failed to initialize payment system. Please try again later.</Alert>
    </Box>
  ) : isLandlord ? (
    <LandlordPaymentForm rent={rent} onSuccess={handleSuccess} onClose={handleClose} />
  ) : (
    <TenantPaymentForm rent={rent} onSuccess={handleTenantSuccess} onClose={handleClose} />
  );

  if (useDrawerShell) {
    return (
      <ThemeAdaptiveDrawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 560, md: 680 },
            maxWidth: '100vw',
            bgcolor: 'background.paper'
          }
        }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{
              px: { xs: 2.25, sm: 3 },
              py: 2.5,
              borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              flexShrink: 0
            }}
          >
            <Typography variant="h4" fontWeight={800}>
              {title}
            </Typography>
            <IconButton onClick={handleClose} aria-label="Close payment drawer" size="small">
              <CloseOutlined />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>{content}</Box>
        </Stack>
      </ThemeAdaptiveDrawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
        }
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '1.5rem',
          px: 3,
          pt: 3,
          pb: 2.5,
          borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        {title}
      </DialogTitle>

      <DialogContent sx={{ px: 0, py: 0 }}>{content}</DialogContent>
    </Dialog>
  );
}
