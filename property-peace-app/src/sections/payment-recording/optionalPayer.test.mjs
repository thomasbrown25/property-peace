import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manual payment allows an unattributed payer while retaining optional tenant attribution', () => {
  const drawer = readFileSync(new URL('../../components/drawers/RecordPaymentDrawer.jsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('./TenantPaymentSelector.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(drawer, /if \(!\(selectedTenant\?\.id/);
  assert.doesNotMatch(drawer, /disabled=\{[^}]*!selectedTenant/);
  assert.match(drawer, /tenantId: selectedTenant\?\.id \?\? selectedTenant\?\.Id \?\? null/);
  assert.match(selector, />Tenant who paid<\/Typography>/);
  assert.doesNotMatch(selector, /Tenant who paid \(optional\)/);
  assert.doesNotMatch(selector, /Tenant who paid \*/);
});
