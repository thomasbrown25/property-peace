import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Grid,
  Paper,
  useTheme,
  alpha,
  Tooltip,
  IconButton
} from '@mui/material';
import { useFormik, FormikProvider, Form } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { bulkCreateUnits } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { Alert } from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import CopyOutlined from '@ant-design/icons/CopyOutlined';

// Validation schema
const UnitSchema = Yup.object().shape({
  units: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Unit name is required'),
      bedrooms: Yup.string().required('Bedrooms is required'),
      baths: Yup.string().required('Baths is required'),
      hasRoomRentals: Yup.boolean()
    })
  )
});

export default function BulkUnitCreateDrawer({ property, open, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitWarning, setLimitWarning] = useState(null);

  // Generate beds and baths options (same as property add workflow)
  const bedsOptions = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({ id: i, value: i.toString(), label: i.toString() })), 
    []
  );
  const bathsOptions = useMemo(() => 
    ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(val => ({ id: val, value: val, label: val })), 
    []
  );

  // Get existing units from property
  const existingUnits = property?.units || [];

  // Get next unit number based on existing units
  const getNextUnitNumber = () => {
    if (existingUnits.length === 0) return 1;
    
    // Detect the highest unit number from existing units
    // Pattern: "Unit {number}" or just "{number}" (case-insensitive)
    const unitNumberPattern = /^unit\s*(\d+)$/i;
    const numberPattern = /^(\d+)$/;
    
    const unitNumbers = existingUnits
      .map(u => {
        if (!u.name) return null;
        const trimmed = u.name.trim();
        const match = trimmed.match(unitNumberPattern) || trimmed.match(numberPattern);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(num => num !== null);
    
    if (unitNumbers.length > 0) {
      return Math.max(...unitNumbers) + 1;
    }
    return existingUnits.length + 1;
  };

  // Get unit limits from subscription (property limits removed - only total units matter)
  const maxTotalUnits = subscriptionStatus?.subscription?.plan?.maxTotalUnits;
  const currentUnitCount = property?.units?.length || 0;
  const currentTotalUnits = subscriptionStatus?.currentTotalUnits || subscriptionStatus?.CurrentTotalUnits || 0;
  const remainingTotalUnits = maxTotalUnits ? maxTotalUnits - currentTotalUnits : null;

  const formik = useFormik({
    initialValues: {
      units: [{ name: '', bedrooms: '', baths: '', hasRoomRentals: false }]
    },
    validationSchema: UnitSchema,
    enableReinitialize: true,
    validate: (values) => {
      if (!values.units || values.units.length === 0) {
        return { units: 'At least one unit is required' };
      }
      const unitErrors = values.units.map((unit, index) => {
        const errors = {};
        if (!unit.name || !unit.name.trim()) {
          errors.name = 'Unit name is required';
        }
        if (!unit.bedrooms) {
          errors.bedrooms = 'Bedrooms is required';
        }
        if (!unit.baths) {
          errors.baths = 'Baths is required';
        }
        return Object.keys(errors).length > 0 ? errors : null;
      }).filter(Boolean);
      if (unitErrors.length > 0) {
        return { units: unitErrors };
      }
      return {};
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      if (!property?.id) {
        openSnackbar({
          open: true,
          message: 'Property ID is required',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setSubmitting(true);
      setLimitWarning(null);
      
      try {
        // Filter out empty units and format for API
        const unitsPayload = values.units
          .filter(unit => unit.name && unit.name.trim())
          .map(unit => ({
            id: 0, // New unit, no ID
            name: unit.name.trim(),
            bedrooms: unit.bedrooms || '',
            baths: unit.baths || '',
            squareFeet: 0,
            isOccupied: false,
            PropertyId: property.id,
            type: '',
            rentAmount: 0,
            amenities: [],
            includedUtility: [],
            hasRoomRentals: unit.hasRoomRentals || false
          }));

        if (unitsPayload.length === 0) {
          openSnackbar({
            open: true,
            message: 'At least one unit with a name is required',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setIsSubmitting(false);
          setSubmitting(false);
          return;
        }

        // Check subscription limits before submitting (only total units limit now)
        const unitsToAdd = unitsPayload.length;
        
        // Check total units limit
        if (maxTotalUnits && (currentTotalUnits + unitsToAdd) > maxTotalUnits) {
          const warning = {
            type: 'total',
            current: currentTotalUnits,
            limit: maxTotalUnits,
            attempting: unitsToAdd,
            message: `Cannot add ${unitsToAdd} unit(s). This would exceed your plan's total unit limit (${currentTotalUnits}/${maxTotalUnits} units). Upgrade your subscription to add more units.`
          };
          setLimitWarning(warning);
          setIsSubmitting(false);
          setSubmitting(false);
          return;
        }

        // Call bulk create endpoint
        const result = await dispatch(bulkCreateUnits(property.id, unitsPayload));

        if (result?.success) {
          openSnackbar({
            open: true,
            message: `Successfully created ${result.data.length} unit(s)`,
            variant: 'alert',
            alert: { color: 'success' }
          });

          resetForm();
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        } else {
          openSnackbar({
            open: true,
            message: 'Failed to create units',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error creating units:', error);
        
        // Parse subscription limit error from backend
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create units';
        const errorStatus = error?.response?.status;
        
        // Check if it's a subscription limit error (403 or contains limit keywords)
        if (errorStatus === 403 || errorMessage.toLowerCase().includes('limit') || errorMessage.toLowerCase().includes('exceed')) {
          // Try to extract current count and limit from error message
          // Pattern: "Cannot add X unit(s). This would exceed your plan's total unit limit (current/limit units)."
          const limitMatch = errorMessage.match(/(\d+)\/(\d+)\s+units?/i);
          if (limitMatch) {
            const current = parseInt(limitMatch[1]);
            const limit = parseInt(limitMatch[2]);
            const attemptingMatch = errorMessage.match(/Cannot add (\d+)/i);
            const attempting = attemptingMatch ? parseInt(attemptingMatch[1]) : (unitsPayload?.length || 0);
            
            const warning = {
              type: 'backend',
              current: current,
              limit: limit,
              attempting: attempting,
              message: errorMessage
            };
            setLimitWarning(warning);
          } else {
            // Fallback: show the error message as warning with available data
            setLimitWarning({
              type: 'backend',
              current: currentTotalUnits,
              limit: maxTotalUnits || 'unknown',
              attempting: unitsPayload?.length || 0,
              message: errorMessage
            });
          }
        } else {
          openSnackbar({
            open: true,
            message: errorMessage,
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });


  useEffect(() => {
    if (open) {
      setLimitWarning(null);
      // Initialize with one new unit, pre-populated with next unit number
      const nextUnitNumber = getNextUnitNumber();
      formik.resetForm({
        values: {
          units: [{ name: nextUnitNumber.toString(), bedrooms: '', baths: '', hasRoomRentals: false }]
        }
      });
    }
  }, [open, property]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <FormikProvider value={formik}>
        <Form onSubmit={formik.handleSubmit}>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h4">Add Units</Typography>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>

              {/* Subscription Limit Warning */}
              {limitWarning && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Subscription Limit Reached
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {limitWarning.message}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current:</strong> {limitWarning.current} units | <strong>Limit:</strong> {limitWarning.limit} units | <strong>Attempting:</strong> {limitWarning.attempting} units
                  </Typography>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    <Typography
                      component="span"
                      onClick={() => {
                        onClose();
                        navigate('/landlord/settings?tab=subscription');
                      }}
                      sx={{
                        color: 'primary.main',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        '&:hover': {
                          color: 'primary.dark'
                        }
                      }}
                    >
                      Upgrade your subscription
                    </Typography>
                    {' '}to add more units.
                  </Typography>
                </Alert>
              )}

              {/* Total Units Limit Info */}
              {maxTotalUnits && (
                <Alert severity={remainingTotalUnits && remainingTotalUnits > 0 ? 'info' : 'warning'}>
                  <Typography variant="body2">
                    <strong>Total Unit Limit:</strong> {currentTotalUnits} / {maxTotalUnits} units used across all properties
                    {remainingTotalUnits !== null && (
                      <> ({remainingTotalUnits > 0 ? `${remainingTotalUnits} remaining` : 'Limit reached'})</>
                    )}
                  </Typography>
                  {remainingTotalUnits !== null && remainingTotalUnits <= 0 && (
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                      <Typography
                        component="span"
                        onClick={() => {
                          onClose();
                          navigate('/landlord/settings?tab=subscription');
                        }}
                        sx={{
                          color: 'primary.main',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          '&:hover': {
                            color: 'primary.dark'
                          }
                        }}
                      >
                        Upgrade your subscription
                      </Typography>
                      {' '}to add more units.
                    </Typography>
                  )}
                </Alert>
              )}

              {/* Existing Units Display */}
              {existingUnits.length > 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Existing Units ({existingUnits.length})
                  </Typography>
                  <Stack spacing={2}>
                    {existingUnits.map((unit, index) => (
                      <Paper
                        key={unit.id || index}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.paper, 0.4),
                          borderColor: alpha(theme.palette.divider, 0.3)
                        }}
                      >
                        <Grid container spacing={2} alignItems="center">
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Typography variant="subtitle2" color="text.secondary">Unit #</Typography>
                            <Typography variant="body1" fontWeight={500}>{unit.name || `Unit ${index + 1}`}</Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Typography variant="subtitle2" color="text.secondary">Beds</Typography>
                            <Typography variant="body1">{unit.bedrooms || '-'}</Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Typography variant="subtitle2" color="text.secondary">Baths</Typography>
                            <Typography variant="body1">{unit.baths || '-'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* New Units to Add */}
              <Box>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Add New Units
                </Typography>
                <Stack spacing={3}>
                  {(formik.values.units || []).map((unit, index) => (
                    <Paper
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.6)
                      }}
                    >
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6" fontWeight={600}>
                            Unit {existingUnits.length + index + 1}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              startIcon={<CopyOutlined />}
                              onClick={() => {
                                const newUnits = [...(formik.values.units || [])];
                                const nextUnitNumber = getNextUnitNumber() + newUnits.length;
                                newUnits.push({
                                  name: nextUnitNumber.toString(),
                                  bedrooms: unit.bedrooms || '',
                                  baths: unit.baths || '',
                                  hasRoomRentals: unit.hasRoomRentals || false
                                });
                                formik.setFieldValue('units', newUnits);
                              }}
                              sx={{ textTransform: 'none', color: 'primary.main' }}
                            >
                              Duplicate Unit
                            </Button>
                            {(formik.values.units || []).length >= 2 && (
                              <Button
                                size="small"
                                startIcon={<DeleteOutlined />}
                                onClick={() => {
                                  const newUnits = [...(formik.values.units || [])];
                                  newUnits.splice(index, 1);
                                  formik.setFieldValue('units', newUnits);
                                }}
                                sx={{ textTransform: 'none', color: 'error.main' }}
                              >
                                Remove
                              </Button>
                            )}
                          </Box>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormInput
                              label="Unit #"
                              placeholder="Ex. Unit 1, Apartment A"
                              value={unit.name || ''}
                              onChange={(e) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], name: e.target.value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              error={formik.touched.units?.[index]?.name && Boolean(formik.errors.units?.[index]?.name)}
                              helperText={formik.touched.units?.[index]?.name && formik.errors.units?.[index]?.name}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormSelect
                              name={`units[${index}].bedrooms`}
                              label="Beds *"
                              options={bedsOptions}
                              value={unit.bedrooms || ''}
                              setFieldValue={(name, value) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], bedrooms: value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              placeholder="Select"
                              valueType="string"
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormSelect
                              name={`units[${index}].baths`}
                              label="Baths *"
                              options={bathsOptions}
                              value={unit.baths || ''}
                              setFieldValue={(name, value) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], baths: value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              placeholder="Select"
                              valueType="string"
                              fullWidth
                            />
                          </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="checkbox"
                            checked={unit.hasRoomRentals || false}
                            onChange={(e) => {
                              const newUnits = [...(formik.values.units || [])];
                              newUnits[index] = { ...newUnits[index], hasRoomRentals: e.target.checked };
                              formik.setFieldValue('units', newUnits);
                            }}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <Typography variant="body2">
                            This unit will have room rentals.{' '}
                            <Tooltip
                              title="Room rentals are when you're renting out rooms separately within the property, each with their own lease."
                              arrow
                              placement="top"
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    maxWidth: 300,
                                    '& .MuiTooltip-arrow': {
                                      color: 'primary.main'
                                    }
                                  }
                                }
                              }}
                            >
                              <Typography
                                component="span"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'underline',
                                  cursor: 'pointer'
                                }}
                              >
                                Learn more
                              </Typography>
                            </Tooltip>
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}

                  <Button
                    variant="outlined"
                    startIcon={<PlusOutlined />}
                    onClick={() => {
                      const currentUnits = formik.values.units || [];
                      const nextUnitNumber = getNextUnitNumber() + currentUnits.length;
                      const newUnits = [...currentUnits, { name: nextUnitNumber.toString(), bedrooms: '', baths: '', hasRoomRentals: false }];
                      formik.setFieldValue('units', newUnits);
                    }}
                    sx={{ textTransform: 'none', px: 3, alignSelf: 'flex-start' }}
                  >
                    Add Another Unit
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-end" width="100%">
              <Button
                variant="text"
                onClick={onClose}
                disabled={isSubmitting}
                startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                sx={{
                  color: 'text.secondary',
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 1,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.black, 0.04)
                  },
                  '&:disabled': {
                    color: 'text.disabled'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="text"
                disabled={isSubmitting}
                startIcon={<PlusOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                sx={{
                  color: 'primary.main',
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 1,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08)
                  },
                  '&:disabled': {
                    color: 'text.disabled'
                  }
                }}
              >
                {isSubmitting ? 'Creating...' : `Create ${(formik.values.units || []).length} Unit(s)`}
              </Button>
            </Stack>
          </DialogActions>
        </Form>
      </FormikProvider>
    </Dialog>
  );
}

