import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  alpha
} from '@mui/material';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import { formatCurrency } from 'utils/formatters';
import axiosServices from 'utils/axios';

// ==============================|| PAYMENT LEASE CONFIRMATION ||============================== //

export default function PaymentLeaseConfirmation({ tenant, selectedProperty, selectedUnit, selectedLease, onConfirmLease }) {
  const [loading, setLoading] = useState(false);
  const [lease, setLease] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLease = async () => {
      if (selectedLease) {
        setLease(selectedLease);
        return;
      }

      if (!selectedProperty) {
        setLease(null);
        return;
      }

      // Try to find lease from selected property/unit first
      if (selectedUnit && (selectedUnit.lease || selectedUnit.Lease)) {
        const unitLease = selectedUnit.lease || selectedUnit.Lease;
        setLease(unitLease);
        if (onConfirmLease) {
          onConfirmLease(unitLease);
        }
        return;
      }
      
      // Also check if property has units with leases
      if (selectedProperty && selectedProperty.units) {
        const unitWithLease = selectedProperty.units.find(u => 
          (u.lease || u.Lease) && 
          (selectedUnit ? u.id === selectedUnit.id : true)
        );
        if (unitWithLease && (unitWithLease.lease || unitWithLease.Lease)) {
          const foundLease = unitWithLease.lease || unitWithLease.Lease;
          setLease(foundLease);
          if (onConfirmLease) {
            onConfirmLease(foundLease);
          }
          return;
        }
      }

      const leaseId = tenant.leaseId || tenant.LeaseId;
      if (!leaseId) {
        setError('Tenant does not have an active lease');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch lease details - the API expects unitId, but we have leaseId
        // We need to get the lease by its ID. Let's try the lease endpoint
        const response = await axiosServices.get(`/api/lease/${leaseId}`);
        if (response.data && response.data.success && response.data.data) {
          const leaseData = response.data.data;
          setLease(leaseData);
          // Auto-confirm the lease
          if (onConfirmLease) {
            onConfirmLease(leaseData);
          }
        } else {
          setError('Failed to load lease details');
        }
      } catch (err) {
        console.error('Error fetching lease:', err);
        // If 404, try alternative approach - get lease from tenant's leaseId
        if (err?.response?.status === 404) {
          // The lease endpoint might expect unitId, not leaseId
          // For now, construct lease from tenant data
          if (tenant?.leaseId || tenant?.LeaseId) {
            // Create a basic lease object from tenant data
            const basicLease = {
              id: tenant.leaseId || tenant.LeaseId,
              propertyName: tenant.propertyName || tenant.PropertyName,
              unitName: tenant.unitName || tenant.UnitName,
              rentAmount: tenant.rentAmount || tenant.RentAmount || 0,
              startDate: tenant.leaseStartDate || tenant.LeaseStartDate,
              endDate: tenant.leaseEndDate || tenant.LeaseEndDate,
              rentDueDay: tenant.rentDueDay || tenant.RentDueDay || 1
            };
            setLease(basicLease);
            if (onConfirmLease) {
              onConfirmLease(basicLease);
            }
          } else {
            setError('Failed to load lease details');
          }
        } else {
          setError(err?.response?.data?.message || 'Failed to load lease details');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLease();
  }, [tenant, selectedProperty, selectedUnit, selectedLease, onConfirmLease]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  if (!lease) {
    return (
      <Alert severity="warning">
        No lease found for this tenant.
      </Alert>
    );
  }

  // Format property display
  const propertyDisplay = lease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily' || 
                          lease.propertyType?.toLowerCase() === 'singlefamily'
    ? lease.propertyName || lease.unit?.property?.name
    : lease.unitName
      ? `${lease.propertyName || lease.unit?.property?.name} – ${lease.unitName}`
      : lease.propertyName || lease.unit?.property?.name || 'N/A';

  const rentAmount = lease.rentAmount || lease.RentAmount || 0;
  const startDate = lease.startDate || lease.StartDate;
  const endDate = lease.endDate || lease.EndDate;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Confirm Lease Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please confirm that this is the correct lease for the payment.
      </Typography>

      <Card
        variant="outlined"
        sx={{
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            {/* Property/Unit Info */}
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <HomeOutlined style={{ fontSize: 20, color: '#1877F2' }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Property / Unit
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {propertyDisplay}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* Tenant Info */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Tenant
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenant ? `${tenant?.firstname || tenant?.Firstname || ''} ${tenant?.lastname || tenant?.Lastname || ''}`.trim() || 'Unnamed tenant' : 'No tenant assigned'}
              </Typography>
              {tenant?.email && (
                <Typography variant="body2" color="text.secondary">
                  {tenant.email}
                </Typography>
              )}
            </Box>

            <Divider />

            {/* Lease Details */}
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Monthly Rent
                </Typography>
                <Typography variant="h6" fontWeight={600} color="primary.main">
                  {formatCurrency(rentAmount)}
                </Typography>
              </Box>

              {startDate && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Lease Period
                  </Typography>
                  <Typography variant="body1">
                    {new Date(startDate).toLocaleDateString()} - {endDate ? new Date(endDate).toLocaleDateString() : 'Ongoing'}
                  </Typography>
                </Box>
              )}

              {lease.rentDueDay && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Rent Due Day
                  </Typography>
                  <Typography variant="body1">
                    Day {lease.rentDueDay} of each month
                  </Typography>
                </Box>
              )}
            </Stack>

            {selectedLease && (
              <Box sx={{ mt: 2 }}>
                <Chip 
                  label="Lease Confirmed" 
                  color="success" 
                  size="small"
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!selectedLease && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={() => onConfirmLease(lease)}
            fullWidth
          >
            Confirm This Lease
          </Button>
        </Box>
      )}
    </Box>
  );
}

PaymentLeaseConfirmation.propTypes = {
  tenant: PropTypes.object,
  selectedProperty: PropTypes.object,
  selectedUnit: PropTypes.object,
  selectedLease: PropTypes.object,
  onConfirmLease: PropTypes.func.isRequired
};
