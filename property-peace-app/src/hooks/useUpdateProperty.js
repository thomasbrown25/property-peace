// hooks/useUpdateProperty.js
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { openSnackbar } from 'api/snackbar';
import { addOrUpdateProperty } from 'store/property/property.action';

export function useUpdateProperty() {
  const dispatch = useDispatch();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateProperty = async (propertyData, imageFile) => {
    setUpdateLoading(true);
    setError(null);
    try {
      const result = await dispatch(addOrUpdateProperty(propertyData, imageFile ? [imageFile] : []));
      openSnackbar({
        open: true,
        message: 'Property updated successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });
      return result;
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to update property.',
        variant: 'alert',
        alert: { color: 'error' }
      });
      throw err;
    } finally {
      setUpdateLoading(false);
    }
  };

  return { updateProperty, updateLoading, error };
}
