import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ts = createRequire(new URL('../../../../property-peace-mobile/package.json', import.meta.url))('typescript');
const source = await readFile(new URL('./short-stay-connect.jsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { fileName: 'short-stay-connect.jsx', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h' } }).outputText;
const h = (type, props, ...children) => ({ type, props: { ...props, children } });
const flatten = (node) => node == null ? [] : Array.isArray(node) ? node.flatMap(flatten) : typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [];

function harness() {
  let slots = [], index = 0, effects = [], response, failure = false, tree;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useCallback(fn) { index++; return fn; },
    useEffect(fn) { const i = index++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } }
  };
  const mui = Object.fromEntries(['Alert', 'Button', 'CircularProgress', 'Paper', 'Stack', 'Typography'].map(name => [name, name]));
  const exported = {};
  const api = { status: async () => { if (failure) throw Error('Offline'); return response; }, preparation: async () => null };
  vm.runInNewContext(compiled, { exports: exported, h, React: { createElement: h }, window: { addEventListener() {}, removeEventListener() {} }, require(name) {
    if (name === 'react') return react;
    if (name === '@mui/material') return mui;
    if (name === 'hooks/useAuth') return () => ({ user: { id: 8 } });
    if (name === 'hooks/useFetchProperties') return () => ({ properties: [{ id: 1 }] });
    if (name === 'contexts/OrganizationContext') return { useOrganization: () => ({ currentOrganization: { id: 9 } }) };
    if (name === 'sections/landlord/payments/ConnectOnboardingWizard') return 'Wizard';
    if (name === 'utils/connectOnboarding') return { validateConnectOnboardingContext: () => ({}) };
    if (name === './short-stay-connect') return { connectReadiness: status => status && ({ charges: 'Unknown', payouts: 'Unknown', card: 'Unknown', kyc: 'Unknown' }), shortStayConnectAPI: api };
    throw Error(name);
  } });
  const render = () => { index = 0; tree = exported.default({ propertyId: 1 }); index = 0; tree = tree.type(tree.props); const pending = effects; effects = []; pending.forEach(fn => fn()); };
  return {
    reset(status, fail = false) { slots = []; effects = []; response = status; failure = fail; },
    render,
    buttons() { return flatten(tree).filter(node => node.type === 'Button').map(node => node.props.children[0]); }
  };
}

test('actions depend on owned status, not rent enablement or optional PP collection review', async () => {
  const ui = harness();
  for (const [accountId, failed, expected] of [[null, false, 'Set up Stripe Connect'], ['acct_existing', false, 'Continue Stripe onboarding'], [null, true, null]]) {
    ui.reset({ accountId, chargesEnabled: false, payoutsEnabled: false }, failed);
    ui.render();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    ui.render();
    assert.equal(ui.buttons().includes('Set up Stripe Connect'), expected === 'Set up Stripe Connect');
    assert.equal(ui.buttons().includes('Continue Stripe onboarding'), expected === 'Continue Stripe onboarding');
  }
});
