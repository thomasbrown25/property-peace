import { useState, useEffect, useCallback } from 'react';
import { staffMemberAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

export default function useFetchStaffMembers() {
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await staffMemberAPI.getStaffMembers();
      console.log('Staff members API response:', response);
      
      // Handle different response structures
      if (response?.success && response?.data) {
        // Direct ServiceResponse structure
        setStaffMembers(Array.isArray(response.data) ? response.data : []);
      } else if (response?.data?.success && response?.data?.data) {
        // Nested structure (response.data contains ServiceResponse)
        setStaffMembers(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        console.warn('Unexpected response structure:', response);
        setStaffMembers([]);
      }
    } catch (err) {
      console.error('Error fetching staff members:', err);
      console.error('Error response:', err?.response);
      setError(err);
      setStaffMembers([]);
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to fetch staff members',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    staffMembers,
    loading,
    error,
    refetch
  };
}
