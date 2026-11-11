import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const page = readFileSync(new URL('../build-lease-agreement.jsx', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../../../sections/lease-builder/LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  visit(node);
  Object.values(node).forEach((value) => Array.isArray(value) ? value.forEach((child) => walk(child, visit)) : walk(value, visit));
};
const declaration = (source, name) => {
  let result;
  walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }), (node) => {
    if (node.type === 'VariableDeclarator' && node.id.name === name) result = source.slice(node.init.start, node.init.end);
  });
  assert.ok(result, name);
  return result;
};
test('edit action opens shared full lease form without navigating or discarding agreement changes', () => {
  let open = false;
  vm.runInNewContext(`(${declaration(page, 'editLease')})`, { setEditOpen: (value) => { open = value; } })();
  assert.equal(open, true);
  assert.match(page, /<Drawer anchor="right"/);
  assert.match(page, /<LeaseSetupBuilder embedded leaseId=\{leaseId\} onSaved=\{onLeaseSaved\}/);
  assert.doesNotMatch(page, /navigate\(`\/landlord\/leases\/\$\{leaseId\}\/builder/);
  assert.match(builder, /if \(embedded\) await onSaved\?\.\(result\)/);
  assert.match(builder, /open=\{!embedded && Boolean\(saved\)\}/);
  parse(builder, { sourceType: 'module', plugins: ['jsx'] });
});
test('content borders remain visible while sidebar surfaces and read-only badge are absent', () => {
  const contentStyle = vm.runInNewContext(`(${declaration(page, 'contentBorderSx')})`);
  assert.equal(contentStyle.border, '1px solid');
  assert.equal(contentStyle.borderColor, contentStyle['&:hover'].borderColor);
  const sidebarStyle = vm.runInNewContext(`(${declaration(page, 'noBorderSx')})`);
  assert.equal(sidebarStyle.border, 0);
  assert.equal(sidebarStyle['&:hover'].border, 0);
  assert.match(page, /title="From your lease" sx=\{contentBorderSx\}/);
  assert.match(page, /title=\{agreementSections\[active\].title\} sx=\{contentBorderSx\}/);
  assert.doesNotMatch(page, /label="Read-only"/);
});
test('lease refresh preserves editor mounting and handles failed post-save reload with retry', async () => {
  for (const failure of [false, true]) {
    const updates = [];
    const refresh = vm.runInNewContext(`(${declaration(page, 'refreshLease')})`, {
      leaseId: 7, axiosServices: { get() {} }, mounted: { current: true },
      loadAgreementContext: async () => { if (failure) throw new Error('Offline'); return { lease: { id: 7 } }; },
      setContext: (v) => updates.push(['context', v.lease.id]),
      setLeaseRefreshNeeded: (v) => updates.push(['retry', v]),
      setError: (v) => updates.push(['error', v])
    });
    await refresh();
    assert.ok(updates.some(([key, value]) => key === 'retry' && value === failure));
    if (!failure) assert.ok(updates.some(([key]) => key === 'context'));
    else assert.ok(updates.some(([key, value]) => key === 'error' && /Lease saved.*Offline/.test(value)));
  }
  assert.match(page, /!hasUnsavedChanges && !leaseRefreshNeeded/);
  assert.match(page, /Keep each editor mounted/);
});
test('successful embedded save closes drawer, clears busy state and refreshes inherited facts', async () => {
  const calls = [];
  const saved = vm.runInNewContext(`(${declaration(page, 'onLeaseSaved')})`, {
    setEditBusy: (v) => calls.push(['busy', v]), setEditOpen: (v) => calls.push(['open', v]),
    refreshLease: async () => calls.push(['refresh'])
  });
  await saved();
  assert.deepEqual(calls, [['busy', false], ['open', false], ['refresh']]);
});
test('drawer close cannot interrupt saving, and cancelled discard leaves edits intact', () => {
  for (const [editBusy, confirm, closes] of [[true, true, 0], [false, false, 0], [false, true, 1]]) {
    const calls = [];
    vm.runInNewContext(`(${declaration(page, 'closeLeaseEditor')})`, {
      editBusy, window: { confirm: () => confirm }, setEditOpen: (v) => calls.push(v)
    })();
    assert.equal(calls.length, closes);
  }
});
