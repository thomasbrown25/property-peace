import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const style = read('./recordTabsStyle.js');

test('shared landlord page tabs retain the property tab design in light and dark mode', () => {
  for (const token of ['minHeight: 42', 'px: 1.25', 'mr: 1.5', 'borderRadius: 1.5', "fontWeight: 700", "'&:hover'", "'&.Mui-selected'", "'& .MuiTabs-indicator'", "theme.palette.mode === 'dark'"]) {
    assert.ok(style.includes(token), `missing ${token}`);
  }
});

test('lease, tenant, payments, and tools use the record tab strip', () => {
  for (const path of ['../leases/LeaseDetailView.jsx', '../../../pages/landlord/tenant.jsx', '../../../pages/landlord/online-payments.jsx', '../../../pages/landlord/tools-tabs.jsx']) {
    assert.match(read(path), /<Box sx=\{recordTabsSx\}>/, path);
  }
});
