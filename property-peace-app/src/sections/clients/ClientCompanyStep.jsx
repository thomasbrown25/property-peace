import PropTypes from 'prop-types';
import { Box, Grid, TextField, Typography, FormControlLabel, Switch } from '@mui/material';

export default function ClientCompanyStep({ formData, setFormData }) {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Company & Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add company information and set the client's status.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={12}>
          <TextField
            fullWidth
            label="Company Name"
            value={formData.companyName || ''}
            onChange={(e) => handleChange('companyName', e.target.value)}
            helperText="Optional - for corporate clients"
          />
        </Grid>
        <Grid size={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive !== false}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
            }
            label="Active"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Active clients will appear in the clients list by default.
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}

ClientCompanyStep.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired
};
