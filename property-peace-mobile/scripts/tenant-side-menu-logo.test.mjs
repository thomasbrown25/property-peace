import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const menu = readFileSync(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
const paymentsHeader = readFileSync(new URL('../src/components/LandlordPageHeader.tsx', import.meta.url), 'utf8');

test('tenant side menu shows the same theme-specific logo as the Payments header', () => {
  for (const [name, asset] of [
    ['lightLogo', 'property-peace-navbar-logo.png'],
    ['darkLogo', 'property-peace-logo.png'],
  ]) {
    assert.match(paymentsHeader, new RegExp(`const ${name} = require\\([^\\n]*${asset.replace('.', '\\.')}['"]\\)`));
    assert.match(menu, new RegExp(`const ${name} = require\\([^\\n]*${asset.replace('.', '\\.')}['"]\\)`));
  }
  assert.match(menu, /audience === 'tenant'\s*\? <Image source=\{mode === 'dark' \? darkLogo : lightLogo\} style=\{styles\.sheetLogo\} resizeMode="contain" accessibilityLabel="Property Peace"/);
  assert.match(menu, /: <Text style=\{\[styles\.sheetEyebrow[^\n]*>PROPERTY PEACE<\/Text>/);
  assert.match(menu, /sheetLogo: \{ width: 148, height: 42 \}/);
});
