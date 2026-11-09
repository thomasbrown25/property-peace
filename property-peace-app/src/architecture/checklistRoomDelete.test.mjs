import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = fs.readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function getChecklistRoomNames('), source.indexOf('function RoomInspectionSection('));
const dto = source.slice(source.indexOf('const toItemDto ='), source.indexOf('// ─── Item Photos Modal'));
const handler = source.slice(source.indexOf('  const handleDeleteRoom ='), source.indexOf('  const handleDeleteItem ='));
const rename = source.slice(source.indexOf('  const handleRenameRoom ='), source.indexOf('  const handleDeleteRoom ='));

function harness({ checklist, counterpartChecklist = null, roomToDelete = 'Kitchen', failId } = {}) {
  const calls = [], refreshed = [], notices = [];
  const state = { custom: checklist.roomNames || [], expanded: roomToDelete, drafts: { [roomToDelete]: 'draft', Other: 'keep' }, room: roomToDelete, deleting: false };
  const setter = (key) => (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const context = {
    checklist, counterpartChecklist, roomToDelete, deletingRoom: false, customRooms: state.custom,
    checklistAPI: { updateChecklist: async (id, payload) => {
      calls.push({ id, payload });
      return id === failId ? { success: false, message: 'Save failed' } : { success: true, data: { id, ...payload } };
    } },
    onRefresh: (data) => refreshed.push(data), openSnackbar: (notice) => notices.push(notice),
    setCustomRooms: setter('custom'), setExpandedRoomName: setter('expanded'), setItemDrafts: setter('drafts'),
    setRoomToDelete: setter('room'), setDeletingRoom: setter('deleting')
  };
  const [remove, renameRoom] = new Function(...Object.keys(context), `${dto}\n${helpers}\n${rename}\n${handler}\nreturn [handleDeleteRoom, handleRenameRoom];`)(...Object.values(context));
  return { remove, renameRoom, calls, refreshed, notices, state };
}

const item = (id, category, sortOrder = 0) => ({ id, category, name: 'Walls', sortOrder, condition: 'Good', isChecked: true, photoBlobUrls: ['photo.jpg'] });

test('default rooms delete all matching items and preserve neighboring item details', async () => {
  const keep = item(3, 'Living Room', 2);
  const h = harness({ checklist: { id: 1, roomNames: ['Kitchen', 'Living Room'], items: [item(1, 'Kitchen'), item(2, ' kitchen '), keep] } });
  await h.remove();
  assert.deepEqual(h.calls[0].payload.RoomNames, ['Living Room']);
  assert.deepEqual(h.calls[0].payload.Items.map((i) => i.Id), [3]);
  assert.equal(h.calls[0].payload.Items[0].Condition, 'Good');
  assert.deepEqual(h.calls[0].payload.Items[0].PhotoBlobUrls, keep.photoBlobUrls);
  assert.deepEqual(h.state.custom, ['Living Room']);
  assert.equal(h.state.expanded, null);
  assert.deepEqual(h.state.drafts, { Other: 'keep' });
  assert.equal(h.state.room, null);
  assert.equal(h.state.deleting, false);
});

test('empty rooms and deleting the last room send empty arrays for persistence', async () => {
  for (const items of [[], [item(1, 'Kitchen')]]) {
    const h = harness({ checklist: { id: 1, roomNames: ['Kitchen'], items } });
    await h.remove();
    assert.deepEqual(h.calls[0].payload, { Id: 1, RoomNames: [], Items: [] });
  }
});

test('linked checklists remove the matching room from both', async () => {
  const h = harness({ checklist: { id: 1, items: [item(1, 'Kitchen')] }, counterpartChecklist: { id: 2, items: [item(2, 'KITCHEN'), item(3, 'Bath')] } });
  await h.remove();
  assert.deepEqual(h.calls.map((c) => c.id), [1, 2]);
  assert.deepEqual(h.calls[1].payload.RoomNames, ['Bath']);
  assert.deepEqual(h.calls[1].payload.Items.map((i) => i.Id), [3]);
  assert.equal(h.refreshed.length, 2);
});

test('failed deletion retains confirmation and state, surfaces error, and releases loading', async () => {
  const h = harness({ checklist: { id: 1, items: [item(1, 'Kitchen')] }, failId: 1 });
  await h.remove();
  assert.equal(h.refreshed.length, 0);
  assert.equal(h.state.room, 'Kitchen');
  assert.equal(h.state.expanded, 'Kitchen');
  assert.equal(h.state.deleting, false);
  assert.equal(h.notices.at(-1).message, 'Save failed');
});

test('partial linked failure refreshes successful save and does not report success', async () => {
  const h = harness({ checklist: { id: 1, items: [item(1, 'Kitchen')] }, counterpartChecklist: { id: 2, items: [item(2, 'Kitchen')] }, failId: 2 });
  await h.remove();
  assert.equal(h.refreshed.length, 1);
  assert.equal(h.state.room, 'Kitchen');
  assert.equal(h.notices.at(-1).alert.color, 'error');
});

test('default rooms remain editable with item identity and condition preserved', async () => {
  const h = harness({ checklist: { id: 1, items: [item(1, 'Kitchen', 0), item(2, 'Bath', 1)] } });
  assert.equal(await h.renameRoom('Kitchen', 'Galley'), true);
  assert.deepEqual(h.calls[0].payload.RoomNames, ['Galley', 'Bath']);
  assert.equal(h.calls[0].payload.Items[0].Category, 'Galley');
  assert.equal(h.calls[0].payload.Items[0].Id, 1);
  assert.equal(h.calls[0].payload.Items[0].Condition, 'Good');
});

test('JSX parses and every room exposes an accessible delete action outside the progress conditional', () => {
  parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const section = source.slice(source.indexOf('function RoomInspectionSection('), source.indexOf('function InspectionColumn('));
  assert.match(section, /\)\}\s*<Tooltip title="Delete room">/);
  assert.match(section, /aria-label=\{`Delete \$\{room.name\}`\}/);
  assert.match(section, /onClick=\{\(\) => onDeleteRoom\(room.name\)\}/);
  assert.match(section, /e.target !== e.currentTarget/);
  assert.match(source, /This cannot be undone/);
  assert.match(source, /from both the move-in and move-out checklists/);
});
