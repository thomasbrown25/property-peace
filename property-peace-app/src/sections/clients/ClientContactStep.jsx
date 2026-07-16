import PropTypes from 'prop-types';
import { Box, Grid, TextField, Typography, Checkbox, FormControlLabel, Divider } from '@mui/material';

export default function ClientContactStep({ formData, setFormData, errors }) {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Contact Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the client's basic contact information.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="First Name"
            required
            value={formData.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            error={!!errors.firstName}
            helperText={errors.firstName}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Last Name"
            required
            value={formData.lastName || ''}
            onChange={(e) => handleChange('lastName', e.target.value)}
            error={!!errors.lastName}
            helperText={errors.lastName}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email || (formData.sendInvite ? "Required if sending invite" : "Optional")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Phone Number"
            value={formData.phoneNumber || ''}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            error={!!errors.phoneNumber}
            helperText={errors.phoneNumber}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <FormControlLabel
        control={
          <Checkbox
            checked={formData.sendInvite || false}
            onChange={(e) => handleChange('sendInvite', e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography variant="body2">
              Send invitation email to create account
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The client will receive an email with a link to create their account
            </Typography>
          </Box>
        }
      />
    </Box>
  );
}

ClientContactStep.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  errors: PropTypes.object
};
