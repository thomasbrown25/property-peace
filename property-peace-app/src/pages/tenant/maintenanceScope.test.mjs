import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('tenant maintenance loads the selected lease organization and opens both intake paths from that selection', () => {
  const page = read('./maintenance.jsx');
  assert.match(page, /getTenantMaintenanceLeases\(\)/);
  assert.match(page, /const organizationId = getLeaseOrganizationId\(selectedLease\)/);
  assert.match(page, /\['tenant-maintenance-requests', userId, organizationId\]/);
  assert.match(page, /maintenanceWorkflowAPI\.list\(organizationRequestOptions\(selectedOrganizationId\)\)/);
  assert.match(page, /<MaintenanceAgentDrawer\b[^>]*organizationId=\{organizationId\}/);
  assert.match(page, /<TenantMaintenanceFormDrawer\b[^>]*leaseId=\{selectedLease\?\.id\}/);
});

test('the agent sends the lease organization for chat without changing the landlord caller contract', () => {
  assert.match(read('./MaintenanceAgentDrawer.jsx'), /axiosServices\.post\(chatEndpoint, body, organizationRequestOptions\(organizationId\)\)/);
});
