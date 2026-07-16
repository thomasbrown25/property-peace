// src/hooks/useCreateProperty.js
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useAuth from './useAuth';
import { openSnackbar } from 'api/snackbar';
import { addOrUpdateProperty } from 'store/property/property.action';

export default function useCreateProperty() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createProperty = async (propertyData, imageFile, options = {}) => {
    setLoading(true);
    setError(null);
    const { suppressSuccessSnackbar = false } = options;

    try {
      // Wrap the call in await so we can handle the result
      const created = await dispatch(addOrUpdateProperty({ ...propertyData, landlordId: user?.id }, imageFile ? [imageFile] : []));

      if (!suppressSuccessSnackbar) {
        openSnackbar({
          open: true,
          message: `Added Property successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      return created;
    } catch (err) {
      console.error('Failed to create property:', err);
      setError(err?.response?.data?.message || err.message);

      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to add property.',
        variant: 'alert',
        alert: { color: 'error' }
      });

      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createProperty, loading, error };
}
