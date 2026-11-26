import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONLINE_PAYMENT_SETUP_PATH } from '../../../utils/onlinePaymentTabs.js';
import { canSetUpOnlinePayments, dismissOwnerSetupTodo, getOwnerSetupTodos, isOwnerSetupTodoDismissed } from './ownerSetupTodoModel.js';

const noAccount = { accountId: null, detailsSubmitted: false };
const incompleteAccount = { accountId: 'acct_example', detailsSubmitted: false, canManageAccount: true };
const canConfigure = { presentation: { canConfigure: true } };

test('an authorized landlord can open the Stripe setup tab from the dashboard', () => {
  assert.deepEqual(getOwnerSetupTodos(noAccount, canConfigure), [
    {
      id: 'online-payments',
      title: 'Set up online payments',
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

test('dismissal persists for one todo in the current user and organization', () => {
  const items = new Map();
  const storage = { getItem: (key) => items.get(key), setItem: (key, value) => items.set(key, value) };
  const scope = JSON.stringify(['41', '7']);
  assert.equal(isOwnerSetupTodoDismissed(scope, 'online-payments', storage), false);
  dismissOwnerSetupTodo(scope, 'online-payments', storage);
  assert.equal(isOwnerSetupTodoDismissed(scope, 'online-payments', storage), true);
  assert.equal(isOwnerSetupTodoDismissed(scope, 'other-todo', storage), false);
  assert.equal(isOwnerSetupTodoDismissed(JSON.stringify(['42', '7']), 'online-payments', storage), false);
  assert.equal(isOwnerSetupTodoDismissed(JSON.stringify(['41', '8']), 'online-payments', storage), false);
});

test('blocked browser storage does not prevent the landlord from opening or dismissing a todo', () => {
  const blocked = () => { throw new Error('Storage unavailable'); };
  const storage = { getItem: blocked, setItem: blocked };
  assert.equal(isOwnerSetupTodoDismissed('scope', 'online-payments', storage), false);
  assert.doesNotThrow(() => dismissOwnerSetupTodo('scope', 'online-payments', storage));
});

test('todos appear above Tasks and reuse the dashboard property hover color', () => {
  const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
  const home = read('./OwnerTodayHome.jsx');
  const todos = read('./OwnerSetupTodos.jsx');
  const row = read('./dashboardEntrance.mjs');
  assert.match(home, /<OwnerSetupTodos[^>]*\/>\s*<Box component="section" aria-labelledby="owner-next-heading"/);
  assert.match(todos, /if \(!todos\.length\) return null/);
  assert.match(todos, /bgcolor: dashboardRowHoverColor/);
  assert.match(row, /'&:hover': \{ bgcolor: dashboardRowHoverColor \}/);
  assert.match(todos, /aria-label=\{\x60Dismiss \$\{todo\.title\}\x60\}/);
});
