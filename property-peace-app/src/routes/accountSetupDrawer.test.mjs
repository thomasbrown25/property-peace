import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('dashboard setup card opens the restored account setup drawer', async () => {
  const dashboard = await source('../pages/landlord/dashboard.jsx');
  const overview = await source('../pages/landlord/dashboard-overview.jsx');
  const setup = await source('../sections/landlord/dashboard/FinishSetup.jsx');

  assert.match(setup, /Continue setting up your account/);
  assert.match(setup, /Continue setup/);
  assert.match(setup, /aria-label="Dismiss account setup"/);
  assert.match(setup, /color:\s*SETUP_NAVY/);
  assert.match(setup, /minHeight:\s*\{\s*xs:\s*220,\s*sm:\s*240\s*\}/);
  assert.match(setup, /mt:\s*'auto'/);
  assert.match(setup, /ThemeAdaptiveDrawer/);
  assert.match(setup, /anchor="right"/);
  assert.match(setup, /Account setup/);
  assert.match(setup, /Object\.entries\(groupedSteps\)/);
  assert.match(overview, /setupTasksOpen/);
  assert.match(overview, /setSetupTasksOpen\(true\)/);
  assert.match(overview, /\/api\/user\/tutorial-status/);
  assert.match(overview, /hasSeenTutorial:\s*true/);
  assert.match(overview, /HasSeenTutorial:\s*true/);
  assert.match(overview, /onDismiss=\{dismissSetupCard\}/);
  assert.match(overview, /!\(user\?\.HasSeenTutorial \|\| user\?\.hasSeenTutorial\)/);
  assert.match(overview, /searchParams\.get\('setup'\)\s*===\s*'open'/);
  assert.match(
    overview,
    /<Grid size=\{\{ xs: 12, md: 4 \}\}[\s\S]*?<Stack spacing=\{2\.5\}[\s\S]*?\{showSetupCard && \([\s\S]*?<FinishSetup[\s\S]*?\)\}[\s\S]*?Quick actions/
  );
  assert.doesNotMatch(dashboard, /activationModeStorage|readActivationModePreference/);
});

test('account setup restores the grouped landlord checklist', async () => {
  const hook = await source('../hooks/useLandlordSetupSteps.js');

  for (const group of ['Account', 'Portfolio', 'Tenant & Lease', 'Rent & Payments', 'Operations']) {
    assert.match(hook, new RegExp(`group:\\s*['"]${group}['"]`));
  }

  assert.match(hook, /Complete landlord profile/);
  assert.match(hook, /Add first property/);
  assert.match(hook, /Add first tenant/);
  assert.match(hook, /Connect payout\/payment account/);
  assert.match(hook, /Set up SMS number/);
});

test('standalone rental activation setup is removed and organization recovery stays actionable', async () => {
  const routes = await source('./MainRoutes.jsx');
  const entitlementGate = await source('../components/entitlements/EntitlementGate.jsx');
  const reports = await source('../pages/landlord/reports/index.jsx');

  assert.doesNotMatch(routes, /pages\/landlord\/setup/);
  assert.doesNotMatch(routes, /path:\s*['"]landlord\/setup['"]/);
  assert.match(entitlementGate, /to="\/landlord\/admin-members"/);
  assert.match(reports, /to="\/landlord\/admin-members"/);
  assert.match(entitlementGate, /Choose organization/);
  assert.match(reports, /Choose organization/);
});
