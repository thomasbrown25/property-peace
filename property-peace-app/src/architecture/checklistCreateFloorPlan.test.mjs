import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/landlord/checklists.jsx', import.meta.url), 'utf8');

test('creation drawer gives checklist type the same floating label style as property and unit', () => {
  assert.match(source, /<Autocomplete\s+label="Checklist type"/);
  assert.match(source, /<Autocomplete\s+label="Property"/);
  assert.match(source, /<Autocomplete\s+label="Unit"/);
});

test('required searchable floors limits visible choices and selection reveals grouped per-floor counts', () => {
  assert.match(source, /<MuiAutocomplete[\s\S]*?filterOptions=\{limitedFloorOptions\}[\s\S]*?label="How many floors"/);
  assert.match(source, /createFilterOptions\(\{ limit: 5/);
  assert.match(source, /floorPlan\.slice\(0, floorCount\)\.map/);
  assert.match(source, /floorLabel\(index \+ 1\)/);
  assert.match(source, /\{ key: 'bedrooms', label: 'Bedrooms' \}/);
  assert.match(source, /\{ key: 'bathrooms', label: 'Bathrooms' \}/);
  assert.match(source, /label=\{label\}/);
});

test('bathroom count accepts only whole and half steps and explains the new room labels', () => {
  assert.match(source, /key === 'bathrooms' \? 0\.5 : 1/);
  assert.match(source, /bathrooms can include a half bath/i);
  assert.match(source, /isValidBathroomCount\(floor\[key\]\)/);
});

test('room name trash action immediately removes a room from the drawer and creation payload', () => {
  assert.match(source, /const \[removedRoomNames, setRemovedRoomNames\] = useState\(\[\]\)/);
  assert.match(source, /generatedRoomNames\.filter\(\(name\) => !removedRoomNames\.includes\(name\)\)/);
  assert.match(source, /<DeleteOutlined\s*\/>/);
  assert.match(source, /aria-label=\{`Remove \$\{originalName\} room`\}/);
  assert.match(source, /setRemovedRoomNames\(\(current\) => \[\.\.\.current, originalName\]\)/);
  assert.match(source, /removeInspectionRooms\(buildFloorInspectionItems\(floorPlan\.slice\(0, floorCount\)\), removedRoomNames\)/);
  assert.match(source, /setRemovedRoomNames\(\[\]\)/);
});

test('creation is gated on complete floor counts and sends generated rooms through existing checklist API', () => {
  assert.match(source, /isValidFloorPlan\(floorCount, floorPlan\)/);
  assert.match(source, /const items = applyRoomNames\(removeInspectionRooms\(buildFloorInspectionItems\(floorPlan\.slice\(0, floorCount\)\), removedRoomNames\), roomNames\)/);
  assert.match(source, /Items: items/);
  assert.match(source, /!validRoomNames/);
  assert.match(source, /RoomNames: \[\.\.\.new Set\(items\.map\(\(item\) => item\.Category\)\)\]/);
  assert.match(source, /setFloorCount\(null\)/);
});
