import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTenantIdForUser,
  organizationRequestOptions,
  tenantDocumentContexts
} from './tenantDocumentScope.mjs';

test('selects the signed-in tenant rather than a co-tenant and scopes each organization', () => {
  const leases = [
    { id: 1, organizationId: 10, tenants: [{ id: 500, userId: 99 }, { id: 501, userId: 7 }] },
    { id: 2, OrganizationId: 20, Tenants: [{ Id: 601, UserId: 7 }] },
    { id: 3, organizationId: 10, tenants: [{ id: 501, userId: 7 }] }
  ];

  assert.equal(getTenantIdForUser(leases[0], 7), 501);
  assert.deepEqual(tenantDocumentContexts(leases, 7), [
    { organizationId: 10, tenantId: 501 },
    { organizationId: 20, tenantId: 601 }
  ]);
  assert.deepEqual(organizationRequestOptions(20), { headers: { 'X-Organization-Id': '20' } });
});
