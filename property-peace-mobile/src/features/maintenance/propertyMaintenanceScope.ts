import type { MaintenanceRequest } from '../../api/maintenanceAPI';

/** A property list must never include requests without a matching property ID. */
export const forProperty = (requests: MaintenanceRequest[], propertyId?: string): MaintenanceRequest[] => {
  if (!propertyId) return requests;
  return requests.filter((request) => {
    const id = request.propertyId ?? request.PropertyId;
    return id != null && String(id) === propertyId;
  });
};
