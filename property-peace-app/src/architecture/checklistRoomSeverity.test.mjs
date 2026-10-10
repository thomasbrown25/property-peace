import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const roomSection = source.slice(source.indexOf('function RoomInspectionSection('), source.indexOf('// ───', source.indexOf('function RoomInspectionSection(') + 1));

test('room header, chip and progress bar use the worst item condition, without altering counts', () => {
  assert.match(source, /import \{ getItemComplete, getRoomProgress, getRoomTone \} from 'utils\/checklistRoomProgress\.mjs'/);
  assert.match(roomSection, /const progress = getRoomProgress\(room\.items\)/);
  assert.match(roomSection, /const roomTone = getRoomTone\(room\.items\)/);
  assert.match(roomSection, /roomTone === 'error' \? theme\.palette\.error\.main/);
  assert.match(roomSection, /roomTone === 'warning' \? theme\.palette\.warning\.main/);
  assert.match(roomSection, /bgcolor: alpha\(progressColor, complete \? 0\.08 : 0\.04\)/);
  assert.match(roomSection, /color=\{roomTone === 'neutral' \? \(progress\.done > 0 \? 'primary' : 'default'\) : roomTone\}/);
  assert.match(roomSection, /value=\{progress\.pct\}/);
});
