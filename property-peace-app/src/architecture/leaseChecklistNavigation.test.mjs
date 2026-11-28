import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

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
    leaseId: '12', propertyId, lease: { unitId: 7 }, URLSearchParams,
    listTransitionChecklists: async ({ leaseId }) => { requested.push(leaseId); if (response instanceof Error) throw response; return response; },
    navigate: (...args) => calls.push(args), openSnackbar: (notice) => notices.push(notice)
  });
  await action(type);
  assert.deepEqual(requested, ['12']);
  return { calls, notices };
}

test('card opens the handoff for the exact lease and phase', async () => {
  const { calls, notices } = await click([
    { id: 1, leaseId: 13, phase: 'moveIn' },
    { id: 2, leaseId: 12, phase: 'moveOut' },
    { id: 3, leaseId: 12, phase: 'moveIn' }
  ]);
  assert.deepEqual(calls, [['/landlord/checklists/handoff/3']]);
  assert.deepEqual(notices, []);
});

test('missing checklist opens lease-linked creation with saved property context', async () => {
  const { calls } = await click([{ id: 9, leaseId: 13, phase: 'moveIn' }]);
  assert.deepEqual(calls, [['/landlord/checklists?propertyId=6&leaseId=12&phase=moveIn&unitId=7']]);
});

test('move-out opens its own checklist, not the move-in checklist', async () => {
  const { calls } = await click([
    { id: 3, leaseId: 12, phase: 'moveIn' },
    { id: 4, leaseId: 12, phase: 'moveOut' }
  ], 'move-out');
  assert.deepEqual(calls, [['/landlord/checklists/handoff/4']]);
});

test('failed or incomplete lookup never treats unknown checklist state as no checklist', async () => {
  for (const response of [null, new Error('Offline')]) {
    const { calls, notices } = await click(response);
    assert.deepEqual(calls, []);
    assert.equal(notices[0].alert.color, 'error');
  }
  assert.deepEqual((await click([], 'move-in', null)).calls, []);
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
