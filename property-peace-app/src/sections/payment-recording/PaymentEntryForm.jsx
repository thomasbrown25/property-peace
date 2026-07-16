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

// ==============================|| PAYMENT ENTRY FORM ||============================== //

export default function PaymentEntryForm({ lease, paymentData, onPaymentDataChange, rentRecordOverride }) {
  const [rentRecord, setRentRecord] = useState(null);
  const [unpaidFees, setUnpaidFees] = useState([]);
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
      const formattedAmountDue = amountDueNow > 0 ? formatCurrency(amountDueNow) : '';

      if (!paymentData.suppressAutoPrefill && (!paymentData.amount || paymentData.amount === 0)) {
        onPaymentDataChange({
          ...paymentData,
          amount: amountDueNow,
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

  // TODO: Fetch unpaid fees when fee system is implemented
  // For now, unpaidFees will be an empty array
  useEffect(() => {
    // Placeholder for future fee fetching
    setUnpaidFees([]);
  }, [lease]);

  // Calculate payment summary values
  const amountDueNow = rentRecord?.amountDueNow ?? rentRecord?.AmountDueNow ?? 0;
  const overdue = rentRecord?.overdueAmount ?? rentRecord?.OverdueAmount ?? 0;
  const monthlyDue = Math.max(amountDueNow - overdue, 0);
  const totalDue = amountDueNow + unpaidDeposit + (unpaidFees?.reduce((sum, fee) => sum + (fee.amount || 0), 0) || 0);
  const paymentAmount = parseFloat(paymentData.amount) || 0;
  const isPartialPayment = paymentAmount > 0 && paymentAmount < totalDue;
  const hasUnpaidFees = unpaidFees && unpaidFees.length > 0;
  const hasUnpaidDeposit = unpaidDeposit > 0;
  const showAllocationSelector = isPartialPayment && (hasUnpaidFees || hasUnpaidDeposit);

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
        {rentRecordsLoading || loadingDeposits ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Monthly Due
              </Typography>
              <Typography variant="body1" fontWeight={500} color="text.primary">
                {formatCurrency(monthlyDue)}
              </Typography>
            </Stack>
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Overdue Amount
                </Typography>
                {overdue > 0 && (
                  <Chip label="Overdue" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                )}
              </Stack>
              <Typography variant="body1" fontWeight={600} color={overdue > 0 ? 'error.main' : 'text.primary'}>
                {formatCurrency(overdue)}
              </Typography>
            </Stack>
            
            {/* Unpaid Deposit Section */}
            {hasUnpaidDeposit && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Unpaid Security Deposit
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatCurrency(unpaidDeposit)}
                  </Typography>
                </Stack>
              </>
            )}
            
            {/* Unpaid Fees Section (when implemented) */}
            {hasUnpaidFees && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Unpaid Fees
                </Typography>
                {unpaidFees.map((fee) => (
                  <Stack key={fee.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ pl: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {fee.name || fee.description}
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(fee.amount || 0)}
                    </Typography>
                  </Stack>
                ))}
              </>
            )}

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
                color={overdue > 0 ? 'error.main' : 'success.main'}
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
        helperText={!rentRecordsLoading && monthlyDue > 0 ? `Monthly rent: ${formatCurrency(monthlyDue)}` : undefined}
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
