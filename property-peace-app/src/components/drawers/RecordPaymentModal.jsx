import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
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
  Alert,
  Grid
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { NumericFormat } from 'react-number-format';

// icons
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import { formatCurrency } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import moment from 'moment';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { selectLease } from 'store/lease/lease.selector';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import useFetchRentCollection from 'hooks/useFetchRentCollection';

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

// Parse currency string back to number
const parseCurrencyToNumber = (value) => {
  if (!value) return 0;
  // Remove currency symbols, commas, and spaces
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export default function RecordPaymentModal({ open, onClose, onSuccess }) {
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const selectedLease = useSelector(selectLease);

  const [paymentDate, setPaymentDate] = useState(new Date());
  const [amount, setAmount] = useState(0);
  const [amountDisplay, setAmountDisplay] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [rentRecord, setRentRecord] = useState(null);
  const [loadingRentData, setLoadingRentData] = useState(false);

  // Fetch rent collection data for selected property
  const { rentRecords, loading: rentRecordsLoading, refetch: refetchRentRecords } = useFetchRentCollection(
    selectedProperty?.id || null,
    false
  );

  // Check if property is single family (no units)
  const isSingleFamilyProperty = useMemo(() => {
    if (!selectedProperty) return false;
    const propertyType = selectedProperty.propertyType?.toLowerCase();
    return propertyType === 'singlefamily' || propertyType === 'single-family';
  }, [selectedProperty]);

  // Find rent record for selected lease
  useEffect(() => {
    if (!selectedLease?.id || !rentRecords) {
      setRentRecord(null);
      return;
    }

    const record = rentRecords.find((r) => r.leaseId === selectedLease.id);
    if (record) {
      setRentRecord(record);
      // Update payment amount to total due when rent record is found
      const monthlyDue = record.rentAmount || record.RentAmount || 0;
      const overdue = record.overdueAmount || record.OverdueAmount || 0;
      const totalDue = monthlyDue + overdue;
      setAmount(totalDue);
    } else {
      setRentRecord(null);
    }
  }, [selectedLease, rentRecords]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Reset form fields
  const resetForm = () => {
    setPaymentDate(new Date());
    setAmount(0);
    setAmountDisplay('');
    setError(null);
    setRentRecord(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Calculate payment summary values
  const monthlyDue = rentRecord?.rentAmount || rentRecord?.RentAmount || 0;
  const overdue = rentRecord?.overdueAmount || rentRecord?.OverdueAmount || 0;
  const totalDue = monthlyDue + overdue;

  // Format property display
  const propertyDisplay = useMemo(() => {
    if (!selectedProperty) return null;
    if (isSingleFamilyProperty) {
      return selectedProperty.name;
    }
    if (selectedUnit && selectedUnit.name) {
      return `${selectedProperty.name} – ${selectedUnit.name}`;
    }
    return selectedProperty.name;
  }, [selectedProperty, selectedUnit, isSingleFamilyProperty]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedLease?.id) {
      setError('Please select a property and unit with an active lease');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await axiosServices.post('/api/rent-collection/payment', {
        leaseId: selectedLease.id,
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
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(response.data?.message || 'Failed to record payment. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

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
        Record Payment
      </DialogTitle>

      <DialogContent sx={{ px: 0, py: 0 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={4} sx={{ px: 3, py: 2 }}>
            {/* Property/Unit Selection */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                Select Property / Unit
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: isSingleFamilyProperty ? 12 : 6 }}>
                  <PropertySelect disableAllOption />
                </Grid>
                {!isSingleFamilyProperty && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <UnitSelect />
                  </Grid>
                )}
              </Grid>
            </Box>

            {/* Property/Unit Info Display */}
            {propertyDisplay && (
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
            )}

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
                Payment Summary
              </Typography>
              {loadingRentData || rentRecordsLoading ? (
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
                        borderRadius: 1.5
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
                    <DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5
                }
              }}
              placeholder="Enter amount"
            />
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="flex-end"
            sx={{
              px: 3,
              py: 3,
              borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              mt: 2
            }}
          >
            <Button
              onClick={handleClose}
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
              disabled={!amount || parseFloat(amount) <= 0 || processing || !selectedLease?.id}
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
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
}

