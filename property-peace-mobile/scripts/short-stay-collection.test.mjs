import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const helpers = require('../src/features/properties/shortStayCollection.ts');
const apiSource = readFileSync(new URL('../src/api/shortStayCollectionAPI.ts', import.meta.url), 'utf8');
const apiCompiled = ts.transpileModule(apiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = readFileSync(new URL('../src/screens/landlord/ShortStayCollectionSection.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
test('collection API sends only authorized draft fields and uses the expected routes', async () => {
  const requests = [];
  const client = Object.fromEntries(['get', 'put', 'post'].map(method => [method, async (...args) => {
    requests.push([method, ...args]);
    return { success: true, data: null };
  }]));
  const exports = {};
  vm.runInNewContext(apiCompiled, { exports, require: () => ({ __esModule: true, default: client }) });
  const api = exports.default;
  await api.requirements(); await api.applications(); await api.saveDraft([1], '2026-10');
  await api.submit(); await api.identitySession(4); await api.identityRefresh(4);
  assert.equal(JSON.stringify(requests.map(row => row.slice(0, 2))), JSON.stringify([
    ['get', '/api/short-stay/collection-applications/requirements'], ['get', '/api/short-stay/collection-applications'],
    ['put', '/api/short-stay/collection-applications/draft'], ['post', '/api/short-stay/collection-applications/submit'],
    ['post', '/api/short-stay/collection-applications/4/identity-session'], ['post', '/api/short-stay/collection-applications/4/identity-refresh'],
  ]));
  assert.equal(JSON.stringify(requests[2][2]), JSON.stringify({ propertyIds: [1], authorityAttested: true, feePolicyConsentVersion: '2026-10' }));
});
const requirement = { available: true, identityEnabled: true, feePolicyUrl: 'https://app.propertypeace.io/legal/collection-fees', feePolicyConsentVersion: '2026-10', reasonCode: null };
const draft = { id: 4, status: 'draft', propertyIds: [1], authorityAttested: true, feePolicyConsentVersion: '2026-10', rowVersion: 1, nextSteps: ['submit'] };
function harness(options = {}) {
  let apps = options.apps ?? [], requirements = options.requirements ?? requirement;
  const calls = { save: [], submit: 0, session: [], refresh: [], opened: [] };
  const api = {
    requirements: async () => requirements,
    applications: async () => apps,
    saveDraft: async (...args) => { calls.save.push(args); apps = [draft]; return draft; },
    submit: async () => { calls.submit++; apps = [{ ...draft, status: 'submitted' }]; },
    identitySession: async id => { calls.session.push(id); return { url: options.identityUrl ?? 'https://verify.stripe.com/start/session-token' }; },
    identityRefresh: async id => { calls.refresh.push(id); }, ...options.api,
  };
  let slots = [], index = 0, pending = [], tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }]; },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
    useCallback(fn, deps) { const slot = index++; if (!slots[slot] || deps.some((dep, i) => dep !== slots[slot].deps[i])) slots[slot] = { fn, deps }; return slots[slot].fn; },
    useEffect(fn, deps) { const slot = index++; if (!slots[slot] || deps.some((dep, i) => dep !== slots[slot].deps[i])) { slots[slot]?.cleanup?.(); slots[slot] = { deps }; pending.push(() => { slots[slot].cleanup = fn(); }); } },
  };
  const listeners = {};
  const navigation = { addListener: (_event, cb) => { listeners.focus = cb; return () => {}; } };
  const stubs = {
    react: { __esModule: true, default: react, ...react },
    'react-native': { StyleSheet: { create: x => x }, AppState: { addEventListener: (_event, cb) => { listeners.active = cb; return { remove() {} }; } }, Linking: { canOpenURL: async () => true, openURL: async url => { calls.opened.push(url); } }, ActivityIndicator: 'ActivityIndicator', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@react-navigation/native': { useNavigation: () => navigation },
    '../../api/shortStayCollectionAPI': { __esModule: true, default: api },
    '../../features/properties/shortStayCollection': helpers,
    '../../theme/AppTheme': { useAppTheme: () => ({ colors: { text: '#000', muted: '#888', accent: '#00f' } }) },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, require: name => { if (!(name in stubs)) throw Error(name); return stubs[name]; } });
  const Screen = exports.default;
  function render() { index = 0; tree = Screen({ propertyId: options.propertyId ?? '1' }); const effects = pending; pending = []; for (const effect of effects) effect(); return tree; }
  function nodes(node = tree) { if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props.children)]; }
  function button(label) { return nodes().find(n => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === label); }
  function checkbox(label) { return button(label); }
  return { render, button, checkbox, nodes, calls, api, listeners, setApps: value => { apps = value; }, setRequirements: value => { requirements = value; } };
}
test('hosted URL requires exact HTTPS Stripe origin, no credentials, port or fragment', () => {
  assert.equal(helpers.hostedIdentityUrl('https://verify.stripe.com/start/s'), true);
  for (const url of ['http://verify.stripe.com/a', 'https://verify.stripe.com.evil.test/a', 'https://verify.stripe.com@evil.test/a', 'https://verify.stripe.com:444/a', 'https://verify.stripe.com/a#token', 'https://VERIFY.stripe.com.evil/a', 'javascript:alert(1)', ' https://verify.stripe.com/a']) assert.equal(helpers.hostedIdentityUrl(url), false, url);
});
test('policy must have a canonical publisher link/version and no disabled reason', () => {
  assert.equal(helpers.policyReady(requirement), true);
  assert.equal(helpers.feePolicyUrl('https://app.propertypeace.io/legal/fees-v2'), true);
  for (const url of [
    'https://evil.test/legal/fees', 'https://app.propertypeace.io.evil.test/legal/fees',
    'https://app.propertypeace.io@evil.test/legal/fees', 'https://user:pass@app.propertypeace.io/legal/fees',
    'http://app.propertypeace.io/legal/fees', 'https://app.propertypeace.io:443/legal/fees',
    'https://app.propertypeace.io:444/legal/fees', 'https://app.propertypeace.io/legal/fees?next=evil',
    'https://app.propertypeace.io/legal/fees#x', 'https://app.propertypeace.io/legal/../fees',
    'https://app.propertypeace.io/legal/%2e%2e/fees', 'https://app.propertypeace.io/legal/fees/',
    'https://app.propertypeace.io/legal/', 'https://app.propertypeace.io/legal/fees%2Fmore',
    'https://app.propertypeace.io/legal/fees_bad', 'https://APP.propertypeace.io/legal/fees',
    ' https://app.propertypeace.io/legal/fees', `https://app.propertypeace.io/legal/${'a'.repeat(500)}`,
  ]) {
    assert.equal(helpers.feePolicyUrl(url), false, url);
    assert.equal(helpers.policyReady({ ...requirement, feePolicyUrl: url }), false, url);
  }
  assert.equal(helpers.policyReady({ ...requirement, available: false }), false);
  assert.equal(helpers.policyReady({ ...requirement, feePolicyConsentVersion: null }), false);
  for (const version of [' ', ' 2026-10', '2026-10 ', 'a'.repeat(65)])
    assert.equal(helpers.policyReady({ ...requirement, feePolicyConsentVersion: version }), false, version);
});
test('unavailable policy and failed load fail closed', async () => {
  const h = harness({ requirements: { ...requirement, available: false, feePolicyUrl: null, reasonCode: 'fee_policy_unavailable' } });
  h.render(); await tick(); h.render();
  assert.equal(h.button('Save collection draft'), undefined);
  assert.ok(h.nodes().some(n => n.props.accessibilityRole === 'alert' && JSON.stringify(n.props.children).includes('fee policy is unavailable')));
  const untrusted = harness({ requirements: { ...requirement, feePolicyUrl: 'https://evil.test/legal/fees' } });
  untrusted.render(); await tick(); untrusted.render();
  assert.equal(untrusted.button('Save collection draft'), undefined);
  assert.equal(untrusted.button('Read the published fee policy'), undefined);
  assert.deepEqual(untrusted.calls.opened, []);
  const failed = harness({ api: { requirements: async () => { throw Error('offline'); } } });
  failed.render(); await tick(); failed.render();
  assert.equal(failed.button('Submit collection application'), undefined);
  assert.equal(failed.button('Save collection draft'), undefined);
});
test('consent and authority required; only scoped property ID and policy version sent', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  assert.equal(h.button('Save collection draft').props.disabled, true);
  h.checkbox('I have authority to apply for this property').props.onPress(); h.render();
  assert.equal(h.button('Save collection draft').props.disabled, true);
  h.checkbox('I consent to the current fee policy').props.onPress(); h.render();
  h.button('Save collection draft').props.onPress(); await tick(); h.render();
  assert.equal(JSON.stringify(h.calls.save), JSON.stringify([[[1], '2026-10']]));
  assert.equal(h.button('Submit collection application').props.disabled, false);
  h.button('Submit collection application').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.submit, 1);
  assert.ok(h.button('Continue with Stripe Identity'));
});
test('multi-property and mismatched drafts are visible but cannot be overwritten', async () => {
  for (const propertyIds of [[1, 2], [2]]) {
    const h = harness({ apps: [{ ...draft, propertyIds }] }); h.render(); await tick(); h.render();
    assert.equal(h.button('Save collection draft'), undefined);
    assert.equal(h.button('Submit collection application'), undefined);
    assert.ok(h.nodes().some(n => n.props.accessibilityRole === 'alert' && JSON.stringify(n.props.children).includes('scope')));
  }
});
test('change of policy or scope between initial load and save aborts mutation', async () => {
  const h = harness(); h.render(); await tick(); h.render();
  h.checkbox('I have authority to apply for this property').props.onPress(); h.render();
  h.checkbox('I consent to the current fee policy').props.onPress(); h.render();
  h.setApps([{ ...draft, propertyIds: [1, 2] }]);
  h.button('Save collection draft').props.onPress(); await tick(); h.render();
  assert.equal(h.calls.save.length, 0);
});
test('rapid Continue presses request and launch only one identity session; failure unlocks retry', async () => {
  let sessions = 0, release, fail = false;
  const h = harness({ apps: [{ ...draft, status: 'submitted' }], api: {
    identitySession: async () => {
      sessions++;
      await new Promise(resolve => { release = resolve; });
      if (fail) throw Error('Unavailable');
      return { url: 'https://verify.stripe.com/start/session-token' };
    },
  } });
  h.render(); await tick(); h.render();
  const click = h.button('Continue with Stripe Identity').props.onPress;
  click(); click();
  assert.equal(sessions, 1);
  release(); await tick(); h.render();
  assert.deepEqual(h.calls.opened, ['https://verify.stripe.com/start/session-token']);
  click(); await tick();
  assert.equal(sessions, 1);
  h.listeners.active('active'); await tick(); h.render();
  click(); click();
  assert.equal(sessions, 2);
  fail = true; release(); await tick(); h.render();
  fail = false;
  h.button('Continue with Stripe Identity').props.onPress();
  assert.equal(sessions, 3);
  release(); await tick();
  assert.equal(h.calls.opened.length, 2);
});
test('identity opens only validated hosted URL; refresh server status without storing token', async () => {
  const h = harness({ apps: [{ ...draft, status: 'submitted' }] }); h.render(); await tick(); h.render();
  h.button('Continue with Stripe Identity').props.onPress(); await tick(); h.render();
  assert.deepEqual(h.calls.opened, ['https://verify.stripe.com/start/session-token']);
  h.listeners.active('active'); await tick(); h.render();
  assert.deepEqual(h.calls.refresh, [4]);
  const evil = harness({ apps: [{ ...draft, status: 'submitted' }], identityUrl: 'https://verify.stripe.com.evil.test/steal' }); evil.render(); await tick(); evil.render();
  evil.button('Continue with Stripe Identity').props.onPress(); await tick(); evil.render();
  assert.deepEqual(evil.calls.opened, []);
  const multi = harness({ apps: [{ ...draft, propertyIds: [1, 2], status: 'submitted' }] }); multi.render(); await tick(); multi.render();
  assert.equal(multi.button('Save collection draft'), undefined);
  assert.ok(multi.button('Continue with Stripe Identity'));
  const pending = harness({ apps: [{ ...draft, status: 'identityPending' }], api: { identitySession: async () => null } }); pending.render(); await tick(); pending.render();
  pending.button('Refresh identity status').props.onPress(); await tick(); pending.render();
  assert.deepEqual(pending.calls.refresh, [4]);
  assert.equal(pending.nodes().some(n => JSON.stringify(n.props.children).includes('session-token')), false);
});
