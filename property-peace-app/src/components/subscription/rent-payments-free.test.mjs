import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('pricing identifies online rent payments as Free-plan included with separate approval', async () => {
  const [card, comparison, settings] = await Promise.all([
    read('./PlanCard.jsx'),
    read('./PlanComparisonTable.jsx'),
    read('../../sections/admin/settings/AdminSettingsForm.jsx')
  ]);
  assert.match(card, /Approval required/);
  assert.match(comparison, /Included · Approval required/);
  assert.match(settings, /Online rent payments are included in Free/);
  assert.doesNotMatch(settings, /Online Rent Collection regardless of subscription plan/);
});

test('main app metadata advertises Free inclusion without claiming universal readiness', async () => {
  const [seo, metadata] = await Promise.all([read('../SEO/SEOHead.jsx'), read('../../../index.html')]);
  for (const source of [seo, metadata]) {
    assert.match(source, /online rent payments are included in Free/i);
    assert.match(source, /approval and setup/i);
    assert.doesNotMatch(source, /does not currently process online rent|processing is not currently available/i);
  }
});