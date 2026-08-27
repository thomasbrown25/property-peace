import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = () => readFile(new URL('./RentPaymentAccessPanel.jsx', import.meta.url), 'utf8');

test('access panel presents the approved states with safe, actionable controls', async () => {
  const panel = await source();
  assert.ok(panel.includes('presentation?.title'));
  assert.ok(panel.includes('presentation?.message'));
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /requesting \|\| loading/);
  assert.ok(panel.includes("primaryLabel === 'Finish payment setup'"));
  assert.match(panel, /Refresh status/);
  assert.match(panel, /Access approved[\s\S]*Payment setup[\s\S]*Ready to collect/);
  assert.match(panel, /&:focus-visible/);
  assert.doesNotMatch(panel, /Premium/);
});

test('access panel keeps setup out of unapproved states and offers retry after errors', async () => {
  const panel = await source();
  assert.ok(panel.includes("primaryLabel === 'Finish payment setup' ? onConfigure : onRefresh"));
  assert.ok(panel.includes("primaryLabel === 'Finish payment setup' && !onConfigure"));
  assert.match(panel, /onRefresh/);
  assert.match(panel, /Online rent payments[\s\S]*Manual rent records remain available/);
});
