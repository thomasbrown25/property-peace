import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { collectionPolicyUrl, stripeIdentityUrl, draftPropertyIds, canSaveCollection, collectionStatus } from './short-stay-collection.js';

const policy = { available: true, identityEnabled: true, feePolicyConsentVersion: '2026-10', feePolicyUrl: 'https://app.propertypeace.io/legal/short-stay-fees' };

test('fee policy must be canonical approved legal HTTPS URL with usable version and availability', () => {
  assert.equal(collectionPolicyUrl(policy), policy.feePolicyUrl);
  for (const url of ['https://evil.test/legal/fees', 'https://app.propertypeace.io.evil.test/legal/fees', 'http://app.propertypeace.io/legal/fees', 'https://app.propertypeace.io/legal/fees?next=evil', 'https://app.propertypeace.io/legal/fees#x', 'https://app.propertypeace.io/legal/%2e%2e', 'https://app.propertypeace.io:443/legal/fees', 'https://app.propertypeace.io/legal/fees/']) {
    assert.equal(collectionPolicyUrl({ ...policy, feePolicyUrl: url }), null, url);
  }
  assert.equal(collectionPolicyUrl({ ...policy, available: false }), null);
  assert.equal(collectionPolicyUrl({ ...policy, identityEnabled: false }), null);
  assert.equal(collectionPolicyUrl({ ...policy, feePolicyConsentVersion: '' }), null);
});

test('identity redirects only to exact Stripe hosted HTTPS identity origin without credentials', () => {
  assert.equal(stripeIdentityUrl('https://verify.stripe.com/start/abc?client_secret=xyz'), 'https://verify.stripe.com/start/abc?client_secret=xyz');
  for (const url of [null, '/start', 'http://verify.stripe.com/start', 'https://verify.stripe.com.evil.test/start', 'https://verify.stripe.com@evil.test/start', 'https://user@verify.stripe.com/start', 'https://verify.stripe.com:444/start', 'https://verify.stripe.com/start#fragment', 'https://verify.stripe.com./start']) assert.equal(stripeIdentityUrl(url), null, String(url));
});

test('one-property draft preserves all existing property IDs; policy and attestation gate mutation', () => {
  assert.deepEqual(draftPropertyIds([{ id: 5, status: 'draft', propertyIds: [2, 4] }], 8), [2, 4, 8]);
  assert.deepEqual(draftPropertyIds([], 8), [8]);
  assert.equal(draftPropertyIds([{ status: 'submitted', propertyIds: [2] }], 8), null);
  assert.equal(draftPropertyIds([{ status: 'draft', propertyIds: [2] }, { status: 'draft', propertyIds: [3] }], 8), null);
  assert.equal(canSaveCollection(policy, true, true, [2, 4, 8]), true);
  assert.equal(canSaveCollection(policy, false, true, [8]), false);
  assert.equal(canSaveCollection({ ...policy, available: false }, true, true, [8]), false);
  assert.equal(collectionStatus('payoutApproved'), 'Review complete — no booking or payout enabled here');
});

test('client sends precise JSON contract with no-store to authenticated organization-aware client', async () => {
  const source = (await readFile(new URL('../../api/shortStay.js', import.meta.url), 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__collectionAxios;');
  const calls = [];
  globalThis.__collectionAxios = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, async (...args) => { calls.push([method, ...args]); return { data: { success: true, data: { url: 'https://verify.stripe.com/start' } } }; }]));
  try {
    const { shortStayAPI } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    await shortStayAPI.getCollectionRequirements();
    await shortStayAPI.getCollectionApplications();
    await shortStayAPI.saveCollectionDraft({ propertyIds: [2, 8], authorityAttested: true, feePolicyConsentVersion: '2026-10' });
    await shortStayAPI.submitCollection();
    await shortStayAPI.startCollectionIdentity(7);
    await shortStayAPI.refreshCollectionIdentity(7);
    assert.deepEqual(calls.map(c => [c[0], c[1]]), [
      ['get', '/api/short-stay/collection-applications/requirements'], ['get', '/api/short-stay/collection-applications'],
      ['put', '/api/short-stay/collection-applications/draft'], ['post', '/api/short-stay/collection-applications/submit'],
      ['post', '/api/short-stay/collection-applications/7/identity-session'], ['post', '/api/short-stay/collection-applications/7/identity-refresh']
    ]);
    assert.deepEqual(calls[2][2], { propertyIds: [2, 8], authorityAttested: true, feePolicyConsentVersion: '2026-10' });
    assert.equal(calls[3][2], null);
    for (const call of calls) assert.equal(call.at(-1).headers['Cache-Control'], 'no-store');
  } finally { delete globalThis.__collectionAxios; }
});

