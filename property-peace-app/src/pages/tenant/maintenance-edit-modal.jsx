import { useState, useEffect, useRef } from 'react';
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
  FormControl,
  Select,
  MenuItem,
  Chip,
  IconButton,
  alpha
} from '@mui/material';
import { DeleteOutlined, EditOutlined, PictureOutlined } from '@ant-design/icons';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { buildImageFromFile } from 'utils/formatters';
import MaintenanceImageUpload from 'components/image/MaintenanceImageUpload';

// ==============================|| TENANT - MAINTENANCE EDIT MODAL ||============================== //

const TenantMaintenanceEditModal = ({ open, onClose, onSuccess, maintenance }) => {
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize form values when maintenance changes
  useEffect(() => {
    if (maintenance && open) {
      // Set existing images from server
      if (maintenance.images && Array.isArray(maintenance.images)) {
        setExistingImages(maintenance.images);
      } else {
        setExistingImages([]);
      }
      setNewImages([]);
      setRemovedImageIds([]);
    }
  }, [maintenance, open]);

  // Validation schema
  const MaintenanceSchema = Yup.object().shape({
    title: Yup.string().required('Title is required'),
    priority: Yup.string().required('Priority is required'),
    category: Yup.string().required('Category is required'),
    status: Yup.string().required('Status is required'),
    description: Yup.string().max(500, 'Description is too long')
  });

  // Convert backend enum format to frontend form format
  const convertBackendStatusToFrontend = (backendStatus) => {
    if (!backendStatus) return 'open';
    const status = backendStatus.toString();
    const statusMap = {
      'Open': 'open',
      'InProgress': 'in-progress',
      'Pending': 'pending',
      'OnHold': 'on-hold',
      'Completed': 'completed',
      'Cancelled': 'cancelled'
    };
    return statusMap[status] || status.toLowerCase();
  };

  const convertBackendPriorityToFrontend = (backendPriority) => {
    if (!backendPriority) return 'medium';
    const priority = backendPriority.toString();
    const priorityMap = {
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high'
    };
    return priorityMap[priority] || priority.toLowerCase();
  };

  // Map category value (e.g. general_repair) to display name
  const CATEGORY_DISPLAY_NAMES = {
    appliances: 'Appliances',
    electrical: 'Electrical',
    exterior: 'Exterior',
    general_repair: 'General Repair',
    household: 'Household',
    outdoors: 'Outdoors',
    plumbing: 'Plumbing'
  };
  const getCategoryDisplayName = (value) => CATEGORY_DISPLAY_NAMES[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : '');

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: maintenance?.title || '',
      priority: convertBackendPriorityToFrontend(maintenance?.priority) || 'medium',
      category: maintenance?.category || 'appliances',
      status: convertBackendStatusToFrontend(maintenance?.status) || 'open',
      description: maintenance?.description || ''
    },
    validationSchema: MaintenanceSchema,
    onSubmit: async (values) => {
      if (!maintenance) return;

      setSubmitting(true);
      try {
        // Convert frontend status format to backend enum format
        const statusMap = {
          'open': 'Open',
          'in-progress': 'InProgress',
          'pending': 'Pending',
          'on-hold': 'OnHold',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
        };

        const backendStatus = statusMap[values.status] || values.status;

        // Convert priority to backend enum format (PascalCase)
        const priorityMap = {
          'low': 'Low',
          'medium': 'Medium',
          'high': 'High'
        };

        const backendPriority = priorityMap[values.priority] || values.priority;

        // Update maintenance request
        const updatePayload = {
          id: maintenance.id,
          title: (values.title || '').trim(),
          unitName: maintenance.unitName || '',
          priority: backendPriority,
          status: backendStatus,
          description: (values.description || '').trim(),
          categoryId: maintenance.categoryId || 0,
          imageUrl: '',
          completedAt: values.status === 'completed' ? new Date().toISOString() : null
        };

        const response = await axiosServices.put(`/api/maintenance-request/${maintenance.id}`, updatePayload);

        if (!response.data || !response.data.success) {
          throw new Error(response.data?.message || 'Failed to update maintenance request');
        }

        // Remove deleted images
        for (const imageId of removedImageIds) {
          try {
            const deleteResponse = await axiosServices.delete(`/api/maintenanceimage/${imageId}`);
            if (!deleteResponse.data || !deleteResponse.data.success) {
              console.warn(`Failed to delete image ${imageId}:`, deleteResponse.data?.message);
            }
          } catch (error) {
            console.error(`Error removing image ${imageId}:`, error);
          }
        }

        // Add new images
        if (newImages.length > 0) {
          const formData = new FormData();
          const filesToUpload = newImages
            .filter(img => img instanceof File || (img?.file && img.file instanceof File))
            .map(img => img instanceof File ? img : img.file);

          for (const file of filesToUpload) {
            formData.append('files', file);
          }

          if (filesToUpload.length > 0) {
            await axiosServices.post(`/api/maintenanceimage/${maintenance.id}`, formData);
          }
        }

        openSnackbar({
          open: true,
          message: 'Maintenance request updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        onSuccess();
      } catch (error) {
        console.error('Error updating maintenance request:', error);
        openSnackbar({
          open: true,
          message: error.response?.data?.message || error.message || 'Failed to update maintenance request',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImageFiles = files.map(buildImageFromFile);
    setNewImages([...newImages, ...newImageFiles]);
    event.target.value = '';
  };

  const handleRemoveExistingImage = (imageId, index) => {
    setRemovedImageIds([...removedImageIds, imageId]);
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  // Get current status to determine allowed status changes
  const currentStatus = convertBackendStatusToFrontend(maintenance?.status);
  const canChangeToCancelled = currentStatus === 'open';
  const canChangeToCompleted = currentStatus !== 'completed' && currentStatus !== 'cancelled';

  // Combine existing and new images for display
  const visibleExistingImages = existingImages
    .map((img, idx) => ({ ...img, isExisting: true, displayIndex: idx }))
    .filter(img => !removedImageIds.includes(img.id));

  const allImages = [
    ...visibleExistingImages,
    ...newImages.map((img, idx) => ({ ...img, isExisting: false, displayIndex: idx }))
  ];

  if (!maintenance) {
    return null;
  }

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
              <EditOutlined style={{ fontSize: 24, color: '#1877F2' }} />
            </Box>
            Edit Maintenance Request
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
                      renderValue={(selected) => getCategoryDisplayName(selected)}
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
                      <MenuItem value="general_repair">General Repair</MenuItem>
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
                  <InputLabel htmlFor="status" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Status *
                  </InputLabel>
                  <FormControl fullWidth>
                    <Select
                      fullWidth
                      id="status"
                      value={values.status}
                      onChange={(e) => setFieldValue('status', e.target.value)}
                      size="medium"
                      error={Boolean(touched.status && errors.status)}
                      disabled={!canChangeToCancelled && values.status !== 'cancelled' && !canChangeToCompleted && values.status !== 'completed'}
                      renderValue={(selected) => (
                        <Chip
                          label={selected === 'in-progress' ? 'In Progress' : selected.charAt(0).toUpperCase() + selected.slice(1)}
                          color={
                            selected === 'open'
                              ? 'primary'
                              : selected === 'in-progress'
                                ? 'warning'
                                : selected === 'completed'
                                  ? 'success'
                                  : 'default'
                          }
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
                      <MenuItem value="open">
                        <Chip label="Open" color="primary" size="small" sx={{ fontWeight: 600 }} />
                      </MenuItem>
                      {canChangeToCompleted && (
                        <MenuItem value="completed">
                          <Chip label="Completed" color="success" size="small" sx={{ fontWeight: 600 }} />
                        </MenuItem>
                      )}
                      {values.status === 'completed' && (
                        <MenuItem value="completed">
                          <Chip label="Completed" color="success" size="small" sx={{ fontWeight: 600 }} />
                        </MenuItem>
                      )}
                      {canChangeToCancelled && (
                        <MenuItem value="cancelled">
                          <Chip label="Cancelled" color="default" size="small" sx={{ fontWeight: 600 }} />
                        </MenuItem>
                      )}
                      {values.status === 'cancelled' && (
                        <MenuItem value="cancelled">
                          <Chip label="Cancelled" color="default" size="small" sx={{ fontWeight: 600 }} />
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                  {!canChangeToCancelled && currentStatus !== 'cancelled' && currentStatus !== 'completed' && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                      You can only cancel requests that are currently Open
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
                        
                      }
                    }}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <InputLabel sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PictureOutlined style={{ fontSize: 18 }} />
                    Images
                  </InputLabel>
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5)
                    }}
                  >
                    {/* Existing Images */}
                    {visibleExistingImages.length > 0 && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        {visibleExistingImages.map((image, index) => (
                          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={image.id || index}>
                            <Box
                              sx={{
                                position: 'relative',
                                borderRadius: 1,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <img
                                src={image.blobUrl || image.url || ''}
                                alt={`Existing ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '150px',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveExistingImage(image.id, index)}
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'error.dark' }
                                }}
                              >
                                <DeleteOutlined style={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    )}

                    {/* New Images */}
                    {newImages.length > 0 && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        {newImages.map((image, index) => (
                          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`new-${index}`}>
                            <Box
                              sx={{
                                position: 'relative',
                                borderRadius: 1,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <img
                                src={image.preview || image.url || ''}
                                alt={`New ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '150px',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveNewImage(index)}
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'error.dark' }
                                }}
                              >
                                <DeleteOutlined style={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    )}

                    {/* Upload Button */}
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PictureOutlined />}
                      fullWidth
                      sx={{ mt: visibleExistingImages.length > 0 || newImages.length > 0 ? 0 : 0 }}
                    >
                      Add Images
                      <input type="file" hidden accept="image/*" multiple onChange={handleImageUpload} />
                    </Button>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={onClose} disabled={submitting || isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting || isSubmitting}>
              {submitting || isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
};

TenantMaintenanceEditModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  maintenance: PropTypes.object
};

export default TenantMaintenanceEditModal;

