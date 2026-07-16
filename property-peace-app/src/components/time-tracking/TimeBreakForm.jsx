import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';
import { timeBreakAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

const TimeBreakSchema = Yup.object().shape({
  breakType: Yup.string().required('Break type is required'),
  startTime: Yup.date().required('Start time is required'),
  endTime: Yup.date()
    .required('End time is required')
    .test('end-after-start', 'End time must be after start time', function (value) {
      const { startTime } = this.parent;
      if (!value || !startTime) return true;
      return new Date(value) > new Date(startTime);
    }),
  notes: Yup.string().max(500, 'Notes are too long')
});

const BREAK_TYPES = [
  { value: 'Lunch', label: 'Lunch' },
  { value: 'Rest', label: 'Rest' },
  { value: 'Other', label: 'Other' }
];

export default function TimeBreakForm({ 
  open, 
  onClose, 
  timeEntryId,
  initialValues = null,
  onSuccess 
}) {
  const [submitting, setSubmitting] = useState(false);
  const [durationHours, setDurationHours] = useState(0);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: initialValues || {
      breakType: 'Other',
      startTime: new Date(),
      endTime: new Date(),
      notes: ''
    },
    validationSchema: TimeBreakSchema,
    onSubmit: async (values, { setSubmitting: setFormikSubmitting }) => {
      try {
        setSubmitting(true);
        const payload = {
          ...values,
          startTime: values.startTime.toISOString(),
          endTime: values.endTime.toISOString()
        };

        let response;
        if (initialValues?.id) {
          response = await timeBreakAPI.updateTimeBreak(initialValues.id, payload);
        } else {
          response = await timeBreakAPI.addTimeBreak(timeEntryId, payload);
        }

        if (response?.data?.success) {
          openSnackbar({
            open: true,
            message: initialValues?.id ? 'Break updated successfully' : 'Break added successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          onSuccess?.();
          onClose();
        } else {
          throw new Error(response?.data?.message || 'Failed to save break');
        }
      } catch (error) {
        console.error('Error saving break:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to save break',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
        setFormikSubmitting(false);
      }
    }
  });

  // Calculate duration when start/end times change
  useEffect(() => {
    if (formik.values.startTime && formik.values.endTime) {
      const start = new Date(formik.values.startTime);
      const end = new Date(formik.values.endTime);
      if (end > start) {
        const diffMs = end - start;
        const hours = diffMs / (1000 * 60 * 60);
        setDurationHours(hours);
      } else {
        setDurationHours(0);
      }
    } else {
      setDurationHours(0);
    }
  }, [formik.values.startTime, formik.values.endTime]);

  const formatDuration = (hours) => {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialValues?.id ? 'Edit Break' : 'Add Break'}
      </DialogTitle>
      <FormikProvider value={formik}>
        <Form>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <FormControl fullWidth error={formik.touched.breakType && Boolean(formik.errors.breakType)}>
                  <InputLabel>Break Type *</InputLabel>
                  <Select
                    name="breakType"
                    value={formik.values.breakType}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    label="Break Type *"
                  >
                    {BREAK_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {formik.touched.breakType && formik.errors.breakType && (
                    <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                      {formik.errors.breakType}
                    </Box>
                  )}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label="Start Time *"
                    value={formik.values.startTime}
                    onChange={(value) => formik.setFieldValue('startTime', value)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: formik.touched.startTime && Boolean(formik.errors.startTime),
                        helperText: formik.touched.startTime && formik.errors.startTime
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label="End Time *"
                    value={formik.values.endTime}
                    onChange={(value) => formik.setFieldValue('endTime', value)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: formik.touched.endTime && Boolean(formik.errors.endTime),
                        helperText: formik.touched.endTime && formik.errors.endTime
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid size={12}>
                <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duration: <strong>{formatDuration(durationHours)}</strong>
                  </Typography>
                </Box>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  name="notes"
                  label="Notes (Optional)"
                  value={formik.values.notes || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.notes && Boolean(formik.errors.notes)}
                  helperText={formik.touched.notes && formik.errors.notes}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : null}
            >
              {submitting ? 'Saving...' : initialValues?.id ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
}

TimeBreakForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  timeEntryId: PropTypes.number.isRequired,
  initialValues: PropTypes.object,
  onSuccess: PropTypes.func
};
