import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  alpha,
  useTheme,
  TextField,
  CircularProgress,
  Chip,
  IconButton,
  styled,
  Paper
} from '@mui/material';
import {
  CloseOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  HomeOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { addMaintenance, analyzeMaintenanceRequest } from 'store/maintenance/maintenance.action';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';

const STEPS = ['Property', 'Description', 'Photos', 'Review & Submit'];
const DRAWER_WIDTH = 500;

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

const getCategoryDisplayName = (value) => {
  if (!value) return 'Not specified';
  const map = {
    appliances: 'Appliances', electrical: 'Electrical', exterior: 'Exterior',
    general_repair: 'General Repair', household: 'Household', outdoors: 'Outdoors', plumbing: 'Plumbing'
  };
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
};

export default function TenantMaintenanceFormDrawer({ open, onClose, onRequestCreated, unitId }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const fileInputRef = useRef(null);

  const [activeStep, setActiveStep] = useState(0);
  const [leases, setLeases] = useState([]);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // Fetch leases when drawer opens
  useEffect(() => {
    if (!open) return;
    setLoadingLeases(true);
    axiosServices.get('/api/lease/tenant/my-leases')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          const all = res.data.data;
          setLeases(all);
          if (unitId) {
            const match = all.find((l) => l.unitId === unitId);
            if (match) setSelectedLease(match);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLeases(false));
  }, [open, unitId]);

  const reset = () => {
    setActiveStep(0);
    setSelectedLease(null);
    setDescription('');
    setImages([]);
    setIsAnalyzing(false);
    setIsCreating(false);
    setIsComplete(false);
    setAiAnalysis(null);
    setAnalysisError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setImages((prev) => [...prev, ...mapped]);
    e.target.value = '';
  };

  const handleImageRemove = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 2 → 3: run AI analysis
  const handleNext = async () => {
    if (activeStep === 2) {
      setIsAnalyzing(true);
      setAnalysisError(null);
      try {
        const result = await dispatch(analyzeMaintenanceRequest('', description));
        if (result) setAiAnalysis(result);
      } catch {
        setAnalysisError('AI analysis unavailable — you can still submit.');
      } finally {
        setIsAnalyzing(false);
        setActiveStep(3);
      }
    } else {
      setActiveStep((s) => s + 1);
    }
  };

  const handleBack = () => setActiveStep((s) => s - 1);

  const handleSubmit = async () => {
    setIsCreating(true);
    try {
      const payload = {
        propertyId: selectedLease?.propertyId ?? null,
        unitId: selectedLease?.unitId ?? null,
        title: aiAnalysis?.title || description.slice(0, 80),
        description,
        priority: aiAnalysis?.priority || 'low',
        categoryId: aiAnalysis?.categoryId ?? null
      };
      await dispatch(addMaintenance(payload, images));
      setIsComplete(true);
      openSnackbar({ open: true, message: 'Maintenance request submitted.', variant: 'alert', alert: { color: 'success' } });
      onRequestCreated?.();
    } catch {
      openSnackbar({ open: true, message: 'Failed to submit request. Please try again.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setIsCreating(false);
    }
  };

  const canAdvance =
    activeStep === 0 ? !!selectedLease :
    activeStep === 1 ? description.trim().length >= 10 :
    true;

  const isSingleFamily = selectedLease?.propertyType?.toLowerCase() === 'singlefamily';

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', backgroundImage: 'none' } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography variant="h5" fontWeight={600}>Submit Maintenance Request</Typography>
        <IconButton size="small" onClick={handleClose}><CloseOutlined /></IconButton>
      </Box>

      {/* Stepper */}
      {!isComplete && (
        <Box sx={{ px: 3, pt: 2.5, pb: 1, flexShrink: 0 }}>
          <Stepper activeStep={activeStep} connector={<CustomStepConnector />} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>

        {/* ── Complete ── */}
        {isComplete && (
          <Stack alignItems="center" spacing={2} sx={{ pt: 6, textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 52, color: theme.palette.success.main }} />
            <Typography variant="h4" fontWeight={700}>Request Submitted</Typography>
            <Typography variant="body2" color="text.secondary">
              Your maintenance request has been submitted. Your landlord has been notified and will follow up shortly.
            </Typography>
            <Button variant="contained" onClick={handleClose} sx={{ mt: 2, px: 3 }}>
              Done
            </Button>
          </Stack>
        )}

        {/* ── Step 0: Property ── */}
        {!isComplete && activeStep === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Select the property this request is for.
            </Typography>
            {loadingLeases ? (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : leases.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No active leases found.</Typography>
            ) : (
              leases.map((lease) => {
                const isSelected = selectedLease?.id === lease.id;
                const sf = lease.propertyType?.toLowerCase() === 'singlefamily';
                return (
                  <Paper
                    key={lease.id}
                    variant="outlined"
                    onClick={() => setSelectedLease(lease)}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      borderRadius: 2,
                      borderColor: isSelected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3),
                      borderWidth: isSelected ? 2 : 1,
                      bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex' }}>
                        <HomeOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {lease.propertyName || 'Property'}
                        </Typography>
                        {lease.unitName && !sf && (
                          <Typography variant="caption" color="text.secondary">Unit {lease.unitName}</Typography>
                        )}
                      </Box>
                      {isSelected && (
                        <CheckCircleOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                      )}
                    </Stack>
                  </Paper>
                );
              })
            )}
          </Stack>
        )}

        {/* ── Step 1: Description ── */}
        {!isComplete && activeStep === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Describe the issue in as much detail as you can. What is broken, where is it located, and when did it start?
            </Typography>
            <TextField
              label="Describe the issue"
              multiline
              rows={6}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. The kitchen faucet has been dripping constantly for the past two days. It's the hot water handle under the sink."
              helperText={`${description.length} characters — minimum 10`}
              sx={{ '& .MuiOutlinedInput-root': {  } }}
            />
          </Stack>
        )}

        {/* ── Step 2: Photos ── */}
        {!isComplete && activeStep === 2 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Add photos to help your landlord understand the issue. This step is optional.
            </Typography>

            <Button
              variant="outlined"
              startIcon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderRadius: 2, borderStyle: 'dashed', py: 1.5, textTransform: 'none' }}
            >
              Add Photos
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageAdd} />

            {images.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1.5}>
                {images.map((img, i) => (
                  <Box key={i} sx={{ position: 'relative', width: 90, height: 90, borderRadius: 2, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
                    <img src={img.preview} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <IconButton
                      size="small"
                      onClick={() => handleImageRemove(i)}
                      sx={{ position: 'absolute', top: 2, right: 2, bgcolor: alpha('#000', 0.5), color: '#fff', p: 0.4, '&:hover': { bgcolor: alpha('#000', 0.75) } }}
                    >
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {/* ── Step 3: Review ── */}
        {!isComplete && activeStep === 3 && (
          <Stack spacing={2}>
            {isAnalyzing ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">Analyzing your request…</Typography>
              </Stack>
            ) : (
              <>
                {analysisError && (
                  <Typography variant="caption" color="warning.main">{analysisError}</Typography>
                )}

                <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.6), border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 1 }}>
                    Summary
                  </Typography>

                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                    <HomeOutlined style={{ fontSize: 13, color: theme.palette.text.disabled }} />
                    <Typography variant="caption" color="text.secondary">
                      {selectedLease?.propertyName || 'Property'}
                      {selectedLease?.unitName && !isSingleFamily ? ` · Unit ${selectedLease.unitName}` : ''}
                    </Typography>
                  </Stack>

                  {aiAnalysis?.title && (
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>{aiAnalysis.title}</Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>{description}</Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.75}>
                    {aiAnalysis?.priority && (
                      <Chip label={`Priority: ${aiAnalysis.priority}`} size="small" color={getPriorityColor(aiAnalysis.priority)} variant="outlined" />
                    )}
                    {aiAnalysis?.categoryName && (
                      <Chip label={getCategoryDisplayName(aiAnalysis.categoryName)} size="small" variant="outlined" />
                    )}
                    {images.length > 0 && (
                      <Chip label={`${images.length} photo${images.length !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      {!isComplete && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, flexShrink: 0 }}>
          <Stack direction="row" justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={activeStep === 0 ? handleClose : handleBack}
              disabled={isAnalyzing || isCreating}
              sx={{ px: 2.5 }}
            >
              {activeStep === 0 ? 'Cancel' : 'Back'}
            </Button>

            {activeStep < 3 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!canAdvance || isAnalyzing}
                startIcon={isAnalyzing ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ px: 2.5 }}
              >
                {isAnalyzing ? 'Analyzing…' : 'Next'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isCreating || isAnalyzing}
                startIcon={isCreating ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ px: 2.5 }}
              >
                {isCreating ? 'Submitting…' : 'Submit Request'}
              </Button>
            )}
          </Stack>
        </Box>
      )}
    </ThemeAdaptiveDrawer>
  );
}

TenantMaintenanceFormDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRequestCreated: PropTypes.func,
  unitId: PropTypes.number
};
