import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const legend = source.slice(source.indexOf('function KeyLegend('), source.indexOf('// Map a loaded item', source.indexOf('function KeyLegend(')));

test('legend places the numeric count after the muted description, without parentheses', () => {
  assert.doesNotMatch(legend, /\{abbr\} \(\{counts\[abbr\]\}\)/);
  assert.match(legend, /<Typography[^>]*>\{abbr\}<\/Typography>[\s\S]*<Typography[^>]*>\{desc\}[\s\S]*<Box component="span"[^>]*>\{counts\[abbr\]\}<\/Box><\/Typography>/);
  assert.doesNotMatch(legend, /gridTemplateColumns: '40px minmax\(0, 1fr\) auto'/);
  assert.match(legend, /component="span"[^>]*ml: 0\.75/);
});

test('legend receives selected checklist items and presents Good plus color-matched counts', () => {
  assert.match(source, /<KeyLegend items=\{checklist\.items \|\| \[\]\}/);
  assert.match(legend, /countChecklistConditions\(items\)/);
  assert.match(legend, /\['Good', 'No issues'\]/);
  assert.match(legend, /conditionThemeColor\(abbr, theme\)/);
  assert.match(legend, /counts\[abbr\]/);
  assert.match(legend, /color: conditionColor/);
});
