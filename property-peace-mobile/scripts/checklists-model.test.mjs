import assert from 'node:assert/strict';
import test from 'node:test';

let homeModel;
let checklistModel;
let loadError;

try {
  homeModel = await import('../src/features/checklists/checklistHomeModel.ts');
  checklistModel = await import('../src/features/checklists/checklistModel.ts');
} catch (error) {
  loadError = error;
}

const requireModels = () => {
  assert.equal(loadError, undefined);
  return { ...homeModel, ...checklistModel };
};

test('property search matches names and full addresses without changing source order', () => {
  const { filterChecklistProperties } = requireModels();
  const properties = [
    { id: 1, name: 'Maple House', streetAddress: '10 Oak St', city: 'Columbus', state: 'OH' },
    { id: 2, name: 'River Flats', streetAddress: '22 Main St', city: 'Dayton', state: 'OH' },
  ];
  assert.deepEqual(filterChecklistProperties(properties, 'dayton').map(({ id }) => id), [2]);
  assert.deepEqual(filterChecklistProperties(properties, '').map(({ id }) => id), [1, 2]);
});

test('unit selection follows the web property type rule', () => {
  const { isMultiUnitProperty } = requireModels();
  for (const propertyType of ['MultiUnit', 'SmallMultiFamily', 'ApartmentBuilding', 'MultiFamily', 'Other']) {
    assert.equal(isMultiUnitProperty({ propertyType }), true, propertyType);
  }
  assert.equal(isMultiUnitProperty({ propertyType: 'SingleFamily' }), false);
});

test('condition choices exactly match the web checklist contract', () => {
  const { CHECKLIST_CONDITIONS } = requireModels();
  assert.deepEqual(CHECKLIST_CONDITIONS, [
    { value: 'Good', label: 'Good – No issues' },
    { value: 'NC', label: 'NC – Needs Cleaning' },
    { value: 'NP', label: 'NP – Needs Painting' },
    { value: 'NR', label: 'NR – Needs Repair' },
    { value: 'NSC', label: 'NSC – Needs Spot Cleaning' },
    { value: 'NSP', label: 'NSP – Needs Spot Painting' },
    { value: 'RP', label: 'RP – Needs Replacing' },
  ]);
});

test('normalization accepts PascalCase and retains every editable checklist field', () => {
  const { normalizeChecklist } = requireModels();
  const result = normalizeChecklist({
    Id: 8,
    ChecklistType: 40,
    ChecklistTypeName: 'MoveInChecklist',
    PropertyId: 3,
    UnitId: 4,
    LeaseId: 5,
    CounterpartChecklistId: 9,
    Title: 'Move in',
    RoomNames: ['Kitchen'],
    Items: [{
      Id: 11,
      Name: 'Floors',
      Category: 'Kitchen',
      Condition: 'NC',
      Notes: 'Dusty',
      HasDamage: true,
      DamageDescription: 'Scratch',
      PhotoBlobNames: ['a.jpg'],
      PhotoBlobUrls: ['https://example.test/a.jpg'],
      SortOrder: 1,
    }],
  });
  assert.equal(result.counterpartChecklistId, 9);
  assert.deepEqual(result.roomNames, ['Kitchen']);
  assert.deepEqual(result.items[0].photoBlobNames, ['a.jpg']);
  assert.equal(result.items[0].damageDescription, 'Scratch');
});

test('linked move in and move out records form one condition cycle', () => {
  const { buildConditionCycles } = requireModels();
  const cycles = buildConditionCycles([
    { id: 1, checklistType: 40, counterpartChecklistId: 2, items: [] },
    { id: 2, checklistType: 41, counterpartChecklistId: 1, items: [] },
  ]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].moveIn.id, 1);
  assert.equal(cycles[0].moveOut.id, 2);
});

test('unlinked records with the same lease form one condition cycle', () => {
  const { buildConditionCycles } = requireModels();
  const cycles = buildConditionCycles([
    { id: 3, checklistType: 40, leaseId: 12, items: [] },
    { id: 4, checklistType: 41, leaseId: 12, items: [] },
  ]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].moveIn.id, 3);
  assert.equal(cycles[0].moveOut.id, 4);
});

test('explicit counterpart linkage wins over an earlier same-lease candidate', () => {
  const { buildConditionCycles } = requireModels();
  const cycles = buildConditionCycles([
    { id: 5, checklistType: 40, leaseId: 12, counterpartChecklistId: 7, items: [] },
    { id: 6, checklistType: 41, leaseId: 12, items: [] },
    { id: 7, checklistType: 41, leaseId: 12, counterpartChecklistId: 5, items: [] },
  ]);

  assert.equal(cycles[0].moveIn.id, 5);
  assert.equal(cycles[0].moveOut.id, 7);
  assert.equal(cycles[1].moveOut.id, 6);
});

