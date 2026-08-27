import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Stack, Button,
  alpha, useTheme, IconButton,
  CircularProgress, Alert, Divider, Toolbar
} from '@mui/material';
import {
  CloseOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { useDrawer } from 'contexts/DrawerContext';
import { openSnackbar } from 'api/snackbar';
import TenantPaymentSelector from 'sections/payment-recording/TenantPaymentSelector';
import PaymentEntryForm from 'sections/payment-recording/PaymentEntryForm';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';
import { normalizeRentBalance } from 'utils/rentBalance';

const DRAWER_WIDTH = 520;

const formatLocalDateTime = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(amount || 0);

export default function RecordPaymentDrawer({ onSuccess }) {
  const drawer = useDrawer();
  const theme = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLease, setSelectedLease] = useState(null);
  const [latestRentRecord, setLatestRentRecord] = useState(null);
  const [paymentData, setPaymentData] = useState({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });

  // Reset on close; hydrate preselected lease context on contextual opens
  useEffect(() => {
    if (!drawer.isOpenPaymentAdd) {
      setLoading(false);
      setError(null);
      setIsComplete(false);
      setSelectedProperty(null);
      setSelectedUnit(null);
      setSelectedLease(null);
      setLatestRentRecord(null);
      setPaymentData({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
      return;
    }

    const initial = drawer.paymentAddInitialSelection;
    if (initial) {
      const lease = initial.lease || null;
      setSelectedProperty(initial.property || null);
      setSelectedUnit(initial.unit || lease?.unit || null);
      setSelectedLease(lease);
    }
  }, [drawer.isOpenPaymentAdd, drawer.paymentAddInitialSelection]);

  const handleSubmit = async () => {
    if (!selectedLease?.id) { setError('Please select a lease'); return; }
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) { setError('Please enter a valid amount'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await axiosServices.post('/api/rent-collection/payment', {
        leaseId: selectedLease.id,
        amount: parseFloat(paymentData.amount),
        paymentDate: formatLocalDateTime(paymentData.paymentDate),
        createdByUserId: user?.id || user?.Id || null
      });
      if (res.data?.success) {
        setLatestRentRecord(res.data?.data || null);
        setIsComplete(true);
        openSnackbar({ open: true, message: 'Payment recorded successfully', variant: 'alert', alert: { color: 'success' } });
        if (onSuccess) onSuccess();
      } else {
        setError(res.data?.message || 'Failed to record payment');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAnother = () => {
    const { rentDue } = normalizeRentBalance(latestRentRecord);
    const fees = latestRentRecord?.unpaidFees ?? latestRentRecord?.UnpaidFees ?? [];
    const amountDueNow = rentDue + fees.reduce(
      (sum, fee) => sum + Number(fee.amountDue ?? fee.AmountDue ?? fee.amount ?? fee.Amount ?? 0),
      0
    );

    setIsComplete(false);
    setError(null);
    setPaymentData({
      paymentDate: new Date(),
      amount: amountDueNow,
      amountDisplay: amountDueNow > 0 ? formatCurrency(amountDueNow) : '',
      paymentAllocation: null,
      suppressAutoPrefill: amountDueNow <= 0
    });
  };

  const handleSelectLease = useCallback((lease) => {
    setSelectedLease(lease);
    setLatestRentRecord(null);
    setPaymentData({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
  }, []);

  const handleSelectTenant = useCallback(() => {}, []);

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenPaymentAdd}
      onClose={() => drawer.closePaymentAddDrawer()}
      PaperProps={{ sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' } }}
    >
      {/* Header */}
      <Toolbar sx={{ px: 2.5, justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography variant="h6">
          Record Payment
        </Typography>
        <IconButton onClick={() => drawer.closePaymentAddDrawer()} size="large">
          <CloseOutlined />
        </IconButton>
      </Toolbar>
      <Divider />

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {isComplete ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <CheckCircleOutlined style={{ fontSize: 56, color: theme.palette.success.main }} />
            <Typography variant="h6" fontWeight={700}>Payment Recorded!</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              The payment has been successfully recorded.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={handleRecordAnother} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
                Record Another
              </Button>
              <Button variant="contained" onClick={() => drawer.closePaymentAddDrawer()} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
                Done
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={3}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
              <Stack spacing={3}>
                <TenantPaymentSelector
                  selectedLease={selectedLease}
                  onSelectTenant={handleSelectTenant}
                  selectedProperty={selectedProperty}
                  onSelectProperty={setSelectedProperty}
                  selectedUnit={selectedUnit}
                  onSelectUnit={setSelectedUnit}
                  onConfirmLease={handleSelectLease}
                />
                {selectedLease && (
                  <PaymentEntryForm
                    key={selectedLease.id || selectedLease.Id}
                    lease={selectedLease}
                    paymentData={paymentData}
                    onPaymentDataChange={setPaymentData}
                    rentRecordOverride={latestRentRecord}
                  />
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      {!isComplete && selectedLease && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!paymentData.amount || parseFloat(paymentData.amount) <= 0 || loading}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: 1.5, textTransform: 'none' }}
          >
            Record Payment
          </Button>
        </Box>
      )}
    </ThemeAdaptiveDrawer>
  );
}

RecordPaymentDrawer.propTypes = { onSuccess: PropTypes.func };
