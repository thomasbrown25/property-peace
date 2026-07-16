import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  alpha,
  useTheme,
  IconButton,
  Link,
  CircularProgress,
  Grid
} from '@mui/material';
import { ArrowLeftOutlined, EditOutlined, FileTextOutlined, DollarOutlined, DeleteOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { openSnackbar } from 'api/snackbar';
import { updateLease, setLease } from 'store/lease/lease.action';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import FormSelect from 'components/input/FormSelect';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import EditLeaseTermModal from 'components/dialogs/EditLeaseTermModal';
import { deleteLease } from 'store/lease/lease.action';
import { formatDate } from 'utils/formatters';

const validationSchema = Yup.object().shape({
  name: Yup.string().max(255),
  propertyId: Yup.number().required('Property is required'),
  unitId: Yup.number().nullable()
});

export default function LeaseSettingsPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { propertiesRefetch } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTermModalOpen, setEditTermModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Find the initial lease from properties (if leaseId is provided)
  const initialLease = useMemo(() => {
    if (!properties || !leaseId) return null;
    return properties
      ?.flatMap((p) =>
        (p.units || [])
          .filter((u) => u.lease)
          .map((u) => ({
            ...u.lease,
            unit: u,
            propertyName: p.name || p.streetAddress,
            propertyId: p.id,
            unitId: u.id
          }))
      )
      ?.find((l) => l?.id?.toString() === leaseId);
  }, [properties, leaseId]);

  // Find the selected property
  const selectedProperty = useMemo(() => {
    if (!properties || !selectedPropertyId) return null;
    return properties.find((p) => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  // Determine if selected property is multi-unit
  const isMultiUnitProperty = useMemo(() => {
    if (!selectedProperty) return false;
    const propertyType = selectedProperty.propertyType || selectedProperty.PropertyType || '';
    const normalizedType = propertyType.toLowerCase();
    return normalizedType === 'multiunit' || normalizedType === 'multi-unit';
  }, [selectedProperty]);

  // Get unit options for the selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty || !isMultiUnitProperty) return [];
    return (selectedProperty.units || []).map((u) => ({
      id: u.id,
      value: u.id.toString(),
      label: u.name || `Unit ${u.id}`
    }));
  }, [selectedProperty, isMultiUnitProperty]);

  // Find the lease for the selected property/unit combination
  const lease = useMemo(() => {
    if (!selectedPropertyId) {
      // If no property selected, return initial lease if it exists
      return initialLease;
    }

    if (!selectedProperty) return null;

    // For single-unit properties, find the lease for the first (and only) unit
    if (!isMultiUnitProperty) {
      const unit = selectedProperty.units?.[0];
      if (unit?.lease) {
        return {
          ...unit.lease,
          unit: unit,
          propertyName: selectedProperty.name || selectedProperty.streetAddress,
          propertyId: selectedProperty.id,
          unitId: unit.id
        };
      }
      return null;
    }

    // For multi-unit properties, find the lease for the selected unit
    if (!selectedUnitId) return null;

    const unit = selectedProperty.units?.find((u) => u.id === selectedUnitId);
    if (unit?.lease) {
      return {
        ...unit.lease,
        unit: unit,
        propertyName: selectedProperty.name || selectedProperty.streetAddress,
        propertyId: selectedProperty.id,
        unitId: unit.id
      };
    }
    return null;
  }, [selectedPropertyId, selectedUnitId, selectedProperty, isMultiUnitProperty, initialLease]);

  // Initialize selected property/unit from initial lease
  useEffect(() => {
    if (initialLease && !selectedPropertyId) {
      setSelectedPropertyId(initialLease.propertyId);
      setSelectedUnitId(initialLease.unitId);
      setIsInitializing(false);
    } else if (!initialLease && properties && properties.length > 0) {
      // If no initial lease, mark as initialized
      setIsInitializing(false);
    }
  }, [initialLease, selectedPropertyId, properties]);

  // Auto-select first unit when a multi-unit property is selected and no unit is selected
  // Only do this after initialization is complete and when user manually changes property
  useEffect(() => {
    if (!isInitializing && selectedProperty && isMultiUnitProperty && !selectedUnitId) {
      const firstUnit = selectedProperty.units?.[0];
      if (firstUnit) {
        setSelectedUnitId(firstUnit.id);
        formik.setFieldValue('unitId', firstUnit.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, isMultiUnitProperty, selectedUnitId, isInitializing]);

  // Get property options for dropdown
  const propertyOptions = useMemo(() => {
    if (!properties) return [];
    return properties.map((p) => ({
      id: p.id,
      value: p.id.toString(),
      label: p.name?.trim() || p.streetAddress?.trim() || 'Property'
    }));
  }, [properties]);

  // Format lease term display
  const leaseTermDisplay = useMemo(() => {
    if (!lease?.startDate || !lease?.endDate) return 'No lease term added yet.';
    const startDate = formatDate(lease.startDate);
    const endDate = formatDate(lease.endDate);
    return `${startDate} - ${endDate}`;
  }, [lease?.startDate, lease?.endDate]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: lease?.name || '',
      propertyId: selectedPropertyId || lease?.propertyId || '',
      unitId: selectedUnitId || lease?.unitId || '',
      allowPartialPayments: lease?.allowPartialPayments ?? true,
      allowRecurringCharges: lease?.allowRecurringCharges ?? true,
      requireSettlePastDue: lease?.requireSettlePastDue ?? true
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!lease?.id) {
        openSnackbar({
          open: true,
          message: 'No lease found for the selected property/unit combination. Please select a property/unit that has an active lease.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }

      if (isMultiUnitProperty && !selectedUnitId) {
        openSnackbar({
          open: true,
          message: 'Please select a unit',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
      
      setSaving(true);
      try {
        // Update lease with new values
        const updatePayload = {
          id: lease.id,
          propertyId: Number(values.propertyId),
          unitId: Number(values.unitId) || lease.unitId,
          startDate: lease.startDate,
          endDate: lease.endDate,
          rentAmount: lease.rentAmount,
          depositAmount: lease.depositAmount,
          leaseLength: lease.leaseLength,
          rentFrequency: lease.rentFrequency,
          rentDueDay: lease.rentDueDay,
          isActive: lease.isActive,
          isDrafted: lease.isDrafted,
          // Add new fields (these may need to be added to backend)
          name: values.name || null,
          allowPartialPayments: values.allowPartialPayments,
          allowRecurringCharges: values.allowRecurringCharges,
          requireSettlePastDue: values.requireSettlePastDue
        };

        const result = await dispatch(updateLease(updatePayload));
        
        if (result?.success) {
          openSnackbar({
            open: true,
            message: 'Lease settings updated successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          await propertiesRefetch();
          if (leaseId) {
            navigate(`/landlord/leases/${leaseId}`);
          }
        } else {
          throw new Error(result?.message || 'Failed to update lease settings');
        }
      } catch (error) {
        console.error('Error updating lease settings:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update lease settings',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSaving(false);
      }
    }
  });

  useEffect(() => {
    if (properties) {
      setLoading(false);
    }
  }, [properties]);

  // Update form values when lease changes
  useEffect(() => {
    if (lease) {
      formik.setValues({
        name: lease.name || '',
        propertyId: lease.propertyId || selectedPropertyId || '',
        unitId: lease.unitId || selectedUnitId || '',
        allowPartialPayments: lease.allowPartialPayments ?? true,
        allowRecurringCharges: lease.allowRecurringCharges ?? true,
        requireSettlePastDue: lease.requireSettlePastDue ?? true
      });
    } else if (selectedPropertyId && (!isMultiUnitProperty || selectedUnitId)) {
      // If property/unit is selected but no lease exists, reset form to defaults
      formik.setValues({
        name: '',
        propertyId: selectedPropertyId || '',
        unitId: selectedUnitId || '',
        allowPartialPayments: true,
        allowRecurringCharges: true,
        requireSettlePastDue: true
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lease?.id, selectedPropertyId, selectedUnitId, isMultiUnitProperty]);

  const handleDeleteLease = async () => {
    if (!lease?.id) return;
    
    try {
      const result = await dispatch(deleteLease(lease.id));
      if (result?.success) {
        openSnackbar({
          open: true,
          message: 'Lease deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate('/landlord/leases');
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to delete lease',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, pt: 3 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => {
            if (leaseId) {
              navigate(`/landlord/leases/${leaseId}`);
            } else {
              navigate('/landlord/leases');
            }
          }}
          sx={{
            mb: 3,
            color: 'text.primary',
            textTransform: 'none',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08)
            }
          }}
        >
          BACK
        </Button>

        {/* Main Lease Settings Card */}
        <MainCard sx={{ mb: 3 }}>
          {/* Title */}
          <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ mb: 4 }}>
            Lease Settings
          </Typography>

          {/* Lease Details Section */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              </Box>
              <Typography variant="h6" fontWeight={600}>
                Lease Details
              </Typography>
            </Stack>

          <Stack spacing={3}>
            {/* Lease Term - Only show if lease exists */}
            {lease?.id && (
              <>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    Lease Term
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
                      {leaseTermDisplay}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() => setEditTermModalOpen(true)}
                      sx={{ textTransform: 'none', px: 3 }}
                    >
                      Edit Term
                    </Button>
                  </Stack>
                  <Link
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: Show help dialog or navigate to help page
                    }}
                    sx={{ mt: 0.5, fontSize: '0.875rem' }}
                  >
                    How do I delete or end this lease?
                  </Link>
                </Box>
                <Divider />
              </>
            )}

            {/* Lease Name */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Lease Nickname
              </Typography>
              <TextField
                fullWidth
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="1317 Shannonhouse - Roberts"
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={
                  formik.touched.name && formik.errors.name
                    ? formik.errors.name
                    : 'Most landlords use a combination of the property address and tenant\'s names ("Main St. #12 - Rodriguez").'
                }
                sx={{ mt: 1 }}
              />
            </Box>

            <Divider />

            {/* Property and Unit Selection */}
            <Stack spacing={2} direction={{ xs: 'column', sm: isMultiUnitProperty ? 'row' : 'column' }}>
              <Box sx={{ flex: 1, width: { xs: '100%', sm: isMultiUnitProperty ? 'auto' : '100%' } }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Property*
                </Typography>
                <FormSelect
                  name="propertyId"
                  label=""
                  options={propertyOptions}
                  value={selectedPropertyId?.toString() || formik.values.propertyId?.toString() || ''}
                  setFieldValue={(name, value) => {
                    const propertyId = Number(value);
                    setSelectedPropertyId(propertyId);
                    formik.setFieldValue(name, propertyId);
                    // Clear unit selection when property changes
                    // The useEffect will auto-select first unit for multi-unit properties
                    setSelectedUnitId(null);
                    formik.setFieldValue('unitId', '');
                  }}
                  placeholder="Select property"
                  valueType="string"
                  fullWidth
                  error={formik.touched.propertyId && Boolean(formik.errors.propertyId)}
                  helperText={formik.touched.propertyId && formik.errors.propertyId}
                />
              </Box>

              {/* Unit (only for multi-unit properties) */}
              {isMultiUnitProperty && (
                <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    Unit*
                  </Typography>
                  <FormSelect
                    name="unitId"
                    label=""
                    options={unitOptions}
                    value={selectedUnitId?.toString() || formik.values.unitId?.toString() || ''}
                    setFieldValue={(name, value) => {
                      const unitId = Number(value);
                      setSelectedUnitId(unitId);
                      formik.setFieldValue(name, unitId);
                    }}
                    placeholder="Select unit"
                    valueType="string"
                    fullWidth
                    error={formik.touched.unitId && Boolean(formik.errors.unitId)}
                    helperText={formik.touched.unitId && formik.errors.unitId}
                  />
                </Box>
              )}
            </Stack>
          </Stack>
        </Box>

          <Divider sx={{ my: 4 }} />

          {/* Payments Section */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <DollarOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              </Box>
              <Typography variant="h6" fontWeight={600}>
                Payments
              </Typography>
            </Stack>

          <Stack spacing={3}>
            {/* Allow partial payments */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Allow partial payments on this lease?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This allows roommates to easily split rent.
              </Typography>
              <RadioGroup
                row
                name="allowPartialPayments"
                value={formik.values.allowPartialPayments ? 'true' : 'false'}
                onChange={(e) => formik.setFieldValue('allowPartialPayments', e.target.value === 'true')}
              >
                <FormControlLabel value="true" control={<Radio />} label="Yes" />
                <FormControlLabel value="false" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>

            <Divider />

            {/* Allow recurring charges */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Allow tenants to automatically pay recurring charges on this lease?
              </Typography>
              <RadioGroup
                row
                name="allowRecurringCharges"
                value={formik.values.allowRecurringCharges ? 'true' : 'false'}
                onChange={(e) => formik.setFieldValue('allowRecurringCharges', e.target.value === 'true')}
              >
                <FormControlLabel value="true" control={<Radio />} label="Yes" />
                <FormControlLabel value="false" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>

            <Divider />

            {/* Require settle past due */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Require tenants to settle older past due charges before paying newer charges?
              </Typography>
              <RadioGroup
                row
                name="requireSettlePastDue"
                value={formik.values.requireSettlePastDue ? 'true' : 'false'}
                onChange={(e) => formik.setFieldValue('requireSettlePastDue', e.target.value === 'true')}
              >
                <FormControlLabel value="true" control={<Radio />} label="Yes" />
                <FormControlLabel value="false" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                onClick={formik.handleSubmit}
                disabled={saving}
                sx={{ 
                  textTransform: 'none', 
                  px: 4, 
                  py: 1.5,
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}
              >
                {saving ? <CircularProgress size={20} /> : 'SAVE CHANGES'}
              </Button>
            </Box>
          </Stack>
          </Box>
        </MainCard>

        {/* Delete Lease Section - Only show if lease exists */}
        {lease?.id && (
          <MainCard
            sx={{
              bgcolor: (t) => alpha(t.palette.error.main, 0.05),
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={600} color="error.main">
                Delete Lease
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Best for leases where tenants never moved in or when you created this as a test. You'll learn more on the next step.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlined />}
                onClick={() => setDeleteConfirmOpen(true)}
                sx={{ 
                  textTransform: 'none', 
                  px: 3, 
                  alignSelf: 'flex-start',
                  borderColor: 'error.main',
                  color: 'error.main',
                  '&:hover': {
                    borderColor: 'error.dark',
                    bgcolor: alpha(theme.palette.error.main, 0.08)
                  }
                }}
              >
                DELETE LEASE
              </Button>
            </Stack>
          </MainCard>
        )}
      </Box>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteLease}
        title="Delete Lease"
        content="Are you sure you want to delete this lease? This action cannot be undone."
        confirmText="Delete"
        confirmButtonColor="error"
      />

      <EditLeaseTermModal
        open={editTermModalOpen}
        onClose={() => setEditTermModalOpen(false)}
        lease={lease}
        onSave={async (updatedLease) => {
          setSaving(true);
          try {
            const result = await dispatch(updateLease(updatedLease));
            
            if (result?.success) {
              openSnackbar({
                open: true,
                message: 'Lease term updated successfully',
                variant: 'alert',
                alert: { color: 'success' }
              });
              await propertiesRefetch();
            } else {
              throw new Error(result?.message || 'Failed to update lease term');
            }
          } catch (error) {
            console.error('Error updating lease term:', error);
            openSnackbar({
              open: true,
              message: error?.response?.data?.message || 'Failed to update lease term',
              variant: 'alert',
              alert: { color: 'error' }
            });
            throw error; // Re-throw so modal doesn't close on error
          } finally {
            setSaving(false);
          }
        }}
      />
    </Box>
  );
}
