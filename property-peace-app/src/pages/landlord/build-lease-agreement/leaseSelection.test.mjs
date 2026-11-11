import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { agreementBuilderPath, loadAgreementLeaseOptions } from './leaseSelection.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const ok = (data) => ({ data: { success: true, data } });
const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  fn(node);
  Object.values(node).forEach((value) => Array.isArray(value) ? value.forEach((item) => walk(item, fn)) : typeof value === 'object' && walk(value, fn));
};

test('builder destinations skip selection only for valid saved lease IDs', () => {
  assert.equal(agreementBuilderPath(), '/landlord/leases/build-lease-agreement');
  assert.equal(agreementBuilderPath('42'), '/landlord/leases/build-lease-agreement?leaseId=42');
  for (const id of [0, -1, 'bad', 1.5]) assert.equal(agreementBuilderPath(id), '/landlord/leases/build-lease-agreement');
});

test('selection includes scheduled and historical leases instead of only active unit projection', async () => {
  const calls = [];
  const properties = [{ id: 3, name: 'Oak', units: [{ id: 9, name: 'B', lease: { id: 1 } }] }, { Id: 4, Name: 'Elm', Units: [{ Id: 10, Name: 'C' }] }];
  const leases = await loadAgreementLeaseOptions(properties, async (url) => {
    calls.push(url);
    return ok(url.includes('/3/') ? [{ id: 1, unitId: 9 }, { id: 2, unitId: 9, isActive: false }, { id: 8, isDeleted: true }] : [{ Id: 6, UnitId: 10 }, { Id: 0 }]);
  });
  assert.deepEqual(calls, ['/api/lease/property/3/all', '/api/lease/property/4/all']);
  assert.deepEqual(leases.map((lease) => lease.id), [1, 2, 6]);
  assert.equal(leases[1].unitName, 'B');
  assert.equal(leases[2].propertyName, 'Elm');
  assert.equal(leases[2].unitName, 'C');
  assert.deepEqual(await loadAgreementLeaseOptions([], () => assert.fail('empty portfolio must not fetch')), []);
});

test('selection fails closed on failed, missing, or malformed responses', async () => {
  for (const data of [{ success: false }, { success: true }, { success: true, data: {} }]) {
    await assert.rejects(loadAgreementLeaseOptions([{ id: 3 }], async () => ({ data })), /Could not load/);
  }
  await assert.rejects(loadAgreementLeaseOptions([{ id: 3 }], async () => { throw new Error('offline'); }), /offline/);
});

test('full-page selection gates continuation and later editors', () => {
  const source = read('./SelectAgreementLease.jsx');
  parse(source, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(source, /1\. Select lease/);
  assert.match(source, /disabled=\{!selected \|\| loading \|\| Boolean\(error\) \|\| propertiesError\}/);
  assert.match(source, /if \(selected\) onContinue\(selected.id\)/);
  assert.match(source, /if \(!live\) return/);
  assert.match(source, /setOptions\(/);
  const builder = read('../build-lease-agreement.jsx');
  parse(builder, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(builder, /if \(!lease \|\| confirmSelection\) return <SelectAgreementLease/);
  assert.match(builder, /initialLease=\{lease\}/);
  assert.match(builder, /confirmSelection=\{params.get\('selectLease'\) === '1'\}/);
  assert.match(builder, /navigate\(agreementBuilderPath\(selectedLeaseId\)\)/);
  assert.match(builder, /key=\{`\$\{organizationId\}:\$\{leaseId\}`\}/);
});

test('workspace New agreement runs direct navigation without a drawer', () => {
  const source = read('../leases.jsx');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let handler;
  walk(ast, (node) => {
    if (node.type !== 'JSXElement' || node.openingElement.name.name !== 'Button') return;
    if (!node.children.some((child) => child.type === 'JSXText' && child.value.trim() === 'New agreement')) return;
    handler = node.openingElement.attributes.find((attr) => attr.name?.name === 'onClick')?.value.expression;
  });
  assert.ok(handler);
  let destination;
  new Function('navigate', `return (${source.slice(handler.start, handler.end)})();`)((path) => { destination = path; });
  assert.equal(destination, agreementBuilderPath());
  assert.doesNotMatch(source, /CreateLeaseAgreementDrawer|openCreateAgreementDrawer/);
});

test('lease detail and successful creation keep the exact saved lease selected', () => {
  const detail = read('../../../sections/landlord/leases/LeaseDetailView.jsx');
  const ast = parse(detail, { sourceType: 'module', plugins: ['jsx'] });
  let callback;
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.name === 'leaseAgreementSetupUrl') callback = node.init.arguments[0];
  });
  assert.ok(callback);
  const url = new Function('lease', 'leaseId', 'property', `return (${detail.slice(callback.start, callback.end)})();`)({ id: 88, unitId: 9 }, 10, { id: 3 });
  assert.equal(new URL(url, 'https://example.test').searchParams.get('leaseId'), '88');
  assert.match(detail, /onBuildAgreement=\{\(\) => navigate\(leaseAgreementSetupUrl\)\}/);
  const setup = read('../../../sections/lease-builder/leaseSetup.mjs');
  assert.match(setup, /build-lease-agreement\?leaseId=/);
});

