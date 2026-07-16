import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';

// project imports
import TenantPaymentSelector from './TenantPaymentSelector';
import PaymentLeaseConfirmation from './PaymentLeaseConfirmation';
import PaymentEntryForm from './PaymentEntryForm';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';

const steps = [
  'Who made the payment?',
  'Confirm Lease Details',
  'Enter Payment Details'
];

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

// ==============================|| RECORD PAYMENT WIZARD ||============================== //

export default function RecordPaymentWizard({ onComplete }) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Wizard state
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLease, setSelectedLease] = useState(null);
  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date(),
    amount: 0,
    amountDisplay: '',
    paymentAllocation: null // 'rent' or fee ID if applicable
  });

  const handleNext = async () => {
    // If we're on the last step (Payment Entry), record the payment
    if (activeStep === steps.length - 1) {
      await handleRecordPayment();
      return;
    }
    
    // Otherwise, proceed to next step
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleRecordPayment = async () => {
    if (!selectedLease?.id) {
      setError('Please select a lease');
      return;
    }

    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axiosServices.post('/api/rent-collection/payment', {
        leaseId: selectedLease.id,
        amount: parseFloat(paymentData.amount),
        paymentDate: formatLocalDateTime(paymentData.paymentDate),
        createdByUserId: user?.id || user?.Id || null
      });

      if (response.data && response.data.success) {
        if (onComplete) {
          onComplete();
        }
      } else {
        setError(response.data?.message || 'Failed to record payment. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleStepChange = (step) => {
    // Validate current step before allowing navigation
    if (step < activeStep || validateStep(activeStep)) {
      setActiveStep(step);
    }
  };

  // Check if property is single family (no units)
  const isSingleFamilyProperty = useMemo(() => {
    if (!selectedProperty) return false;
    const propertyType = selectedProperty.propertyType?.toLowerCase();
    return propertyType === 'singlefamily' || propertyType === 'single-family';
  }, [selectedProperty]);

  const validateStep = (step) => {
    switch (step) {
      case 0:
        // Require property, and unit if multi-unit property
        if (!selectedProperty) return false;
        if (!isSingleFamilyProperty && !selectedUnit) return false;
        return true;
      case 1:
        return selectedLease !== null;
      case 2:
        return paymentData.amount && parseFloat(paymentData.amount) > 0;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <TenantPaymentSelector
            selectedTenant={selectedTenant}
            onSelectTenant={(tenant) => {
              setSelectedTenant(tenant);
              // Reset lease when tenant changes
              setSelectedLease(null);
            }}
            selectedProperty={selectedProperty}
            onSelectProperty={setSelectedProperty}
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
          />
        );
      case 1:
        return (
          <PaymentLeaseConfirmation
            tenant={selectedTenant}
            selectedProperty={selectedProperty}
            selectedUnit={selectedUnit}
            selectedLease={selectedLease}
            onConfirmLease={setSelectedLease}
          />
        );
      case 2:
        return (
          <PaymentEntryForm
            lease={selectedLease}
            paymentData={paymentData}
            onPaymentDataChange={setPaymentData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h3" sx={{ mb: 3 }}>
          Record Payment
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                onClick={() => handleStepChange(index)}
                sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: '400px', mb: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : (
            renderStepContent()
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" justifyContent="space-between">
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!validateStep(activeStep) || loading}
          >
            {activeStep === steps.length - 1 ? 'Record Payment' : 'Next'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

RecordPaymentWizard.propTypes = {
  onComplete: PropTypes.func
};
