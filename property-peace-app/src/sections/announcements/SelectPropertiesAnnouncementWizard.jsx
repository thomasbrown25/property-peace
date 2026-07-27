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
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';

// project imports
import OrganizationSelector from './OrganizationSelector';
import RecipientSelector from './RecipientSelector';
import DeliveryMethodStep from './DeliveryMethodStep';
import MessageStep from './MessageStep';
import ScheduleStep from './ScheduleStep';
import ReviewStep from './ReviewStep';

const steps = [
  'Select Recipients',
  'Delivery Methods',
  'Compose Message',
  'Schedule',
  'Review & Confirm'
];

// ==============================|| SELECT PROPERTIES ANNOUNCEMENT WIZARD ||============================== //

export default function SelectPropertiesAnnouncementWizard({ onComplete, onCancel, initialData = null }) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [recipientsReady, setRecipientsReady] = useState(false);
  
  // Initialize with existing data if editing
  const [selectedOrganizations, setSelectedOrganizations] = useState(
    initialData?.selectedOrganizations || new Set()
  );
  const [selectedProperties, setSelectedProperties] = useState(
    initialData?.selectedProperties || new Set()
  );
  const [selectedUnits, setSelectedUnits] = useState(
    initialData?.selectedUnits || new Set()
  );
  const [deliveryMethods, setDeliveryMethods] = useState(
    initialData?.deliveryMethods || {
      inApp: true,
      email: true
    }
  );
  const [message, setMessage] = useState(initialData?.message || '');
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType || 'now');
  
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
        selectedOrganizations,
        selectedProperties,
        selectedUnits,
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
        // Step 1: Must have at least one organization selected, and at least one property or unit
        if (selectedOrganizations.size === 0) return false;
        return selectedProperties.size > 0 || selectedUnits.size > 0;
      case 1:
        // Step 2: Must have at least one delivery method selected
        return deliveryMethods.inApp || deliveryMethods.email;
      case 2:
        // Step 3: Must have a message
        return message.trim().length > 0;
      case 3:
        // Step 4: If scheduled, must have a valid future date/time
        if (scheduleType === 'scheduled') {
          if (!scheduledDateTime) return false;
          const selectedDate = new Date(scheduledDateTime);
          const now = new Date();
          return selectedDate > now;
        }
        return true; // "now" is always valid
      case 4:
        // Step 5: Never send until the exact audience has been verified.
        return recipientsReady;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <OrganizationSelector
              selectedOrganizations={selectedOrganizations}
              onSelectionChange={(orgIds) => setSelectedOrganizations(new Set(orgIds))}
            />
            {selectedOrganizations.size > 0 && (
              <Box sx={{ mt: 3 }}>
                <RecipientSelector
                  selectedOrganizations={selectedOrganizations}
                  selectedProperties={selectedProperties}
                  selectedUnits={selectedUnits}
                  onPropertiesChange={(props) => setSelectedProperties(new Set(props))}
                  onUnitsChange={(units) => setSelectedUnits(new Set(units))}
                />
              </Box>
            )}
            {selectedOrganizations.size === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Please select at least one organization to view properties and units.
              </Alert>
            )}
          </Box>
        );
      case 1:
        return (
          <DeliveryMethodStep
            deliveryMethods={deliveryMethods}
            onDeliveryMethodsChange={setDeliveryMethods}
          />
        );
      case 2:
        return (
          <MessageStep
            message={message}
            onMessageChange={setMessage}
          />
        );
      case 3:
        return (
          <ScheduleStep
            scheduleType={scheduleType}
            scheduledDateTime={scheduledDateTime}
            onScheduleTypeChange={setScheduleType}
            onScheduledDateTimeChange={setScheduledDateTime}
          />
        );
      case 4:
        return (
          <ReviewStep
            deliveryMethods={deliveryMethods}
            message={message}
            scheduleType={scheduleType}
            scheduledDateTime={scheduledDateTime}
            selectedOrganizations={selectedOrganizations}
            selectedProperties={selectedProperties}
            selectedUnits={selectedUnits}
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
            <Typography variant="h5" fontWeight={700}>Build a targeted announcement</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Pick recipients first, then choose delivery, write the message, schedule it, and review.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<CheckCircleOutlined />}
              label={`Step ${activeStep + 1} of ${steps.length}`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
            <Chip
              label={`${selectedProperties.size} properties · ${selectedUnits.size} units`}
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Stack>
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
            minHeight: 360
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

SelectPropertiesAnnouncementWizard.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    selectedOrganizations: PropTypes.instanceOf(Set),
    selectedProperties: PropTypes.instanceOf(Set),
    selectedUnits: PropTypes.instanceOf(Set),
    deliveryMethods: PropTypes.shape({
      inApp: PropTypes.bool,
      email: PropTypes.bool
    }),
    message: PropTypes.string,
    scheduleType: PropTypes.oneOf(['now', 'scheduled']),
    scheduledDateTime: PropTypes.string
  })
};
