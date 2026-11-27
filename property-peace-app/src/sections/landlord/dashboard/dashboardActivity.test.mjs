import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadDashboardActivity, RECENT_ACTIVITY_LIMIT } from './dashboardActivity.mjs';
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');

test('recent activity requests five records in organization scope and caps oversized responses', async () => {
  const items = Array.from({ length: 9 }, (_, id) => ({ id }));
  const client = { get: async (url, config) => {
    assert.equal(url, '/api/activities');
    assert.deepEqual(config.params, { page: 1, pageSize: 5 });
    assert.equal(config.headers['X-Organization-Id'], '7');
    return { data: { success: true, data: { activities: items } } };
  } };
  assert.equal(RECENT_ACTIVITY_LIMIT, 5);
  assert.deepEqual(await loadDashboardActivity(client, 7), items.slice(0, 5));
});

test('activity failures do not masquerade as no recent activity', async () => {
  await assert.rejects(loadDashboardActivity({ get: async () => ({ data: { success: false } }) }, 1));
});

test('dashboard sidebar shows recent activity without loading or showing Stripe accounts', () => {
  const sidebar = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  for (const source of [sidebar, home]) parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(sidebar, /component="aside" aria-labelledby="owner-recent-activity-heading"/);
  assert.match(sidebar, /id="owner-recent-activity-heading"[^>]*>Recent activity<\/Typography>/);
  assert.match(sidebar, /to="\/landlord\/activity"/);
  assert.doesNotMatch(sidebar, /Stripe account|owner-home-accounts|loadDashboardAccounts/);
  assert.match(sidebar, /\['owner-home-activity', organizationId, userId\]/);
  assert.match(home, /gridTemplateAreas: \{ xs: '"setup" "main" "sidebar"', lg: '"setup main" "sidebar main"' \}/);
  assert.match(home, /aria-labelledby="owner-properties-heading"[\s\S]*<Stack spacing=\{3\} sx=\{\{ gridArea: 'sidebar'[^\n]*>[\s\S]*?<Box component="section" aria-labelledby="owner-next-heading"[\s\S]*?<\/Box>\s*<OwnerHomeSidebar \/>\s*<\/Stack>/);
});

test('the dashboard Tasks empty state shows only the scheduled-task message', () => {
  const home = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const tasks = home.slice(home.indexOf('aria-labelledby="owner-next-heading"'), home.indexOf('<OwnerHomeSidebar />'));
  assert.match(tasks, /\) : \(\s*<Typography[^>]*>\s*Nothing scheduled for today\.\s*<\/Typography>/);
});
