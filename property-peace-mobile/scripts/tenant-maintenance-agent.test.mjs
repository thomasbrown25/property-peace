import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('tenant reporting defaults to tenant agent and retains manual fallback', () => {
  const entry = read('screens/tenant/TenantMaintenanceReportScreen.tsx');
  const nav = read('navigation/MainNavigator.tsx');
  assert.match(nav, /TenantMaintenanceIntake.*component=\{TenantMaintenanceReportScreen\}/);
  assert.match(entry, /useState<'agent' \| 'manual'>\('agent'\)/);
  assert.match(entry, /TenantMaintenanceAgentScreen/);
  assert.match(entry, /TenantMaintenanceIntakeScreen/);
  assert.match(entry, /onManual/);
  assert.doesNotMatch(entry, /getTenantAgentSettings\(/);
  const agent = read('screens/tenant/TenantMaintenanceAgentScreen.tsx');
  assert.match(agent, /\{!!error && <TouchableOpacity[^>]*onPress=\{onManual\}/);
  assert.doesNotMatch(agent, /^        <TouchableOpacity[^\n]*onPress=\{onManual\}/m);
  assert.doesNotMatch(entry, /chatWithLandlordAgent/);
});

test('tenant conversation uses tenant API, starts empty, and protects ambiguous submission', () => {
  const api = read('api/maintenanceAPI.ts');
  const agent = read('screens/tenant/TenantMaintenanceAgentScreen.tsx');
  assert.match(api, /'\/api\/maintenance-agent\/settings'/);
  assert.match(api, /'\/api\/maintenance-agent\/chat'/);
  assert.match(agent, /chatWithTenantAgent\(history\)/);
  assert.match(agent, /chat\(\[\], true\)/);
  assert.match(agent, /messagesRef\.current/);
  assert.match(agent, /photoRequested/);
  assert.match(agent, /uploadAttachment\(id, 'Intake', photo\)/);
  assert.match(agent, /setUncertain\(true\)/);
  assert.match(agent, /Check your maintenance list/);
  assert.match(agent, /Submitting does not contact emergency services/);
});
