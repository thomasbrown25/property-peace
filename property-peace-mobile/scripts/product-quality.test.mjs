import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('v1 leases are read-only and unfinished lease routes are unreachable', async () => {
  const [navigator, types, leases] = await Promise.all([
    read('../src/navigation/MainNavigator.tsx'),
    read('../src/navigation/types.ts'),
    read('../src/screens/landlord/LeasesScreen.tsx'),
  ]);

  assert.doesNotMatch(navigator, /LeaseDetailScreen|AddLeaseScreen/);
  assert.doesNotMatch(navigator, /name=["'](?:LeaseDetail|AddLease)["']/);
  assert.doesNotMatch(types, /LeaseDetail:|AddLease:/);
  assert.doesNotMatch(leases, /navigate\(["'](?:LeaseDetail|AddLease)["']/);
  assert.doesNotMatch(leases, /Add Lease|Lease #|leaseId|unitId/);
  assert.match(leases, /read-only/i);
});

test('the duplicate property-stack checklist screen is unregistered', async () => {
  const [navigator, types, propertyDetail] = await Promise.all([
    read('../src/navigation/MainNavigator.tsx'),
    read('../src/navigation/types.ts'),
    read('../src/screens/landlord/PropertyDetailScreen.tsx'),
  ]);

  assert.doesNotMatch(navigator, /screens\/landlord\/ChecklistsScreen/);
  assert.doesNotMatch(navigator, /PropertiesStack\.Screen name=["']Checklists["']/);
  assert.doesNotMatch(types, /^\s*Checklists: \{ propertyId:/m);
  assert.match(propertyDetail, /navigate\(['"]Checklists['"], buildPropertyChecklistEntry\(property\)\)/);
});

test('unsupported roles receive a full-screen honest gate with sign-out', async () => {
  const [navigator, model, gate] = await Promise.all([
    read('../src/navigation/MainNavigator.tsx'),
    read('../src/navigation/mainTabModel.ts'),
    read('../src/screens/UnsupportedRoleScreen.tsx'),
  ]);

  assert.match(navigator, /audience === ['"]unsupported['"]/);
  assert.match(navigator, /<UnsupportedRoleScreen/);
  assert.doesNotMatch(model, /UnsupportedMaintenanceNavigator/);
  assert.deepEqual((model.match(/unsupported:\s*\[([^\]]*)\]/s)?.[1] ?? '').trim(), '');
  assert.match(gate, /vendor/i);
  assert.match(gate, /not available/i);
  assert.match(gate, /dispatch\(logout\(\)\)/);
  assert.match(gate, />Sign out</);
});

for (const screen of ['LoginScreen.tsx', 'ForgotPasswordScreen.tsx', 'MfaVerificationScreen.tsx']) {
  test(`${screen} is keyboard-safe and scrollable on compact phones`, async () => {
    const source = await read(`../src/screens/auth/${screen}`);
    assert.match(source, /KeyboardAvoidingView/);
    assert.match(source, /ScrollView/);
    assert.match(source, /keyboardShouldPersistTaps=["']handled["']/);
    assert.match(source, /contentContainerStyle=\{styles\.content\}/);
    assert.match(source, /content:\s*\{[^}]*flexGrow:\s*1/s);
  });
}
