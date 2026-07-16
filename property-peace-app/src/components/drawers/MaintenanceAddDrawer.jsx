import { useState, useRef, useEffect, useMemo } from 'react';
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
  TextField,
  CircularProgress,
  LinearProgress,
  Chip,
  Divider,
  Drawer,
  IconButton,
  styled,
  Paper
} from '@mui/material';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  CloseOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { buildImageFromFile } from 'utils/formatters';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { selectMaintenanceCategories } from 'store/maintenance/maintenance.selector';
import {
  addMaintenance,
  analyzeMaintenanceRequest,
  getMaintenanceCategories
} from 'store/maintenance/maintenance.action';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import { useDrawer } from 'contexts/DrawerContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';

const STEPS = ['Property & Unit', 'Description', 'Images', 'Review'];
const DRAWER_WIDTH = 520;

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main },
  [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300], borderTopWidth: 2, borderRadius: 1 }
}));

const getPriorityColor = (p) => {
  const l = p?.toLowerCase();
  if (l === 'high') return 'error';
  if (l === 'medium') return 'warning';
  return 'info';
};

const getPriorityLabel = (p) => {
  const l = p?.toLowerCase();
  if (l === 'high') return 'High';
  if (l === 'medium') return 'Medium';
  return 'Low';
};

const getCategoryDisplayName = (value) => {
  if (!value) return 'Not specified';
  const map = {
    appliances: 'Appliances', electrical: 'Electrical', exterior: 'Exterior',
    general_repair: 'General Repair', household: 'Household', outdoors: 'Outdoors', plumbing: 'Plumbing'
  };
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
};

