import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  InputLabel,
  Stack,
  TextField,
  Typography,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Chip,
  alpha,
  Paper
} from '@mui/material';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import MaintenanceImageUpload from 'components/image/MaintenanceImageUpload';
import { addMaintenance } from 'store/maintenance/maintenance.action';
import { openSnackbar } from 'api/snackbar';

// icons
import {
  ToolOutlined,
  EditOutlined,
  AlertOutlined
} from '@ant-design/icons';

// ==============================|| TENANT - MAINTENANCE ADD MODAL ||============================== //

const TenantMaintenanceAddModal = ({ open, onClose, onSuccess, lease }) => {
  const dispatch = useDispatch();

  // Validation schema
  const MaintenanceSchema = Yup.object().shape({
    title: Yup.string().required('Title is required'),
    priority: Yup.string().required('Priority is required'),
    category: Yup.string().required('Category is required'),
    description: Yup.string().max(500, 'Description is too long')
  });

  const formik = useFormik({
    initialValues: {
      title: '',
      priority: 'medium',
      category: 'appliances',
      description: '',
      images: []
    },
    validationSchema: MaintenanceSchema,
    onSubmit: async (values, { resetForm }) => {
      if (!lease) {
        openSnackbar({
          open: true,
          message: 'No active lease found. Please contact your landlord.',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }

      const payload = {
        propertyId: lease.unit?.propertyId || lease.propertyId || '',
        unitId: lease.unitId || lease.unit?.id || '',
        title: (values.title || '').trim(),
        priority: values.priority,
        category: values.category,
        status: 'open',
        description: (values.description || '').trim()
      };

      try {
        await dispatch(addMaintenance(payload, values.images));
        openSnackbar({
          open: true,
          message: 'Maintenance request submitted successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        resetForm();
        onSuccess();
        onClose();
      } catch (error) {
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || error?.message || 'Failed to submit maintenance request',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      formik.resetForm();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
        }
      }}
    >
      <FormikProvider value={formik}>
        <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
          <DialogTitle
            sx={{
              fontWeight: 700,
              fontSize: '1.5rem',
              pb: 2,
              borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ToolOutlined style={{ fontSize: 24, color: '#1877F2' }} />
            </Box>
            Submit Maintenance Request
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <InputLabel htmlFor="title" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Title *
                  </InputLabel>
                  <TextField
                    fullWidth
                    id="title"
                    placeholder="Ex. Leaky Faucet in Kitchen"
                    size="medium"
                    {...getFieldProps('title')}
                    error={Boolean(touched.title && errors.title)}
                    helperText={touched.title && errors.title}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EditOutlined style={{ fontSize: 18, opacity: 0.6 }} />
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5
                      }
                    }}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={1}>
                  <InputLabel htmlFor="category" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Category *
                  </InputLabel>
                  <FormControl fullWidth>
                    <Select
                      fullWidth
                      id="category"
                      value={values.category}
                      onChange={(e) => setFieldValue('category', e.target.value)}
                      size="medium"
                      error={Boolean(touched.category && errors.category)}
                      sx={{
                        borderRadius: 1.5,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha('#000', 0.23)
                        }
                      }}
                    >
                      <MenuItem value="appliances">Appliances</MenuItem>
                      <MenuItem value="electrical">Electrical</MenuItem>
                      <MenuItem value="exterior">Exterior</MenuItem>
                      <MenuItem value="household">Household</MenuItem>
                      <MenuItem value="outdoors">Outdoors</MenuItem>
                      <MenuItem value="plumbing">Plumbing</MenuItem>
                    </Select>
                  </FormControl>
                  {touched.category && errors.category && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {errors.category}
                    </Typography>
                  )}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={1}>
                  <InputLabel htmlFor="priority" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Priority *
                  </InputLabel>
                  <FormControl fullWidth>
                    <Select
                      fullWidth
                      id="priority"
                      value={values.priority}
                      onChange={(e) => setFieldValue('priority', e.target.value)}
                      size="medium"
                      error={Boolean(touched.priority && errors.priority)}
                      renderValue={(selected) => (
                        <Chip
                          label={selected.charAt(0).toUpperCase() + selected.slice(1)}
                          color={selected === 'high' ? 'error' : selected === 'medium' ? 'warning' : 'success'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      sx={{
                        borderRadius: 1.5,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha('#000', 0.23)
                        }
                      }}
                    >
                      <MenuItem value="low">
                        <Chip label="Low" color="success" size="small" sx={{ fontWeight: 600 }} />
                      </MenuItem>
                      <MenuItem value="medium">
                        <Chip label="Medium" color="warning" size="small" sx={{ fontWeight: 600 }} />
                      </MenuItem>
                      <MenuItem value="high">
                        <Chip label="High" color="error" size="small" sx={{ fontWeight: 600 }} />
                      </MenuItem>
                    </Select>
                  </FormControl>
                  {touched.priority && errors.priority && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {errors.priority}
                    </Typography>
                  )}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <InputLabel htmlFor="description" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Description
                  </InputLabel>
                  <TextField
                    fullWidth
                    id="description"
                    placeholder="Provide details about the maintenance issue..."
                    multiline
                    rows={4}
                    {...getFieldProps('description')}
                    error={Boolean(touched.description && errors.description)}
                    helperText={touched.description && errors.description}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5
                      }
                    }}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <InputLabel sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    Upload Images
                  </InputLabel>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                      border: (theme) => `1px dashed ${alpha(theme.palette.divider, 0.5)}`
                    }}
                  >
                    <MaintenanceImageUpload onImagesChange={(imgs) => setFieldValue('images', imgs)} />
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions
            sx={{
              p: 3,
              borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            <Stack direction="row" spacing={2} sx={{ width: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={onClose}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                }}
              >
                Submit Request
              </Button>
            </Stack>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
};

TenantMaintenanceAddModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  lease: PropTypes.object
};

export default TenantMaintenanceAddModal;

