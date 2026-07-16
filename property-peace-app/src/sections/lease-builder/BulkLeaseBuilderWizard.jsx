import { useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
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
  Slide,
  alpha,
  useTheme
} from '@mui/material';

// project imports
import BulkLeaseTermsStep from './BulkLeaseTermsStep';
import BulkTenantSelectionStep from './BulkTenantSelectionStep';
import BulkFeesAndRentIncreaseStep from './BulkFeesAndRentIncreaseStep';
import BulkLeaseReviewStep from './BulkLeaseReviewStep';
import LeaseCreatedSuccessDialog from 'components/dialogs/LeaseCreatedSuccessDialog';

const steps = [
  'Select Units',
  'Select Tenants',
  'Fees & Rent Increases',
  'Review & Confirm'
];

// ==============================|| BULK LEASE BUILDER WIZARD ||============================== //

export default function BulkLeaseBuilderWizard({ onComplete }) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // State for all selected units with their lease terms
  const [selectedUnits, setSelectedUnits] = useState([]);
  
  // Success dialog state (moved to parent so it's not affected by loading state)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdLeaseCount, setCreatedLeaseCount] = useState(0);
  const [createdLeaseIds, setCreatedLeaseIds] = useState([]);
  const [userClickedAction, setUserClickedAction] = useState(false);

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setActiveStep(newStep);
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }, 50);
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (!validateStep(activeStep)) {
      return;
    }
    
    // If we're on the last step, the review step will handle completion
    if (activeStep === steps.length - 1) {
      return;
    }
    
    transitionToStep(activeStep + 1, 'left');
  };

  const handleBack = () => {
    if (activeStep > 0) {
      transitionToStep(activeStep - 1, 'right');
    }
  };

  const handleStepChange = (step) => {
    // Allow going back, but validate before going forward
    if (step < activeStep || validateStep(activeStep)) {
      const direction = step > activeStep ? 'left' : 'right';
      transitionToStep(step, direction);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 0:
        // Step 1: Must have at least one unit with lease terms applied
        return selectedUnits.length > 0 && selectedUnits.some(u => u.hasTermsApplied);
      case 1:
        // Step 2: Optional, always valid
        return true;
      case 2:
        // Step 3: Fees & Rent Increases - optional, always valid
        return true;
      case 3:
        // Step 4: Review step - validation handled in review component
        return true;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <BulkLeaseTermsStep
            selectedUnits={selectedUnits}
            onUpdateSelectedUnits={setSelectedUnits}
          />
        );
      case 1:
        return (
          <BulkTenantSelectionStep
            selectedUnits={selectedUnits}
            onUpdateSelectedUnits={setSelectedUnits}
          />
        );
      case 2:
        return (
          <BulkFeesAndRentIncreaseStep
            selectedUnits={selectedUnits}
            onUpdateSelectedUnits={setSelectedUnits}
          />
        );
      case 3:
        return (
          <BulkLeaseReviewStep
            selectedUnits={selectedUnits}
            onComplete={onComplete}
            onError={setError}
            onLoading={setLoading}
            onShowSuccessDialog={(count, leaseIds) => {
              setCreatedLeaseCount(count);
              setCreatedLeaseIds(leaseIds);
              setSuccessDialogOpen(true);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Typography variant="h3" sx={{ mb: 3 }}>
        Bulk Lease Builder
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

      <Box sx={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '500px'
      }}>
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          px: 3,
          position: 'relative',
          overflow: 'hidden',
          minHeight: '400px'
        }}>
          <Box sx={{ width: '100%', maxWidth: '800px', position: 'relative' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
              </Box>
            ) : (
              <Slide
                direction={slideDirection}
                in={true}
                timeout={600}
                mountOnEnter
                unmountOnExit
                key={activeStep}
              >
                <Box>
                  {renderStepContent()}
                </Box>
              </Slide>
            )}
          </Box>
        </Box>

        {/* Navigation Buttons */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 'auto',
          pt: 4,
          pb: 2,
          px: 3,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
        }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            variant="outlined"
            sx={{ textTransform: 'none', px: 3 }}
          >
            Back
          </Button>
          {activeStep < steps.length - 1 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!validateStep(activeStep) || loading}
              sx={{ textTransform: 'none', px: 4, py: 1 }}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>

      {/* Bulk Lease Created Success Dialog - rendered at parent level */}
      <LeaseCreatedSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false);
          setCreatedLeaseCount(0);
          // Only call onComplete if user didn't click an action button (just closed dialog)
          if (!userClickedAction && onComplete && createdLeaseIds.length > 0) {
            onComplete(createdLeaseIds);
          }
          setUserClickedAction(false);
          setCreatedLeaseIds([]);
        }}
        isBulk={true}
        leaseCount={createdLeaseCount}
        onActionClick={() => {
          // Mark that user clicked an action button (which handles its own navigation)
          setUserClickedAction(true);
        }}
      />
    </>
  );
}

BulkLeaseBuilderWizard.propTypes = {
  onComplete: PropTypes.func.isRequired
};
