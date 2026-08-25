const ALLOWED_PERCY_WORKFLOW_ROUTES = new Set([
  '/landlord/properties',
  '/landlord/finances?tab=payments',
  '/landlord/maintenances',
  '/landlord/leases',
  '/landlord/applications',
  '/landlord/urgent-messages'
]);

const readField = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];

export const safePercyWorkflowRoute = (route) =>
  typeof route === 'string' && ALLOWED_PERCY_WORKFLOW_ROUTES.has(route) ? route : null;

export const mapPercySource = (source) => ({
  kind: String(readField(source, 'kind', 'Kind') || '').slice(0, 40),
  label: String(readField(source, 'label', 'Label') || 'Property Peace data').slice(0, 80),
  workflowRoute: safePercyWorkflowRoute(readField(source, 'workflowRoute', 'WorkflowRoute')),
  recordReference: readField(source, 'recordReference', 'RecordReference') || null,
  retrievedAtUtc: readField(source, 'retrievedAtUtc', 'RetrievedAtUtc') || null
});
