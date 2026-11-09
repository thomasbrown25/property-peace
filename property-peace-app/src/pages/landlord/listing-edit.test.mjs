import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSync, transformFromAstSync } from '@babel/core';

const source = readFileSync(new URL('../../components/ListingPropertyDetails.jsx', import.meta.url), 'utf8');
const ast = parseSync(source, { babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] } });
function find(predicate) {
  let result;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result = node;
    Object.entries(node).forEach(([key, value]) => { if (key !== 'loc') Array.isArray(value) ? value.forEach(visit) : visit(value); });
  }
  visit(ast);
  assert.ok(result);
  return result;
}
function expression(node) {
  return transformFromAstSync({ type: 'File', program: { type: 'Program', sourceType: 'script', body: [{ type: 'ExpressionStatement', expression: node }] } }, '', { babelrc: false, configFile: false }).code.replace(/;\s*$/, '');
}
const named = name => expression(find(n => n.type === 'VariableDeclarator' && n.id.name === name).init);
const invoke = (code, context) => new Function(...Object.keys(context), `return (${code})();`)(...Object.values(context));

test('Continue to edit navigates to the guarded dedicated edit route', () => {
  const destinations = [];
  invoke(named('startEdit'), { listing: { id: 12 }, navigate: value => destinations.push(value) });
  assert.deepEqual(destinations, ['/landlord/listings/12/edit']);
  const routes = readFileSync(new URL('../../routes/MainRoutes.jsx', import.meta.url), 'utf8');
  assert.match(routes, /path: 'landlord\/listings\/:id\/edit',[\s\S]*?<SubscriptionPausedGuard>[\s\S]*?<ListingEdit \/>/);
});

test('edit initializer prefills property/unit values, preserves zero values and never overwrites dirty edits', () => {
  const effect = find(n => n.type === 'CallExpression' && n.callee.name === 'useEffect' && n.arguments[1]?.elements?.some(e => e?.name === 'editPage'));
  let draft;
  const context = { editPage: true, property: { name: 'Oak', propertyType: 'singleFamily', yearBuilt: 1995 }, unit: { name: 'Main', bedrooms: 0, baths: 1.5, squareFeet: 900 }, listing: { marketingDescription: 'Sunny home' }, draft: null,
    canonicalType: x => x, initialAmenities: () => ({}), setDraft: value => { draft = value; }, setSelectedAmenities: () => {}, setSearch: () => {}, setEditing: () => {}, setConfirmEdit: () => {} };
  invoke(expression(effect.arguments[0]), context);
  assert.deepEqual(draft, { name: 'Oak', propertyType: 'singleFamily', yearBuilt: 1995, unitName: 'Main', bedrooms: 0, baths: 1.5, squareFeet: 900, marketingDescription: 'Sunny home' });
  context.draft = { name: 'User edit' };
  draft = undefined;
  invoke(expression(effect.arguments[0]), context);
  assert.equal(draft, undefined);
});

function saveContext(failAt) {
  const calls = [], notices = [];
  const context = {
    property: { id: 7, name: 'Old', streetAddress: '123 Oak St', city: 'Austin', state: 'TX', zipCode: '78701' }, unit: { id: 8, name: 'Main', isOccupied: false }, listing: { id: 12 },
    draft: { name: ' Updated ', propertyType: 'singleFamily', yearBuilt: 2000, unitName: 'Unit A', bedrooms: 2, baths: 1, squareFeet: 800, marketingDescription: 'Updated description' },
    selectedAmenities: { basicAmenities: [{ id: 1 }], propertyAmenities: [], propertyFeatures: [] },
    itemId: x => x.id, isCustom: x => !!x.isCustom, itemName: x => x.name,
    setSaving: () => {}, setEditing: () => {}, refreshProperty: () => {}, openSnackbar: value => notices.push(value),
    navigate: value => calls.push(['navigate', value]), setSelectedListing: value => ({ kind: 'selected', value }),
    addOrUpdateProperty: value => ({ kind: 'property', value }), addOrUpdateUnit: value => ({ kind: 'unit', value }),
    dispatch: async value => { calls.push([value.kind, value.value]); if (failAt === value.kind) throw new Error('Failed'); },
    listingApi: {
      updateListing: async (id, value) => { calls.push(['listing', value]); return { success: failAt !== 'listing', data: { id } }; },
      publishListing: async id => { calls.push(['publish', id]); return { success: failAt !== 'publish', data: { id, status: 'Active' } }; }
    }
  };
  return { context, calls, notices };
}

test('Publish saves property, unit, description and amenities before publishing and returning to listing', async () => {
  const h = saveContext();
  await invoke(named('save'), h.context);
  assert.deepEqual(h.calls.map(c => c[0]), ['property', 'unit', 'listing', 'publish', 'selected', 'navigate']);
  assert.equal(h.calls[0][1].name, 'Updated');
  assert.equal(h.calls[0][1].streetAddress, '123 Oak St');
  assert.equal(h.calls[2][1].marketingDescription, 'Updated description');
  assert.deepEqual(h.calls[2][1].basicAmenityIds, [1]);
  assert.equal(h.calls.at(-1)[1], '/landlord/listings/12');
  assert.equal(h.notices.at(-1).alert.color, 'success');
});

test('failed saves/publish retain the edit page and report the error, without false success', async () => {
  for (const stage of ['property', 'unit', 'listing', 'publish']) {
    const h = saveContext(stage);
    await invoke(named('save'), h.context);
    assert.ok(!h.calls.some(c => c[0] === 'navigate'));
    if (stage !== 'publish') assert.ok(!h.calls.some(c => c[0] === 'publish'));
    assert.equal(h.notices.at(-1).alert.color, 'error');
  }
});

test('invalid numeric values block persistence; Publish is in the top-right header, with no inline save row', async () => {
  const h = saveContext();
  h.context.draft.squareFeet = -1;
  await invoke(named('save'), h.context);
  assert.equal(h.calls.length, 0);
  assert.equal(h.notices.at(-1).alert.color, 'error');
  assert.match(source, /justifyContent="space-between"[\s\S]*?ml: 'auto'[\s\S]*?onClick=\{save\}>\{saving \? 'Publishing…' : 'Publish'\}/);
  assert.doesNotMatch(source, />Save changes<|setEditing\(true\);[\s\S]*?const startEdit/);
});
