import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
  Grid,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  alpha,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  UserOutlined,
  DollarOutlined,
  RightOutlined,
  MailOutlined,
  PhoneOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { formatCurrency } from 'utils/formatters';
import { setProperty } from 'store/property/property.action';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import { useDrawer } from 'contexts/DrawerContext';
import UnitEditDrawer from 'components/drawers/UnitEditDrawer';
import { useSubscription } from 'hooks/useSubscription';
import RentEstimateCard from 'components/RentEstimateCard';
import { deleteUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';

export default function UnitPage() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { properties } = useFetchProperties();
  const selectedProperties = useSelector(selectProperties);
  const drawer = useDrawer();
  const { subscription } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const isPremium = planName === 'premium' || planName.includes('lifetime');

  const [unit, setUnit] = useState(null);
  const [property, setPropertyState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Find unit in properties
  useEffect(() => {
    const findUnit = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use properties from hook or Redux selector
        const propertiesList = properties || selectedProperties || [];

        // Find unit in all properties
        let foundUnit = null;
        let foundProperty = null;

        for (const prop of propertiesList) {
          if (prop.units && Array.isArray(prop.units)) {
            const unitInProperty = prop.units.find(u => String(u.id) === String(unitId));
            if (unitInProperty) {
              foundUnit = unitInProperty;
              foundProperty = prop;
              break;
            }
          }
        }

        if (foundUnit && foundProperty) {
          setUnit(foundUnit);
          setPropertyState(foundProperty);
          // Set property in Redux for navigation
          dispatch(setProperty(foundProperty));
        } else {
          setError('Unit not found');
        }
      } catch (err) {
        console.error('Error finding unit:', err);
        setError(err?.response?.data?.message || 'Failed to load unit details');
      } finally {
        setLoading(false);
      }
    };

    if (unitId && (properties || selectedProperties)) {
      findUnit();
    }
  }, [unitId, properties, selectedProperties, dispatch]);

  const handleBack = () => {
    if (property?.id) {
      dispatch(setProperty(property));
      navigate(`/landlord/property/${property.id}`);
    } else {
      navigate('/landlord/properties');
    }
  };

  const handleEditUnit = () => {
    if (unit) {
      drawer.openUnitEditDrawer(unit);
    }
  };

  const handleUnitUpdateSuccess = () => {
    // Refresh unit data after update
    const findUnit = async () => {
      try {
        const propertiesList = properties || selectedProperties || [];
        let foundUnit = null;
        let foundProperty = null;

        for (const prop of propertiesList) {
          if (prop.units && Array.isArray(prop.units)) {
            const unitInProperty = prop.units.find(u => String(u.id) === String(unitId));
            if (unitInProperty) {
              foundUnit = unitInProperty;
              foundProperty = prop;
              break;
            }
          }
        }

        if (foundUnit && foundProperty) {
          setUnit(foundUnit);
          setPropertyState(foundProperty);
          dispatch(setProperty(foundProperty));
        }
      } catch (err) {
        console.error('Error refreshing unit:', err);
      }
    };

    if (unitId && (properties || selectedProperties)) {
      findUnit();
    }
  };

  const handleViewProperty = () => {
    if (property?.id) {
      dispatch(setProperty(property));
      navigate(`/landlord/property/${property.id}`);
    }
  };

  // Must be above early returns to satisfy Rules of Hooks
  const lease = unit?.lease || null;
  const leaseUnitId = lease?.unitId ?? lease?.UnitId ?? unit?.id;
  const tenants = useMemo(() => {
    const raw = lease?.tenants || lease?.Tenants || [];
    if (leaseUnitId == null) return raw;
    return raw.filter(t => (t.unitId ?? t.UnitId) === leaseUnitId);
  }, [lease?.tenants, lease?.Tenants, leaseUnitId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !unit || !property) {
    return (
      <Box>
        <PageBreadcrumbs />
        <MainCard>
          <Alert severity="error">{error || 'Unit not found'}</Alert>
          <Box sx={{ mt: 2 }}>
            <Button startIcon={<ArrowLeftOutlined />} onClick={handleBack}>
              Back to Portfolio
            </Button>
          </Box>
        </MainCard>
      </Box>
    );
  }

  const unitRent = unit?.lease?.rentAmount || 0;
  const isOccupied = unit?.isOccupied || false;
  
  const handleDeleteUnit = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteUnit(unit.id));
      openSnackbar({
        open: true,
        message: 'Unit deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      if (property?.id) {
        dispatch(setProperty(property));
        navigate(`/landlord/property/${property.id}`);
      } else {
        navigate('/landlord/properties');
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to delete unit',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleViewPayments = () => {
    if (property?.id) {
      dispatch(setProperty(property));
      const params = new URLSearchParams();
      params.append('propertyId', property.id);
      if (unit?.id) {
        params.append('unitId', unit.id);
      }
      navigate('/landlord/payments');
    }
  };

  return (
    <Box>
      <PageBreadcrumbs />
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                startIcon={<ArrowLeftOutlined />}
                onClick={handleBack}
                sx={{ minWidth: 'auto', p: 1 }}
              >
                Back
              </Button>
              <Typography variant="h4" fontWeight={600}>
                {unit.name || `Unit ${unit.id}`}
              </Typography>
              <Chip
                label={isOccupied ? 'Occupied' : 'Vacant'}
                size="small"
                sx={{
                  bgcolor: isOccupied 
                    ? alpha(theme.palette.success.main, 0.1) 
                    : alpha(theme.palette.warning.main, 0.1),
                  color: isOccupied 
                    ? theme.palette.success.main 
                    : theme.palette.warning.main,
                  fontWeight: 500
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <HomeOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Button
                variant="text"
                onClick={handleViewProperty}
                sx={{
                  textTransform: 'none',
                  p: 0,
                  minWidth: 'auto',
                  color: 'primary.main',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                {property.name || 'Property'}
              </Button>
              {property.streetAddress && (
                <>
                  <Typography variant="body2" color="text.secondary">•</Typography>
                  <EnvironmentOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                  <Typography variant="body2" color="text.secondary">
                    {property.streetAddress}
                    {property.city && `, ${property.city}`}
                    {property.state && `, ${property.state}`}
                  </Typography>
                </>
              )}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              startIcon={<EditOutlined style={{ fontSize: 16 }} />}
              onClick={handleEditUnit}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              Edit Unit
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<DeleteOutlined style={{ fontSize: 16 }} />}
              onClick={() => setDeleteOpen(true)}
              sx={{
                color: 'error.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) }
              }}
            >
              Delete
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {/* Unit Details - Cards */}
        <Grid container spacing={3} sx={{ width: '100%' }}>
          {/* Unit Information Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard
              title="Unit Information"
              sx={{
                height: '100%',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Unit Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {unit.name || `Unit ${unit.id}`}
                  </Typography>
                </Stack>
                {unit.bedrooms !== null && unit.bedrooms !== undefined && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Bedrooms
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {unit.bedrooms}
                    </Typography>
                  </Stack>
                )}
                {unit.baths !== null && unit.baths !== undefined && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Bathrooms
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {unit.baths}
                    </Typography>
                  </Stack>
                )}
                {unit.squareFeet && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Square Feet
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {unit.squareFeet.toLocaleString()}
                    </Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={isOccupied ? 'Occupied' : 'Vacant'}
                    size="small"
                    sx={{
                      bgcolor: isOccupied 
                        ? alpha(theme.palette.success.main, 0.1) 
                        : alpha(theme.palette.warning.main, 0.1),
                      color: isOccupied 
                        ? theme.palette.success.main 
                        : theme.palette.warning.main,
                      fontWeight: 500
                    }}
                  />
                </Stack>
              </Stack>
            </MainCard>
          </Grid>

          {/* Lease Information Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard
              title="Lease Information"
              sx={{
                height: '100%',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2.5}>
                {lease ? (
                  <>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Rent Amount
                      </Typography>
                      <Typography variant="body1" fontWeight={600} color="primary.main">
                        {formatCurrency(unitRent)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Lease Status
                      </Typography>
                      <Chip
                        label={lease.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={lease.isActive ? 'success' : 'default'}
                      />
                    </Stack>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No active lease
                  </Typography>
                )}
              </Stack>
            </MainCard>
          </Grid>

          {/* Tenant Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <UserOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    Tenant Information
                  </Typography>
                </Stack>
              }
              sx={{
                height: '100%',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              {tenants.length > 0 ? (
                <Stack spacing={2.5}>
                  {tenants.map((tenant, index) => {
                    const fullName = `${tenant.firstname || tenant.firstName || ''} ${tenant.lastname || tenant.lastName || ''}`.trim() || 'Unnamed Tenant';
                    return (
                      <Box key={tenant.id || index}>
                        {index > 0 && <Divider sx={{ my: 1 }} />}
                        <Stack spacing={1.5}>
                          <Typography variant="body1" fontWeight={600}>
                            {fullName}
                          </Typography>
                          {tenant.email && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <MailOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                              <Typography variant="body2" color="text.secondary">
                                {tenant.email}
                              </Typography>
                            </Stack>
                          )}
                          {tenant.phoneNumber && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <PhoneOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                              <Typography variant="body2" color="text.secondary">
                                {tenant.phoneNumber}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tenants assigned to this lease
                </Typography>
              )}
            </MainCard>
          </Grid>

          {/* Payment History Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <DollarOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    Payment History
                  </Typography>
                </Stack>
              }
              secondary={
                <Button
                  size="small"
                  variant="text"
                  endIcon={<RightOutlined style={{ fontSize: 16 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewPayments();
                  }}
                  sx={{
                    color: 'primary.main',
                    textTransform: 'none',
                    flexShrink: 0,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  View All
                </Button>
              }
              sx={{
                height: '100%',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: (t) => `0 8px 32px ${alpha(t.palette.primary.main, 0.25)}`,
                  transform: 'translateY(-2px)',
                  borderColor: theme.palette.primary.main
                }
              }}
              onClick={handleViewPayments}
            >
              <Stack spacing={2} alignItems="flex-start">
                <Typography variant="body2" color="text.secondary">
                  View all payment history for this unit
                </Typography>
              </Stack>
            </MainCard>
          </Grid>
        </Grid>

        {/* Rent Estimate */}
        {property?.id && unit?.id && (
          <Box sx={{ mt: 3 }}>
            <RentEstimateCard
              propertyId={property.id}
              unitId={unit.id}
              isPremium={isPremium}
            />
          </Box>
        )}

      {/* Unit Edit Drawer */}
      {property?.id && (
        <UnitEditDrawer propertyId={property.id} onUpdateSuccess={handleUnitUpdateSuccess} />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, maxWidth: 420 } } }}
      >
        <IconButton
          onClick={() => setDeleteOpen(false)}
          size="small"
          disabled={deleting}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'text.secondary',
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) }
          }}
        >
          <CloseOutlined />
        </IconButton>

        <DialogTitle sx={{ pt: 4, pb: 1, px: 3 }}>
          <Stack alignItems="center" spacing={2} mb={1}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.error.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'error.main',
                fontSize: 24
              }}
            >
              <DeleteOutlined />
            </Box>
            <Box textAlign="center">
              <Typography variant="h5" fontWeight={700}>
                Delete Unit
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {unit?.name || `Unit ${unit?.id}`}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 0.5, pb: 1 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              bgcolor: alpha(theme.palette.error.main, 0.04),
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start'
            }}
          >
            <WarningOutlined style={{ fontSize: 16, color: theme.palette.error.main, marginTop: 2, flexShrink: 0 }} />
            <Typography variant="body2" color="error.main" fontWeight={500} lineHeight={1.5}>
              This will permanently delete the unit and all associated data. This action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            fullWidth
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUnit}
            disabled={deleting}
            fullWidth
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            {deleting ? 'Deleting...' : 'Delete Unit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
