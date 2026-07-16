import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Slide,
  alpha,
  useTheme,
  Alert,
  Card,
  CardContent,
  Drawer,
  IconButton,
  Divider,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import {
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CloseOutlined
} from '@ant-design/icons';
import PropertySelect from 'components/PropertySelect';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperty } from 'store/property/property.selector';

const STEPS = {
  PROPERTY_UNIT: 1,
  PAYMENT_DETAILS: 2,
  REVIEW: 3,
  PROCESSING: 4,
  SUCCESS: 5
};

const incomeSteps = ['Property & Unit', 'Payment Details', 'Review'];

const formatLocalDateTime = (date) => {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

const EMPTY_FORM = {
  amount: '',
  paymentDate: new Date().toISOString().split('T')[0],
  method: '',
  reference: ''
};

export default function IncomeAddDrawer({ open, onClose, onSuccess }) {
  const theme = useTheme();
  const { properties } = useFetchProperties();
  const reduxProperty = useSelector(selectProperty);

  const [currentStep, setCurrentStep] = useState(STEPS.PROPERTY_UNIT);
  const [slideDirection, setSlideDirection] = useState('left');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [localProperty, setLocalProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Reset whenever drawer opens
  useEffect(() => {
    if (open) {
      setCurrentStep(STEPS.PROPERTY_UNIT);
      setFormData({ ...EMPTY_FORM, paymentDate: new Date().toISOString().split('T')[0] });
      setLocalProperty(null);
      setSelectedUnit(null);
      setError(null);
      setSlideDirection('left');
      setProcessing(false);
    }
  }, [open]);

  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
    [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300], borderTopWidth: 2, borderRadius: 1 }
  }));

  const getStepperIndex = () => Math.min(currentStep - 1, incomeSteps.length - 1);

  const isMultiUnit = useMemo(() => (localProperty?.units?.length ?? 0) > 1, [localProperty]);

  const unitOptions = useMemo(() => (localProperty?.units ?? []).map((u) => ({
    id: u.id,
    label: u.name || `Unit ${u.id}`
  })), [localProperty]);

  // Derive lease from selected property/unit
  const activeLease = useMemo(() => {
    if (!localProperty) return null;
    if (isMultiUnit && selectedUnit) {
      const unit = localProperty.units?.find((u) => u.id === selectedUnit);
      return unit?.lease || unit?.Lease || null;
    }
    const unit = localProperty.units?.[0];
    return unit?.lease || unit?.Lease || null;
  }, [localProperty, selectedUnit, isMultiUnit]);

  const handleChange = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const transitionToStep = (step, dir) => {
    setSlideDirection(dir);
    setTimeout(() => setCurrentStep(step), 50);
  };

  const handleNext = () => {
    if (currentStep === STEPS.PROPERTY_UNIT) {
      if (!localProperty) { setError('Please select a property'); return; }
      if (isMultiUnit && !selectedUnit) { setError('Please select a unit'); return; }
      if (!activeLease?.id) { setError('No active lease found for this property/unit. Please ensure a lease exists.'); return; }
      setError(null);
      transitionToStep(STEPS.PAYMENT_DETAILS, 'left');
    } else if (currentStep === STEPS.PAYMENT_DETAILS) {
      if (!formData.amount || parseFloat(formData.amount) <= 0) { setError('Please enter a valid amount'); return; }
      if (!formData.paymentDate) { setError('Please select a payment date'); return; }
      setError(null);
      transitionToStep(STEPS.REVIEW, 'left');
    } else if (currentStep === STEPS.REVIEW) {
      transitionToStep(STEPS.PROCESSING, 'left');
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.PROPERTY_UNIT) transitionToStep(currentStep - 1, 'right');
  };

  const handleSubmit = async () => {
    setProcessing(true);
    try {
      const [y, mo, d] = formData.paymentDate.split('-').map(Number);
      const dateObj = new Date(y, mo - 1, d, 12, 0, 0);
      await axiosServices.post('/api/rent-collection/payment', {
        leaseId: activeLease.id,
        amount: parseFloat(formData.amount),
        paymentDate: formatLocalDateTime(dateObj)
      });
      setTimeout(() => {
        setProcessing(false);
        transitionToStep(STEPS.SUCCESS, 'left');
        onSuccess?.();
      }, 800);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to record payment. Please try again.';
      setError(msg);
      setProcessing(false);
      transitionToStep(STEPS.REVIEW, 'right');
      openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleAddAnother = () => {
    setFormData({ ...EMPTY_FORM, paymentDate: new Date().toISOString().split('T')[0] });
    setLocalProperty(null);
    setSelectedUnit(null);
    setError(null);
    transitionToStep(STEPS.PROPERTY_UNIT, 'right');
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.PROPERTY_UNIT:
        return (
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
              Which property is this income for?
            </Typography>
            <Box sx={{ mb: 2 }}>
              <PropertySelect
                width="100%"
                onPropertyChange={(p) => { setLocalProperty(p); setSelectedUnit(null); setError(null); }}
                localSelectedProperty={localProperty}
              />
            </Box>
            {isMultiUnit && (
              <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={selectedUnit || ''}
                  label="Unit"
                  onChange={(e) => { setSelectedUnit(e.target.value); setError(null); }}
                >
                  {unitOptions.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {localProperty && !activeLease && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No active lease found for this {isMultiUnit ? 'unit' : 'property'}. Please select a unit with an active lease.
              </Alert>
            )}
            {localProperty && activeLease && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Lease found — ready to record income.
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.PAYMENT_DETAILS:
        return (
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
              Payment details
            </Typography>
            <NumericFormat
              customInput={TextField}
              fullWidth
              label="Amount *"
              value={formData.amount}
              onValueChange={(vals) => handleChange('amount', vals.floatValue || '')}
              thousandSeparator
              prefix="$"
              decimalScale={2}
              fixedDecimalScale
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="date"
              label="Payment Date *"
              value={formData.paymentDate}
              onChange={(e) => handleChange('paymentDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Reference / Note (optional)"
              value={formData.reference}
              onChange={(e) => handleChange('reference', e.target.value)}
              placeholder="e.g. January rent"
              sx={{ mb: 2 }}
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.REVIEW:
        return (
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
              Review & Confirm
            </Typography>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Property</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {localProperty?.name || '—'}
                    {isMultiUnit && selectedUnit && unitOptions.find((u) => u.id === selectedUnit)
                      ? ` — ${unitOptions.find((u) => u.id === selectedUnit)?.label}`
                      : ''}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" fontWeight={500} color="success.main">
                    ${parseFloat(formData.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Payment Date</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formData.paymentDate ? new Date(formData.paymentDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                  </Typography>
                </CardContent>
              </Card>
              {formData.reference && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Reference</Typography>
                    <Typography variant="body1" fontWeight={500}>{formData.reference}</Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={56} sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>Recording payment…</Typography>
            <Typography variant="body2" color="text.secondary">Just a moment.</Typography>
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleOutlined style={{ fontSize: 60, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>Income Recorded!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              The payment has been recorded successfully.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={handleAddAnother} sx={{ textTransform: 'none', px: 3 }}>
                Add Another
              </Button>
              <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none', px: 3 }}>
                Done
              </Button>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  const showNav = currentStep < STEPS.PROCESSING;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={currentStep === STEPS.PROCESSING ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 520 },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexShrink: 0
      }}>
        <Typography variant="h6" fontWeight={600}>Add Income</Typography>
        <IconButton onClick={onClose} disabled={currentStep === STEPS.PROCESSING} size="small">
          <CloseOutlined />
        </IconButton>
      </Box>

      {/* Stepper */}
      {currentStep < STEPS.PROCESSING && (
        <Box sx={{ px: 2, pt: 2, pb: 1, flexShrink: 0 }}>
          <Stepper activeStep={getStepperIndex()} alternativeLabel connector={<CustomStepConnector />}>
            {incomeSteps.map((label, index) => (
              <Step key={label} completed={index < getStepperIndex()}>
                <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.65rem' } }}>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      <Divider />

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, position: 'relative' }}>
        <Slide direction={slideDirection === 'left' ? 'left' : 'right'} in timeout={400} mountOnEnter unmountOnExit key={currentStep}>
          <Box>{renderStep()}</Box>
        </Slide>
      </Box>

      {/* Navigation */}
      {showNav && (
        <>
          <Divider />
          <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <Button
              onClick={handleBack}
              disabled={currentStep === STEPS.PROPERTY_UNIT || processing}
              startIcon={<ArrowLeftOutlined />}
              sx={{ textTransform: 'none', px: 3 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={processing}
              sx={{ textTransform: 'none', px: 4 }}
            >
              {currentStep === STEPS.REVIEW ? 'Record Payment' : 'Next'}
            </Button>
          </Box>
        </>
      )}
    </Drawer>
  );
}
