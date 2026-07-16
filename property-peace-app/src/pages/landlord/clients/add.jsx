import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import MainCard from 'components/MainCard';
import { openSnackbar } from 'api/snackbar';
import { addClient, getClients } from 'store/client/client.action';
import ClientContactStep from 'sections/clients/ClientContactStep';
import ClientCompanyStep from 'sections/clients/ClientCompanyStep';
import ClientManagementStep from 'sections/clients/ClientManagementStep';
import ClientReviewStep from 'sections/clients/ClientReviewStep';

const steps = [
  'Contact Information',
  'Company & Details',
  'Management Settings',
  'Review & Confirm'
];

export default function ClientAddWizard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stepErrors, setStepErrors] = useState({});

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    isActive: true,
    managementFeePercentage: '',
    managementFeeFlat: '',
    statementFrequency: 'Monthly',
    sendInvite: true
  });

  // Pure validation function that doesn't set state (for use in render)
  const isValidStep = (step) => {
    switch (step) {
      case 0:
        // Step 1: Contact Information
        const hasRequiredFields = !!(formData.firstName?.trim() && formData.lastName?.trim());
        const emailValidIfRequired = !formData.sendInvite || !!(formData.email?.trim());
        return hasRequiredFields && emailValidIfRequired;
      case 1:
        // Step 2: Company & Details - no validation needed (all optional)
        return true;
      case 2:
        // Step 3: Management Settings
        return !!(formData.managementFeePercentage || formData.managementFeeFlat);
      case 3:
        // Step 4: Review - no validation needed
        return true;
      default:
        return true;
    }
  };

  // Validation function that sets errors (for use in handlers)
  const validateStep = (step) => {
    const errors = {};
    
    switch (step) {
      case 0:
        // Step 1: Contact Information
        if (!formData.firstName?.trim()) {
          errors.firstName = 'First name is required';
        }
        if (!formData.lastName?.trim()) {
          errors.lastName = 'Last name is required';
        }
        // Email is required if sending invite
        if (formData.sendInvite && !formData.email?.trim()) {
          errors.email = 'Email is required when sending an invite';
        }
        // Validate email format if provided
        if (formData.email?.trim() && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 1:
        // Step 2: Company & Details - no validation needed (all optional)
        break;
      case 2:
        // Step 3: Management Settings
        if (!formData.managementFeePercentage && !formData.managementFeeFlat) {
          errors.managementFee = 'Please provide either a percentage or flat fee';
        }
        break;
      case 3:
        // Step 4: Review - no validation needed
        break;
      default:
        break;
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(activeStep)) {
      return;
    }

    if (activeStep === steps.length - 1) {
      // Last step - submit the form
      handleSubmit();
      return;
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setError(null);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setError(null);
    setStepErrors({});
  };

  const handleStepChange = (step) => {
    // Allow going back, but validate before going forward
    if (step < activeStep || validateStep(activeStep)) {
      setActiveStep(step);
      setError(null);
      setStepErrors({});
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const clientData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim() || '',
        phoneNumber: formData.phoneNumber.trim() || null,
        companyName: formData.companyName.trim() || null,
        managementFeePercentage: formData.managementFeePercentage
          ? parseFloat(formData.managementFeePercentage)
          : null,
        managementFeeFlat: formData.managementFeeFlat ? parseFloat(formData.managementFeeFlat) : null,
        statementFrequency: formData.statementFrequency,
        isActive: formData.isActive,
        sendInvite: formData.sendInvite || false
      };

      const result = await dispatch(addClient(clientData));

      if (result.success) {
        openSnackbar({
          open: true,
          message: 'Client created successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Refresh clients list
        dispatch(getClients());
        
        // Navigate back to clients page
        navigate('/landlord/clients');
      } else {
        setError(result.message || 'Failed to create client');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while creating the client');
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <ClientContactStep
            formData={formData}
            setFormData={setFormData}
            errors={stepErrors}
          />
        );
      case 1:
        return (
          <ClientCompanyStep
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 2:
        return (
          <ClientManagementStep
            formData={formData}
            setFormData={setFormData}
            errors={stepErrors}
          />
        );
      case 3:
        return (
          <ClientReviewStep
            formData={formData}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <MainCard>
        <Typography variant="h3" sx={{ mb: 3 }}>
          Add New Client
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
          {renderStepContent()}
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
          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!isValidStep(activeStep) || loading}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !isValidStep(activeStep)}
            >
              {loading ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </Button>
          )}
        </Stack>
      </MainCard>
    </Box>
  );
}
