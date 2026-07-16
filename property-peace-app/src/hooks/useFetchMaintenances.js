import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getHistoryMaintenances } from 'store/maintenance/maintenance.action';
import { getCurrentMaintenances } from 'store/maintenance/maintenance.action';
import { getCurrentMaintenancesByOrganization } from 'store/maintenance/maintenance.action';
import { getHistoryMaintenancesByOrganization } from 'store/maintenance/maintenance.action';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import { selectHistoryMaintenances } from 'store/maintenance/maintenance.selector';

export default function useFetchMaintenances(propertyId) {
  const dispatch = useDispatch();
  const maintenances = useSelector(selectMaintenanceRequests);
  const historyMaintenances = useSelector(selectHistoryMaintenances);

  const refetch = useCallback(async () => {
    if (propertyId) {
      await Promise.all([
        dispatch(getCurrentMaintenances(propertyId)),
        dispatch(getHistoryMaintenances(propertyId))
      ]);
    } else {
      // OrganizationId is sent via X-Organization-Id header
      await Promise.all([
        dispatch(getCurrentMaintenancesByOrganization()),
        dispatch(getHistoryMaintenancesByOrganization())
      ]);
    }
  }, [dispatch, propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { refetch, maintenances, historyMaintenances };
}