test('success modal requests lease confirmation and matches the green builder label', () => {
  const source = read('../../../sections/lease-builder/LeaseSetupBuilder.jsx');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let handler;
  walk(ast, (node) => {
    if (node.type !== 'JSXElement' || node.openingElement.name.name !== 'Button') return;
    if (!node.children.some((child) => child.type === 'JSXText' && child.value.trim() === 'Create lease agreement')) return;
    handler = node.openingElement.attributes.find((attr) => attr.name?.name === 'onClick').value.expression;
  });
  assert.ok(handler);
  let path;
  new Function('navigate', 'destinations', `return (${source.slice(handler.start, handler.end)})();`)(
    (value) => { path = value; }, { agreement: agreementBuilderPath(42) });
  assert.equal(path, '/landlord/leases/build-lease-agreement?leaseId=42&selectLease=1');
  assert.match(source, /variant="overline" color="success.main">Create lease builder/);
});

test('selection prefill uses the exact saved lease, including before portfolio refresh', () => {
  const source = read('./SelectAgreementLease.jsx');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let handler;
  walk(ast, (node) => {
    if (node.type === 'CallExpression' && node.callee.property?.name === 'then') handler = node.arguments[0];
  });
  assert.ok(handler);
  const run = (initialLease, leases, live = true) => {
    let options, selected;
    new Function('live', 'initialLease', 'readAgreement', 'setOptions', 'setSelected', 'leases',
      `return (${source.slice(handler.start, handler.end)})(leases);`)(live, initialLease,
      (item, key) => item?.[key] ?? item?.[key[0].toUpperCase() + key.slice(1)],
      (value) => { options = value; }, (value) => { selected = value; }, leases);
    return { options, selected };
  };
  const saved = { Id: 42, name: 'New lease' };
  assert.equal(run(saved, [{ id: 9 }]).selected.id, 42);
  assert.deepEqual(run(saved, [{ id: 9 }]).options.map((item) => item.id), [42, 9]);
  const listed = { id: 42, propertyName: 'Oak' };
  assert.equal(run(saved, [listed]).selected, listed);
  assert.equal(run(saved, [listed]).options.length, 1);
  assert.equal(run(null, [listed]).selected, null);
  assert.deepEqual(run(saved, [listed], false), { options: undefined, selected: undefined });
});

test('Continue gates selection and the create-lease fallback is hover-underlined text', () => {
  const source = read('./SelectAgreementLease.jsx');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const buttons = [];
  walk(ast, (node) => {
    if (node.type === 'JSXElement' && node.openingElement.name.name === 'Button') buttons.push(node);
  });
  const button = buttons.find((node) => node.children.some((child) => child.type === 'JSXText' && child.value.trim() === 'Continue'));
  assert.ok(button);
  const disabled = button.openingElement.attributes.find((attr) => attr.name?.name === 'disabled').value.expression;
  const isDisabled = new Function('selected', 'loading', 'error', 'propertiesError', `return ${source.slice(disabled.start, disabled.end)};`);
  assert.equal(isDisabled(null, false, '', false), true);
  assert.equal(isDisabled({ id: 42 }, false, '', false), false);
  assert.equal(isDisabled({ id: 42 }, true, '', false), true);
  assert.equal(isDisabled({ id: 42 }, false, 'offline', false), true);
  assert.match(source, /variant="text" onClick=\{onCreateLease\}/);
  assert.match(source, /Don't see your lease\? Create a lease/);
  assert.match(source, /textDecoration: 'underline'/);
  assert.doesNotMatch(source, /Continue to agreement details|justifyContent="space-between"|variant="outlined"/);
});
