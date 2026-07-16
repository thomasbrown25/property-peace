import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

// material-ui
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  alpha,
  useTheme,
  Avatar,
  Link,
  Paper,
  styled,
  TextField,
  CircularProgress,
  Card,
  CardContent,
  CardActionArea,
  Chip
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  HomeOutlined,
  CheckCircleFilled
} from '@ant-design/icons';

// project imports
import MainCard from 'components/MainCard';
import { buildImageFromFile } from 'utils/formatters';
import { addMaintenance } from 'store/maintenance/maintenance.action';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import MaintenanceRequestCreatedSuccessDialog from 'components/dialogs/MaintenanceRequestCreatedSuccessDialog';

export default function TenantMaintenanceAddWorkflow() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState('');
  const [leases, setLeases] = useState([]);
  const [selectedLease, setSelectedLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [createdMaintenanceRequest, setCreatedMaintenanceRequest] = useState(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch leases and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all leases for this tenant
        const leasesResponse = await axiosServices.get('/api/lease/tenant/my-leases');
        if (leasesResponse.data && leasesResponse.data.success && leasesResponse.data.data) {
          const allLeases = leasesResponse.data.data;
          setLeases(allLeases);
          // Auto-select if only one lease
          if (allLeases.length === 1) {
            setSelectedLease(allLeases[0]);
          }
        }

        // Fetch categories
        const categoriesResponse = await axiosServices.get('/api/maintenance-request/categories');
        if (categoriesResponse.data && categoriesResponse.data.success && categoriesResponse.data.data) {
          setCategories(categoriesResponse.data.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        openSnackbar({
          open: true,
          message: 'Failed to load information. Please try again.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.Id || user?.id) {
      fetchData();
    }
  }, [user]);

  // Generate title from description
  const generateTitle = (desc) => {
    if (!desc || desc.trim().length === 0) return '';
    const cleaned = desc.trim().replace(/\s+/g, ' ');
    if (cleaned.length <= 60) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    const firstSentence = cleaned.split(/[.!?]/)[0];
    if (firstSentence.length <= 60) {
      return firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
    }
    const truncated = cleaned.substring(0, 57).trim();
    return truncated.charAt(0).toUpperCase() + truncated.slice(1) + '...';
  };

  // AI priority determination based on description
  const determinePriority = (desc) => {
    if (!desc) return 'medium';
    const textToAnalyze = desc.toLowerCase();
    const highPriorityKeywords = [
      'leak', 'leaking', 'flood', 'flooding', 'fire', 'smoke', 'smoking', 'broken',
      'emergency', 'urgent', 'no heat', 'no water', 'no power', 'electrical',
      'gas', 'danger', 'dangerous', 'safety', 'burst', 'overflow', 'sparking',
      'sparks', 'water damage', 'flooded', 'not working', "doesn't work",
      'stopped working', 'fell off', 'broken down', 'critical'
    ];
    const lowPriorityKeywords = [
      'cosmetic', 'minor', 'touch up', 'clean', 'cleaning', 'paint', 'painting',
      'aesthetic', 'routine', 'maintenance', 'preventive', 'preventative',
      'upgrade', 'improvement', 'enhancement', 'optional', 'nice to have'
    ];
    if (highPriorityKeywords.some(k => textToAnalyze.includes(k))) return 'high';
    if (lowPriorityKeywords.some(k => textToAnalyze.includes(k))) return 'low';
    return 'medium';
  };

  // Determine category from description
  const determineCategory = (desc) => {
    if (!desc || !categories || categories.length === 0) {
      return categories?.[0]?.id || null;
    }
    const text = desc.toLowerCase();
    const categoryKeywords = {
      plumbing: ['plumb', 'pipe', 'drain', 'faucet', 'sink', 'toilet', 'shower', 'bathtub', 'water', 'leak', 'leaking', 'dripping', 'clog', 'clogged', 'backup', 'overflow', 'hot water', 'cold water', 'sprinkler', 'pump'],
      electrical: ['electrical', 'electric', 'outlet', 'switch', 'light', 'lighting', 'bulb', 'breaker', 'circuit', 'power', 'wiring', 'fuse', 'spark', 'sparking', 'shock', 'voltage', 'amp', 'telephone', 'phone line'],
      appliances: ['appliance', 'stove', 'oven', 'refrigerator', 'fridge', 'dishwasher', 'washer', 'dryer', 'microwave', 'heating', 'cooling', 'ac', 'air conditioning', 'hvac', 'furnace', 'boiler'],
      household: ['door', 'window', 'lock', 'key', 'closet', 'floor', 'flooring', 'carpet', 'wall', 'ceiling', 'pest', 'bug', 'insect', 'rodent', 'mouse', 'roach', 'ant'],
      exterior: ['roof', 'roofing', 'siding', 'gutter', 'chimney', 'exterior', 'outside', 'outdoor'],
      outdoors: ['landscaping', 'landscape', 'fence', 'fencing', 'pool', 'porch', 'deck', 'parking', 'driveway', 'sidewalk', 'yard', 'lawn', 'garden']
    };
    const categoryScores = {};
    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 1;
      }
      if (score > 0) categoryScores[categoryName] = score;
    }
    let bestCategory = 'general_repair';
    let highestScore = 0;
    for (const [categoryName, score] of Object.entries(categoryScores)) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = categoryName;
      }
    }
    const categoryValueMap = {
      plumbing: 'plumbing',
      electrical: 'electrical',
      appliances: 'general_repair',
      household: 'general_repair',
      exterior: 'general_repair',
      outdoors: 'general_repair'
    };
    const targetValue = categoryValueMap[bestCategory] || 'general_repair';
    const matchedCategory = categories.find(cat => cat.value?.toLowerCase() === targetValue.toLowerCase());
    return matchedCategory?.id || categories[0]?.id || null;
  };

  const getPriorityString = (priority) => {
    const priorityMap = { low: 'low', medium: 'medium', high: 'high' };
    return priorityMap[priority] || 'medium';
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    } else {
      navigate('/tenant/maintenance');
    }
  };

  const handleLeaseNext = () => {
    if (!selectedLease) {
      openSnackbar({
        open: true,
        message: 'Please select a property before continuing.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    setActiveStep(1);
  };

  const handleDescriptionNext = () => {
    if (!description.trim()) {
      openSnackbar({
        open: true,
        message: 'Please describe the issue before continuing.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    setActiveStep(2);
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(buildImageFromFile);
    setImages([...images, ...newImages]);
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedLease) {
      openSnackbar({
        open: true,
        message: 'No property selected. Please go back and select a property.',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    if (!description.trim()) {
      openSnackbar({
        open: true,
        message: 'Please describe the issue before submitting.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedTitle = generateTitle(description);
      const priority = determinePriority(description);
      const categoryId = determineCategory(description);

      if (!categoryId) {
        throw new Error('Failed to determine category. Please try again.');
      }

      const imageFiles = images
        .filter(img => img.file instanceof File)
        .map(img => img.file);

      const payload = {
        propertyId: selectedLease.unit?.propertyId || selectedLease.propertyId || '',
        unitId: selectedLease.unitId || selectedLease.unit?.id || '',
        title: generatedTitle,
        priority: getPriorityString(priority),
        categoryId: categoryId,
        status: 'open',
        description: description.trim()
      };

      const result = await dispatch(addMaintenance(payload, imageFiles));
      const createdRequest = result?.data || result?.payload || null;

      if (createdRequest) {
        setCreatedMaintenanceRequest(createdRequest);
        setSuccessDialogOpen(true);
      } else {
        openSnackbar({
          open: true,
          message: 'Maintenance request submitted, but could not retrieve details.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        navigate('/tenant/maintenance');
      }
    } catch (error) {
      console.error('Error creating maintenance request:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to submit maintenance request',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom StepConnector
  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300] }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  const steps = ['Property', 'Description', 'Images'];

  if (isSubmitting) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          Creating your maintenance request...
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please wait while we submit your request.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!leases.length) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Submit Maintenance Request
          </Typography>
        </Box>
        <MainCard>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
              Lease Not Set Up
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your landlord has not set up the lease yet. Maintenance requests will be available once your landlord creates and assigns a lease to your account.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/tenant/maintenance')}>
              Back to Maintenance
            </Button>
          </Box>
        </MainCard>
      </Box>
    );
  }

  return (
    <Box>
      {/* Back Button and Stepper */}
      <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%' }}>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={handleBack}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            minWidth: 'auto',
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
          }}
        >
          BACK
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <Box sx={{ maxWidth: 600, width: '100%' }}>
            <Stepper activeStep={activeStep} alternativeLabel connector={<CustomStepConnector />}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        </Box>
      </Box>

      {/* Step Content */}
      <MainCard
        sx={{
          maxWidth: 900,
          mx: 'auto',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        {/* Step 0: Select Property / Unit */}
        {activeStep === 0 && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Select a property
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Choose the unit this maintenance request is for.
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
              {leases.map((lease) => {
                const isSelected = selectedLease?.id === lease.id;
                return (
                  <Grid key={lease.id} size={{ xs: 12, sm: 6 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        border: `2px solid ${isSelected ? theme.palette.primary.main : theme.palette.divider}`,
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': {
                          borderColor: theme.palette.primary.main,
                          boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`
                        }
                      }}
                      onClick={() => setSelectedLease(lease)}
                    >
                      {isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            color: 'primary.main',
                            lineHeight: 0
                          }}
                        >
                          <CheckCircleFilled style={{ fontSize: 20 }} />
                        </Box>
                      )}
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar
                            src={lease.propertyImageUrl || undefined}
                            sx={{
                              width: 48,
                              height: 48,
                              bgcolor: alpha(theme.palette.primary.main, 0.12),
                              color: 'primary.main',
                              flexShrink: 0
                            }}
                          >
                            {!lease.propertyImageUrl && <HomeOutlined style={{ fontSize: 22 }} />}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} noWrap>
                              {lease.propertyName || 'Property'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {lease.unitName || 'Unit'}
                            </Typography>
                            <Chip
                              label={lease.isActive ? 'Active' : 'Inactive'}
                              size="small"
                              color={lease.isActive ? 'success' : 'default'}
                              sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={handleLeaseNext}
                disabled={!selectedLease}
                sx={{ textTransform: 'none', minWidth: 120 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 1: Description */}
        {activeStep === 1 && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              What is the issue?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Describe the issue in detail. AI will automatically create a title and set the priority.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 800, mx: 'auto' }}>
              <TextField
                fullWidth
                label="Description *"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                multiline
                rows={8}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1rem',
                    
                  }
                }}
              />

              <Box
                sx={{
                  p: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography variant="body2" color="info.main" sx={{ mt: 0.5 }}>
                    ℹ️
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Provide as much detail as possible. This helps us understand and prioritize your request.
                    AI will automatically generate a title, determine priority, and categorize your request.
                  </Typography>
                </Stack>
              </Box>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleDescriptionNext}
                disabled={!description.trim()}
                sx={{ textTransform: 'none', minWidth: 120 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2: Image Upload + Submit */}
        {activeStep === 2 && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Add photos of the issue
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Upload photos to help us understand the problem better. This step is optional.
            </Typography>

            {/* Upload Area */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    border: `2px dashed ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 200,
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.02)
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'grey.100', color: 'grey.600' }}>
                      <CloudUploadOutlined style={{ fontSize: 32 }} />
                    </Avatar>
                    <Box sx={{ textAlign: 'center', width: '100%' }}>
                      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                        Upload Photos
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Add photos or upload a file
                      </Typography>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        sx={{
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        Choose file
                      </Link>
                    </Box>
                  </Stack>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                </Paper>
              </Grid>
            </Grid>

            {/* Image Previews */}
            {images.length > 0 && (
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {images.map((img, index) => (
                  <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '100%',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                      }}
                    >
                      <Box
                        component="img"
                        src={img?.preview || img?.blobUrl}
                        alt={`Uploaded ${index + 1}`}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <Button
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          minWidth: 'auto',
                          width: 32,
                          height: 32,
                          bgcolor: 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' }
                        }}
                      >
                        ×
                      </Button>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Submit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isSubmitting}
                sx={{ textTransform: 'none', minWidth: 200 }}
                startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {isSubmitting ? 'Creating Request...' : 'Create Request'}
              </Button>
            </Box>
          </Box>
        )}
      </MainCard>

      {/* Success Dialog */}
      <MaintenanceRequestCreatedSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false);
          setCreatedMaintenanceRequest(null);
          navigate('/tenant/maintenance');
        }}
        maintenanceRequest={createdMaintenanceRequest}
        propertyName={selectedLease?.unit?.propertyName || selectedLease?.propertyName}
        unitName={selectedLease?.unit?.name || selectedLease?.unitName}
      />
    </Box>
  );
}
