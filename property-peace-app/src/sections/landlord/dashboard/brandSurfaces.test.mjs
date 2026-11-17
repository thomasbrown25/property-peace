import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('dashboard active surfaces use forest while dark-mode chrome stays adaptive', () => {
  const header = source('./DashboardHeader.jsx');
  const horizon = source('./OnTheHorizon.jsx');
  const setup = source('./FinishSetup.jsx');
  assert.match(header, /bgcolor: 'brand\.forest'/);
  assert.match(header, /theme\.palette\.mode === 'dark' \? theme\.palette\.primary\.light : theme\.palette\.brand\.forest/);
  assert.match(horizon, /d\.isToday \|\| d\.isSelected \? theme\.palette\.brand\.forest/);
  assert.match(setup, /bgcolor: 'brand\.forest'/);
});

test('property action and payment surfaces have no fixed navy fills or focus rings', () => {
  const property = source('../property/PropertyActiveLease.jsx');
  const actions = source('../property/PropertyQuickActionsPanel.jsx');
  const payments = source('../settings/PaymentsSettings.jsx');
  assert.match(property, /bgcolor: 'brand\.forest'/);
  assert.match(actions, /bgcolor: 'background\.paper'/);
  assert.match(payments, /colorPrimary: theme\.palette\.primary\.main/);
  assert.match(payments, /alpha\(theme\.palette\.primary\.main, 0\.2\)/);
  for (const file of [property, actions, payments]) {
    assert.doesNotMatch(file, /#061e35|#061E35|rgba\(6, 30, 53|#042238|#0b2f4f/i);
  }
});
