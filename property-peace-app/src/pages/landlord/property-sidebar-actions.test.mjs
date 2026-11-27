import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const page = await readFile(new URL('./property.jsx', import.meta.url), 'utf8');
const actionEffect = page.match(/useEffect\(\(\) => \{\r?\n(    const \{ propertySidebarAction,[\s\S]*?)\r?\n  \}, \[/)?.[1];

function propertyActionContext(action) {
  const calls = [];
  const selectedProperty = { id: 42 };
  const context = {
    selectedProperty,
    propertyId: '42',
    propertyMatchesRoute: true,
    propertyMatchesOrganization: true,
    organizationLoading: false,
    handledSidebarActionKeys: { current: new Set() },
    location: { key: 'action', pathname: '/landlord/property/42', search: '?tab=overview', hash: '#details', state: { propertySidebarAction: action, returnFrom: 'sidebar' } },
    navigate: (to, options) => calls.push(['navigate', structuredClone(to), structuredClone(options)]),
    drawer: {
      openPropertyEditDrawer: () => calls.push(['edit']),
      openLeaseAddDrawer: (...args) => calls.push(['lease', ...args])
    },
    setDocumentUploadPropertyId: (id) => calls.push(['upload', id])
  };

  assert.ok(actionEffect, 'Expected the effect that consumes the sidebar action');
  return { calls, context, selectedProperty, run: () => runInNewContext(`(() => {${actionEffect}})()`, context) };
}

test('sidebar property actions wait for the correct property and organization', () => {
  const { calls, context, run } = propertyActionContext('edit');
  context.propertyMatchesRoute = false;
  run();
  context.propertyMatchesRoute = true;
  context.propertyMatchesOrganization = false;
  run();
  context.propertyMatchesOrganization = true;
  context.organizationLoading = true;
  run();
  assert.deepEqual(calls, []);
});

test('sidebar property actions open the existing drawers once and preserve other navigation state', () => {
  for (const action of ['edit', 'lease', 'upload']) {
    const { selectedProperty, calls, run } = propertyActionContext(action);
    run();
    run();
    const drawerCall = { edit: ['edit'], lease: ['lease', null, selectedProperty], upload: ['upload', '42'] }[action];
    assert.deepEqual(calls, [
      ['navigate', { pathname: '/landlord/property/42', search: '?tab=overview', hash: '#details' }, { replace: true, state: { returnFrom: 'sidebar' } }],
      drawerCall
    ]);
  }
});

test('an unknown sidebar action leaves navigation and drawers alone', () => {
  const { calls, run } = propertyActionContext('unknown');
  run();
  assert.deepEqual(calls, []);
});
