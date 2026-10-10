import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFloorInspectionItems, isValidFloorPlan, floorLabel, sortRoomsByFloor } from './checklistFloorPlan.mjs';

test('requires selected floor count and numeric bedroom/bathroom counts for every floor', () => {
  assert.equal(isValidFloorPlan(null, []), false);
  assert.equal(isValidFloorPlan(1, [{ bedrooms: '', bathrooms: '1' }]), false);
  assert.equal(isValidFloorPlan(2, [{ bedrooms: '1', bathrooms: '0' }]), false);
  assert.equal(isValidFloorPlan(1, [{ bedrooms: '0', bathrooms: '0' }]), true);
  assert.equal(isValidFloorPlan(2, [{ bedrooms: '2', bathrooms: '1' }, { bedrooms: '0', bathrooms: '2' }]), true);
  for (const value of ['-1', '1.5', 'many', '21']) {
    assert.equal(isValidFloorPlan(1, [{ bedrooms: value, bathrooms: '0' }]), false);
  }
  assert.equal(isValidFloorPlan(21, Array.from({ length: 21 }, () => ({ bedrooms: '0', bathrooms: '0' }))), false);
});

test('accepts whole or half bathroom counts and rejects other fractions or out-of-range values', () => {
  for (const baths of ['0.5', '1.5', '3.5', '20.5']) {
    assert.equal(isValidFloorPlan(1, [{ bedrooms: '1', bathrooms: baths }]), true, baths);
  }
  for (const baths of ['', '-0.5', '1.25', '1.7', '21', '21.5', 'oops']) {
    assert.equal(isValidFloorPlan(1, [{ bedrooms: '1', bathrooms: baths }]), false, baths);
  }
});

test('half baths get their own label, and full baths are qualified only when half baths exist', () => {
  const rooms = (bathrooms) => new Set(buildFloorInspectionItems([{ bedrooms: '0', bathrooms }]).map(({ Category }) => Category));
  assert.deepEqual(rooms('1.5'), new Set(['Kitchen', 'Living Room', 'Bathroom Full', 'Bathroom Half', 'Laundry', 'General']));
  assert.deepEqual(rooms('0.5'), new Set(['Kitchen', 'Living Room', 'Bathroom Half', 'Laundry', 'General']));
  assert.deepEqual(rooms('2.5'), new Set(['Kitchen', 'Living Room', 'Bathroom Full 1', 'Bathroom Full 2', 'Bathroom Half', 'Laundry', 'General']));
  assert.deepEqual(rooms('3'), new Set(['Kitchen', 'Living Room', 'Bathroom 1', 'Bathroom 2', 'Bathroom 3', 'Laundry', 'General']));
});

test('first-floor generated rooms stay unprefixed in a multi-floor checklist', () => {
  const rooms = [...new Set(buildFloorInspectionItems([
    { bedrooms: '1', bathrooms: '1.5' },
    { bedrooms: '1', bathrooms: '0.5' }
  ]).map(({ Category }) => Category))];
  assert.deepEqual(rooms, [
    'Kitchen', 'Living Room', 'Bedroom 1', 'Bathroom Full', 'Bathroom Half 1',
    'Laundry', 'General', '2nd Floor - Bedroom 2', '2nd Floor - Bathroom Half 2'
  ]);
});

test('half baths retain floor labels and full-bath numbering across floors', () => {
  const items = buildFloorInspectionItems([
    { bedrooms: '1', bathrooms: '1.5' },
    { bedrooms: '1', bathrooms: '2.5' }
  ]);
  assert.deepEqual([...new Set(items.map(({ Category }) => Category))], [
    'Kitchen', 'Living Room', 'Bedroom 1',
    'Bathroom Full 1', 'Bathroom Half 1', 'Laundry', 'General',
    '2nd Floor - Bedroom 2', '2nd Floor - Bathroom Full 2', '2nd Floor - Bathroom Full 3', '2nd Floor - Bathroom Half 2'
  ]);
  assert.equal(items.find((item) => item.Category === 'Bathroom Half 1').Name, 'Walls & Ceiling');
});

test('generated room and item order keeps all rooms of each floor together', () => {
  const items = buildFloorInspectionItems([
    { bedrooms: '1', bathrooms: '1.5' },
    { bedrooms: '1', bathrooms: '1' },
    { bedrooms: '0', bathrooms: '0.5' }
  ]);
  const rooms = [...new Set(items.map(({ Category }) => Category))];
  assert.deepEqual(rooms, [
    'Kitchen', 'Living Room', 'Bedroom 1',
    'Bathroom Full 1', 'Bathroom Half 1', 'Laundry', 'General',
    '2nd Floor - Bedroom 2', '2nd Floor - Bathroom Full 2', '3rd Floor - Bathroom Half 2'
  ]);
  assert.deepEqual(items.map(({ SortOrder }) => SortOrder), items.map((_, index) => index));
});

