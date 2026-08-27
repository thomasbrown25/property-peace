const SAFE_ROUTES = Object.freeze({
  viewApplication: ({ applicationId }) => `/landlord/listings?tab=applications${applicationId ? `&applicationId=${applicationId}` : ''}`,
  viewMaintenanceRequest: ({ maintenanceRequestId }) => `/landlord/maintenances${maintenanceRequestId ? `?requestId=${maintenanceRequestId}` : ''}`
});

/**
 * Portfolio Summary is deterministic guidance only. It may navigate to an
 * existing workflow, but it never sends messages or creates/changes records.
 */
export function runPortfolioWorkflow(action, { navigate }) {
  if (!action?.action) return { success: false, message: 'Invalid action' };
  const params = action.params ?? {};
  const route = action.action === 'navigateToPage'
    ? params.route
    : SAFE_ROUTES[action.action]?.(params);

  if (!route || typeof route !== 'string' || !route.startsWith('/landlord/')) {
    return { success: false, message: 'This portfolio action is not supported' };
  }

  navigate(route);
  return { success: true, message: 'Opened workflow' };
}
