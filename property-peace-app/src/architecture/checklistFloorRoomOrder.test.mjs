import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');

test('specific checklist room cards render in floor order even for older saved checklists', () => {
  assert.match(source, /import \{ sortRoomsByFloor \} from 'utils\/checklistFloorPlan\.mjs'/);
  assert.match(source, /return sortRoomsByFloor\(Array\.from\(grouped\.entries\(\)\)\.map\(\(\[name, roomItems\]\) => \(\{ name, items: roomItems \}\)\)\)/);
});
