import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./leases.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const effects = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.name === 'useEffect') effects.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
  }
}
walk(ast);
function productionEffect(dependencies, context) {
  const matches = effects.filter((node) => {
    const deps = node.arguments[1];
    return deps?.type === 'ArrayExpression' &&
      deps.elements.map((element) => source.slice(element.start, element.end)).join(',') === dependencies;
  });
  assert.equal(matches.length, 1, `exactly one production effect with [${dependencies}]`);
  const callback = matches[0].arguments[0];
  return vm.runInNewContext(`(${source.slice(callback.start, callback.end)})`, { URLSearchParams, ...context });
}
function harness(query, initialFilters) {
  const state = { searchParams: new URLSearchParams(query), filters: initialFilters, view: null, navigations: [] };
  const context = () => ({
    searchParams: state.searchParams,
    filters: state.filters,
    setView: (view) => { state.view = view; },
    setFilters: (update) => { state.filters = update(state.filters); },
    setSearchParams: (params) => {
      state.navigations.push(params.toString());
      state.searchParams = params;
    }
  });
  state.fromUrl = () => productionEffect('searchParams', context())();
  state.toUrl = () => productionEffect('filters.status,searchParams,setSearchParams', context())();
  return state;
}

for (const status of ['current', 'renewals', 'history', 'overdue', 'notStarted', 'active']) {
  test(`URL ${status} preserves the already-matching singleton filters reference`, () => {
    const filters = { status: [status], other: { retained: true } };
    const state = harness(status === 'current' ? 'workspace=agreements' : `workspace=agreements&view=${status}`, filters);
    state.fromUrl();
    assert.strictEqual(state.filters, filters);
    assert.equal(state.view, status);
    for (let pass = 0; pass < 5; pass++) {
      state.toUrl();
      state.fromUrl();
    }
    assert.strictEqual(state.filters, filters);
    assert.deepEqual(state.navigations, [], 'repeated production effects must not navigate');
  });
}

test('URL changes update status once, retaining other filter fields', () => {
  const other = { retained: true };
  const filters = { status: ['current', 'active'], other };
  const state = harness('view=overdue&workspace=agreements', filters);
  state.fromUrl();
  assert.notStrictEqual(state.filters, filters);
  assert.deepEqual(Array.from(state.filters.status), ['overdue']);
  assert.strictEqual(state.filters.other, other);
  const updated = state.filters;
  state.fromUrl();
  assert.strictEqual(state.filters, updated);
});

test('legacy history URLs retain precedence and unknown views remain untouched', () => {
  for (const query of ['tab=history', 'view=current&tab=history', 'view=unknown&tab=history']) {
    const filters = { status: ['history'] };
    const state = harness(query, filters);
    state.fromUrl();
    assert.strictEqual(state.filters, filters);
    assert.equal(state.view, 'history');
  }
  const filters = { status: ['active'] };
  const unknown = harness('view=unknown&workspace=agreements', filters);
  unknown.fromUrl();
  assert.strictEqual(unknown.filters, filters);
  assert.equal(unknown.view, null);
});

test('filter sync changes only view, preserves workspace/tab and repeated parameters, then stops navigating', () => {
  const filters = { status: ['overdue'] };
  const state = harness('workspace=agreements&tab=history&propertyId=42&tag=a&tag=b&view=active', filters);
  state.toUrl();
  assert.deepEqual(state.navigations, ['workspace=agreements&tab=history&propertyId=42&tag=a&tag=b&view=overdue']);
  assert.strictEqual(state.filters, filters);
  state.toUrl();
  assert.equal(state.navigations.length, 1);
});

test('current removes only view and does not navigate when view is already absent', () => {
  const state = harness('workspace=agreements&tab=leases&view=current&propertyId=42', { status: ['current'] });
  state.toUrl();
  assert.deepEqual(state.navigations, ['workspace=agreements&tab=leases&propertyId=42']);
  state.toUrl();
  assert.equal(state.navigations.length, 1);
});

test('multiselect serializes only the first status without changing the selected statuses', () => {
  const filters = { status: ['active', 'overdue'] };
  const state = harness('workspace=agreements&view=active', filters);
  state.toUrl();
  assert.deepEqual(state.navigations, []);
  assert.strictEqual(state.filters, filters);
  assert.deepEqual(filters.status, ['active', 'overdue']);
  state.searchParams = new URLSearchParams('workspace=agreements&view=history');
  state.toUrl();
  assert.deepEqual(state.navigations, ['workspace=agreements&view=active']);
  assert.strictEqual(state.filters, filters);
});

test('empty or missing status leaves the URL and view untouched', () => {
  for (const filters of [{ status: [] }, {}]) {
    const state = harness('workspace=agreements&view=active', filters);
    state.toUrl();
    assert.deepEqual(state.navigations, []);
    assert.equal(state.view, null);
    assert.strictEqual(state.filters, filters);
  }
});
