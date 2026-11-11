import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./PropertyLeaseActions.jsx', import.meta.url), 'utf8');
const tabs = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../../pages/landlord/property.jsx', import.meta.url), 'utf8');
const parseJsx = text => parse(text, { sourceType: 'module', plugins: ['jsx'] });
const ast = parseJsx(source);
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const returnNode = component.body.body.find(node => node.type === 'ReturnStatement');
// Execute the actual production component's hook declarations/handlers, not a copy of the delete algorithm.
const body = source.slice(component.body.start + 1, returnNode.start);
const makeComponent = new Function('useState', 'useRef', 'axiosServices', 'console',
  `return function({lease,onDeleted}) { ${body}\nreturn { anchor, open, deleteDocuments, deleteChecklists, deleting, error, openDelete, closeDelete, confirmDelete, setDeleteDocuments, setDeleteChecklists }; };`);
function harness({ lease = { id: 42 }, request = async () => ({ data: { success: true } }), onDeleted } = {}) {
  const slots = []; let cursor = 0; const calls = []; const warnings = [];
  const useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
  const useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
  const render = makeComponent(useState, useRef, { delete: (...args) => { calls.push(args); return request(...args); } }, { warn: (...args) => warnings.push(args) });
  return { render: () => { cursor = 0; return render({ lease, onDeleted }); }, calls, warnings };
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function attribute(element, name) { return element.attributes.find(attr => attr.name?.name === name); }

test('More > Delete opens confirmation with default cleanup; cancel never calls API', () => {
  const h = harness(); let ui = h.render();
  assert.equal(ui.open, false);
  ui.setDeleteDocuments(false); ui.setDeleteChecklists(false);
  h.render().openDelete(); ui = h.render();
  assert.equal(ui.open, true); assert.equal(ui.anchor, null);
  assert.equal(ui.deleteDocuments, true); assert.equal(ui.deleteChecklists, true);
  ui.closeDelete(); assert.equal(h.render().open, false); assert.equal(h.calls.length, 0);
  let menu;
  walk(ast, node => { if (node.type === 'JSXOpeningElement' && node.name.name === 'MenuItem') menu = node; });
  assert.equal(attribute(menu, 'onClick').value.expression.name, 'openDelete');
});

test('successful delete sends query cleanup flags and notifies only after archive', async () => {
  for (const [deleteDocuments, deleteChecklists] of [[true, true], [false, true], [true, false], [false, false]]) {
    const notified = []; const h = harness({ lease: { Id: 42 }, onDeleted: id => notified.push(id) });
    let ui = h.render(); ui.openDelete(); ui.setDeleteDocuments(deleteDocuments); ui.setDeleteChecklists(deleteChecklists);
    await h.render().confirmDelete(); ui = h.render();
    assert.deepEqual(h.calls, [['/api/Lease/42', { params: { deleteLeaseDocuments: deleteDocuments, deleteChecklists } }]]);
    assert.deepEqual(notified, [42]); assert.equal(ui.open, false); assert.equal(ui.deleting, false); assert.equal(ui.error, '');
  }
});

test('both API success=false casings keep dialog and selected flags for retry', async () => {
  for (const data of [{ success: false, message: 'Denied' }, { Success: false, Message: 'Denied' }]) {
    let fail = true; let notified = 0;
    const h = harness({ request: async () => ({ data: fail ? data : {} }), onDeleted: () => notified++ });
    h.render().openDelete(); h.render().setDeleteDocuments(false);
    await h.render().confirmDelete(); let ui = h.render();
    assert.equal(ui.open, true); assert.equal(ui.error, 'Denied'); assert.equal(ui.deleting, false);
    assert.equal(ui.deleteDocuments, false); assert.equal(notified, 0);
    fail = false; await ui.confirmDelete(); ui = h.render();
    assert.equal(ui.open, false); assert.equal(ui.error, ''); assert.equal(notified, 1);
    assert.equal(h.calls.length, 2);
  }
});

test('network errors leave retry available and never remove the row', async () => {
  const h = harness({ request: async () => { throw new Error('Offline'); }, onDeleted: () => assert.fail('must not remove') });
  h.render().openDelete(); await h.render().confirmDelete();
  assert.equal(h.render().open, true); assert.equal(h.render().error, 'Offline'); assert.equal(h.render().deleting, false);
});

test('in-flight lock prevents duplicate submits and closing; missing id is inert', async () => {
  let resolve; const h = harness({ request: () => new Promise(done => { resolve = done; }) });
  h.render().openDelete(); const ui = h.render(); const pending = ui.confirmDelete();
  await ui.confirmDelete(); ui.closeDelete();
  assert.equal(h.calls.length, 1); assert.equal(h.render().open, true); assert.equal(h.render().deleting, true);
  resolve({ data: {} }); await pending; assert.equal(h.render().deleting, false);
  const missing = harness({ lease: {} }); await missing.render().confirmDelete(); assert.equal(missing.calls.length, 0);
});

test('refresh failure is not reported as a failed delete and cannot reopen retry', async () => {
  const h = harness({ onDeleted: async () => { throw new Error('Refresh failed'); } });
  h.render().openDelete(); await h.render().confirmDelete();
  assert.equal(h.render().open, false); assert.equal(h.render().error, ''); assert.equal(h.warnings.length, 1);
});

test('production success callback removes matching row locally before optional refresh without navigation', async () => {
  const tree = parseJsx(tabs); let handler;
  walk(tree, node => { if (node.type === 'VariableDeclarator' && node.id.name === 'handleLeaseDeleted') handler = tabs.slice(node.init.start, node.init.end); });
  let rows = [{ id: 1 }, { Id: 42 }, { id: 3 }]; let refreshed = 0;
  const read = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
  const callback = new Function('setLeases', 'read', 'onLeaseDeleted', 'navigate', 'onTabChange', `return ${handler}`)(
    update => { rows = update(rows); }, read, async () => { assert.deepEqual(rows, [{ id: 1 }, { id: 3 }]); refreshed++; },
    () => assert.fail('must not navigate'), () => assert.fail('must not change tabs'));
  await callback('42'); assert.equal(refreshed, 1);
  const optional = new Function('setLeases', 'read', 'onLeaseDeleted', `return ${handler}`)(update => { rows = update(rows); }, read, undefined);
  await optional(1); assert.deepEqual(rows, [{ id: 3 }]);
  assert.doesNotMatch(handler, /navigate|onTabChange|setTab/);
  assert.doesNotMatch(source, /navigate|onTabChange/);
  assert.match(tabs, /label="Leases"[^\n]+columns=\{propertyLeaseColumns\}/);
  assert.match(tabs, /<PropertyLeaseActions[^\n]+onDeleted=\{handleLeaseDeleted\}/);
  assert.match(page, /onLeaseDeleted=\{handlePropertyRefresh\}/);
  const refresh = page.slice(page.indexOf('const handlePropertyRefresh ='), page.indexOf('const handleImageUpload ='));
  assert.doesNotMatch(refresh, /navigate|setTab/);
});

test('production event boundaries stop row navigation for action, menu and dialog portal events', () => {
  const declaration = ast.program.body.find(node => node.type === 'VariableDeclaration');
  const stop = new Function(`${source.slice(declaration.start, declaration.end)}; return stopRowEvent;`)();
  let stopped = 0; stop({ stopPropagation: () => stopped++ }); assert.equal(stopped, 1);
  const boundaries = [];
  walk(ast, node => {
    if (node.type === 'JSXOpeningElement' && ['Box', 'Menu', 'Dialog'].includes(node.name.name)) {
      boundaries.push(node.name.name);
      for (const event of ['onClick', 'onKeyDown']) assert.equal(attribute(node, event).value.expression.name, 'stopRowEvent');
    }
  });
  assert.deepEqual(boundaries.sort(), ['Box', 'Dialog', 'Menu']);
  let click, keydown;
  walk(parseJsx(tabs), node => {
    if (node.type === 'JSXOpeningElement' && node.name.name === 'TableRow' && attribute(node, 'onClick')) {
      click = attribute(node, 'onClick').value.expression; keydown = attribute(node, 'onKeyDown').value.expression;
    }
  });
  const destinations = [];
  const make = node => new Function('detailColumn', 'read', 'row', 'navigate', `return ${tabs.slice(node.start, node.end)}`)(
    { link: () => '/landlord/leases/42' }, row => row.id, { id: 42 }, url => destinations.push(url));
  const onClick = make(click); const onKeyDown = make(keydown);
  for (const [contained, interactive] of [[true, true], [false, false], [false, true]]) {
    onClick({ currentTarget: { contains: () => contained }, target: { closest: () => interactive } });
  }
  assert.equal(destinations.length, 0);
  onClick({ currentTarget: { contains: () => true }, target: { closest: () => false } });
  const row = {}; onKeyDown({ target: row, currentTarget: row, key: 'Enter', preventDefault() {} });
  onKeyDown({ target: {}, currentTarget: row, key: 'Enter', preventDefault() { assert.fail('child key must not navigate'); } });
  assert.deepEqual(destinations, ['/landlord/leases/42', '/landlord/leases/42']);
});

test('all changed JSX parses', () => { parseJsx(source); parseJsx(tabs); parseJsx(page); });
