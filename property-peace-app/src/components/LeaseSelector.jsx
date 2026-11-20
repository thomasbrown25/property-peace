import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useState, useEffect, useRef } from 'react';
import { Select, MenuItem, Box, Typography, CircularProgress } from '@mui/material';
import { DownOutlined } from '@ant-design/icons';
import { useLease } from 'contexts/LeaseContext';
import axiosServices from 'utils/axios';
import { filterControlSx } from 'themes/filterControlStyles';

const LeaseSelector = ({ sx = {} }) => {
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
    return isDetachedSingleUnitType(propertyType);
  };

  // Format lease display: "Property Name - Unit Name" for multi-unit properties only
  const formatLeaseLabel = (lease) => {
    const propertyName = lease.propertyName || lease.PropertyName || lease.unit?.property?.name || 'Property';
    const unitName = lease.unitName || lease.unit?.name || '';
    return unitName && !isSingleUnitProperty(lease) ? `${propertyName} - ${unitName}` : propertyName;
  };

  return (
    <Select
      id="lease-selector"
      size="small"
      value={selectedLeaseId || ''}
      onChange={handleChange}
      inputProps={{ 'aria-label': 'Select lease' }}
      IconComponent={DownOutlined}
      sx={{ ...filterControlSx, ...sx }}
    >
      {leases.map((lease) => (
        <MenuItem key={lease.id || lease.Id} value={lease.id || lease.Id}>
          Lease: {formatLeaseLabel(lease)}
        </MenuItem>
      ))}
    </Select>
  );
};

export default LeaseSelector;
