import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import {
  Box,
  Typography,
  Stack,
  Divider,
  Chip,
  Button,
  IconButton,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  alpha,
  ImageList,
  ImageListItem,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  ToolOutlined,
  HomeOutlined,
  FileTextOutlined,
  PictureOutlined,
  EditOutlined,
  CheckCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatDateAndTime } from 'utils/formatters';
import { getPriorityColor, getStatusColor } from 'utils/helper-methods';
import MainCard from 'components/MainCard';
import TenantMaintenanceEditModal from './maintenance-edit-modal';
import { openSnackbar } from 'api/snackbar';
import moment from 'moment';

// ==============================|| TENANT - MAINTENANCE DETAIL ||============================== //

export default function TenantMaintenanceDetail({ maintenanceId, onBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    const fetchMaintenance = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axiosServices.get(`/api/maintenance-request/${maintenanceId}`);
        
        if (response.data && response.data.success && response.data.data) {
          setMaintenance(response.data.data);
        } else {
          setError('Maintenance request not found');
        }
      } catch (err) {
        console.error('Error fetching maintenance request:', err);
        setError(err?.response?.data?.message || 'Failed to load maintenance request');
      } finally {
        setLoading(false);
      }
    };

    if (maintenanceId) {
      fetchMaintenance();
    }
  }, [maintenanceId]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/tenant/maintenance');
    }
  };

  const handleEditSuccess = async () => {
    setEditModalOpen(false);
    // Refetch maintenance data
    try {
      const response = await axiosServices.get(`/api/maintenance-request/${maintenanceId}`);
      if (response.data && response.data.success && response.data.data) {
        const updatedMaintenance = response.data.data;
        setMaintenance(updatedMaintenance);
        
        // If status changed to cancelled, navigate back to list to see it in history
        if (updatedMaintenance.status === 'cancelled' || updatedMaintenance.status === 'completed') {
          // Small delay to show the updated status, then navigate back
          setTimeout(() => {
            handleBack();
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error refetching maintenance request:', err);
    }
  };

  const handleImageUpload = async (files) => {
    if (!maintenance?.id || !files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      const response = await axiosServices.post(`/api/maintenanceimage/${maintenance.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        openSnackbar({
          open: true,
          message: 'Images uploaded successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refetch maintenance data to get updated images
        const refreshResponse = await axiosServices.get(`/api/maintenance-request/${maintenanceId}`);
        if (refreshResponse.data && refreshResponse.data.success && refreshResponse.data.data) {
          setMaintenance(refreshResponse.data.data);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to upload images');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload images',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleMarkAsResolved = async () => {
    if (!maintenance) return;

    setResolving(true);
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

      // Convert priority to backend enum format
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High'
      };

      const backendPriority = priorityMap[maintenance.priority?.toLowerCase()] || maintenance.priority || 'Medium';

      // Update maintenance request to completed status
      const updatePayload = {
        id: maintenance.id,
        title: maintenance.title || '',
        unitName: maintenance.unitName || '',
        priority: backendPriority,
        status: 'Completed',
        description: maintenance.description || '',
        categoryId: maintenance.categoryId || 0,
        imageUrl: maintenance.imageUrl || '',
        completedAt: new Date().toISOString()
      };

      const response = await axiosServices.put(`/api/maintenance-request/${maintenance.id}`, updatePayload);

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to mark maintenance as resolved');
      }

      openSnackbar({
        open: true,
        message: 'Maintenance request marked as resolved',
        variant: 'alert',
        alert: { color: 'success' }
      });

      // Refetch maintenance data
      const refreshResponse = await axiosServices.get(`/api/maintenance-request/${maintenanceId}`);
      if (refreshResponse.data && refreshResponse.data.success && refreshResponse.data.data) {
        setMaintenance(refreshResponse.data.data);
        // Navigate back after a short delay
        setTimeout(() => {
          handleBack();
        }, 1000);
      }
    } catch (error) {
      console.error('Error marking maintenance as resolved:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to mark maintenance as resolved',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !maintenance) {
    return (
      <Box>
        <Button startIcon={<ArrowLeftOutlined />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to Maintenance Requests
        </Button>
        <Alert severity="error">{error || 'Maintenance request not found'}</Alert>
      </Box>
    );
  }

  const { title, description, priority, status, category, images, createdAt, updatedAt, propertyName, unitName } = maintenance;

  const formatTimeOpen = (createdAt) => {
    if (!createdAt) return 'N/A';
    
    // Handle UTC dates - ensure proper parsing
    let dateStr = String(createdAt).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateStr)) {
      dateStr += 'Z';
    }
    
    const now = moment();
    const created = moment(dateStr);
    const duration = moment.duration(now.diff(created));

    const days = Math.floor(duration.asDays());
    const hours = Math.floor(duration.asHours()) % 24;
    const minutes = Math.floor(duration.asMinutes()) % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);

    return parts.join(', ');
  };

  return (
    <Box sx={{ pb: { xs: 8, md: 0 } }}>
      {/* Header */}
      <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="flex-start" sx={{ mb: { xs: 2, sm: 3 } }}>
        <IconButton onClick={handleBack} sx={{ color: 'primary.main', mt: { xs: -0.5, sm: 0 } }}>
          <ArrowLeftOutlined />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.45rem', sm: '2rem' }, lineHeight: 1.2 }}>
            Maintenance Request Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            View details and status of your maintenance request
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            {/* Request Information */}
            <MainCard
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FileTextOutlined style={{ fontSize: 18, color: '#1877F2' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Request Information
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                        Priority:
                      </Typography>
                      <Chip
                        label={priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'N/A'}
                        color={getPriorityColor(priority)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setEditModalOpen(true)}
                        sx={{
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1)
                          }
                        }}
                        title="Edit Request"
                      >
                        <EditOutlined />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Title
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {title || 'Maintenance Request'}
                  </Typography>
                </Box>

                {description && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Description
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {description}
                    </Typography>
                  </Box>
                )}

                <Divider />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Submitted
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {createdAt ? formatDateAndTime(createdAt) : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Time Open
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {formatTimeOpen(createdAt)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Status
                    </Typography>
                    <Chip
                      label={status === 'in-progress' ? 'In Progress' : status ? status.charAt(0).toUpperCase() + status.slice(1) : 'N/A'}
                      color={getStatusColor(status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Grid>
                </Grid>

                {/* Mark as Resolved Button */}
                {status !== 'completed' && status !== 'cancelled' && (
                  <Box sx={{ pt: 2 }}>
                    <Button
                      variant="contained"
                      color="success"
                      size={isMobile ? 'large' : 'medium'}
                      startIcon={<CheckCircleOutlined />}
                      onClick={handleMarkAsResolved}
                      disabled={resolving}
                      sx={{
                        fontWeight: 600,
                        textTransform: 'none',
                        px: 2,
                        py: 1,
                        width: { xs: '100%', sm: 'auto' }
                      }}
                    >
                      {resolving ? 'Marking as Resolved...' : 'Mark as Resolved'}
                    </Button>
                  </Box>
                )}
              </Stack>
            </MainCard>

            {/* Images */}
            <MainCard
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <PictureOutlined style={{ fontSize: 18, color: '#1877F2' }} />
                    <Typography variant="h6" fontWeight="bold">
                      Images ({images && images.length > 0 ? images.length : 0})
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                </Box>
                {images && images.length > 0 ? (
                  <>
                    <ImageList cols={isMobile ? 1 : 3} gap={8}>
                      {images.map((image, index) => (
                        <ImageListItem key={image.id || index}>
                          <img
                            src={image.blobUrl || image.url || image.blobName || ''}
                            alt={`Maintenance ${index + 1}`}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '200px',
                              objectFit: 'cover',
                              borderRadius: 8,
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(image.blobUrl || image.url || image.blobName, '_blank')}
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<UploadOutlined style={{ fontSize: 14 }} />}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleImageUpload(Array.from(e.target.files));
                          }
                        };
                        input.click();
                      }}
                      disabled={uploadingImages}
                      sx={{
                        color: 'primary.main',
                        textTransform: 'none',
                        alignSelf: 'flex-start',
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08)
                        }
                      }}
                    >
                      {uploadingImages ? 'Uploading...' : 'Upload photo'}
                    </Button>
                  </>
                ) : (
                  <Stack spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No images attached
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<UploadOutlined style={{ fontSize: 14 }} />}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleImageUpload(Array.from(e.target.files));
                          }
                        };
                        input.click();
                      }}
                      disabled={uploadingImages}
                      sx={{
                        color: 'primary.main',
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08)
                        }
                      }}
                    >
                      {uploadingImages ? 'Uploading...' : 'Upload photo'}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </MainCard>
          </Stack>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            {/* Property Information */}
            <MainCard
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <HomeOutlined style={{ fontSize: 18, color: '#1877F2' }} />
                    <Typography variant="h6" fontWeight="bold">
                      Property Information
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                </Box>

                {propertyName && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Property
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {propertyName}
                    </Typography>
                  </Box>
                )}

                {unitName && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Unit
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {unitName}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </MainCard>
          </Stack>
        </Grid>
      </Grid>

      {/* Edit Modal */}
      <TenantMaintenanceEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        maintenance={maintenance}
      />
    </Box>
  );
}

