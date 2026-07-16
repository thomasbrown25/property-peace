import { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';

// material-ui
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, InputLabel, Stack, TextField, Typography } from '@mui/material';
import { Select, MenuItem, Chip } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import { useDrawer } from 'contexts/DrawerContext';
import { updateMaintenance, addMaintenanceImages, removeMaintenanceImage } from '../../store/maintenance/maintenance.action';
import { buildImageFromFile } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import VendorSelect from 'components/VendorSelect';
import { useNavigate } from 'react-router-dom';
import { timeEntryAPI } from 'api';
import { ClockCircleOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';

const MaintenanceEditDrawer = ({ maintenance, onUpdateSuccess }) => {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const fileInputRef = useRef(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);

  // Initialize form values when maintenance changes
  useEffect(() => {
    if (maintenance && drawer.isOpenMaintenanceEdit) {
      // Set existing images from server
      if (maintenance.images && Array.isArray(maintenance.images)) {
        setExistingImages(maintenance.images);
      }
      setNewImages([]);
      setRemovedImageIds([]);
      // Fetch time entries for this maintenance request
      fetchTimeEntries();
    }
  }, [maintenance, drawer.isOpenMaintenanceEdit]);

  const fetchTimeEntries = async () => {
    if (!maintenance?.id) return;
    try {
      setLoadingTimeEntries(true);
      const response = await timeEntryAPI.getTimeEntries({ maintenanceRequestId: maintenance.id });
      if (response?.data?.success && response?.data?.data) {
        setTimeEntries(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoadingTimeEntries(false);
    }
  };

  // Validation schema
  const MaintenanceSchema = Yup.object().shape({
    title: Yup.string().required('Title is required'),
    priority: Yup.string().required('Priority is required'),
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

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: maintenance?.title || '',
      unitId: maintenance?.unitName || '',
      priority: convertBackendPriorityToFrontend(maintenance?.priority) || 'medium',
      status: convertBackendStatusToFrontend(maintenance?.status) || 'open',
      description: maintenance?.description || '',
      vendorId: maintenance?.vendorId || null
    },
    validationSchema: MaintenanceSchema,
    onSubmit: async (values, { resetForm }) => {
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
          unitName: (values.unitId || '').trim(),
          priority: backendPriority,
          status: backendStatus,
          description: (values.description || '').trim(),
          categoryId: maintenance.categoryId || 0,
          imageUrl: '',
          completedAt: values.status === 'completed' ? new Date().toISOString() : null,
          vendorId: values.vendorId || null
        };

        await dispatch(updateMaintenance(updatePayload));

        // Remove deleted images
        for (const imageId of removedImageIds) {
          try {
            await dispatch(removeMaintenanceImage(imageId));
          } catch (error) {
            console.error(`Error removing image ${imageId}:`, error);
          }
        }

        // Add new images
        if (newImages.length > 0) {
          // Filter out preview URLs and get actual File objects
          const filesToUpload = newImages
            .filter(img => {
              // Keep File objects directly, or objects with a file property that is a File
              return img instanceof File || (img?.file && img.file instanceof File);
            })
            .map(img => img instanceof File ? img : img.file);

          if (filesToUpload.length > 0) {
            await dispatch(addMaintenanceImages(maintenance.id, filesToUpload));
          }
        }

        openSnackbar({
          open: true,
          message: 'Maintenance request updated successfully',
          variant: 'alert',
          alert: {
            color: 'success',
            variant: 'filled'
          },
          close: true,
          actionButton: false,
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'right'
          },
          transition: 'SlideUp',
          autoHideDuration: 5000
        });

        resetForm();
        drawer.closeMaintenanceEditDrawer();
        
        // Trigger refetch if callback provided
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } catch (error) {
        console.error('Error updating maintenance request:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || error?.message || 'Failed to update maintenance request',
          variant: 'alert',
          alert: {
            color: 'error',
            variant: 'filled'
          },
          close: true,
          actionButton: false,
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'right'
          },
          transition: 'SlideUp',
          autoHideDuration: 5000
        });
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImageFiles = files.map(buildImageFromFile);
    setNewImages([...newImages, ...newImageFiles]);
    event.target.value = ''; // Reset input
  };

  const handleRemoveExistingImage = (imageId, index) => {
    setRemovedImageIds([...removedImageIds, imageId]);
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  // Combine existing and new images for display
  // Filter out removed existing images
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
    <Dialog open={drawer.isOpenMaintenanceEdit} onClose={drawer.closeMaintenanceEditDrawer} maxWidth="md" fullWidth>
      <FormikProvider value={formik}>
        <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
          <DialogTitle>Edit Maintenance Request</DialogTitle>
          <Divider />
          <DialogContent sx={{ p: 2.5 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Stack sx={{ gap: 1 }}> 
                  <Typography variant="h5">
                    {maintenance?.propertyName || 'N/A'}
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel htmlFor="title">Title</InputLabel>
                  <TextField
                    fullWidth
                    id="title"
                    placeholder="Ex. Leaky Faucet"
                    {...getFieldProps('title')}
                    error={Boolean(touched.title && errors.title)}
                    helperText={touched.title && errors.title}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel htmlFor="unitId">Unit Number</InputLabel>
                  <TextField
                    fullWidth
                    id="unitId"
                    placeholder="Ex. Unit A"
                    disabled
                    {...getFieldProps('unitId')}
                    error={Boolean(touched.unitId && errors.unitId)}
                    helperText={touched.unitId && errors.unitId}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel htmlFor="priority">Priority</InputLabel>
                  <Select
                    fullWidth
                    id="priority"
                    value={values.priority}
                    onChange={(e) => setFieldValue('priority', e.target.value)}
                    renderValue={(selected) => (
                      <Chip
                        label={selected.charAt(0).toUpperCase() + selected.slice(1)}
                        color={selected === 'high' ? 'error' : selected === 'medium' ? 'warning' : 'success'}
                        size="small"
                      />
                    )}
                  >
                    <MenuItem value="low">
                      <Chip label="Low" color="success" size="small" />
                    </MenuItem>
                    <MenuItem value="medium">
                      <Chip label="Medium" color="warning" size="small" />
                    </MenuItem>
                    <MenuItem value="high">
                      <Chip label="High" color="error" size="small" />
                    </MenuItem>
                  </Select>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel htmlFor="status">Status</InputLabel>
                  <Select
                    fullWidth
                    id="status"
                    value={values.status}
                    onChange={(e) => setFieldValue('status', e.target.value)}
                    renderValue={(selected) => {
                      let label = selected === 'in-progress' ? 'In Progress' : selected === 'on-hold' ? 'On Hold' : selected.charAt(0).toUpperCase() + selected.slice(1);
                      let color = 'default';
                      if (selected === 'open') {
                        color = 'primary';
                      } else if (selected === 'in-progress' || selected === 'pending' || selected === 'on-hold') {
                        color = 'warning';
                      } else if (selected === 'completed') {
                        color = 'success';
                      }
                      return (
                        <Chip
                          label={label}
                          color={color}
                          size="small"
                        />
                      );
                    }}
                  >
                    <MenuItem value="open">
                      <Chip label="Open" color="primary" size="small" />
                    </MenuItem>
                    <MenuItem value="in-progress">
                      <Chip label="In Progress" color="warning" size="small" />
                    </MenuItem>
                    <MenuItem value="pending">
                      <Chip label="Pending" color="warning" size="small" />
                    </MenuItem>
                    <MenuItem value="on-hold">
                      <Chip label="On Hold" color="warning" size="small" />
                    </MenuItem>
                    <MenuItem value="completed">
                      <Chip label="Completed" color="success" size="small" />
                    </MenuItem>
                    <MenuItem value="cancelled">
                      <Chip label="Cancelled" color="default" size="small" />
                    </MenuItem>
                  </Select>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel>Assign Vendor (Optional)</InputLabel>
                  <VendorSelect
                    width="100%"
                    value={values.vendorId}
                    onChange={(vendorId) => {
                      setFieldValue('vendorId', vendorId);
                    }}
                    label="Select Vendor"
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack sx={{ gap: 1 }}>
                  <InputLabel htmlFor="description">Description</InputLabel>
                  <TextField
                    fullWidth
                    id="description"
                    multiline
                    rows={4}
                    placeholder="Provide details about the issue..."
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
                <Stack sx={{ gap: 1 }}>
                  <InputLabel>Images</InputLabel>
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    onClick={() => fileInputRef?.current?.click()}
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Click to upload new images (or drag & drop)
                    </Typography>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                  </Box>

                  {/* Display existing and new images */}
                  {allImages.length > 0 && (
                    <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
                      {allImages.map((img, index) => {
                        const imageSrc = img.isExisting
                          ? img.blobUrl || img.url
                          : img.preview || (img.file ? URL.createObjectURL(img.file) : null);
                        const imageKey = img.isExisting ? `existing-${img.id}` : `new-${index}`;

                        return (
                          <Box
                            key={imageKey}
                            position="relative"
                            width="100px"
                            height="100px"
                            borderRadius="8px"
                            overflow="hidden"
                            sx={{
                              border: '1px solid #ddd'
                            }}
                          >
                            {imageSrc && (
                              <img
                                src={imageSrc}
                                alt={`Maintenance ${index}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            )}
                            <IconButton
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                color: '#fff',
                                background: 'rgba(0,0,0,0.5)',
                                '&:hover': { background: 'rgba(0,0,0,0.7)' }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (img.isExisting) {
                                  handleRemoveExistingImage(img.id, img.displayIndex);
                                } else {
                                  handleRemoveNewImage(img.displayIndex);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Stack>
              </Grid>

              {/* Time Entries Section */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Stack sx={{ gap: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <InputLabel>Time Entries</InputLabel>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlusOutlined />}
                        onClick={() => {
                          drawer.closeMaintenanceEditDrawer();
                          navigate(`/landlord/time-tracking?maintenanceRequestId=${maintenance.id}`);
                        }}
                      >
                        Add Time Entry
                      </Button>
                      {timeEntries.length > 0 && (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            drawer.closeMaintenanceEditDrawer();
                            navigate(`/landlord/time-tracking?maintenanceRequestId=${maintenance.id}`);
                          }}
                        >
                          View All ({timeEntries.length})
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                  {loadingTimeEntries ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading time entries...
                    </Typography>
                  ) : timeEntries.length > 0 ? (
                    <Box>
                      {timeEntries.slice(0, 3).map((entry) => (
                        <Box
                          key={entry.id}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack spacing={0.5}>
                              <Typography variant="body2" fontWeight="medium">
                                {entry.staffMemberName || 'Unknown Staff'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {entry.startTime
                                  ? new Date(entry.startTime).toLocaleDateString()
                                  : '-'}
                                {' • '}
                                {entry.hoursWorked
                                  ? `${Math.floor(entry.hoursWorked)}h ${Math.round((entry.hoursWorked - Math.floor(entry.hoursWorked)) * 60)}m`
                                  : '0h'}
                              </Typography>
                            </Stack>
                            <Button
                              size="small"
                              startIcon={<EyeOutlined />}
                              onClick={() => {
                                drawer.closeMaintenanceEditDrawer();
                                navigate(`/landlord/time-entry/${entry.id}`);
                              }}
                            >
                              View
                            </Button>
                          </Stack>
                        </Box>
                      ))}
                      {timeEntries.length > 3 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Showing 3 of {timeEntries.length} entries
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}
                    >
                      <ClockCircleOutlined style={{ fontSize: 24, opacity: 0.3 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        No time entries recorded
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} sx={{ width: 1, justifyContent: 'flex-end' }}>
              <Button variant="outlined" color="inherit" onClick={drawer.closeMaintenanceEditDrawer}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                Update Request
              </Button>
            </Stack>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
};

MaintenanceEditDrawer.propTypes = {
  maintenance: PropTypes.object,
  onUpdateSuccess: PropTypes.func
};

export default MaintenanceEditDrawer;

