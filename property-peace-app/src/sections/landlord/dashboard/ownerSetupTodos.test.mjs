import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ONLINE_PAYMENT_SETUP_PATH } from '../../../utils/onlinePaymentTabs.js';
import {
  canSetUpOnlinePayments,
  clearOnlinePaymentSetupDismissal,
  getOwnerSetupCompletion,
  getOwnerSetupTodos,
  wasOnlinePaymentSetupDismissed
} from './ownerSetupTodoModel.js';

const noAccount = { accountId: null, detailsSubmitted: false };
const incompleteAccount = { accountId: 'acct_example', detailsSubmitted: false, canManageAccount: true };
const canConfigure = { presentation: { canConfigure: true } };

test('setup completion uses confirmed progress and excludes hidden steps from the remaining count', () => {
  assert.equal(getOwnerSetupCompletion({ remainingCount: 2, propertiesStatus: 'ready', propertyCount: 0 }), 0);
  assert.equal(getOwnerSetupCompletion({ remainingCount: 1, propertiesStatus: 'ready', propertyCount: 1 }), 50);
  assert.equal(getOwnerSetupCompletion({ remainingCount: 1, propertiesStatus: 'pending', propertyCount: 1 }), 0);
  assert.equal(getOwnerSetupCompletion({ remainingCount: 1, paymentAccountStatus: { isEnabled: true } }), 50);
  assert.equal(getOwnerSetupCompletion({ remainingCount: 1, paymentAccountStatus: incompleteAccount }), 0);
});

test('a confirmed empty portfolio puts adding a property before payments setup', () => {
  const todos = getOwnerSetupTodos(noAccount, canConfigure, { propertiesStatus: 'ready', propertyCount: 0 });
  assert.deepEqual(todos.map(({ id }) => id), ['add-property', 'online-payments']);
  assert.equal(todos[0].href, '/landlord/properties/add');
  assert.equal(getOwnerSetupTodos(null, {}, { propertiesStatus: 'ready', propertyCount: 0 })[0].id, 'add-property');
});

test('both setup steps use their own saved illustration', () => {
  const [propertyStep, paymentsStep] = getOwnerSetupTodos(noAccount, canConfigure, { propertiesStatus: 'ready', propertyCount: 0 });
  const propertyImage = new URL('../../../assets/images/icons/add-property.png', import.meta.url);
  const paymentsImage = new URL('../../../assets/images/icons/setup-online-payments.png', import.meta.url);

  assert.equal(propertyStep.image, propertyImage.href);
  assert.equal(paymentsStep.image, paymentsImage.href);
  assert.ok(existsSync(propertyImage));
  assert.ok(existsSync(paymentsImage));
});

test('a populated, loading, or failed portfolio never prompts for a first property', () => {
  for (const properties of [
    { propertiesStatus: 'ready', propertyCount: 1 },
    { propertiesStatus: 'pending', propertyCount: 0 },
    { propertiesStatus: 'failed', propertyCount: 0 }
  ]) {
    assert.deepEqual(getOwnerSetupTodos(null, {}, properties), []);
  }
});

test('an authorized landlord can open the Stripe setup tab from the dashboard', () => {
  assert.deepEqual(getOwnerSetupTodos(noAccount, canConfigure), [
    {
      id: 'online-payments',
      image: new URL('../../../assets/images/icons/setup-online-payments.png', import.meta.url).href,
      title: 'Set up online payments',
      description: 'Give tenants a way to pay rent online.',
      actionLabel: 'Set up Stripe',
      href: ONLINE_PAYMENT_SETUP_PATH
    }
  ]);
  assert.equal(getOwnerSetupTodos(incompleteAccount, canConfigure)[0].actionLabel, 'Continue Stripe setup');
});

test('only actionable, confirmed Stripe setup states can show a todo', () => {
  for (const status of [
    null,
    { accountId: null },
    { ...incompleteAccount, detailsSubmitted: true },
    { ...incompleteAccount, isEnabled: true },
    { ...incompleteAccount, canManageAccount: false }
  ]) {
    assert.equal(canSetUpOnlinePayments(status), false);
    assert.deepEqual(getOwnerSetupTodos(status, canConfigure), []);
  }
  assert.equal(canSetUpOnlinePayments(noAccount), true);
  assert.equal(canSetUpOnlinePayments(incompleteAccount), true);
  assert.deepEqual(getOwnerSetupTodos(noAccount, { loading: true, ...canConfigure }), []);
  assert.deepEqual(getOwnerSetupTodos(noAccount, { error: 'Unavailable', ...canConfigure }), []);
  assert.deepEqual(getOwnerSetupTodos(noAccount, { readinessError: 'Unavailable', ...canConfigure }), []);
  assert.deepEqual(getOwnerSetupTodos(noAccount, { presentation: { canConfigure: false } }), []);
  assert.deepEqual(getOwnerSetupTodos(noAccount, { presentation: { canConfigure: true, canPay: true } }), []);
});

