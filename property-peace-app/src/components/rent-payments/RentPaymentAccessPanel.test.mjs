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
  assert.ok(panel.includes('presentation?.canConfigure === true'));
  assert.match(panel, /Refresh status/);
  assert.doesNotMatch(panel, /Access approved[\s\S]*Payment setup[\s\S]*Ready to collect/);
  assert.match(panel, /justifyContent:\s*primaryLabel === 'Refresh status' \? 'flex-end'/);
  assert.match(panel, /&:focus-visible/);
  assert.doesNotMatch(panel, /Premium/);
});

test('access panel keeps setup out of unapproved states and offers retry after errors', async () => {
  const panel = await source();
  assert.ok(panel.includes('isConfigureAction ? onConfigure : onRefresh'));
  assert.ok(panel.includes('isConfigureAction && !onConfigure'));
  assert.match(panel, /onRefresh/);
  assert.match(panel, /Connected Account Status/);
  assert.doesNotMatch(panel, /Included with the Free plan/);
  assert.match(panel, /state !== 'under-review'/);
});

test('access panel shows landlords a status chip for every access state', async () => {
  const panel = await source();
  assert.match(panel, /pending:\s*\{\s*label:\s*'Under review',\s*color:\s*'warning'/);
  assert.match(panel, /approved-onboarding[\s\S]*label:\s*'Approved'/);
  assert.match(panel, /under-review[\s\S]*label:\s*'Setup under review'/);
  assert.match(panel, /ready:[\s\S]*label:\s*'Ready'/);
  assert.match(panel, /<Chip[\s\S]*label=\{statusChip\.label\}/);
});
