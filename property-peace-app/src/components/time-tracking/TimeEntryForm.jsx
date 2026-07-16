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
  FormControlLabel,
  Checkbox,
  Stack,
  CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchStaffMembers from 'hooks/useFetchStaffMembers';
import { timeEntryAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';

const TimeEntrySchema = Yup.object().shape({
  staffMemberId: Yup.number().required('Staff member is required'),
  propertyId: Yup.number().required('Property is required'),
  startTime: Yup.date().required('Start time is required'),
  endTime: Yup.date().nullable().test('end-after-start', 'End time must be after start time', function (value) {
    const { startTime } = this.parent;
    if (!value || !startTime) return true;
    return new Date(value) > new Date(startTime);
  }),
  description: Yup.string().required('Description is required').max(500, 'Description is too long'),
  notes: Yup.string().max(1000, 'Notes are too long'),
  isBillable: Yup.boolean()
});

export default function TimeEntryForm({ 
  open, 
  onClose, 
  initialValues = null,
  maintenanceRequestId = null,
  onSuccess,
  title = null
}) {
  const { properties } = useFetchProperties();
  const { staffMembers } = useFetchStaffMembers();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const [submitting, setSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: initialValues || {
      staffMemberId: '',
      propertyId: selectedProperty?.id || '',
      unitId: selectedUnit?.id || '',
      maintenanceRequestId: maintenanceRequestId || '',
      startTime: new Date(),
      endTime: null,
      description: '',
      notes: '',
      isBillable: true
    },
    validationSchema: TimeEntrySchema,
    onSubmit: async (values, { setSubmitting: setFormikSubmitting }) => {
      try {
        setSubmitting(true);
        const payload = {
          ...values,
          startTime: values.startTime.toISOString(),
          endTime: values.endTime ? values.endTime.toISOString() : null,
          unitId: values.unitId || null,
          maintenanceRequestId: values.maintenanceRequestId || null
        };

        let response;
        if (initialValues?.id) {
          response = await timeEntryAPI.updateTimeEntry(initialValues.id, payload);
        } else {
          response = await timeEntryAPI.addTimeEntry(payload);
        }

        if (response?.data?.success) {
          openSnackbar({
            open: true,
            message: initialValues?.id ? 'Time entry updated successfully' : 'Time entry created successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          onSuccess?.();
          onClose();
        } else {
          throw new Error(response?.data?.message || 'Failed to save time entry');
        }
      } catch (error) {
        console.error('Error saving time entry:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to save time entry',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
        setFormikSubmitting(false);
      }
    }
  });

  useEffect(() => {
    if (initialValues) {
      setIsActive(!initialValues.endTime);
    }
  }, [initialValues]);

  const handleIsActiveChange = (event) => {
    const active = event.target.checked;
    setIsActive(active);
    if (active) {
      formik.setFieldValue('endTime', null);
    } else if (!formik.values.endTime) {
      formik.setFieldValue('endTime', new Date());
    }
  };

  // Filter maintenance requests by selected property
  const maintenanceRequests = selectedProperty?.maintenanceRequests || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title || (initialValues?.id ? 'Edit Time Entry' : 'Add Time Entry')}
      </DialogTitle>
      <FormikProvider value={formik}>
        <Form>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <FormControl fullWidth error={formik.touched.staffMemberId && Boolean(formik.errors.staffMemberId)}>
                  <InputLabel>Staff Member *</InputLabel>
                  <Select
                    name="staffMemberId"
                    value={formik.values.staffMemberId}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    label="Staff Member *"
                  >
                    {staffMembers
                      .filter(sm => sm.isActive)
                      .map((staff) => (
                        <MenuItem key={staff.id} value={staff.id}>
                          {staff.userName || `${staff.userFirstName} ${staff.userLastName}`}
                        </MenuItem>
                      ))}
                  </Select>
                  {formik.touched.staffMemberId && formik.errors.staffMemberId && (
                    <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                      {formik.errors.staffMemberId}
                    </Box>
                  )}
                </FormControl>
              </Grid>

              <Grid size={12}>
                <PropertySelect disableAllOption />
              </Grid>

              {selectedProperty && (
                <Grid size={12}>
                  <UnitSelect propertyId={selectedProperty.id} />
                </Grid>
              )}

              {selectedProperty && maintenanceRequests.length > 0 && (
                <Grid size={12}>
                  <FormControl fullWidth>
                    <InputLabel>Maintenance Request (Optional)</InputLabel>
                    <Select
                      name="maintenanceRequestId"
                      value={formik.values.maintenanceRequestId || ''}
                      onChange={formik.handleChange}
                      label="Maintenance Request (Optional)"
                    >
                      <MenuItem value="">None</MenuItem>
                      {maintenanceRequests.map((mr) => (
                        <MenuItem key={mr.id} value={mr.id}>
                          {mr.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

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
                    label="End Time"
                    value={formik.values.endTime}
                    onChange={(value) => formik.setFieldValue('endTime', value)}
                    disabled={isActive}
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isActive}
                      onChange={handleIsActiveChange}
                      disabled={!!initialValues?.id}
                    />
                  }
                  label="Currently Active (no end time)"
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description *"
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.description && Boolean(formik.errors.description)}
                  helperText={formik.touched.description && formik.errors.description}
                  multiline
                  rows={3}
                />
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

              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isBillable"
                      checked={formik.values.isBillable}
                      onChange={formik.handleChange}
                    />
                  }
                  label="Billable"
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
              {submitting ? 'Saving...' : initialValues?.id ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
}

TimeEntryForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  maintenanceRequestId: PropTypes.number,
  onSuccess: PropTypes.func
};
