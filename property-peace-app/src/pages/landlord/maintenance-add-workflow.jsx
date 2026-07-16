import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  Card,
  CardContent,
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
  LinearProgress,
  Chip,
  Divider,
  Slide
} from '@mui/material';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
  EditOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { buildImageFromFile } from 'utils/formatters';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { addMaintenance, analyzeMaintenanceRequest, getMaintenanceCategories } from 'store/maintenance/maintenance.action';
import { selectMaintenanceCategories } from 'store/maintenance/maintenance.selector';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';

const steps = ['Property & Unit', 'Details', 'Images', 'Review'];

export default function MaintenanceAddWorkflow() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const [activeStep, setActiveStep] = useState(0);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [createdMaintenanceRequest, setCreatedMaintenanceRequest] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reviewOverrides, setReviewOverrides] = useState({}); // { title, categoryId, category, priority }
  const fileInputRef = useRef(null);
  const editModalFileInputRef = useRef(null);

  const categories = useSelector(selectMaintenanceCategories) || [];

  // Check if selected property is multi-unit
  const isMultiUnitProperty = selectedProperty && 
    (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit');

  // Custom StepConnector
  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.grey[300]
      }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  // Analyze with AI when reaching review step
  useEffect(() => {
    if (activeStep === 3 && !aiAnalysis && !isAnalyzing && !analysisError) {
      analyzeWithAI();
    }
  }, [activeStep]);

  // Fetch maintenance categories when on review step (for edit modal)
  useEffect(() => {
    if (activeStep === 3) {
      dispatch(getMaintenanceCategories());
    }
  }, [activeStep, dispatch]);

  const analyzeWithAI = async () => {
    if (!description.trim()) {
      setAnalysisError('Description is required for AI analysis');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Pass empty title - AI will generate it from description
      const result = await dispatch(analyzeMaintenanceRequest('', description));
      
      if (result?.success && result?.data) {
        setAiAnalysis(result.data);
      } else {
        setAnalysisError(result?.message || 'Failed to analyze maintenance request');
      }
    } catch (error) {
      console.error('Error analyzing maintenance request:', error);
      setAnalysisError(error?.message || 'Failed to analyze maintenance request');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setActiveStep(newStep);
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }, 50);
  };

  const handleBack = () => {
    if (activeStep > 0) {
      // Reset AI analysis when going back from review step
      if (activeStep === 3) {
        setAiAnalysis(null);
        setAnalysisError(null);
      }
      transitionToStep(activeStep - 1, 'right');
    } else {
      navigate('/landlord/maintenances');
    }
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (activeStep === 0) {
      if (!selectedProperty?.id) {
        openSnackbar({
          open: true,
          message: 'Please select a property',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    } else if (activeStep === 1) {
      if (!description.trim()) {
        openSnackbar({
          open: true,
          message: 'Please enter a description',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    }

    if (activeStep < steps.length - 1) {
      transitionToStep(activeStep + 1, 'left');
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(buildImageFromFile);
    setImages([...images, ...newImages]);
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Edit modal: form state (initialized when opening)
  const [editForm, setEditForm] = useState({ title: '', description: '', categoryId: '', category: '', priority: 'medium' });
  const [editImages, setEditImages] = useState([]);

  const handleOpenEditModal = () => {
    const effectiveTitle = reviewOverrides.title ?? aiAnalysis?.title ?? 'Maintenance Request';
    const effectiveCategoryId = reviewOverrides.categoryId ?? aiAnalysis?.categoryId;
    const effectiveCategory = reviewOverrides.category ?? aiAnalysis?.categoryName ?? aiAnalysis?.category ?? '';
    const effectivePriority = (reviewOverrides.priority ?? aiAnalysis?.priority ?? 'medium').toLowerCase();
    setEditForm({
      title: effectiveTitle,
      description: description,
      categoryId: effectiveCategoryId ?? '',
      category: effectiveCategory,
      priority: effectivePriority
    });
    setEditImages([...images]);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
  };

  const handleEditModalImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(buildImageFromFile);
    setEditImages((prev) => [...prev, ...newImages]);
  };

  const handleEditModalRemoveImage = (index) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEditModal = () => {
    if (!editForm.title?.trim()) {
      openSnackbar({ open: true, message: 'Title is required', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    const selectedCategory = categories.find((c) => String(c.id) === String(editForm.categoryId));
    const categoryName = selectedCategory?.value ?? selectedCategory?.name ?? editForm.category;
    setReviewOverrides({
      title: editForm.title.trim(),
      categoryId: selectedCategory?.id ?? editForm.categoryId,
      category: categoryName,
      priority: editForm.priority
    });
    setDescription(editForm.description);
    setImages(editImages);
    setEditModalOpen(false);
  };

  // Map priority from backend format to display format
  const getPriorityColor = (priority) => {
    const priorityLower = priority?.toLowerCase();
    if (priorityLower === 'high') return 'error';
    if (priorityLower === 'medium') return 'warning';
    return 'info';
  };

  const getPriorityLabel = (priority) => {
    const priorityLower = priority?.toLowerCase();
    if (priorityLower === 'high') return 'High';
    if (priorityLower === 'medium') return 'Medium';
    return 'Low';
  };

  const getCategoryDisplayName = (value) => {
    if (!value) return 'Not specified';
    const map = {
      appliances: 'Appliances',
      electrical: 'Electrical',
      exterior: 'Exterior',
      general_repair: 'General Repair',
      household: 'Household',
      outdoors: 'Outdoors',
      plumbing: 'Plumbing'
    };
    return map[value] ?? (value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '));
  };

  const handleCreateRequest = async () => {
    if (!selectedProperty?.id || !description.trim()) {
      openSnackbar({
        open: true,
        message: 'Please select a property and enter a description',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    if (!aiAnalysis) {
      openSnackbar({
        open: true,
        message: 'Please wait for AI analysis to complete',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setIsCreating(true);

    try {
      // Prepare images - extract File objects from image objects
      const imageFiles = images
        .filter(img => img.file instanceof File)
        .map(img => img.file);

      // Prepare payload: use review overrides if set (from edit modal), else AI analysis
      const effectiveTitle = reviewOverrides.title ?? aiAnalysis?.title ?? 'Maintenance Request';
      const effectivePriority = (reviewOverrides.priority ?? aiAnalysis?.priority ?? 'medium').toString().toLowerCase();
      const effectiveCategoryId = reviewOverrides.categoryId ?? aiAnalysis?.categoryId;
      const payload = {
        propertyId: selectedProperty.id,
        title: effectiveTitle,
        unitId: selectedUnit?.id ? String(selectedUnit.id).trim() : '',
        priority: effectivePriority,
        categoryId: effectiveCategoryId,
        status: 'open',
        description: (description || '').trim()
      };

      const result = await dispatch(addMaintenance(payload, imageFiles));
      
      if (result?.success) {
        // Store the created request data
        setCreatedMaintenanceRequest(result?.data || null);
        setIsCreating(false);
        setIsComplete(true);
        
        openSnackbar({
          open: true,
          message: 'Maintenance request created successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      }
    } catch (error) {
      console.error('Error creating maintenance request:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to create maintenance request',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setIsCreating(false);
      setIsComplete(false);
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} sx={{ mb: 4, textAlign: 'center' }}>
              What is the property & Unit that is having the issue?
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto', textAlign: 'left' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Property *
                </Typography>
                <PropertySelect width="100%" disableAllOption />
              </Box>

              {isMultiUnitProperty && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Unit
                  </Typography>
                  <UnitSelect width="100%" />
                </Box>
              )}
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} sx={{ mb: 1, textAlign: 'center' }}>
              What is the issue that is happening?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Provide details about the maintenance request. AI will generate a title based on your description.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto', textAlign: 'left' }}>
              <TextField
                fullWidth
                label="Description *"
                multiline
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the maintenance issue in detail..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Stack>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} sx={{ mb: 4, textAlign: 'center' }}>
              Would you like to add any images of the issue?
            </Typography>
            {/* Images step content - keeping existing implementation */}
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadOutlined />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  mb: 3,
                  textTransform: 'none',
                  borderRadius: 2,
                  py: 1.5,
                  px: 3
                }}
              >
                Upload Images
              </Button>

              {images.length > 0 && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {images.map((img, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        }}
                      >
                        <Box
                          component="img"
                          src={img?.preview || img?.blobUrl}
                          alt={`Uploaded ${index + 1}`}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRemoveImage(index)}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            minWidth: 'auto',
                            width: 32,
                            height: 32,
                            borderRadius: '50%'
                          }}
                        >
                          ×
                        </Button>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ textAlign: 'center', position: 'relative' }}>
            {/* Loading Overlay for AI Analysis */}
            {isAnalyzing && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: alpha(theme.palette.background.paper, 0.9),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  borderRadius: 2
                }}
              >
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  AI is analyzing your request...
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Generating title, category, and priority
                </Typography>
                <Box sx={{ width: '100%', maxWidth: 300 }}>
                  <LinearProgress />
                </Box>
                <Stack spacing={1} sx={{ textAlign: 'center', px: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    This may take a few moments
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Error Overlay */}
            {analysisError && !isAnalyzing && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: alpha(theme.palette.background.paper, 0.95),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  borderRadius: 2,
                  p: 3
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3
                  }}
                >
                  <ExclamationCircleOutlined style={{ fontSize: 40, color: theme.palette.error.main }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  Analysis Failed
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                  {analysisError}
                </Typography>
                <Button
                  variant="contained"
                  onClick={analyzeWithAI}
                  sx={{ textTransform: 'none', px: 3 }}
                >
                  Try Again
                </Button>
              </Box>
            )}

            {!isComplete ? (
              <>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="h4" fontWeight={700} sx={{ textAlign: 'center' }}>
                    Review & Create
                  </Typography>
                  <IconButton
                    color="primary"
                    onClick={handleOpenEditModal}
                    disabled={!aiAnalysis}
                    title="Edit all fields"
                    sx={{ mt: 0.5, pl: 1.5 }}
                  >
                    <EditOutlined />
                  </IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
                  Review your maintenance request details and AI analysis before creating.
                </Typography>

                {/* Error Message */}
                {analysisError && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ExclamationCircleOutlined style={{ color: theme.palette.error.main }} />
                      <Typography variant="body2" color="error">
                        {analysisError}
                      </Typography>
                    </Stack>
                  </Box>
                )}

                {/* Review Content - all details displayed */}
                <Stack spacing={3} sx={{ maxWidth: 700, mx: 'auto', textAlign: 'left', mb: 4 }}>
                  {/* Property & Unit */}
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Property & Unit
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedProperty?.name || 'No property selected'}
                      </Typography>
                      {isMultiUnitProperty && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Unit: {selectedUnit ? selectedUnit.name : 'None selected'}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>

                  {/* Title */}
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Title
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {reviewOverrides.title ?? aiAnalysis?.title ?? 'Maintenance Request'}
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Description */}
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Description
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ whiteSpace: 'pre-wrap' }}>
                        {description || 'No description'}
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Category & Priority */}
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Category
                          </Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {isAnalyzing
                              ? 'Analyzing…'
                              : getCategoryDisplayName(reviewOverrides.category ?? aiAnalysis?.categoryName ?? aiAnalysis?.category)}
                          </Typography>
                        </Box>
                        <Divider />
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Priority
                          </Typography>
                          <Chip
                            label={getPriorityLabel(reviewOverrides.priority ?? aiAnalysis?.priority)}
                            color={getPriorityColor(reviewOverrides.priority ?? aiAnalysis?.priority)}
                            size="small"
                          />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* Images */}
                  {images.length > 0 && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                          Images ({images.length})
                        </Typography>
                        <Grid container spacing={2}>
                          {images.map((img, index) => (
                            <Grid item xs={6} sm={4} key={index}>
                              <Box
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  aspectRatio: '1',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                                }}
                              >
                                <Box
                                  component="img"
                                  src={img?.preview || img?.blobUrl}
                                  alt={`Uploaded ${index + 1}`}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </CardContent>
                    </Card>
                  )}
                </Stack>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleOutlined
                  style={{
                    fontSize: 48,
                    color: theme.palette.success.main
                  }}
                />
                <Stack spacing={1} sx={{ textAlign: 'center', px: 2, mb: 4 }}>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    Request Created!
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Your maintenance request has been successfully created.
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setIsComplete(false);
                      setActiveStep(0);
                      setDescription('');
                      setImages([]);
                      setAiAnalysis(null);
                      setAnalysisError(null);
                      setReviewOverrides({});
                      setCreatedMaintenanceRequest(null);
                      dispatch(setProperty(null));
                      dispatch(setUnit(null));
                    }}
                    sx={{ textTransform: 'none', px: 3 }}
                  >
                    Add Another Request
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/landlord/maintenances')}
                    sx={{ textTransform: 'none', px: 3 }}
                  >
                    View All Maintenances
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <PageBreadcrumbs links={[{ title: 'Maintenances', to: '/landlord/maintenances' }, { title: 'Add Maintenance Request' }]} />

      <MainCard
        sx={{
          mt: 3,
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Step Indicators */}
        {!isComplete && (
          <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%', px: 3, pt: 2, display: { xs: 'none', sm: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <Box sx={{ maxWidth: 800, width: '100%' }}>
                <Stepper 
                  activeStep={activeStep} 
                  alternativeLabel
                  connector={<CustomStepConnector />}
                >
                  {steps.map((label, index) => (
                    <Step key={label} completed={index < activeStep}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '500px'
        }}>
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 6,
            px: 3,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px'
          }}>
            <Box sx={{ width: '100%', maxWidth: '800px', position: 'relative' }}>
              <Slide
                direction={slideDirection}
                in={true}
                timeout={600}
                mountOnEnter
                unmountOnExit
                key={activeStep}
              >
                <Box>
                  {renderStep()}
                </Box>
              </Slide>
            </Box>
          </Box>

          {/* Navigation Buttons */}
          {!isComplete && (
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 'auto',
              pt: 4,
              pb: 2,
              px: 3,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
            }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0 || isCreating || isAnalyzing}
                startIcon={<ArrowLeftOutlined />}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleCreateRequest}
                  disabled={!aiAnalysis || isCreating || isAnalyzing}
                  sx={{ textTransform: 'none', px: 4, py: 1 }}
                >
                  Create Request
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={isCreating || isAnalyzing}
                  sx={{ textTransform: 'none', px: 4, py: 1 }}
                >
                  Next
                </Button>
              )}
            </Box>
          )}
        </Box>
      </MainCard>

      {/* Edit modal: edit all fields before creating */}
      <Dialog open={editModalOpen} onClose={handleCloseEditModal} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle>Edit maintenance request</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Property *
              </Typography>
              <PropertySelect width="100%" disableAllOption />
            </Box>
            {isMultiUnitProperty && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Unit
                </Typography>
                <UnitSelect width="100%" />
              </Box>
            )}
            <TextField
              fullWidth
              label="Title *"
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Leaky faucet in kitchen"
            />
            <TextField
              fullWidth
              label="Description *"
              multiline
              rows={4}
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the maintenance issue..."
            />
            <FormControl fullWidth>
              <InputLabel id="edit-category-label">Category</InputLabel>
              <Select
                labelId="edit-category-label"
                label="Category"
                value={editForm.categoryId ?? ''}
                onChange={(e) => {
                  const cat = categories.find((c) => String(c.id) === String(e.target.value));
                  setEditForm((prev) => ({
                    ...prev,
                    categoryId: cat?.id ?? e.target.value,
                    category: cat?.value ?? cat?.name ?? prev.category
                  }));
                }}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.label ?? getCategoryDisplayName(cat.value ?? cat.name) ?? String(cat.id)}
                  </MenuItem>
                ))}
                {categories.length === 0 && (
                  <MenuItem value={editForm.categoryId || aiAnalysis?.categoryId}>
                    {editForm.category || aiAnalysis?.categoryName || aiAnalysis?.category || 'Select category'}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="edit-priority-label">Priority</InputLabel>
              <Select
                labelId="edit-priority-label"
                label="Priority"
                value={editForm.priority}
                onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.value }))}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Images
              </Typography>
              <input
                ref={editModalFileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleEditModalImageUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUploadOutlined />}
                onClick={() => editModalFileInputRef.current?.click()}
                sx={{ mb: 2, textTransform: 'none' }}
              >
                Upload Images
              </Button>
              {editImages.length > 0 && (
                <Grid container spacing={1}>
                  {editImages.map((img, index) => (
                    <Grid item xs={6} sm={4} key={index}>
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        }}
                      >
                        <Box
                          component="img"
                          src={img?.preview || img?.blobUrl}
                          alt={`Upload ${index + 1}`}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleEditModalRemoveImage(index)}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            minWidth: 'auto',
                            width: 28,
                            height: 28,
                            borderRadius: '50%'
                          }}
                        >
                          ×
                        </Button>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseEditModal} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEditModal} sx={{ textTransform: 'none' }}>
            Save changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
