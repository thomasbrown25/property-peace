import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const row = source.match(/function InspectionItemRow\([\s\S]*?\/\/ ─── Inspection Column/)?.[0];

test('mobile retains the existing dropdown, desktop shows the seven square condition choices', () => {
  assert.ok(row);
  assert.match(row, /<Select[\s\S]*?display: \{ xs: 'inline-flex', md: 'none' \}[\s\S]*?<\/Select>/);
  assert.match(row, /display: \{ xs: 'none', md: 'flex' \}[\s\S]*?CONDITION_OPTIONS\.map\(\(opt\) => \(/);
  assert.match(row, /width: 42, height: 42[\s\S]*?borderRadius: 1/);
  for (const value of ['Good', 'NC', 'NP', 'NR', 'NSC', 'NSP', 'RP']) {
    assert.match(source, new RegExp(`value: '${value}'`));
  }
});

test('desktop choices disclose descriptions and expose selected state for assistive technology', () => {
  assert.match(row, /<Tooltip key=\{opt\.value\} title=\{opt\.label\.split\('–'\)\[1\]\?\.trim\(\)\}/);
  assert.match(row, /aria-label=\{opt\.label\}/);
  assert.match(row, /aria-pressed=\{displayedCondition === opt\.value\}/);
});

test('desktop and mobile select locally at once and remain interactive while save runs', () => {
  assert.match(row, /createConditionSaveQueue\(/);
  assert.match(row, /value=\{displayedCondition \|\| ''\}/);
  assert.match(row, /queueRef\.current\.select\(newCondition\)/);
  assert.doesNotMatch(row, /disabled=\{saving\}/);
  assert.match(row, /onClick=\{\(\) => handleConditionChange\(opt\.value\)\}/);
  assert.match(row, /checklistAPI\.updateChecklist\(checklistId, \{ Id: checklistId, Items: updatedItems \}\)/);
});
