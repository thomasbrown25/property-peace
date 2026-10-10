import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const control = source.slice(source.indexOf('function ScheduleVisitControl('), source.indexOf('// Key legend shown'));

test('schedule visit prefills local now only when no visit was previously saved', () => {
  assert.match(control, /useState\(\(\) => toDateTimeLocalValue\(checklist\?\.inspectionDate \|\| new Date\(\)\)\)/);
  assert.match(control, /setScheduledAt\(toDateTimeLocalValue\(checklist\?\.inspectionDate \|\| new Date\(\)\)\)/);
  assert.match(control, /\[checklist\?\.id, checklist\?\.inspectionDate\]/);
  assert.match(source, /date\.getTime\(\) - date\.getTimezoneOffset\(\) \* 60000/);
});

test('default remains unsaved until the user clicks Save', () => {
  assert.match(control, /onClick=\{handleSave\}/);
  assert.match(control, /const inspectionDate = fromDateTimeLocalValue\(scheduledAt\)/);
  assert.match(control, /checklistAPI\.updateChecklist\(checklist\.id, \{ Id: checklist\.id, InspectionDate: inspectionDate \}\)/);
});
