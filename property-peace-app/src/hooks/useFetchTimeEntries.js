import { useState, useEffect, useCallback } from 'react';
import { timeEntryAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

export default function useFetchTimeEntries(filters = {}) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await timeEntryAPI.getTimeEntries(filters);
      if (response?.data?.success && response?.data?.data) {
        setTimeEntries(response.data.data);
      } else {
        setTimeEntries([]);
      }
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err);
      setTimeEntries([]);
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to fetch time entries',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    timeEntries,
    loading,
    error,
    refetch
  };
}
