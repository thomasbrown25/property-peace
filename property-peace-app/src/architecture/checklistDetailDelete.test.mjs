import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');

test('schedule visit label and date input do not paint a white background', () => {
  const control = source.match(/function ScheduleVisitControl\([\s\S]*?\/\/ Key legend shown/)?.[0];
  assert.ok(control);
  assert.match(control, /InputLabelProps=\{\{ shrink: true, style: \{ background: 'transparent' \} \}\}/);
  assert.match(control, /& \.MuiOutlinedInput-root': \{ bgcolor: 'transparent' \}/);
});

test('existing checklist has a red Delete button immediately after visit Save', () => {
  const control = source.match(/function ScheduleVisitControl\([\s\S]*?\/\/ Key legend/)?.[0];
  assert.ok(control);
  assert.match(control, /\bSave\s*<\/Button>[\s\S]*?<Button[\s\S]*?color="error"[\s\S]*?onClick=\{onDelete\}[\s\S]*?Delete\s*<\/Button>/);
  assert.match(source, /<ScheduleVisitControl[\s\S]*?onDelete=\{\(\) => setChecklistToDelete\(activeChecklist\)\}/);
});

test('detail deletion requires confirmation, deletes only the selected checklist, and returns to the table after success', () => {
  assert.match(source, /<Dialog\s+open=\{Boolean\(checklistToDelete\)\}/);
  assert.match(source, /Delete checklist\?/);
  assert.match(source, /permanently removed[\s\S]*?cannot be undone/i);
  assert.match(source, /onClick=\{\(\) => setChecklistToDelete\(null\)\}/);
  assert.match(source, /checklistAPI\.deleteChecklist\(checklistToDelete\.id\)/);
  assert.match(source, /if \(result\?\.success === false\) throw/);
  assert.match(source, /navigate\('\/landlord\/checklists'\)/);
  assert.match(source, /Failed to delete checklist/);
});

test('detail heading uses a checklist icon and no back-arrow button', () => {
  const header = source.match(/\{\/\* Header \*\/\}[\s\S]*?\{loading \? \(/)?.[0];
  assert.ok(header);
  assert.match(header, /<AuditOutlined[^>]*\/>/);
  assert.doesNotMatch(header, /<ArrowLeftOutlined/);
  assert.doesNotMatch(header, /<HomeOutlined/);
});

test('room controls and instructions are separate white panels above the main card', () => {
  const detail = source.match(/function InspectionColumn\([\s\S]*?function normalizeChecklistTitle/)?.[0];
  assert.ok(detail);
  assert.match(detail, /\{checklist && \(\s*<Grid container[\s\S]*?Rooms[\s\S]*?Add Room[\s\S]*?<KeyLegend[\s\S]*?<\/Grid>\s*\)\}[\s\S]*?<MainCard/);
  assert.match(detail, /bgcolor: '#fff'/);
  assert.match(source, /function KeyLegend[\s\S]*?bgcolor: '#fff'/);
});

test('progress is first within the main checklist card before room items', () => {
  const detail = source.match(/function InspectionColumn\([\s\S]*?function normalizeChecklistTitle/)?.[0];
  assert.ok(detail);
  const card = detail.slice(detail.indexOf('<MainCard'));
  assert.ok(card.indexOf('<LinearProgress') > -1);
  assert.ok(card.indexOf('<LinearProgress') < card.indexOf('{/* Column body */}'));
});

test('checklist type is the detail heading and property name is a subtitle beneath it', () => {
  assert.match(source, /<Typography variant="h5"[\s\S]*?\{activeType \? \(activeType === MOVE_IN \? 'Move-in Checklist' : 'Move-out Checklist'\) : displayPropertyName\}[\s\S]*?<\/Typography>/);
  assert.match(source, /<Typography variant="body2" color="text.secondary"[\s\S]*?\{displayPropertyName\}[\s\S]*?<\/Typography>/);
});
