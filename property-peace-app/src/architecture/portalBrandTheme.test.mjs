import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('portal brand tokens flow into the default MUI palette without replacing semantic status colors', () => {
  const brand = source('../themes/brand.js');
  const palette = source('../themes/palette.js');
  const preset = source('../themes/theme/default.js');
  const buttons = source('../themes/overrides/Button.js');
  for (const hex of ['#102C29', '#247568', '#B9E4CB', '#F8F7F1', '#24343A']) {
    assert.ok(brand.includes(hex), `missing portal brand color ${hex}`);
  }
  assert.match(preset, /primaryColors = mode === ThemeMode\.DARK/);
  assert.match(preset, /brand\.teal/);
  assert.match(palette, /background: \{\s*paper: surfaces\.paper,\s*default: surfaces\.app/);
  assert.match(palette, /success: secondaryGreen/);
  for (const status of ['error', 'warning', 'info']) assert.match(preset, new RegExp(`\\b${status}: \\{`));
  assert.match(buttons, /containedPrimary: \{[\s\S]*?backgroundColor: theme\.palette\.primary\.main/);
  assert.match(buttons, /containedSuccess: \{/);
});

test('the top bar uses brand surfaces without restoring a landlord sidebar', () => {
  const header = source('../layout/Dashboard/Header/index.jsx');
  const navigation = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  assert.match(header, /theme\.palette\.brand\.forest/);
  assert.match(header, /theme\.palette\.background\.paper/);
  assert.match(navigation, /theme\.palette\.brand\.mint : theme\.palette\.primary\.main/);
  assert.match(content, /<LandlordPrimaryNavigation \/>/);
  assert.doesNotMatch(content, /<MainDrawer/);
});