const MaintenanceAddDrawer = ({ onAddSuccess }) => {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const theme = useTheme();

  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const categories = useSelector(selectMaintenanceCategories) || [];

  const isMultiUnitProperty = selectedProperty &&
    (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit');

  // Step state
  const [activeStep, setActiveStep] = useState(0);
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [images, setImages] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', categoryId: '', category: '', priority: 'medium' });
  const [editImages, setEditImages] = useState([]);
  const fileInputRef = useRef(null);
  const editModalFileInputRef = useRef(null);

  // Reset when drawer closes
  useEffect(() => {
    if (!drawer.isOpenMaintenanceAdd) {
      setActiveStep(0);
      setDescription('');
      setScheduledDate('');
      setImages([]);
      setIsCreating(false);
      setIsComplete(false);
      setIsAnalyzing(false);
      setAiAnalysis(null);
      setAnalysisError(null);
      setReviewOverrides({});
    }
  }, [drawer.isOpenMaintenanceAdd]);

  // Fetch AI analysis when reaching review step
  useEffect(() => {
    if (activeStep === 3 && !aiAnalysis && !isAnalyzing && !analysisError) {
      analyzeWithAI();
    }
  }, [activeStep]);

  useEffect(() => {
    if (activeStep === 3) dispatch(getMaintenanceCategories());
  }, [activeStep, dispatch]);

  const analyzeWithAI = async () => {
    if (!description.trim()) {
      setAnalysisError('Description is required for AI analysis');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await dispatch(analyzeMaintenanceRequest('', description));
      if (result?.success && result?.data) {
        setAiAnalysis(result.data);
      } else {
        setAnalysisError(result?.message || 'Failed to analyze maintenance request');
      }
    } catch (error) {
      setAnalysisError(error?.message || 'Failed to analyze maintenance request');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !selectedProperty?.id) {
      openSnackbar({ open: true, message: 'Please select a property', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    if (activeStep === 1 && !description.trim()) {
      openSnackbar({ open: true, message: 'Please enter a description', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    if (activeStep < STEPS.length - 1) setActiveStep(s => s + 1);
  };

  const handleBack = () => {
    if (activeStep === 3) { setAiAnalysis(null); setAnalysisError(null); }
    if (activeStep > 0) setActiveStep(s => s - 1);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files.map(buildImageFromFile)]);
  };

  const handleRemoveImage = (index) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleOpenEditModal = () => {
    setEditForm({
      title: reviewOverrides.title ?? aiAnalysis?.title ?? '',
      description,
      categoryId: reviewOverrides.categoryId ?? aiAnalysis?.categoryId ?? '',
      category: reviewOverrides.category ?? aiAnalysis?.categoryName ?? aiAnalysis?.category ?? '',
      priority: (reviewOverrides.priority ?? aiAnalysis?.priority ?? 'medium').toLowerCase()
    });
    setEditImages([...images]);
    setEditModalOpen(true);
  };

  const handleSaveEditModal = () => {
    if (!editForm.title?.trim()) {
      openSnackbar({ open: true, message: 'Title is required', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    const selectedCategory = categories.find(c => String(c.id) === String(editForm.categoryId));
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

  const handleCreate = async () => {
    if (!selectedProperty?.id || !description.trim()) {
      openSnackbar({ open: true, message: 'Please select a property and enter a description', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    if (!aiAnalysis) {
      openSnackbar({ open: true, message: 'Please wait for AI analysis to complete', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    setIsCreating(true);
    try {
      const imageFiles = images.filter(img => img.file instanceof File).map(img => img.file);
      const payload = {
        propertyId: selectedProperty.id,
        title: reviewOverrides.title ?? aiAnalysis?.title ?? 'Maintenance Request',
        unitId: selectedUnit?.id ? String(selectedUnit.id) : '',
        priority: (reviewOverrides.priority ?? aiAnalysis?.priority ?? 'medium').toLowerCase(),
        categoryId: reviewOverrides.categoryId ?? aiAnalysis?.categoryId,
        description: description.trim(),
        scheduledDate: scheduledDate || null
      };
      const result = await dispatch(addMaintenance(payload, imageFiles));
      if (result?.success) {
        setIsComplete(true);
        openSnackbar({ open: true, message: 'Maintenance request created successfully', variant: 'alert', alert: { color: 'success' } });
        if (onAddSuccess) await onAddSuccess();
      }
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || error?.message || 'Failed to create request', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setIsComplete(false);
    setActiveStep(0);
    setDescription('');
    setImages([]);
    setAiAnalysis(null);
    setAnalysisError(null);
    setReviewOverrides({});
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  };

  const handleClose = () => {
    drawer.closeMaintenanceAddDrawer();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Property *</Typography>
              <PropertySelect width="100%" disableAllOption label="" />
            </Box>
            {isMultiUnitProperty && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Unit</Typography>
                <UnitSelect width="100%" />
              </Box>
            )}
            {selectedProperty && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <HomeOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Selected</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedProperty.name}{selectedUnit ? ` — ${selectedUnit.name}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Describe the issue in detail. AI will generate a title, category, and priority from your description.
            </Typography>
            <TextField
              fullWidth
              label="Description *"
              multiline
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the maintenance issue in detail..."
              sx={{  }}
            />
            <TextField
              fullWidth
              label="Schedule date (optional)"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: new Date().toISOString().split('T')[0] } }}
              helperText="Only set this if you have a specific date planned — scheduled requests will appear on the calendar."
              sx={{  }}
            />
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3} alignItems="center">
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Optionally upload photos of the issue to help with diagnosis.
            </Typography>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            <Button
              variant="outlined"
              startIcon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', borderRadius: 2, py: 1.5, px: 3 }}
            >
              Upload Images
            </Button>
            {images.length > 0 && (
              <Grid container spacing={1.5} sx={{ width: '100%' }}>
                {images.map((img, index) => (
                  <Grid item xs={6} sm={4} key={index}>
                    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
                      <Box component="img" src={img?.preview || img?.blobUrl} alt={`img-${index}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveImage(index)}
                        sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', width: 24, height: 24, '&:hover': { bgcolor: 'background.paper' } }}
                      >
                        <CloseOutlined style={{ fontSize: 10 }} />
                      </IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        );

      case 3:
        return (
          <Box sx={{ position: 'relative', minHeight: 300 }}>
            {/* AI loading overlay */}
            {isAnalyzing && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: alpha(theme.palette.background.paper, 0.92), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 2 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>AI is analyzing your request…</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Generating title, category, and priority</Typography>
                <Box sx={{ width: 240 }}><LinearProgress /></Box>
              </Box>
            )}

            {/* AI error overlay */}
            {analysisError && !isAnalyzing && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: alpha(theme.palette.background.paper, 0.95), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 2, p: 3 }}>
                <ExclamationCircleOutlined style={{ fontSize: 40, color: theme.palette.error.main, marginBottom: 12 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Analysis Failed</Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>{analysisError}</Typography>
                <Button variant="contained" onClick={analyzeWithAI} sx={{ textTransform: 'none', px: 3 }}>Try Again</Button>
              </Box>
            )}

            {!isComplete ? (
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>Review & Create</Typography>
                  <IconButton size="small" color="primary" onClick={handleOpenEditModal} disabled={!aiAnalysis}>
                    <EditOutlined style={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>

                <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>PROPERTY</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                      {selectedProperty?.name || '—'}
                      {isMultiUnitProperty && selectedUnit ? ` — ${selectedUnit.name}` : ''}
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>TITLE</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                      {reviewOverrides.title ?? aiAnalysis?.title ?? '—'}
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>DESCRIPTION</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{description}</Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>CATEGORY</Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                          {getCategoryDisplayName(reviewOverrides.category ?? aiAnalysis?.categoryName ?? aiAnalysis?.category)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>PRIORITY</Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={getPriorityLabel(reviewOverrides.priority ?? aiAnalysis?.priority)}
                            color={getPriorityColor(reviewOverrides.priority ?? aiAnalysis?.priority)}
                            size="small"
                          />
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {images.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>IMAGES ({images.length})</Typography>
                      <Grid container spacing={1} sx={{ mt: 0.5 }}>
                        {images.map((img, index) => (
                          <Grid item xs={4} key={index}>
                            <Box sx={{ borderRadius: 1, overflow: 'hidden', aspectRatio: '1', border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
                              <Box component="img" src={img?.preview || img?.blobUrl} alt={`img-${index}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                <CheckCircleOutlined style={{ fontSize: 56, color: theme.palette.success.main }} />
                <Typography variant="h6" fontWeight={700}>Request Created!</Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Your maintenance request has been successfully created.
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                  <Button variant="outlined" onClick={handleReset} sx={{ textTransform: 'none', px: 2.5 }}>
                    Add Another
                  </Button>
                  <Button variant="contained" onClick={handleClose} sx={{ textTransform: 'none', px: 2.5 }}>
                    Done
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={drawer.isOpenMaintenanceAdd}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: DRAWER_WIDTH },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper'
          }
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex' }}>
              <FileTextOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700}>New Maintenance Request</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
            <CloseOutlined style={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Stepper */}
        {!isComplete && (
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, bgcolor: 'background.paper', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`, flexShrink: 0 }}>
            <Stepper activeStep={activeStep} alternativeLabel connector={<CustomStepConnector />}>
              {STEPS.map((label, index) => (
                <Step key={label} completed={index < activeStep}>
                  <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem' } }}>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, bgcolor: 'background.paper' }}>
          {renderStepContent()}
        </Box>

        {/* Footer navigation */}
        {!isComplete && (
          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              bgcolor: 'background.paper',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <Button
              onClick={handleBack}
              disabled={activeStep === 0 || isCreating || isAnalyzing}
              startIcon={<ArrowLeftOutlined />}
              sx={{ textTransform: 'none', px: 2.5 }}
            >
              Back
            </Button>
            <Typography variant="caption" color="text.secondary">
              Step {activeStep + 1} of {STEPS.length}
            </Typography>
            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{ textTransform: 'none', px: 2.5 }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={isCreating || isAnalyzing || !aiAnalysis}
                startIcon={isCreating ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <CheckCircleOutlined style={{ fontSize: 14 }} />}
                sx={{ textTransform: 'none', px: 2.5 }}
              >
                {isCreating ? 'Creating…' : 'Create Request'}
              </Button>
            )}
          </Box>
        )}
      </Drawer>

      {/* Edit overrides modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Title *" value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))} />
            <TextField fullWidth multiline rows={4} label="Description" value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={editForm.categoryId}
                label="Category"
                onChange={(e) => {
                  const cat = categories.find(c => String(c.id) === String(e.target.value));
                  setEditForm(p => ({ ...p, categoryId: e.target.value, category: cat?.value ?? cat?.name ?? '' }));
                }}
              >
                {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.value || c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select value={editForm.priority} label="Priority" onChange={(e) => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                <MenuItem value="low"><Chip label="Low" color="info" size="small" /></MenuItem>
                <MenuItem value="medium"><Chip label="Medium" color="warning" size="small" /></MenuItem>
                <MenuItem value="high"><Chip label="High" color="error" size="small" /></MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEditModal}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

MaintenanceAddDrawer.propTypes = {
  onAddSuccess: PropTypes.func
};

export default MaintenanceAddDrawer;
