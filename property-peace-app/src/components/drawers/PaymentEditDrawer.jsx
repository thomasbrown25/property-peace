import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

// material-ui
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import CloseOutlined from '@ant-design/icons/CloseOutlined';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// app
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import { openSnackbar } from 'api/snackbar';
import axios from 'utils/axios';
import { formatCurrency } from 'utils/formatters';

const METHOD_OPTIONS = ['Manual Entry', 'Cash', 'Check', 'ACH', 'Online Payment', 'Other'];

const getValue = (obj, camel, pascal, fallback = '') => obj?.[camel] ?? obj?.[pascal] ?? fallback;

const toDateInputValue = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const toLocalMiddayIso = (dateValue) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
};

const getDisplayLocation = (payment) => {
  const propertyName = getValue(payment, 'propertyName', 'PropertyName', 'Property');
  const unitName = getValue(payment, 'unitName', 'UnitName', '');
  const isSingleUnit = getValue(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty', false);
  if (!unitName || isSingleUnit) return propertyName;
  return `${propertyName} · ${unitName}`;
};

const PaymentSchema = Yup.object().shape({
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be greater than 0')
    .min(0.01, 'Amount must be at least $0.01'),
  paymentDate: Yup.string().required('Payment date is required')
});

const PaymentEditDrawer = ({ payment, open, onClose, onUpdateSuccess }) => {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const paymentId = getValue(payment, 'id', 'Id', null);
  const currentAmount = parseFloat(getValue(payment, 'amount', 'Amount', 0)) || 0;
  const locationLabel = getDisplayLocation(payment);
  const tenantName = getValue(payment, 'tenantName', 'TenantName', '');

  const initialValues = useMemo(() => ({
    amount: currentAmount,
    paymentDate: toDateInputValue(getValue(payment, 'paymentDate', 'PaymentDate', null)),
    method: getValue(payment, 'method', 'Method', '') || 'Manual Entry',
    reference: getValue(payment, 'reference', 'Reference', '') || ''
  }), [currentAmount, payment]);

  const formik = useFormik({
    initialValues,
    validationSchema: PaymentSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting: setFormikSubmitting }) => {
      try {
        setSubmitting(true);
        setFormikSubmitting(true);

        if (!paymentId) {
          openSnackbar({
            open: true,
            message: 'No payment selected for editing.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          return;
        }

        await axios.put(`/api/payment/${paymentId}`, {
          amount: parseFloat(values.amount),
          paymentDate: toLocalMiddayIso(values.paymentDate),
          method: values.method || null,
          reference: values.reference?.trim() || ''
        });

        openSnackbar({
          open: true,
          message: 'Payment updated successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        onUpdateSuccess?.();
        onClose();
      } catch (error) {
        console.error('Error updating payment:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || error?.response?.data?.Message || error?.response?.data || 'Failed to update payment.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
        setFormikSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, handleChange, handleBlur } = formik;

  const handleCancel = () => {
    formik.resetForm();
    onClose();
  };

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={handleCancel}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 500, md: 560 },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          backgroundImage: 'none'
        }
      }}
    >
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <Toolbar
            sx={{
              px: 2.5,
              minHeight: '64px !important',
              borderBottom: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.customShadows?.z1
            }}
          >
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Edit Payment
            </Typography>
            <IconButton onClick={handleCancel} size="small" sx={{ color: 'text.secondary' }}>
              <CloseOutlined />
            </IconButton>
          </Toolbar>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            <Stack spacing={2.25}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Payment context
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                  {tenantName || 'Tenant'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {locationLabel} · current amount {formatCurrency(currentAmount)}
                </Typography>
              </Box>

              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                This updates the existing payment record. The lease balance and accounting ledger entry will be refreshed after save.
              </Alert>

              <Stack spacing={0.75}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Amount *
                </Typography>
                <NumericFormat
                  customInput={TextField}
                  fullWidth
                  name="amount"
                  value={values.amount}
                  onValueChange={(numericValues) => {
                    handleChange({ target: { name: 'amount', value: numericValues.floatValue || '' } });
                  }}
                  onBlur={handleBlur}
                  error={touched.amount && Boolean(errors.amount)}
                  helperText={touched.amount && errors.amount}
                  thousandSeparator
                  prefix="$"
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  size="small"
                />
              </Stack>

              <Stack spacing={0.75}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Payment date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  name="paymentDate"
                  value={values.paymentDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.paymentDate && Boolean(errors.paymentDate)}
                  helperText={touched.paymentDate && errors.paymentDate}
                  size="small"
                />
              </Stack>

              <Stack spacing={0.75}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Method
                </Typography>
                <TextField
                  select
                  fullWidth
                  name="method"
                  value={values.method}
                  onChange={handleChange}
                  size="small"
                >
                  {METHOD_OPTIONS.map((method) => (
                    <MenuItem key={method} value={method}>{method}</MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack spacing={0.75}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Reference / note
                </Typography>
                <TextField
                  fullWidth
                  name="reference"
                  value={values.reference}
                  onChange={handleChange}
                  multiline
                  minRows={3}
                  placeholder="e.g. January rent, check #1042"
                />
              </Stack>
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleCancel} disabled={submitting} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} sx={{ textTransform: 'none' }}>
                {submitting ? <CircularWithPath size={20} /> : 'Save changes'}
              </Button>
            </Stack>
          </Box>
        </Form>
      </FormikProvider>
    </ThemeAdaptiveDrawer>
  );
};

PaymentEditDrawer.propTypes = {
  payment: PropTypes.object,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateSuccess: PropTypes.func
};

export default PaymentEditDrawer;
