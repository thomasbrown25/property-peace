import { useState, useCallback } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import useAuth from './useAuth';
import { openSnackbar } from 'api/snackbar';
import { updateHouseholdAsync } from '../store/household/household.action';

/**
 * useUpdateHousehold
 * Handles updating a household record.
 *
 * @returns {Object} { updateHousehold, updateLoading, updateError }
 */
export function useUpdateHousehold() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  /**
   * Update household record
   * @param {Object} householdData - Updated household fields (must include ID)
   * @returns {Promise<Object>} - Updated household response
   */
  const updateHousehold = useCallback(
    async (householdData) => {
      setUpdateLoading(true);
      setUpdateError(null);

      try {
        await dispatch(updateHouseholdAsync(user?.id, householdData));

        openSnackbar({
          open: true,
          message: `Household "${householdData?.householdName || 'Record'}" updated successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } catch (error) {
        console.error('Failed to update household:', error);
        setUpdateError(error);

        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update household.',
          variant: 'alert',
          alert: { color: 'error' }
        });

        throw error;
      } finally {
        setUpdateLoading(false);
      }
    },
    [dispatch, user?.id]
  );

  return {
    updateHousehold,
    updateLoading,
    updateError
  };
}

export default useUpdateHousehold;