test('a saved payments dismissal only hides payments setup for the matching user and organization', () => {
  const scope = JSON.stringify(['41', '7']);
  const items = new Map([['propertyPeace:owner-setup-todo:["41","7"]:online-payments', 'true']]);
  const storage = { getItem: (key) => items.get(key) };
  const paymentSetupDismissed = wasOnlinePaymentSetupDismissed(scope, storage);
  assert.equal(paymentSetupDismissed, true);
  assert.equal(wasOnlinePaymentSetupDismissed(JSON.stringify(['42', '7']), storage), false);
  assert.equal(wasOnlinePaymentSetupDismissed(JSON.stringify(['41', '8']), storage), false);
  const todos = getOwnerSetupTodos(noAccount, canConfigure, { propertiesStatus: 'ready', propertyCount: 0, paymentSetupDismissed });
  assert.deepEqual(todos.map(({ id }) => id), ['add-property']);
});

test('a successfully migrated browser dismissal is removed so a failed sync can be retried later', () => {
  const scope = JSON.stringify(['41', '7']);
  const key = 'propertyPeace:owner-setup-todo:["41","7"]:online-payments';
  const items = new Map([[key, 'true']]);
  const storage = {
    getItem: (itemKey) => items.get(itemKey),
    removeItem: (itemKey) => items.delete(itemKey)
  };

  clearOnlinePaymentSetupDismissal(scope, storage);

  assert.equal(wasOnlinePaymentSetupDismissed(scope, storage), false);
});

test('blocked browser storage does not throw when reading or clearing a legacy dismissal', () => {
  const blocked = () => { throw new Error('Storage unavailable'); };
  const storage = { getItem: blocked, removeItem: blocked };
  assert.equal(wasOnlinePaymentSetupDismissed('scope', storage), false);
  assert.doesNotThrow(() => clearOnlinePaymentSetupDismissal('scope', storage));
});

test('the setup card uses the left dashboard column and provides manual step navigation', () => {
  const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
  const home = read('./OwnerTodayHome.jsx');
  const todos = read('./OwnerSetupTodos.jsx');
  assert.match(home, /"setup main" "sidebar main"/);
  assert.match(home, /gridArea: 'setup'[^>]*>\s*<OwnerSetupTodos/);
  assert.match(todos, /aria-label="Previous setup step"/);
  assert.match(todos, /aria-label="Next setup step"/);
  assert.match(todos, /\{completion\}% complete[\s\S]*?aria-label="Previous setup step"/);
  assert.match(todos, /<Stack alignItems="center"[^>]*textAlign: 'center'/);
  assert.doesNotMatch(todos, /Get set up/);
  assert.match(todos, /aria-live="polite"/);
  assert.doesNotMatch(todos, />\s*(?:Optional|Dismiss)\s*</);
});

test('the online payments step provides a labeled dismissal button', () => {
  const todos = readFileSync(new URL('./OwnerSetupTodos.jsx', import.meta.url), 'utf8');
  assert.match(
    todos,
    /todo\.id === ONLINE_PAYMENT_TODO_ID\s*&&\s*\(\s*<IconButton\s+aria-label="Dismiss online payments setup"\s+onClick=\{dismissPayments\}/
  );
});

test('all available setup steps contribute to the same card height while only the active one is interactive', () => {
  const todos = readFileSync(new URL('./OwnerSetupTodos.jsx', import.meta.url), 'utf8');
  assert.match(todos, /const hasPaymentSetup = todos\.some\(\(\{ id \}\) => id === ONLINE_PAYMENT_TODO_ID\)/);
  assert.match(todos, /pr: hasPaymentSetup \? 5\.5 : 0/);
  assert.match(todos, /<Box aria-live="polite" sx=\{\{ display: 'grid'[^>]*>\s*\{todos\.map\(\(step\)/);
  assert.match(todos, /const isActive = step\.id === todo\.id/);
  assert.match(todos, /inert=\{!isActive\}/);
  assert.match(todos, /gridArea: '1 \/ 1', visibility: isActive \? 'visible' : 'hidden'/);
});

test('the payments prompt waits for the organization preference and aborts a stale dismissal request', () => {
  const todos = readFileSync(new URL('./OwnerSetupTodos.jsx', import.meta.url), 'utf8');
  assert.match(todos, /loadOnlinePaymentSetupDismissal\(\{/);
  assert.match(todos, /saveOnlinePaymentSetupDismissal\(\{/);
  assert.match(todos, /dismissControllerRef\.current\?\.abort\(\)/);
  assert.match(todos, /paymentSetupDismissed === false/);
  assert.match(todos, /disabled=\{isDismissingPayments\}/);
});