test('rooms combine explicit names and item categories without case duplicates', () => {
  const { groupChecklistRooms } = requireModels();
  const rooms = groupChecklistRooms({
    roomNames: ['Kitchen', 'Empty room'],
    items: [
      { id: 1, name: 'Floors', category: 'kitchen' },
      { id: 2, name: 'Entry', category: '' },
    ],
  });
  assert.deepEqual(rooms.map(({ name }) => name), ['Kitchen', 'Empty room', 'General']);
  assert.deepEqual(rooms[0].items.map(({ id }) => id), [1]);
});

test('the final condition completes a checklist and clearing one reopens it', () => {
  const { serializeChecklistUpdate, withItemCondition } = requireModels();
  const original = {
    id: 8,
    items: [
      { id: 1, name: 'Walls', condition: 'Good' },
      { id: 2, name: 'Floors', condition: '' },
    ],
  };
  const completed = withItemCondition(original, 2, 'NC', '2026-08-22T12:00:00.000Z');
  assert.equal(completed.isCompleted, true);
  assert.equal(completed.completedAt, '2026-08-22T12:00:00.000Z');
  const reopened = withItemCondition(completed, 1, null, '2026-08-22T12:01:00.000Z');
  assert.equal(reopened.isCompleted, false);
  assert.equal(reopened.completedAt, null);
  assert.equal(serializeChecklistUpdate(reopened).Items[0].Condition, '');
  assert.equal(serializeChecklistUpdate(reopened).CompletedAt, null);
});

test('room operations reject duplicates and rename every matching item category', () => {
  const { addChecklistRoom, renameChecklistRoom } = requireModels();
  const checklist = { roomNames: ['Kitchen'], items: [{ id: 1, name: 'Floors', category: 'Kitchen' }] };
  assert.throws(() => addChecklistRoom(checklist, ' kitchen '), /already exists/i);
  const renamed = renameChecklistRoom(checklist, 'Kitchen', 'Galley');
  assert.deepEqual(renamed.roomNames, ['Galley']);
  assert.equal(renamed.items[0].category, 'Galley');
});

test('default items cannot be removed while custom items can', () => {
  const { removeCustomChecklistItem } = requireModels();
  const checklist = {
    items: [
      { id: 1, name: 'Walls', sortOrder: 0 },
      { id: 2, name: 'Custom shelf', sortOrder: 1000 },
    ],
  };
  assert.throws(() => removeCustomChecklistItem(checklist, 1), /default item/i);
  assert.deepEqual(removeCustomChecklistItem(checklist, 2).items.map(({ id }) => id), [1]);
});

test('update serialization preserves counterpart, rooms, conditions, notes, damage and photos', () => {
  const { normalizeChecklist, serializeChecklistUpdate } = requireModels();
  const checklist = normalizeChecklist({
    Id: 8,
    CounterpartChecklistId: 9,
    RoomNames: ['Kitchen'],
    Items: [{
      Id: 11,
      Name: 'Floors',
      Category: 'Kitchen',
      Condition: 'NR',
      Notes: 'Loose board',
      HasDamage: true,
      DamageDescription: 'Split near doorway',
      PhotoBlobNames: ['a.jpg'],
      PhotoBlobUrls: ['https://example.test/a.jpg'],
      IsChecked: true,
      CheckedAt: '2026-08-22T12:00:00.000Z',
      SortOrder: 1,
    }],
  });
  const payload = serializeChecklistUpdate(checklist);
  assert.equal(payload.CounterpartChecklistId, 9);
  assert.deepEqual(payload.RoomNames, ['Kitchen']);
  assert.deepEqual(payload.Items[0], {
    Id: 11,
    Name: 'Floors',
    Description: '',
    Category: 'Kitchen',
    Condition: 'NR',
    Notes: 'Loose board',
    HasDamage: true,
    DamageDescription: 'Split near doorway',
    PhotoBlobNames: ['a.jpg'],
    PhotoBlobUrls: ['https://example.test/a.jpg'],
    IsChecked: true,
    CheckedAt: '2026-08-22T12:00:00.000Z',
    SortOrder: 1,
  });
});

test('picker assets receive safe multipart filename and MIME defaults', () => {
  const { toChecklistUploadAsset } = requireModels();
  assert.deepEqual(toChecklistUploadAsset({ uri: 'file:///photo', fileName: null, mimeType: null }), {
    uri: 'file:///photo',
    name: 'checklist-photo.jpg',
    type: 'image/jpeg',
  });
});
