import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('both mobile roles start the assistant without organization enablement settings', () => {
  const tenant = read('src/screens/tenant/TenantMaintenanceReportScreen.tsx');
  const landlord = read('src/screens/landlord/MaintenanceAgentIntakeScreen.tsx');
  assert.match(tenant, /useState<'agent' \| 'manual'>\('agent'\)/);
  assert.doesNotMatch(tenant, /getTenantAgentSettings/);
  assert.doesNotMatch(landlord, /getLandlordAgentSettings/);
  assert.match(landlord, /\{!!error && <TouchableOpacity onPress=\{onManual\}/);
  assert.match(landlord, /if \(!initial\) setUncertain\(true\)/);
});

test('API reports assistant available independent of legacy organization setting', () => {
  const tenant = read('../property-peace-api/Controllers/MaintenanceAgentController.cs');
  const landlord = read('../property-peace-api/Controllers/LandlordMaintenanceAgentController.cs');
  const service = read('../property-peace-api/Services/OrganizationService/OrganizationService.cs');
  for (const controller of [tenant, landlord]) {
    assert.match(controller, /data = new \{ isMaintenanceAgentEnabled = true \}/);
    assert.doesNotMatch(controller, /org\?\.IsMaintenanceAgentEnabled/);
  }
  assert.doesNotMatch(service, /org\.IsMaintenanceAgentEnabled = dto\.IsMaintenanceAgentEnabled/);
});
