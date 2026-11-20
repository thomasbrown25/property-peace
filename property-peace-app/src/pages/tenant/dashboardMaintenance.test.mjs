import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('tenant dashboard shows recent payments at full width without loading or rendering maintenance requests', () => {
  const dashboard = readFileSync(new URL('./dashboard.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /title="Maintenance Requests"|<MaintenanceAgentDrawer\b|<TenantMaintenanceFormDrawer\b/);
  assert.doesNotMatch(dashboard, /maintenanceWorkflowAPI|\/api\/maintenance-request\/tenant\/current/);
  assert.match(dashboard, /<Grid size=\{12\}>\s*<MainCard\s+title="Recent Payments"/);
});

test('canonical maintenance list forwards the selected organization and returns the request array', async () => {
  const source = readFileSync(new URL('../../api/maintenanceWorkflow.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  const requests = [{ id: 9, status: 'reported', createdAtUtc: '2026-11-19T19:00:00Z' }];
  const axios = {
    async get(path, config) {
      assert.equal(path, '/api/maintenance-requests');
      assert.equal(config.headers['X-Organization-Id'], '42');
      return { data: requests };
    }
  };
  const workflow = new Function('axiosServices', `${source}\nreturn maintenanceWorkflowAPI;`)(axios);

  assert.deepEqual(await workflow.list({ headers: { 'X-Organization-Id': '42' } }), requests);
});
