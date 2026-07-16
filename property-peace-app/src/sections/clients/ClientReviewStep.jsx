import PropTypes from 'prop-types';
import { Box, Typography, Grid, Stack, Chip, Divider, CircularProgress } from '@mui/material';
import { MailOutlined, PhoneOutlined, DollarOutlined } from '@ant-design/icons';

export default function ClientReviewStep({ formData, loading }) {
  const formatManagementFee = () => {
    if (formData.managementFeePercentage) {
      return `${formData.managementFeePercentage}%`;
    } else if (formData.managementFeeFlat) {
      return `$${parseFloat(formData.managementFeeFlat || 0).toFixed(2)}`;
    }
    return 'Not set';
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Review & Confirm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review all information before creating the client.
      </Typography>

      <Grid container spacing={3}>
        {/* Contact Information */}
        <Grid size={12}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Contact Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Name
              </Typography>
              <Typography variant="body1">
                {`${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Not provided'}
              </Typography>
            </Box>
            {formData.email && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MailOutlined style={{ fontSize: 14 }} />
                  <Typography variant="body1">{formData.email}</Typography>
                </Stack>
              </Box>
            )}
            {formData.phoneNumber && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Phone Number
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneOutlined style={{ fontSize: 14 }} />
                  <Typography variant="body1">{formData.phoneNumber}</Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        </Grid>

        {/* Company & Details */}
        <Grid size={12}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Company & Details
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Company Name
              </Typography>
              <Typography variant="body1">
                {formData.companyName || 'Not provided'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={formData.isActive !== false ? 'Active' : 'Inactive'}
                  color={formData.isActive !== false ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>
          </Stack>
        </Grid>

        {/* Management Settings */}
        <Grid size={12}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Management Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Management Fee
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                <DollarOutlined style={{ fontSize: 14 }} />
                <Typography variant="body1">{formatManagementFee()}</Typography>
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Statement Frequency
              </Typography>
              <Typography variant="body1">
                {formData.statementFrequency || 'Monthly'}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            Creating client...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

ClientReviewStep.propTypes = {
  formData: PropTypes.object.isRequired,
  loading: PropTypes.bool
};
