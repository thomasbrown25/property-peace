import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { findLinkedChecklist } from '../utils/checklistLeaseOptions.mjs';
import { buildChecklistWorkspacePath } from '../utils/checklistPortfolio.js';

const require = createRequire(import.meta.url);
const { parseSync, traverse } = require('@babel/core');
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const leasePage = source('../pages/landlord/lease.jsx');
const createPage = source('../pages/landlord/checklists.jsx');
const parse = (code) => parseSync(code, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'], sourceType: 'module' } });
const leaseAst = parse(leasePage);
const createAst = parse(createPage);
let handler;
traverse(leaseAst, { JSXAttribute(path) {
  if (path.node.name.name === 'onViewChecklists' && path.node.value?.expression?.type === 'ArrowFunctionExpression') {
    const node = path.node.value.expression;
    handler = leasePage.slice(node.start, node.end);
  }
} });
assert.ok(handler);
const compile = (code, context) => Function(...Object.keys(context), `return (${code});`)(...Object.values(context));

async function click(response, type = 'move-in', propertyId = 6) {
  const calls = [];
  const notices = [];
  const requested = [];
  const action = compile(handler, {
    leaseId: '12', propertyId, findLinkedChecklist, buildChecklistWorkspacePath, URLSearchParams,
    getChecklistsByLease: async (id) => { requested.push(id); if (response instanceof Error) throw response; return response; },
    navigate: (...args) => calls.push(args), openSnackbar: (notice) => notices.push(notice)
  });
  await action(type);
  assert.deepEqual(requested, ['12']);
  return { calls, notices };
}

test('card opens the exact lease/type checklist for numeric and serialized enum values', async () => {
  for (const checklistType of [40, '40', 'MoveInChecklist', 'Move-inChecklist']) {
    const { calls, notices } = await click({ success: true, data: [
      { id: 1, leaseId: 13, checklistType: 40, propertyId: 6 },
      { id: 2, leaseId: 12, checklistType: 41, propertyId: 6 },
      { id: 3, leaseId: 12, checklistType, propertyId: 6, unitId: 7 }
    ] });
    assert.deepEqual(calls, [['/landlord/checklists/property/6/unit/7/checklist/3']]);
    assert.deepEqual(notices, []);
  }
});

test('Pascal-case records and property-scoped checklist routes remain supported', async () => {
  const { calls } = await click({ success: true, data: [{ Id: 3, LeaseId: 12, ChecklistType: 'MoveInChecklist', PropertyId: 6 }] });
  assert.deepEqual(calls, [['/landlord/checklists/property/6/checklist/3']]);
});

test('missing checklist opens lease-linked creation with saved property context', async () => {
  const { calls } = await click({ success: true, data: [{ id: 9, leaseId: 13, checklistType: 40 }] });
  assert.deepEqual(calls, [['/landlord/leases/12/checklists/move-in/new?propertyId=6', { state: { propertyId: 6 } }]]);
});

test('move-out opens its own checklist, not the move-in checklist', async () => {
  const { calls } = await click({ success: true, data: [
    { id: 3, leaseId: 12, checklistType: 40, propertyId: 6 },
    { id: 4, leaseId: 12, checklistType: 'MoveOutChecklist', propertyId: 6 }
  ] }, 'move-out');
  assert.deepEqual(calls, [['/landlord/checklists/property/6/checklist/4']]);
});

test('failed or incomplete lookup never treats unknown checklist state as no checklist', async () => {
  for (const response of [{ success: false }, { success: true, data: null }, new Error('Offline')]) {
    const { calls, notices } = await click(response);
    assert.deepEqual(calls, []);
    assert.equal(notices[0].alert.color, 'error');
  }
  assert.deepEqual((await click({ success: true, data: [] }, 'move-in', null)).calls, []);
});

test('lease-linked creation skips property, unit, and inspection type selectors; portfolio creation retains them', () => {
  const labels = [];
  traverse(createAst, { JSXAttribute(path) {
    if (path.node.name.name !== 'label' || !['Property', 'Unit', 'Checklist type'].includes(path.node.value?.value)) return;
    const guard = path.findParent((parent) => parent.node.type === 'LogicalExpression' && parent.node.operator === '&&' &&
      parent.node.left.type === 'UnaryExpression' && parent.node.left.operator === '!' && parent.node.left.argument.name === 'standalone');
    assert.ok(guard, `${path.node.value.value} must be skipped for lease-linked creation`);
    const expression = createPage.slice(guard.node.left.start, guard.node.left.end);
    assert.equal(compile(expression, { standalone: true }), false);
    assert.equal(compile(expression, { standalone: false }), true);
    labels.push(path.node.value.value);
  } });
  assert.deepEqual(labels.sort(), ['Checklist type', 'Property', 'Unit']);
});

test('production context effect automatically selects the lease unit then links the exact lease', () => {
  let effect;
  traverse(createAst, { CallExpression(path) {
    if (path.node.callee.name !== 'useEffect') return;
    const callback = path.node.arguments[0];
    const code = createPage.slice(callback.start, callback.end);
    if (code.includes('setSelectedLeaseId(contextLease.id)')) effect = code;
  } });
  assert.ok(effect);
  const unit = { id: 7, label: 'Unit 7' };
  const selected = [];
  const linked = [];
  const context = {
    standalone: true, leasesLoading: false, contextLease: { id: 12, unitId: 7 }, needsUnit: true,
    unitsLoading: false, units: [unit], unitOptions: [unit], contextUnitId: 7, selectedUnit: null,
    setSelectedUnit: (value) => selected.push(value), setSelectedLeaseId: (value) => linked.push(value),
    setLeaseDecision: (value) => linked.push(value)
  };
  compile(effect, context)();
  assert.deepEqual(selected, [unit]);
  assert.deepEqual(linked, []);
  compile(effect, { ...context, selectedUnit: unit })();
  assert.deepEqual(linked, [12, 'linked']);
  linked.length = 0;
  compile(effect, { ...context, needsUnit: false })();
  assert.deepEqual(linked, [12, 'linked']);
  linked.length = 0;
  compile(effect, { ...context, unitsLoading: true })();
  assert.deepEqual(linked, []);
});