test('existing floor-prefixed rooms display floor by floor even when stored out of order', () => {
  const rooms = [
    { name: '1st Floor Kitchen' }, { name: '2nd Floor Bedroom' },
    { name: '1st Floor Laundry' }, { name: '3rd Floor Bathroom' },
    { name: '1st Floor General' }, { name: '2nd Floor Bathroom' },
    { name: 'Custom storage' }
  ];
  assert.deepEqual(sortRoomsByFloor(rooms).map(({ name }) => name), [
    '1st Floor Kitchen', '1st Floor Laundry', '1st Floor General',
    '2nd Floor Bedroom', '2nd Floor Bathroom', '3rd Floor Bathroom', 'Custom storage'
  ]);
  assert.deepEqual(sortRoomsByFloor([{ name: '2nd Floor Bedroom' }, { name: 'Kitchen' }, { name: 'Bedroom' }]).map(({ name }) => name), ['Kitchen', 'Bedroom', '2nd Floor Bedroom']);
  assert.deepEqual(sortRoomsByFloor([{ name: 'Kitchen' }, { name: 'Bedroom' }]).map(({ name }) => name), ['Kitchen', 'Bedroom']);
  assert.equal(rooms[1].name, '2nd Floor Bedroom');
});

test('unprefixed first-floor rooms display ahead of labeled upper floors', () => {
  const rooms = [
    { name: '2nd Floor - Bedroom' }, { name: 'Kitchen' },
    { name: '3rd Floor - Bathroom' }, { name: 'Laundry' }
  ];
  assert.deepEqual(sortRoomsByFloor(rooms).map(({ name }) => name), [
    'Kitchen', 'Laundry', '2nd Floor - Bedroom', '3rd Floor - Bathroom'
  ]);
});

test('multi-floor rooms keep first-floor names plain and number bedrooms/bathrooms continuously across floors', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21].map(floorLabel), [
    '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '11th Floor', '12th Floor', '13th Floor', '21st Floor'
  ]);
  const items = buildFloorInspectionItems([
    { bedrooms: '2', bathrooms: '1' },
    { bedrooms: '1', bathrooms: '2' }
  ]);
  const categories = new Set(items.map(({ Category }) => Category));
  assert.deepEqual(categories, new Set(['Kitchen', 'Living Room',
    'Bedroom 1', 'Bedroom 2', 'Bathroom 1',
    '2nd Floor - Bedroom 3', '2nd Floor - Bathroom 2', '2nd Floor - Bathroom 3',
    'Laundry', 'General']));
  assert.ok(items.findIndex((item) => item.Category === 'Bathroom 1') < items.findIndex((item) => item.Category === '2nd Floor - Bedroom 3'));
  assert.equal(items.find((item) => item.Category === 'Bedroom 1').Name, 'Walls & Ceiling');
  assert.deepEqual(items.map((item) => item.SortOrder), items.map((_, index) => index));
});

test('one floor has plain room names, numbering beds and baths only when repeated', () => {
  const single = new Set(buildFloorInspectionItems([{ bedrooms: '1', bathrooms: '1' }]).map((item) => item.Category));
  assert.deepEqual(single, new Set(['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry', 'General']));
  const multiple = new Set(buildFloorInspectionItems([{ bedrooms: '2', bathrooms: '3' }]).map((item) => item.Category));
  assert.deepEqual(multiple, new Set(['Kitchen', 'Living Room', 'Bedroom 1', 'Bedroom 2',
    'Bathroom 1', 'Bathroom 2', 'Bathroom 3', 'Laundry', 'General']));
});

test('multi-floor with a single bedroom or bathroom does not add an unnecessary number', () => {
  const categories = new Set(buildFloorInspectionItems([
    { bedrooms: '0', bathrooms: '1' }, { bedrooms: '1', bathrooms: '0' }
  ]).map((item) => item.Category));
  assert.ok(categories.has('Bathroom'));
  assert.ok(categories.has('2nd Floor - Bedroom'));
  assert.ok(![...categories].some((room) => /Bedroom 1|Bathroom 1/.test(room)));
});

test('zero bedrooms or bathrooms creates no phantom room', () => {
  const categories = new Set(buildFloorInspectionItems([{ bedrooms: '0', bathrooms: '1' }]).map((item) => item.Category));
  assert.ok(![...categories].some((room) => room.includes('Bedroom')));
  assert.ok(categories.has('Bathroom'));
});
