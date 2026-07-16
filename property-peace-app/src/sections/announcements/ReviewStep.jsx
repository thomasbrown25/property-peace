import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  NotificationOutlined,
  MailOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  SendOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';

// ==============================|| REVIEW STEP ||============================== //

export default function ReviewStep({ 
  deliveryMethods, 
  message, 
  scheduleType, 
  scheduledDateTime,
  selectedOrganizations,
  selectedProperties,
  selectedUnits,
  organizationNames
}) {
  const formatScheduledTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    try {
      const date = new Date(dateTimeString);
      return format(date, 'MMM dd, yyyy h:mm a');
    } catch (error) {
      return dateTimeString;
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Review & Confirm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review your announcement details before sending.
      </Typography>

      <Stack spacing={2}>
        {/* Recipients */}
        {(selectedOrganizations?.size > 0 || selectedProperties?.size > 0 || selectedUnits?.size > 0) && (
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <FileTextOutlined style={{ fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Recipients
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {selectedOrganizations?.size > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Organizations ({selectedOrganizations.size}):
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {Array.from(selectedOrganizations).map(orgId => (
                        <Chip
                          key={orgId}
                          label={organizationNames?.[orgId] || `Organization ${orgId}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                {selectedProperties?.size > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Properties: {selectedProperties.size} propert{selectedProperties.size === 1 ? 'y' : 'ies'} selected
                  </Typography>
                )}
                {selectedUnits?.size > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Units: {selectedUnits.size} unit{selectedUnits.size === 1 ? '' : 's'} selected
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Delivery Methods */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <NotificationOutlined style={{ fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Delivery Methods
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label="In-App Notification"
                color={deliveryMethods.inApp ? "primary" : "default"}
                size="small"
                icon={<NotificationOutlined />}
                sx={{
                  ...(deliveryMethods.inApp ? {} : {
                    opacity: 0.5,
                    bgcolor: 'grey.100',
                    color: 'text.disabled'
                  })
                }}
              />
              <Chip
                label="Email"
                color={deliveryMethods.email ? "primary" : "default"}
                size="small"
                icon={<MailOutlined />}
                sx={{
                  ...(deliveryMethods.email ? {} : {
                    opacity: 0.5,
                    bgcolor: 'grey.100',
                    color: 'text.disabled'
                  })
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Message */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <FileTextOutlined style={{ fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Message
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {message || 'No message entered'}
            </Typography>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              {scheduleType === 'now' ? (
                <SendOutlined style={{ fontSize: 20 }} />
              ) : (
                <ClockCircleOutlined style={{ fontSize: 20 }} />
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                Schedule
              </Typography>
            </Stack>
            <Typography variant="body2">
              {scheduleType === 'now' ? (
                <Chip label="Send Immediately" color="primary" size="small" icon={<SendOutlined />} />
              ) : (
                <>
                  <Chip label="Scheduled" color="info" size="small" icon={<ClockCircleOutlined />} sx={{ mr: 1 }} />
                  {scheduledDateTime && formatScheduledTime(scheduledDateTime)}
                </>
              )}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

ReviewStep.propTypes = {
  deliveryMethods: PropTypes.shape({
    inApp: PropTypes.bool.isRequired,
    email: PropTypes.bool.isRequired
  }).isRequired,
  message: PropTypes.string.isRequired,
  scheduleType: PropTypes.oneOf(['now', 'scheduled']).isRequired,
  scheduledDateTime: PropTypes.string,
  selectedOrganizations: PropTypes.instanceOf(Set),
  selectedProperties: PropTypes.instanceOf(Set),
  selectedUnits: PropTypes.instanceOf(Set),
  organizationNames: PropTypes.object
};
