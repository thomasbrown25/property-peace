import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('function RoomInspectionSection('), source.indexOf('function InspectionColumn('));
const column = source.slice(source.indexOf('function InspectionColumn('), source.indexOf('function normalizeChecklistTitle('));

test('room headers use parent-controlled accordion state for click and keyboard', () => {
  assert.match(column, /const \[expandedRoomName, setExpandedRoomName\] = useState\(null\)/);
  assert.match(column, /expanded=\{expandedRoomName === room\.name\}/);
  assert.match(column, /onToggle=\{\(\) => setExpandedRoomName\(\(current\) => current === room\.name \? null : room\.name\)\}/);
  assert.doesNotMatch(section, /const \[expanded, setExpanded\] = useState/);
  assert.match(section, /aria-expanded=\{expanded\}/);
  assert.equal((section.match(/onToggle\(\)/g) || []).length, 2);
  assert.match(section, /<Collapse in=\{expanded\}/);
});

test('expansion resets for another checklist but persists across room renaming', () => {
  assert.match(column, /setExpandedRoomName\(null\);\s*\}, \[checklist\?\.id\]\)/);
  assert.match(column, /setExpandedRoomName\(\(current\) => current === currentName \? normalizedNextName : current\)/);
});
