import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('online payments intro dismissal is saved for one browser user and organization', async () => {
  const { dismissOnlinePaymentsIntro, hasSeenOnlinePaymentsIntro } = await import('./onlinePaymentsIntroState.mjs');
  const items = new Map();
  const storage = { getItem: (key) => items.get(key), setItem: (key, value) => items.set(key, value) };
  const scope = JSON.stringify(['12', '34']);

  assert.equal(hasSeenOnlinePaymentsIntro(scope, storage), false);
  dismissOnlinePaymentsIntro(scope, storage);

  const nextSession = await import('./onlinePaymentsIntroState.mjs?new-session');
  assert.equal(nextSession.hasSeenOnlinePaymentsIntro(scope, storage), true);
  assert.equal(nextSession.hasSeenOnlinePaymentsIntro(JSON.stringify(['12', '35']), storage), false);
  assert.equal(nextSession.hasSeenOnlinePaymentsIntro(JSON.stringify(['13', '34']), storage), false);
});

test('a storage failure still allows dismissal for the current app session', async () => {
  const { dismissOnlinePaymentsIntro, hasSeenOnlinePaymentsIntro } = await import('./onlinePaymentsIntroState.mjs');
  const blocked = () => { throw new Error('Storage disabled'); };
  const storage = { getItem: blocked, setItem: blocked };
  const scope = JSON.stringify(['20', '40']);
  assert.equal(hasSeenOnlinePaymentsIntro(scope, storage), false);
  dismissOnlinePaymentsIntro(scope, storage);
  assert.equal(hasSeenOnlinePaymentsIntro(scope, storage), true);
});

test('the settings panel mounts the scoped guide with the setup-card art', () => {
  const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
  const panel = read('./OnlinePaymentSettings.jsx');
  assert.match(panel, /<PaymentsSettingsContent[\s\S]*?introScope=\{introScope\}/);
  const stripePanel = read('./PaymentsSettings.jsx');
  assert.match(stripePanel, /introScope && canCreateInitialAccount && <OnlinePaymentsIntroDialog key=\{introScope\} scopeKey=\{introScope\}/);
  const dialog = read('./OnlinePaymentsIntroDialog.jsx');
  assert.match(dialog, /setup-online-payments\.png/);
  assert.match(dialog, /Set up online payments/);
  assert.match(dialog, /aria-label="Close online rent payments guide"/);
  assert.doesNotMatch(dialog, /View payment history/);
  assert.match(dialog, /onClose=\{dismiss\}/);
});
