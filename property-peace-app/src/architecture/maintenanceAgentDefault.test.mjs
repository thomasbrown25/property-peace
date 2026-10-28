import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('tenant maintenance and dashboard start with assistant and use form only on assistant failure', () => {
  const maintenance = read('pages/tenant/maintenance.jsx');
  const dashboard = read('pages/tenant/dashboard.jsx');
  assert.match(maintenance, /agentFailed \? <TenantMaintenanceFormDrawer/);
  assert.match(maintenance, /onUnavailable=\{\(\) => setAgentFailed\(true\)\}/);
  assert.match(maintenance, /setAgentFailed\(false\); setAgentDrawerOpen\(true\)/);
  assert.match(dashboard, /onUnavailable=\{\(\) => setMaintenanceAgentEnabled\(false\)\}/);
  assert.doesNotMatch(dashboard, /get\('\/api\/maintenance-agent\/settings'\)/);
});

test('landlord starts assistant without an organization setting', () => {
  const landlord = read('components/drawers/LandlordMaintenanceDrawer.jsx');
  assert.match(landlord, /useState\(true\)/);
  assert.match(landlord, /onUnavailable=\{handleAgentUnavailable\}/);
  assert.doesNotMatch(landlord, /landlord-maintenance-agent\/settings/);
});

test('ambiguous web chat failures do not blindly retry the submit', () => {
  const agent = read('pages/tenant/MaintenanceAgentDrawer.jsx');
  assert.match(agent, /onUnavailable && msgHistory\.length === 0/);
  assert.match(agent, /setUncertainSubmission\(true\)/);
  assert.match(agent, /Check your maintenance requests before trying again/);
  assert.match(agent, /if \(!text \|\| loading \|\| uncertainSubmission\) return/);
});
