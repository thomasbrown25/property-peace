import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./moneyCenter.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../components/money-center/MoneyCenter.jsx', import.meta.url), 'utf8');
const controller = await readFile(new URL('../../../property-peace-api/Controllers/MoneyCenterController.cs', import.meta.url), 'utf8');

test('Money Center client uses only the server contract endpoints', () => {
  assert.match(source, /const ROOT = ['"]\/api\/money-center['"]/);
  assert.match(source, /axiosServices\.get\(ROOT/);
  assert.match(source, /`\$\{ROOT\}\/items`/);
  assert.match(source, /`\$\{ROOT\}\/export`/);
  assert.match(source, /responseType:\s*['"]blob['"]/);
});

test('Money Center client sends contract query names', () => {
  for (const name of ['from', 'to', 'propertyId', 'unitId', 'upcomingDays']) assert.match(source, new RegExp(name));
  for (const name of ['from', 'to', 'propertyId', 'unitId', 'upcomingDays', 'limit']) assert.match(controller, new RegExp(`\\b${name}\\b`, 'i'));
});

test('export download always cleans up its temporary DOM node and object URL', () => {
  assert.match(source, /finally\s*{/);
  assert.match(source, /link\.remove\(\)/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
});

test('interactive Money Center surfaces expose keyboard activation', () => {
  assert.match(component, /function keyboardAction/);
  assert.match(component, /role:\s*'button'/);
  assert.match(component, /tabIndex:\s*0/);
  assert.match(component, /onKeyDown/);
});

test('interactive truncation disclosure confirms the accountant export remains complete', () => {
  assert.match(component, /accountant-review CSV includes every source record in the selected period/i);
  assert.doesNotMatch(component, /CSV[^.]*may also be limited/i);
});

test('Money Center hero subtitle keeps readable contrast on the dark background', () => {
  assert.match(component, /<Typography sx={{ color: alpha\('#fff', 0\.86\),[^}]+}}>Recorded property activity/);
});
