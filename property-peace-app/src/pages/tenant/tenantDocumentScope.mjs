function read(value, camelCase, pascalCase) {
  return value?.[camelCase] ?? value?.[pascalCase];
}

export function getTenantForUser(lease, userId) {
  if (userId === undefined || userId === null) return null;
  return (lease?.tenants ?? lease?.Tenants ?? []).find((tenant) =>
    String(read(tenant, 'userId', 'UserId')) === String(userId)
  ) ?? null;
}

export function getTenantIdForUser(lease, userId) {
  const tenant = getTenantForUser(lease, userId);
  return read(tenant, 'id', 'Id') ?? null;
}

export function getLeaseOrganizationId(lease) {
  return read(lease, 'organizationId', 'OrganizationId');
}

export function organizationRequestOptions(organizationId) {
  if (organizationId === undefined || organizationId === null) return undefined;
  return { headers: { 'X-Organization-Id': String(organizationId) } };
}

export function tenantDocumentContexts(leases, userId) {
  const contexts = new Map();
  for (const lease of leases ?? []) {
    const organizationId = getLeaseOrganizationId(lease);
    const tenantId = getTenantIdForUser(lease, userId);
    if (organizationId === undefined || organizationId === null || tenantId === null) continue;
    contexts.set(`${organizationId}-${tenantId}`, { organizationId, tenantId });
  }
  return [...contexts.values()];
}
