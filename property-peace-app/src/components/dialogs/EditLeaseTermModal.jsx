import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  IconButton,
  Box,
  Typography
} from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import FormSelect from 'components/input/FormSelect';
import { rentFrequencyOptions, rentDueDayOptions } from 'utils/models';

// ---------- validation ----------
const LeaseTermSchema = Yup.object().shape({
  startDate: Yup.date().required('Start date is required').nullable(),
  endDate: Yup.date()
    .required('End date is required')
    .nullable()
    .min(Yup.ref('startDate'), 'End date must be after start date'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required('Rent frequency is required'),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required')
});

export default function EditLeaseTermModal({ open, onClose, lease, onSave }) {
  const [saving, setSaving] = useState(false);

  // Helper to convert date string to Date object
  const parseDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      startDate: parseDate(lease?.startDate),
      endDate: parseDate(lease?.endDate),
      rentFrequency: lease?.rentFrequency?.toLowerCase() ?? 'monthly',
      rentDueDay: lease?.rentDueDay ?? 1
    },
    validationSchema: LeaseTermSchema,
    onSubmit: async (values) => {
      if (!lease?.id) return;

      setSaving(true);
      try {
        // Convert dates to ISO strings (matching the format expected by the backend)
        const startDate = values.startDate ? new Date(values.startDate).toISOString() : lease.startDate;
        const endDate = values.endDate ? new Date(values.endDate).toISOString() : lease.endDate;

        // Call the onSave callback with updated values
        await onSave({
          id: lease.id,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          startDate,
          endDate,
          rentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          rentDueDay: Number(values.rentDueDay),
          rentAmount: lease.rentAmount,
          depositAmount: lease.depositAmount,
          leaseLength: lease.leaseLength,
          isActive: lease.isActive,
          isDrafted: lease.isDrafted,
          name: lease.name,
          allowPartialPayments: lease.allowPartialPayments,
          allowRecurringCharges: lease.allowRecurringCharges,
          requireSettlePastDue: lease.requireSettlePastDue
        });

        onClose();
      } catch (error) {
        console.error('Error saving lease term:', error);
      } finally {
        setSaving(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, setFieldValue, resetForm } = formik;

  // Reset form when modal opens/closes or lease changes
  useEffect(() => {
    if (open && lease) {
      resetForm({
        values: {
          startDate: parseDate(lease?.startDate),
          endDate: parseDate(lease?.endDate),
          rentFrequency: lease?.rentFrequency?.toLowerCase() ?? 'monthly',
          rentDueDay: lease?.rentDueDay ?? 1
        }
      });
    }
  }, [open, lease, resetForm]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}
      >
        <Typography variant="h6" component="span">
          Edit Lease Term
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {/* Start Date */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date *"
                value={values.startDate}
                onChange={(date) => {
                  setFieldValue('startDate', date);
                  // If end date is before new start date, update it
                  if (date && values.endDate && new Date(date) > new Date(values.endDate)) {
                    const newEndDate = new Date(date);
                    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    setFieldValue('endDate', newEndDate);
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: touched.startDate && Boolean(errors.startDate),
                    helperText: touched.startDate && errors.startDate
                  }
                }}
              />
            </LocalizationProvider>

            {/* End Date */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date *"
                value={values.endDate}
                onChange={(date) => setFieldValue('endDate', date)}
                minDate={values.startDate || undefined}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: touched.endDate && Boolean(errors.endDate),
                    helperText: touched.endDate && errors.endDate
                  }
                }}
              />
            </LocalizationProvider>

            {/* Rent Frequency */}
            <FormSelect
              name="rentFrequency"
              label="Rent Frequency *"
              options={rentFrequencyOptions}
              value={values.rentFrequency}
              setFieldValue={setFieldValue}
              touched={touched.rentFrequency}
              errorText={errors.rentFrequency}
              placeholder="Select frequency"
              valueType="string"
              fullWidth
            />

            {/* Rent Due Day */}
            <FormSelect
              name="rentDueDay"
              label="Rent Due Day *"
              options={rentDueDayOptions}
              value={values.rentDueDay}
              setFieldValue={(name, value) => setFieldValue(name, Number(value))}
              touched={touched.rentDueDay}
              errorText={errors.rentDueDay}
              placeholder="Select due day"
              valueType="number"
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ textTransform: 'none' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
