import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { timeTrackingSettingsAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

const SettingsSchema = Yup.object().shape({
  roundingIncrementMinutes: Yup.number()
    .required('Rounding increment is required')
    .oneOf([5, 10, 15, 30, 60], 'Invalid rounding increment'),
  roundingMethod: Yup.string()
    .required('Rounding method is required')
    .oneOf(['RoundUp', 'RoundDown', 'RoundNearest'], 'Invalid rounding method')
});

const ROUNDING_INCREMENTS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
];

const ROUNDING_METHODS = [
  { value: 'RoundUp', label: 'Round Up' },
  { value: 'RoundDown', label: 'Round Down' },
  { value: 'RoundNearest', label: 'Round Nearest' }
];

export default function TimeTrackingSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await timeTrackingSettingsAPI.getTimeTrackingSettings();
      if (response?.data?.success && response?.data?.data) {
        setSettings(response.data.data);
      } else {
        // If no settings exist, use defaults
        setSettings({
          roundingIncrementMinutes: 15,
          roundingMethod: 'RoundNearest'
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to load settings',
        variant: 'alert',
        alert: { color: 'error' }
      });
      // Use defaults on error
      setSettings({
        roundingIncrementMinutes: 15,
        roundingMethod: 'RoundNearest'
      });
    } finally {
      setLoading(false);
    }
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      roundingIncrementMinutes: settings?.roundingIncrementMinutes || 15,
      roundingMethod: settings?.roundingMethod || 'RoundNearest'
    },
    validationSchema: SettingsSchema,
    onSubmit: async (values) => {
      try {
        setSubmitting(true);
        let response;
        if (settings?.id) {
          response = await timeTrackingSettingsAPI.updateTimeTrackingSettings(settings.id, values);
        } else {
          response = await timeTrackingSettingsAPI.addTimeTrackingSettings(values);
        }

        if (response?.data?.success) {
          openSnackbar({
            open: true,
            message: 'Settings saved successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          fetchSettings();
        } else {
          throw new Error(response?.data?.message || 'Failed to save settings');
        }
      } catch (error) {
        console.error('Error saving settings:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to save settings',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  if (loading) {
    return (
      <MainCard>
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  return (
    <MainCard>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <SettingOutlined style={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h3">Time Tracking Settings</Typography>
            <Typography variant="body2" color="text.secondary">
              Configure time rounding and other tracking preferences
            </Typography>
          </Box>
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          These settings apply to all time entries in your organization. Time rounding helps standardize
          recorded hours for billing and payroll purposes.
        </Alert>

        <FormikProvider value={formik}>
          <Form>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={3}>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl
                        fullWidth
                        error={formik.touched.roundingIncrementMinutes && Boolean(formik.errors.roundingIncrementMinutes)}
                      >
                        <InputLabel>Rounding Increment *</InputLabel>
                        <Select
                          name="roundingIncrementMinutes"
                          value={formik.values.roundingIncrementMinutes}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          label="Rounding Increment *"
                        >
                          {ROUNDING_INCREMENTS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {formik.touched.roundingIncrementMinutes && formik.errors.roundingIncrementMinutes && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                            {formik.errors.roundingIncrementMinutes}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 1.75 }}>
                          Time entries will be rounded to the nearest increment
                        </Typography>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl
                        fullWidth
                        error={formik.touched.roundingMethod && Boolean(formik.errors.roundingMethod)}
                      >
                        <InputLabel>Rounding Method *</InputLabel>
                        <Select
                          name="roundingMethod"
                          value={formik.values.roundingMethod}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          label="Rounding Method *"
                        >
                          {ROUNDING_METHODS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {formik.touched.roundingMethod && formik.errors.roundingMethod && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                            {formik.errors.roundingMethod}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 1.75 }}>
                          How to round when time falls between increments
                        </Typography>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Example:
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2">
                        If an employee works <strong>1 hour 7 minutes</strong> with a{' '}
                        <strong>{formik.values.roundingIncrementMinutes}-minute</strong> increment and{' '}
                        <strong>{ROUNDING_METHODS.find(m => m.value === formik.values.roundingMethod)?.label}</strong>:
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        • Round Up: <strong>1 hour {formik.values.roundingIncrementMinutes} minutes</strong>
                      </Typography>
                      <Typography variant="body2">
                        • Round Down: <strong>1 hour</strong>
                      </Typography>
                      <Typography variant="body2">
                        • Round Nearest: <strong>1 hour {formik.values.roundingIncrementMinutes <= 15 ? formik.values.roundingIncrementMinutes : 0} minutes</strong>
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" justifyContent="flex-end" spacing={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={submitting ? <CircularProgress size={16} /> : <SaveOutlined />}
                      disabled={submitting}
                    >
                      {submitting ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Form>
        </FormikProvider>
      </Stack>
    </MainCard>
  );
}
