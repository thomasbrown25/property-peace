import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../pages/landlord/checklists.jsx', import.meta.url), 'utf8');

test('defaults to created date and applies selected column sorting after filters', () => {
  assert.match(page, /useState\(\{ key: 'created', direction: 'desc' \}\)/);
  assert.match(page, /sortChecklistPortfolio\(filtered, sort\.key, sort\.direction\)/);
  assert.match(page, /prev\.key === key \? \(prev\.direction === 'asc' \? 'desc' : 'asc'\) : 'asc'/);
});

test('every named column is a keyboard-accessible sorting control with direction feedback', () => {
  assert.match(page, /\['Home', 'Checklist', 'Lease', 'Progress', 'Inspection', 'Status'\]\.map/);
  assert.match(page, /aria-sort=\{sort\.key === key \? \(sort\.direction === 'asc' \? 'ascending' : 'descending'\) : 'none'\}/);
  assert.match(page, /onClick=\{\(\) => handleSort\(key\)\}/);
  assert.match(page, /aria-label=\{`Sort by \$\{label\}/);
});
