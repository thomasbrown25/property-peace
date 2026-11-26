import ThemeAdaptiveDrawer, { getThemeAdaptiveDrawerStyles } from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useCallback, useEffect, useId, useRef } from 'react';
import {
  Box, Typography, Stack, Button,
  alpha, useTheme, IconButton,
  CircularProgress, Alert, Divider, Toolbar, Collapse, Dialog
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
import { firstOfCycleMonth } from 'utils/leasePaymentTimeline';

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

  return (
    <RecordPaymentOverlay
      open={drawer.isOpenPaymentAdd}
      onClose={drawer.closePaymentAddDrawer}
      initialSelection={drawer.paymentAddInitialSelection}
      onSuccess={onSuccess}
    />
  );
}

RecordPaymentDrawer.propTypes = { onSuccess: PropTypes.func };

export function RecordPaymentOverlay({ open, onClose, onSuccess, initialSelection = null, presentation = 'drawer' }) {
  const theme = useTheme();
  const titleId = useId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLease, setSelectedLease] = useState(null);
  const [detailLease, setDetailLease] = useState(null);
  const [switchingLease, setSwitchingLease] = useState(false);
  const pendingLeaseRef = useRef(null);
  const selectedLeaseRef = useRef(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [latestRentRecord, setLatestRentRecord] = useState(null);
  const [paymentData, setPaymentData] = useState({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
  const cycleSelection = open ? initialSelection : null;
  const viewingCyclePayments = Array.isArray(cycleSelection?.cyclePayments);

  // Reset on close; hydrate preselected lease context on contextual opens
  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setIsComplete(false);
      setSelectedProperty(null);
      setSelectedUnit(null);
      setSelectedLease(null);
      selectedLeaseRef.current = null;
      pendingLeaseRef.current = null;
      setDetailLease(null);
      setSwitchingLease(false);
      setSelectedTenant(null);
      setLatestRentRecord(null);
      setPaymentData({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
      return;
    }

    const initial = initialSelection;
    if (initial) {
      const lease = initial.lease || null;
      setSelectedProperty(initial.property || null);
      setSelectedUnit(initial.unit || lease?.unit || null);
      setSelectedLease(lease);
      selectedLeaseRef.current = lease;
      pendingLeaseRef.current = lease;
      setDetailLease(lease);
      setSwitchingLease(false);
      setSelectedTenant((lease?.tenants || lease?.Tenants || [])[0] || null);
      const cycleDate = firstOfCycleMonth(initial.cycleDueDate);
      if (cycleDate) setPaymentData({ paymentDate: cycleDate, amount: 0, amountDisplay: '', paymentAllocation: null });
    }
  }, [open, initialSelection]);

  const handleSubmit = async () => {
    if (!(selectedLease?.id ?? selectedLease?.Id)) { setError('Please select a lease'); return; }
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) { setError('Please enter a valid amount'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await axiosServices.post('/api/rent-collection/payment', {
        leaseId: selectedLease.id ?? selectedLease.Id,
        tenantId: selectedTenant?.id ?? selectedTenant?.Id ?? null,
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
    const previousId = selectedLeaseRef.current?.id ?? selectedLeaseRef.current?.Id;
    const nextId = lease?.id ?? lease?.Id;
    selectedLeaseRef.current = lease;
    pendingLeaseRef.current = lease;
    setSelectedLease(lease);
    if (previousId !== nextId) {
      if (previousId != null) {
        setSwitchingLease(true);
      } else {
        setDetailLease(lease);
        setSelectedTenant((lease?.tenants || lease?.Tenants || [])[0] || null);
        setLatestRentRecord(null);
        setPaymentData({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
      }
    } else if (!switchingLease) {
      // The properties query may refresh the selected lease without changing the selection.
      setDetailLease(lease);
    }
  }, [switchingLease]);

  const handleDetailExit = useCallback(() => {
    const lease = pendingLeaseRef.current;
    setDetailLease(lease);
    setSelectedTenant((lease?.tenants || lease?.Tenants || [])[0] || null);
    setLatestRentRecord(null);
    setPaymentData({ paymentDate: new Date(), amount: 0, amountDisplay: '', paymentAllocation: null });
    setSwitchingLease(false);
  }, []);

  const handleSelectTenant = useCallback((tenant) => setSelectedTenant(tenant), []);

  const isModal = presentation === 'modal';
  const Surface = isModal ? Dialog : ThemeAdaptiveDrawer;
  const styles = getThemeAdaptiveDrawerStyles(theme);
  const surfaceProps = isModal
    ? {
        fullWidth: true,
        maxWidth: 'sm',
        'aria-labelledby': titleId,
        slotProps: {
          backdrop: { sx: styles.backdrop },
          paper: { sx: { ...styles.paper, width: { sm: DRAWER_WIDTH }, border: '1px solid', borderColor: 'divider', borderRadius: 2 } }
        }
      }
    : {
        anchor: 'right',
        PaperProps: { sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' } }
      };

  return (
    <Surface open={open} onClose={onClose} {...surfaceProps}>
      {/* Header */}
      <Toolbar sx={{ px: 2.5, justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography id={titleId} variant="h6">
          {viewingCyclePayments ? 'Rent payments' : 'Record Payment'}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} size="large">
          <CloseOutlined />
        </IconButton>
      </Toolbar>
      <Divider />

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {viewingCyclePayments ? (
          <Stack spacing={2}>
            <Typography variant="h6">
              {firstOfCycleMonth(cycleSelection.cycleDueDate)?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} rent
            </Typography>
            {cycleSelection.cyclePayments.length ? cycleSelection.cyclePayments.map(({ payment, appliedAmount }, index) => {
              const paymentDate = payment.paymentDate ?? payment.PaymentDate;
              const receiptAmount = Number(payment.amount ?? payment.Amount ?? 0);
              const method = payment.method ?? payment.Method;
              const reference = payment.reference ?? payment.Reference;
              return (
                <Box key={payment.id ?? payment.Id ?? index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Typography fontWeight={700}>{paymentDate ? new Date(`${String(paymentDate).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date not recorded'}</Typography>
                    <Typography fontWeight={700}>{formatCurrency(receiptAmount)}</Typography>
                  </Stack>
                  {appliedAmount !== receiptAmount && <Typography variant="body2" color="text.secondary">{formatCurrency(appliedAmount)} applied to this month</Typography>}
                  {method && <Typography variant="body2" color="text.secondary">{method}</Typography>}
                  {reference && <Typography variant="body2" color="text.secondary">Reference: {reference}</Typography>}
                </Box>
              );
            }) : <Typography color="text.secondary">No recorded rent payments for this month.</Typography>}
          </Stack>
        ) : isComplete ? (
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
              <Button variant="contained" onClick={onClose} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
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
                  detailLease={detailLease}
                  detailsVisible={Boolean(detailLease) && !switchingLease}
                  selectedTenant={selectedTenant}
                  autoSelectPropertyId={open && selectedProperty
                    ? (initialSelection?.property?.id ?? initialSelection?.property?.Id)
                    : null}
                  onSelectTenant={handleSelectTenant}
                  selectedProperty={selectedProperty}
                  onSelectProperty={setSelectedProperty}
                  selectedUnit={selectedUnit}
                  onSelectUnit={setSelectedUnit}
                  onConfirmLease={handleSelectLease}
                />
                <Collapse in={Boolean(detailLease) && !switchingLease} timeout={300} unmountOnExit onExited={handleDetailExit}>
                  {detailLease && (
                    <PaymentEntryForm
                      key={detailLease.id || detailLease.Id}
                      lease={detailLease}
                      paymentData={paymentData}
                      onPaymentDataChange={setPaymentData}
                      rentRecordOverride={latestRentRecord}
                    />
                  )}
                </Collapse>
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      {!viewingCyclePayments && !isComplete && selectedLease && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={switchingLease || !paymentData.amount || parseFloat(paymentData.amount) <= 0 || loading}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: 1.5, textTransform: 'none' }}
          >
            Record Payment
          </Button>
        </Box>
      )}
    </Surface>
  );
}

RecordPaymentOverlay.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  initialSelection: PropTypes.object,
  presentation: PropTypes.oneOf(['drawer', 'modal'])
};
