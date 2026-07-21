const CLOSED_MAINTENANCE_STATUSES = new Set(['resolved', 'completed', 'cancelled', 'closed']);

export const normalizeMaintenanceStatus = (status) => (status || '').toString().toLowerCase().replace(/[-_\s]/g, '');

export const isClosedMaintenanceStatus = (status) => CLOSED_MAINTENANCE_STATUSES.has(normalizeMaintenanceStatus(status));

export const isOpenMaintenanceRequest = (request) => !isClosedMaintenanceStatus(request?.status || request?.Status);

export const isHighPriorityMaintenanceRequest = (request) =>
  (request?.priority || request?.Priority || '').toString().toLowerCase() === 'high' && isOpenMaintenanceRequest(request);
