import { useState, useEffect, useRef } from 'react';
import { FormControl, Select, MenuItem, Box, Typography, CircularProgress, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLease } from 'contexts/LeaseContext';
import axiosServices from 'utils/axios';

const LeaseSelector = ({ sx = {} }) => {
  const theme = useTheme();
  const { selectedLeaseId, leases, setLeases, selectLease, loading, setLoading } = useLease();
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  // Fetch leases only once on mount
  useEffect(() => {
    if (hasFetchedRef.current) return;

    const fetchLeases = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axiosServices.get('/api/lease/tenant/my-leases');

        if (response.data && response.data.success && response.data.data) {
          const leaseList = Array.isArray(response.data.data) ? response.data.data : [];
          setLeases(leaseList);
          hasFetchedRef.current = true;
        } else {
          setLeases([]);
          hasFetchedRef.current = true;
        }
      } catch (err) {
        console.error('Error fetching leases:', err);
        setError('Failed to load leases');
        setLeases([]);
        hasFetchedRef.current = true;
      } finally {
        setLoading(false);
      }
    };

    fetchLeases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

  // Handle initial selection separately - only when leases are loaded and no lease is selected
  const hasSelectedInitialRef = useRef(false);
  useEffect(() => {
    if (leases.length > 0 && selectedLeaseId === null && !hasSelectedInitialRef.current) {
      selectLease(leases[0].id);
      hasSelectedInitialRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leases.length, selectedLeaseId]); // Only when leases array changes from empty to having items, or selectedLeaseId becomes null

  const handleChange = (event) => {
    const leaseId = event.target.value;
    selectLease(leaseId);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading leases...
        </Typography>
      </Box>
    );
  }

  if (error || !leases || leases.length === 0) {
    return null; // Don't show selector if no leases
  }

  const isSingleUnitProperty = (lease) => {
    const propertyType = (lease.propertyType || lease.PropertyType || lease.unit?.property?.propertyType || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    return propertyType === 'singlefamily' || propertyType === 'singleunit';
  };

  // Format lease display: "Property Name - Unit Name" for multi-unit properties only
  const formatLeaseLabel = (lease) => {
    const propertyName = lease.propertyName || lease.PropertyName || lease.unit?.property?.name || 'Property';
    const unitName = lease.unitName || lease.unit?.name || '';
    return unitName && !isSingleUnitProperty(lease) ? `${propertyName} - ${unitName}` : propertyName;
  };

  return (
    <Stack spacing={0.5} sx={{ minWidth: { xs: '100%', sm: 270 }, ...sx }}>
      <Typography
        id="lease-selector-label"
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ lineHeight: 1, letterSpacing: 0.35 }}
      >
        Select Lease
      </Typography>
      <FormControl size="small" fullWidth>
        <Select
          id="lease-selector"
          labelId="lease-selector-label"
          value={selectedLeaseId || ''}
          onChange={handleChange}
          displayEmpty
          sx={{
            bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.28 : 0.78),
            borderRadius: 1.5,
            boxShadow:
              theme.palette.mode === 'dark'
                ? `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.04)}`
                : `0 8px 20px ${alpha(theme.palette.primary.main, 0.06)}`,
            '& .MuiSelect-select': {
              py: 0.9,
              fontWeight: 600
            }
          }}
        >
          {leases.map((lease) => (
            <MenuItem key={lease.id || lease.Id} value={lease.id || lease.Id}>
              {formatLeaseLabel(lease)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};

export default LeaseSelector;
