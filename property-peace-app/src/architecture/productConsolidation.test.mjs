import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import pages from '../menu-items/pages.js';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFile(path.join(srcRoot, relativePath), 'utf8');

test('dashboard rent reminder uses canonical rent collection navigation and no legacy mutation drawer', async () => {
  const dashboard = await source('pages/landlord/dashboard.jsx');
  const organizationApi = await source('api/organization.js');
  const sharedOrganizationApi = await readFile(path.resolve(srcRoot, '../../shared/api/organization.js'), 'utf8');

  assert.doesNotMatch(dashboard, /SendRentReminderDrawer|rentReminderOpen|setRentReminderOpen/);
  assert.match(dashboard, /label: 'Rent Collection'/);
  assert.match(dashboard, /onClick: \(\) => navigate\('\/landlord\/rent-collection'\)/);
  assert.doesNotMatch(organizationApi, /updateAgentSettings|agent-settings/);
  assert.doesNotMatch(sharedOrganizationApi, /updateAgentSettings|agent-settings/);
  await assert.rejects(access(path.join(srcRoot, 'components/drawers/SendRentReminderDrawer.jsx')), (error) => error?.code === 'ENOENT');
});

test('landlord settings does not expose or retain the legacy AI Summary surface', async () => {
  const settings = await source('pages/landlord/settings.jsx');

  assert.doesNotMatch(settings, /AISummarySettings|AI Summary|aisummary/);
  await assert.rejects(access(path.join(srcRoot, 'sections/landlord/settings/AISummarySettings.jsx')), (error) => error?.code === 'ENOENT');
});

test('maintenance header uses the canonical request workflow rather than the retired agent route', async () => {
  const maintenances = await source('pages/landlord/maintenances.jsx');

  assert.doesNotMatch(maintenances, /\/landlord\/ai-center\/maintenance-agent|Agent settings/);
  assert.match(maintenances, /navigate\('\/landlord\/maintenances\/add'\)/);
  assert.match(maintenances, />New request<\/Button>/);
});

test('collection history copy and breadcrumbs point to canonical rent collection', async () => {
  const history = await source('pages/landlord/collections-history.jsx');

  assert.doesNotMatch(history, /Collections Agent|\/landlord\/ai-center\/collections-agent|Run the/);
  assert.match(history, /\{ label: 'Rent collection', path: '\/landlord\/rent-collection' \}/);
  assert.match(history, />Rent Collection History<\/Typography>/);
  assert.match(history, /Rent follow-up and collection activity across your leases\./);
  assert.match(history, /Rent collection activity will appear here as follow-ups are recorded\./);
});

test('landlord finance lists consolidate into one Accounting workspace', async () => {
  const routes = await source('routes/MainRoutes.jsx');
  const destinations = pages.find(({ id }) => id === 'group-landlord-navigation')?.children ?? [];
  const accounting = destinations.find(({ id }) => id === 'accounting');

  assert.match(routes, /import\('pages\/landlord\/finances'\)/);
  assert.doesNotMatch(routes, /import\('pages\/landlord\/(expenses|payments|ledger|money-activity)'\)/);
  assert.equal(
    destinations.some(({ id }) => id === 'money-center'),
    false
  );
  assert.deepEqual(
    accounting?.children.map(({ title }) => title),
    ['Finances', 'Rent Collection', 'Tax Center', 'Reports & Analytics']
  );
});
test('Percy starter prompts and composer fail closed when the runtime is unavailable', async () => {
  const aiCenter = await source('pages/landlord/ai-center.jsx');
  const mobilePanel = aiCenter.slice(aiCenter.indexOf('{mobilePanelOpen &&'));

  assert.doesNotMatch(aiCenter, /settings\?tab=aiSummary|Percy settings/);
  assert.doesNotMatch(aiCenter, /Property Peace data reviewed/);
  assert.match(aiCenter, /disabled=\{!aiRuntimeReady \|\| !percyReadiness\.canInvoke \|\| thinking \|\| conversationLoading\}/);
  assert.match(aiCenter, /disabled=\{!aiRuntimeReady \|\| !percyReadiness\.canInvoke \|\| summaryLoading \|\| conversationLoading\}/);
  assert.match(mobilePanel, /to="\/landlord\/ai-center\/collections-history"/);
  assert.match(mobilePanel, />\s*Activity history\s*<\/Button>/);
});
