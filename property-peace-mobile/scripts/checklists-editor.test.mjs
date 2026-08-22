import assert from 'node:assert/strict';
import test from 'node:test';

let model;
let loadError;
try {
  model = await import('../src/features/checklists/checklistEditorModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return model;
};

const pair = () => ({
  active: {
    id: 1,
    roomNames: ['Kitchen'],
    items: [{ id: 10, name: 'Floors', category: 'Kitchen', notes: '', damageDescription: '', hasDamage: false }],
  },
  counterpart: {
    id: 2,
    roomNames: ['Kitchen'],
    items: [{ id: 20, name: 'Floors', category: 'Kitchen' }],
  },
});

test('item detail save updates only the selected item and derives damage state', () => {
  const { withChecklistItemDetails } = required();
  const checklist = {
    items: [
      { id: 10, name: 'Floors', notes: '', damageDescription: '', hasDamage: false },
      { id: 11, name: 'Walls', notes: 'Keep', damageDescription: '', hasDamage: false },
    ],
  };
  const result = withChecklistItemDetails(checklist, 10, {
    notes: 'Loose board',
    damageDescription: 'Split at doorway',
  });
  assert.deepEqual(result.items[0], {
    id: 10,
    name: 'Floors',
    notes: 'Loose board',
    damageDescription: 'Split at doorway',
    hasDamage: true,
  });
  assert.equal(result.items[1], checklist.items[1]);
});

test('adding a room produces matching active and counterpart structures', () => {
  const { addRoomToChecklistPair } = required();
  const result = addRoomToChecklistPair(pair().active, pair().counterpart, 'Bedroom');
  assert.deepEqual(result.active.roomNames, ['Kitchen', 'Bedroom']);
  assert.deepEqual(result.counterpart.roomNames, ['Kitchen', 'Bedroom']);
});

test('renaming a room updates names and item categories on both sides', () => {
  const { renameRoomInChecklistPair } = required();
  const result = renameRoomInChecklistPair(pair().active, pair().counterpart, 'Kitchen', 'Galley');
  assert.deepEqual(result.active.roomNames, ['Galley']);
  assert.equal(result.active.items[0].category, 'Galley');
  assert.deepEqual(result.counterpart.roomNames, ['Galley']);
  assert.equal(result.counterpart.items[0].category, 'Galley');
});

test('pair mutations work when no counterpart exists', () => {
  const { addRoomToChecklistPair } = required();
  const result = addRoomToChecklistPair(pair().active, null, 'Bedroom');
  assert.deepEqual(result.active.roomNames, ['Kitchen', 'Bedroom']);
  assert.equal(result.counterpart, null);
});
