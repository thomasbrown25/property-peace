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
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';

// project imports
import DeliveryMethodStep from './DeliveryMethodStep';
import MessageStep from './MessageStep';
import ScheduleStep from './ScheduleStep';
import ReviewStep from './ReviewStep';

const steps = [
  'Select Delivery Methods',
  'Compose Message',
  'Schedule',
  'Review & Confirm'
];

// ==============================|| ALL PROPERTIES ANNOUNCEMENT WIZARD ||============================== //

export default function AllPropertiesAnnouncementWizard({ onComplete, onCancel, selectedOrganizations, initialData = null }) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [recipientsReady, setRecipientsReady] = useState(false);
  
  // Default scheduled date/time to current date/time
  const getDefaultDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // Initialize with existing data if editing
  const [deliveryMethods, setDeliveryMethods] = useState(
    initialData?.deliveryMethods || {
      inApp: true,
      email: true
    }
  );
  const [message, setMessage] = useState(initialData?.message || '');
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType || 'now');
  const [scheduledDateTime, setScheduledDateTime] = useState(
    initialData?.scheduledDateTime || getDefaultDateTime()
  );

  const handleNext = () => {
    // Validate current step before proceeding
    if (!validateStep(activeStep)) {
      return;
    }
    
    if (activeStep === steps.length - 1) {
      // Last step - complete the wizard
      onComplete({ 
        deliveryMethods, 
        message,
        scheduleType,
        scheduledDateTime: scheduleType === 'scheduled' ? scheduledDateTime : null
      });
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const validateStep = (step) => {
    switch (step) {
      case 0:
        // Step 1: Must have at least one delivery method selected
        return deliveryMethods.inApp || deliveryMethods.email;
      case 1:
        // Step 2: Must have a message
        return message.trim().length > 0;
      case 2:
        // Step 3: If scheduled, must have a valid future date/time
        if (scheduleType === 'scheduled') {
          if (!scheduledDateTime) return false;
          const selectedDate = new Date(scheduledDateTime);
          const now = new Date();
          return selectedDate > now;
        }
        return true; // "now" is always valid
      case 3:
        // Step 4: Never send until the exact audience has been verified.
        return recipientsReady;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <DeliveryMethodStep
            deliveryMethods={deliveryMethods}
            onDeliveryMethodsChange={setDeliveryMethods}
          />
        );
      case 1:
        return (
          <MessageStep
            message={message}
            onMessageChange={setMessage}
          />
        );
      case 2:
        return (
          <ScheduleStep
            scheduleType={scheduleType}
            scheduledDateTime={scheduledDateTime}
            onScheduleTypeChange={setScheduleType}
            onScheduledDateTimeChange={setScheduledDateTime}
          />
        );
      case 3:
        return (
          <ReviewStep
            deliveryMethods={deliveryMethods}
            message={message}
            scheduleType={scheduleType}
            scheduledDateTime={scheduledDateTime}
            selectedOrganizations={selectedOrganizations}
            onRecipientsReady={setRecipientsReady}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.25, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight={700}>Finish the announcement</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Work left to right: delivery, message, timing, then final review.
            </Typography>
          </Box>
          <Chip
            icon={<CheckCircleOutlined />}
            label={`Step ${activeStep + 1} of ${steps.length}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 2.5 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
        <Box
          sx={{
            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.default, 0.35),
            p: { xs: 2, sm: 3 },
            minHeight: 300
          }}
        >
          {renderStepContent()}
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2.5 }}>
          <Button
            onClick={activeStep === 0 ? onCancel : handleBack}
            startIcon={<ArrowLeftOutlined />}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            {activeStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            endIcon={activeStep === steps.length - 1 ? null : <ArrowRightOutlined />}
            disabled={!validateStep(activeStep)}
            sx={{ textTransform: 'none', borderRadius: 1.5, px: 2.5 }}
          >
            {activeStep === steps.length - 1 ? 'Send Announcement' : 'Continue'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

AllPropertiesAnnouncementWizard.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  selectedOrganizations: PropTypes.instanceOf(Set).isRequired,
  initialData: PropTypes.shape({
    deliveryMethods: PropTypes.shape({
      inApp: PropTypes.bool,
      email: PropTypes.bool
    }),
    message: PropTypes.string,
    scheduleType: PropTypes.oneOf(['now', 'scheduled']),
    scheduledDateTime: PropTypes.string
  })
};
