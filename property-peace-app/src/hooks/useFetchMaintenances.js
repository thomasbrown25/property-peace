import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import { selectHistoryMaintenances } from 'store/maintenance/maintenance.selector';
import { maintenanceWorkflowAPI } from 'api/maintenanceWorkflow';
import { normalizeWorkflowToken } from 'utils/maintenanceWorkflow';
import { MAINTENANCE_ACTION_TYPES } from 'store/maintenance/maintenance.types';

export default function useFetchMaintenances(propertyId) {
  const dispatch = useDispatch();
  const maintenances = useSelector(selectMaintenanceRequests);
  const historyMaintenances = useSelector(selectHistoryMaintenances);
  const [loadError, setLoadError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoadError('');
      const rows = await maintenanceWorkflowAPI.list();
      if (!Array.isArray(rows)) throw new Error('Maintenance response was incomplete.');
      const scoped = propertyId ? rows.filter((item) => Number(item.propertyId) === Number(propertyId)) : rows;
      dispatch({ type: MAINTENANCE_ACTION_TYPES.GET_CURRENT_MAINTENANCES_SUCCESS, payload: scoped.filter((item) => !['resolved', 'cancelled'].includes(normalizeWorkflowToken(item.status))) });
      dispatch({ type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_SUCCESS, payload: scoped.filter((item) => ['resolved', 'cancelled'].includes(normalizeWorkflowToken(item.status))) });
    } catch (error) {
      setLoadError(error?.response?.data?.detail || error?.message || 'Maintenance requests could not be loaded.');
    }
  }, [dispatch, propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { refetch, maintenances, historyMaintenances, loadError };
}
