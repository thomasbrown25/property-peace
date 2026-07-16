import PropTypes from 'prop-types';
import { Box, Grid, TextField, Typography, FormControl, Select, MenuItem, InputLabel } from '@mui/material';

export default function ClientManagementStep({ formData, setFormData, errors }) {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Management Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure management fees and statement frequency for this client.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Management Fee Percentage"
            type="number"
            value={formData.managementFeePercentage || ''}
            onChange={(e) => handleChange('managementFeePercentage', e.target.value)}
            helperText="e.g., 8.5 for 8.5%"
            error={!!errors.managementFee}
            InputProps={{
              endAdornment: <Typography variant="body2" sx={{ mr: 1 }}>%</Typography>
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Management Fee Flat"
            type="number"
            value={formData.managementFeeFlat || ''}
            onChange={(e) => handleChange('managementFeeFlat', e.target.value)}
            helperText="Flat monthly fee"
            error={!!errors.managementFee}
            InputProps={{
              startAdornment: <Typography variant="body2" sx={{ ml: 1 }}>$</Typography>
            }}
          />
        </Grid>
        <Grid size={12}>
          {errors.managementFee && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
              {errors.managementFee}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Provide either a percentage or flat fee (or both). At least one is required.
          </Typography>
        </Grid>
        <Grid size={12}>
          <FormControl fullWidth>
            <InputLabel>Statement Frequency</InputLabel>
            <Select
              value={formData.statementFrequency || 'Monthly'}
              onChange={(e) => handleChange('statementFrequency', e.target.value)}
              label="Statement Frequency"
            >
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Annually">Annually</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
}

ClientManagementStep.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  errors: PropTypes.object
};
