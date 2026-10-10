import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRoomNames, buildFloorInspectionItems, getRoomNameErrors, removeInspectionRooms } from './checklistFloorPlan.mjs';

test('renaming any generated room updates every item category without changing item details', () => {
  const items = buildFloorInspectionItems([{ bedrooms: '1', bathrooms: '1' }]);
  const originals = [...new Set(items.map((item) => item.Category))];
  const names = originals.map((name) => `Custom ${name}`);
  const renamed = applyRoomNames(items, names);
  assert.deepEqual([...new Set(renamed.map((item) => item.Category))], names);
  assert.deepEqual(renamed.map((item) => item.Name), items.map((item) => item.Name));
  assert.deepEqual([...new Set(items.map((item) => item.Category))], originals);
});

test('removing a generated room drops all its items, preserves renamed neighbors and reindexes order', () => {
  const items = buildFloorInspectionItems([{ bedrooms: '1', bathrooms: '1.5' }]);
  const remaining = removeInspectionRooms(items, ['Bathroom Half', 'Kitchen']);
  const originalRooms = [...new Set(remaining.map((item) => item.Category))];
  const renamed = applyRoomNames(remaining, originalRooms.map((room) => room === 'Living Room' ? 'Family Room' : room));
  assert.ok(!renamed.some(({ Category }) => Category === 'Kitchen' || Category === 'Bathroom Half'));
  assert.ok(renamed.some(({ Category }) => Category === 'Family Room'));
  assert.deepEqual(renamed.map(({ SortOrder }) => SortOrder), renamed.map((_, index) => index));
  assert.equal(items[0].Category, 'Kitchen');
  assert.deepEqual(removeInspectionRooms(items, []), items);
});

test('room names reject blanks and case-insensitive duplicates', () => {
  assert.deepEqual(getRoomNameErrors(['Kitchen', ' kitchen ', '  ']), ['', 'Room names must be unique', 'Enter a room name']);
  assert.throws(() => applyRoomNames([{ Category: 'Kitchen' }, { Category: 'Bathroom' }], ['Kitchen', ' kitchen ']), /unique/);
  assert.throws(() => applyRoomNames([{ Category: 'Kitchen' }], []), /unique/);
  assert.deepEqual(applyRoomNames([{ Category: 'Kitchen' }], ['  Galley  ']), [{ Category: 'Galley' }]);
});
