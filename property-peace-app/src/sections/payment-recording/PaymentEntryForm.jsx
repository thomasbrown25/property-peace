
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
  alpha,
  CircularProgress,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import { formatCurrency } from 'utils/formatters';
import { normalizeRentBalance } from 'utils/rentBalance';
import { getCurrentRentPresentation } from 'utils/paymentSummaryPresentation';
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

// ==============================|| PAYMENT ENTRY FORM ||============================== //

export default function PaymentEntryForm({ lease, paymentData, onPaymentDataChange, rentRecordOverride }) {

  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);

  // Fetch rent collection data for the lease's property
  const propertyId = lease?.unit?.propertyId || lease?.unit?.property?.id || lease?.propertyId;
  const { rentRecords, loading: rentRecordsLoading } = useFetchRentCollection(propertyId || null, false, true);

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

  // Derive the selected record synchronously so defaults never use the previous lease's balance.
  const rentRecord = useMemo(() => {
    if (!lease?.id) return null;
    const overrideLeaseId = rentRecordOverride?.leaseId ?? rentRecordOverride?.LeaseId;
    return Number(overrideLeaseId) === Number(lease.id)
      ? rentRecordOverride
      : rentRecords?.find((record) => Number(record.leaseId ?? record.LeaseId) === Number(lease.id)) || null;
  }, [lease?.id, rentRecords, rentRecordOverride]);


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

  const { rentDue, rentDueIsOverdue, currentMonthRentDue, overdueAmount } = normalizeRentBalance(rentRecord);
  const currentRentIsOverdue = rentRecord?.currentMonthRentIsOverdue ?? rentRecord?.CurrentMonthRentIsOverdue;
  const overdueRent = Math.min(rentDue, overdueAmount + (currentRentIsOverdue ? currentMonthRentDue : 0))
    || (rentDueIsOverdue ? rentDue : 0);
  const rentDuePresentation = getCurrentRentPresentation({
    dueDate: rentRecord?.currentMonthRentDueDate ?? rentRecord?.CurrentMonthRentDueDate,
    isOverdue: rentDueIsOverdue
  });
  const unpaidFees = useMemo(() => {
    const fees = rentRecord?.unpaidFees ?? rentRecord?.UnpaidFees ?? [];
    return fees.map((fee) => ({
      id: fee.feeId ?? fee.FeeId ?? fee.id ?? fee.Id,
      name: fee.name ?? fee.Name ?? 'Fee',
      amount: Number(fee.amountDue ?? fee.AmountDue ?? fee.amount ?? fee.Amount ?? 0),
      dueDate: fee.dueDate ?? fee.DueDate
    }));
  }, [rentRecord]);
  const totalDue = rentDue + unpaidDeposit + unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);
  const paymentAmount = parseFloat(paymentData.amount) || 0;
  const isPartialPayment = paymentAmount > 0 && paymentAmount < totalDue;
  const hasUnpaidFees = unpaidFees.length > 0;
  const hasUnpaidDeposit = unpaidDeposit > 0;
  const showAllocationSelector = isPartialPayment && (hasUnpaidFees || hasUnpaidDeposit);
  const summaryLoading = (!rentRecord && rentRecordsLoading) || loadingDeposits;

  useEffect(() => {
    if (summaryLoading || !rentRecord || paymentData.suppressAutoPrefill || paymentData.amountEdited) return;
    const amountDisplay = totalDue > 0 ? formatCurrency(totalDue) : '';
    if (paymentData.amount === totalDue && paymentData.amountDisplay === amountDisplay) return;
    onPaymentDataChange({ ...paymentData, amount: totalDue, amountDisplay });
  }, [summaryLoading, rentRecord, totalDue, paymentData, onPaymentDataChange]);

  const handleAmountChange = (value) => {
    const parsed = parseCurrencyToNumber(value);
    onPaymentDataChange({
      ...paymentData,
      amount: parsed,
      amountDisplay: value,
      amountEdited: true
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
      <Typography variant="h6" sx={{ mb: 2 }}>
        Payment details
      </Typography>

      {/* Payment Summary */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          borderColor: 'divider',
          boxShadow: 'none'
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Payment summary
        </Typography>
        {summaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500}>Rent</Typography>
                {rentDue > 0 && rentDuePresentation.dueLabel && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {rentDuePresentation.dueLabel}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(rentDue)}
              </Typography>
            </Stack>
            {hasUnpaidDeposit && (
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Typography variant="body2" fontWeight={500}>Security deposit</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(unpaidDeposit)}
                </Typography>
              </Stack>
            )}
            {unpaidFees.map((fee) => (
              <Stack key={fee.id ?? `${fee.name}-${fee.dueDate ?? ''}`} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Typography variant="body2" fontWeight={500}>{fee.name}</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(fee.amount)}
                </Typography>
              </Stack>
            ))}
            {rentDueIsOverdue && overdueRent > 0 && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
                sx={{ p: 1.25, borderRadius: 1, bgcolor: (theme) => alpha(theme.palette.error.main, 0.06) }}>
                <Typography variant="body2" color="error.main">Overdue rent (included above)</Typography>
                <Typography variant="body2" fontWeight={600} color="error.main" sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(overdueRent)}
                </Typography>
              </Stack>
            )}
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Typography variant="subtitle2" fontWeight={700}>Total due</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
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
              <DollarOutlined style={{ fontSize: 20, color: '#41a541' }} />
            </InputAdornment>
          )
        }}
        helperText={!summaryLoading && totalDue > 0 ? `Total due: ${formatCurrency(totalDue)}` : undefined}
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
