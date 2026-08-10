import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  TextField,
  Stack,
  InputAdornment,
  Paper,
  Divider,
  Chip,
  alpha,
  CircularProgress,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import { formatCurrency } from 'utils/formatters';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import axiosServices from 'utils/axios';

// Parse currency string back to number
const parseCurrencyToNumber = (value) => {
  if (!value) return 0;
  // Remove currency symbols, commas, and spaces
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const formatDueDate = (value) => {
  if (!value) return null;

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// ==============================|| PAYMENT ENTRY FORM ||============================== //

export default function PaymentEntryForm({ lease, paymentData, onPaymentDataChange, rentRecordOverride }) {
  const [rentRecord, setRentRecord] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  // Fetch rent collection data for the lease's property
  const propertyId = lease?.unit?.propertyId || lease?.unit?.property?.id || lease?.propertyId;
  const { rentRecords, loading: rentRecordsLoading } = useFetchRentCollection(
    propertyId || null,
    false
  );

  // Fetch deposits for this lease
  useEffect(() => {
    const fetchDeposits = async () => {
      if (!lease?.id) {
        setDeposits([]);
        return;
      }

      setLoadingDeposits(true);
      try {
        const response = await axiosServices.get(`/api/deposit/lease/${lease.id}`);
        if (response.data && response.data.success) {
          setDeposits(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching deposits:', error);
        setDeposits([]);
      } finally {
        setLoadingDeposits(false);
      }
    };

    fetchDeposits();
  }, [lease?.id]);

  // Find rent record for selected lease
  useEffect(() => {
    if (!lease?.id) {
      setRentRecord(null);
      return;
    }

    const overrideLeaseId = rentRecordOverride?.leaseId ?? rentRecordOverride?.LeaseId;
    const record = Number(overrideLeaseId) === Number(lease.id)
      ? rentRecordOverride
      : rentRecords?.find((r) => r.leaseId === lease.id || r.LeaseId === lease.id);

    if (record) {
      setRentRecord(record);
      const amountDueNow = record.amountDueNow ?? record.AmountDueNow ?? 0;
      const legacyOverdue = record.overdueAmount ?? record.OverdueAmount ?? 0;
      const currentRentDue = record.currentMonthRentDue ?? record.CurrentMonthRentDue ?? Math.max(amountDueNow - legacyOverdue, 0);
      const priorOverdueRent = record.priorPeriodOverdueRent ?? record.PriorPeriodOverdueRent ?? legacyOverdue;
      const feeBalance = (record.unpaidFees ?? record.UnpaidFees ?? [])
        .reduce((sum, fee) => sum + (fee.amountDue ?? fee.AmountDue ?? fee.amount ?? fee.Amount ?? 0), 0);
      const paymentSummaryDue = currentRentDue + priorOverdueRent + feeBalance;
      const formattedAmountDue = paymentSummaryDue > 0 ? formatCurrency(paymentSummaryDue) : '';

      if (!paymentData.suppressAutoPrefill && (!paymentData.amount || paymentData.amount === 0)) {
        onPaymentDataChange({
          ...paymentData,
          amount: paymentSummaryDue,
          amountDisplay: formattedAmountDue
        });
      }
    } else {
      setRentRecord(null);
    }
  }, [lease?.id, rentRecords, rentRecordOverride]);

  // Calculate unpaid deposit amount
  const unpaidDeposit = useMemo(() => {
    if (!lease?.depositAmount || lease.depositAmount === 0) return 0;
    
    // Calculate total deposits received (not refunded)
    const totalDepositsReceived = deposits
      .filter(d => d.receivedDate && !d.refundedDate)
      .reduce((sum, d) => sum + (d.amount || d.Amount || 0), 0);
    
    const depositAmount = lease.depositAmount || lease.DepositAmount || 0;
    const unpaid = depositAmount - totalDepositsReceived;
    
    return Math.max(unpaid, 0); // Don't show negative
  }, [lease, deposits]);

  // Calculate payment summary values from the API's explicit rent/fee split.
  // Fallbacks preserve compatibility while older API responses are still in flight.
  const amountDueNow = rentRecord?.amountDueNow ?? rentRecord?.AmountDueNow ?? 0;
  const legacyOverdue = rentRecord?.overdueAmount ?? rentRecord?.OverdueAmount ?? 0;
  const rentDue = rentRecord?.currentMonthRentDue ?? rentRecord?.CurrentMonthRentDue ?? Math.max(amountDueNow - legacyOverdue, 0);
  const overdueRent = rentRecord?.priorPeriodOverdueRent ?? rentRecord?.PriorPeriodOverdueRent ?? legacyOverdue;
  const unpaidFees = useMemo(() => {
    const fees = rentRecord?.unpaidFees ?? rentRecord?.UnpaidFees ?? [];
    return fees.map((fee) => ({
      id: fee.feeId ?? fee.FeeId ?? fee.id ?? fee.Id,
      name: fee.name ?? fee.Name ?? 'Fee',
      amount: fee.amountDue ?? fee.AmountDue ?? fee.amount ?? fee.Amount ?? 0,
      dueDate: fee.dueDate ?? fee.DueDate
    }));
  }, [rentRecord]);
  const rentBalanceDue = rentDue + overdueRent;
  const nextPaymentDueDate = rentBalanceDue === 0 ? formatDueDate(rentRecord?.dueDate ?? rentRecord?.DueDate) : null;
  const totalDue = rentBalanceDue + unpaidDeposit + unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);
  const paymentAmount = parseFloat(paymentData.amount) || 0;
  const isPartialPayment = paymentAmount > 0 && paymentAmount < totalDue;
  const hasUnpaidFees = unpaidFees.length > 0;
  const hasUnpaidDeposit = unpaidDeposit > 0;
  const showAllocationSelector = isPartialPayment && (hasUnpaidFees || hasUnpaidDeposit);
  const summaryLoading = (!rentRecord && rentRecordsLoading) || loadingDeposits;

  // Format property display
  const propertyDisplay = useMemo(() => {
    if (!lease) return null;
    const isSingleFamily = lease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily' ||
                          lease.propertyType?.toLowerCase() === 'singlefamily';
    if (isSingleFamily) {
      return lease.propertyName || lease.unit?.property?.name;
    }
    if (lease.unitName) {
      return `${lease.propertyName || lease.unit?.property?.name} – ${lease.unitName}`;
    }
    return lease.propertyName || lease.unit?.property?.name;
  }, [lease]);

  const handleAmountChange = (value) => {
    const parsed = parseCurrencyToNumber(value);
    onPaymentDataChange({
      ...paymentData,
      amount: parsed,
      amountDisplay: value
    });
  };

  const handleAmountBlur = (value) => {
    const parsed = parseCurrencyToNumber(value);
    if (parsed > 0) {
      onPaymentDataChange({
        ...paymentData,
        amount: parsed,
        amountDisplay: formatCurrency(parsed)
      });
    } else {
      onPaymentDataChange({
        ...paymentData,
        amount: 0,
        amountDisplay: ''
      });
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Enter Payment Details
      </Typography>

      {/* Property/Unit Info Display */}
      {propertyDisplay && (
        <Box
          sx={{
            p: 3,
            mb: 3,
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
      )}

      {/* Info message */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 1.5 }}>
        As a landlord, you're recording a payment that has been received. No payment processing will occur.
      </Alert>

      {/* Payment Summary */}
      <Paper
        variant="outlined"
        sx={{
          p: 3.5,
          mb: 3,
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
          Payment Summary
        </Typography>
        {summaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Rent Due
              </Typography>
              <Typography variant="body1" fontWeight={500} color="text.primary">
                {formatCurrency(rentDue)}
              </Typography>
            </Stack>
            {nextPaymentDueDate && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Next Rent Due
                  </Typography>
                  <Typography variant="body1" fontWeight={600} color="text.primary">
                    {nextPaymentDueDate}
                  </Typography>
                </Stack>
              </>
            )}
            {overdueRent > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Overdue Rent
                    </Typography>
                    <Chip label="Overdue" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                  </Stack>
                  <Typography variant="body1" fontWeight={600} color="error.main">
                    {formatCurrency(overdueRent)}
                  </Typography>
                </Stack>
              </>
            )}

            {/* Unpaid Deposit Section */}
            {hasUnpaidDeposit && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Security Deposit
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatCurrency(unpaidDeposit)}
                  </Typography>
                </Stack>
              </>
            )}

            {/* Each unpaid fee stays separate from rent and other charges. */}
            {unpaidFees.map((fee) => (
              <Box key={fee.id ?? `${fee.name}-${fee.dueDate ?? ''}`}>
                <Divider sx={{ mb: 2 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {fee.name}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatCurrency(fee.amount)}
                  </Typography>
                </Stack>
              </Box>
            ))}

            <Divider sx={{ my: 0.5 }} />
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
                Total Due
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color={overdueRent > 0 ? 'error.main' : 'success.main'}
                sx={{
                  fontSize: '1.5rem'
                }}
              >
                {formatCurrency(totalDue)}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Paper>

      {/* Payment Date */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Payment Date"
          value={paymentData.paymentDate}
          onChange={(newDate) => {
            onPaymentDataChange({
              ...paymentData,
              paymentDate: newDate || new Date()
            });
          }}
          slotProps={{
            textField: {
              fullWidth: true,
              size: 'medium',
              sx: {
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5
                }
              },
              InputProps: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthOutlinedIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }
            }
          }}
        />
      </LocalizationProvider>

      {/* Payment Amount */}
      <TextField
        label="Payment Amount"
        value={paymentData.amountDisplay}
        onChange={(e) => handleAmountChange(e.target.value)}
        onBlur={(e) => handleAmountBlur(e.target.value)}
        fullWidth
        size="medium"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            </InputAdornment>
          )
        }}
        helperText={!rentRecordsLoading && rentDue > 0 ? `Current rent due: ${formatCurrency(rentDue)}` : undefined}
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5
          }
        }}
        placeholder="Enter amount"
      />

      {/* Payment Allocation Selector (if partial payment and fees exist) */}
      {showAllocationSelector && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 1.5,
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
            border: (theme) => `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Payment Allocation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is a partial payment. Where should this payment be applied?
          </Typography>
          <FormControl component="fieldset">
            <RadioGroup
              value={paymentData.paymentAllocation || 'rent'}
              onChange={(e) => {
                onPaymentDataChange({
                  ...paymentData,
                  paymentAllocation: e.target.value
                });
              }}
            >
              <FormControlLabel 
                value="rent" 
                control={<Radio />} 
                label={`Rent Payment (${formatCurrency(paymentAmount)})`}
              />
              {hasUnpaidDeposit && (
                <FormControlLabel
                  value="deposit"
                  control={<Radio />}
                  label={`Security Deposit (${formatCurrency(unpaidDeposit)})`}
                />
              )}
              {unpaidFees.map((fee) => (
                <FormControlLabel
                  key={fee.id}
                  value={`fee-${fee.id}`}
                  control={<Radio />}
                  label={`${fee.name || fee.description} (${formatCurrency(fee.amount || 0)})`}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Paper>
      )}
    </Box>
  );
}

PaymentEntryForm.propTypes = {
  lease: PropTypes.object.isRequired,
  paymentData: PropTypes.object.isRequired,
  onPaymentDataChange: PropTypes.func.isRequired,
  rentRecordOverride: PropTypes.object
};