test('UI is scoped to selected organization, re-fetches authority from server and has no identity storage or PII forms', async () => {
  const page = await readFile(new URL('./short-stay-collection.jsx', import.meta.url), 'utf8');
  const setup = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  assert.match(setup, /ShortStayCollection/);
  assert.match(page, /currentOrganization/);
  assert.match(page, /getCollectionRequirements/);
  assert.match(page, /getCollectionApplications/);
  assert.match(page, /refreshCollectionIdentity/);
  assert.match(page, /window\.location\.assign\(safeUrl\)/);
  assert.match(page, /draftPropertyIds\(applications, propertyId\)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\.|type="file"|type="password"|bankAccount|identityDocument/);
});

test('rapid Continue clicks launch only one identity session; failed launch permits retry', async () => {
  const ts = createRequire(new URL('../../../../property-peace-mobile/package.json', import.meta.url))('typescript');
  const source = await readFile(new URL('./short-stay-collection.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: new URL('./short-stay-collection.jsx', import.meta.url).pathname, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h' } }).outputText;
  const calls = { sessions: 0, redirects: [] };
  let fail = false;
  const api = {
    getCollectionRequirements: async () => policy,
    getCollectionApplications: async () => [{ id: 7, status: 'submitted', propertyIds: [1] }],
    startCollectionIdentity: async () => {
      calls.sessions++;
      if (fail) throw Error('Unavailable');
      return { url: 'https://verify.stripe.com/start/session' };
    },
  };
  let slots = [], index = 0, effects = [], tree;
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], value => { slots[slot] = value; }]; },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
    useCallback(fn) { index++; return fn; },
    useEffect(fn) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(fn); } },
  };
  const h = (type, props, ...children) => ({ type, props: { ...props, children } });
  const mui = Object.fromEntries(['Alert', 'Box', 'Button', 'Checkbox', 'CircularProgress', 'FormControlLabel', 'Link', 'Paper', 'Stack', 'Typography'].map(name => [name, name]));
  const exports = {};
  vm.runInNewContext(compiled, { exports, h, React: { createElement: h }, window: { addEventListener() {}, removeEventListener() {}, location: { assign(url) { calls.redirects.push(url); } } }, require: name => {
    if (name === 'react') return react;
    if (name === '@mui/material') return mui;
    if (name === 'contexts/OrganizationContext') return { useOrganization: () => ({ currentOrganization: { id: 1 } }) };
    if (name === 'api/shortStay') return { shortStayAPI: api };
    if (name === './short-stay-collection') return { collectionPolicyUrl, stripeIdentityUrl, draftPropertyIds, canSaveCollection, collectionStatus };
    throw Error(name);
  } });
  function render() {
    index = 0; tree = exports.default({ propertyId: 1 });
    index = 0; tree = tree.type(tree.props);
    const pending = effects; effects = []; pending.forEach(fn => fn());
  }
  function button(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map(button).find(Boolean);
    if (node.type === 'Button' && node.props.children.includes('Continue with Stripe-hosted identity')) return node;
    return button(node.props?.children);
  }
  const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  render(); await tick(); render();
  const click = button(tree).props.onClick;
  click(); click(); await tick(); render();
  assert.equal(calls.sessions, 1);
  assert.deepEqual(calls.redirects, ['https://verify.stripe.com/start/session']);
  click(); await tick();
  assert.equal(calls.sessions, 1);

  // Simulate a new mount whose first launch fails and whose second launch succeeds.
  slots = []; fail = true; render(); await tick(); render();
  const retry = button(tree).props.onClick;
  retry(); retry(); await tick(); render();
  assert.equal(calls.sessions, 2);
  fail = false;
  function refreshButton(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map(refreshButton).find(Boolean);
    if (node.type === 'Button' && node.props.children.includes('Refresh requirements and application status')) return node;
    return refreshButton(node.props?.children);
  }
  refreshButton(tree).props.onClick(); await tick(); render();
  button(tree).props.onClick(); await tick();
  assert.equal(calls.sessions, 3);
  assert.equal(calls.redirects.length, 2);
});
