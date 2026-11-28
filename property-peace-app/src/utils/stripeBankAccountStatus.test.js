import assert from 'node:assert/strict';
import test from 'node:test';
import { getStripeBankAccountStatus } from './stripeBankAccountStatus.js';

test('past-due requirements take precedence over pending verification and include the items to update', () => {
  const status = getStripeBankAccountStatus({
    AccountId: 'acct_test',
    DetailsSubmitted: true,
    CardPaymentsCapabilityStatus: 'pending',
    HasPastDueRequirements: true,
    PastDueRequirementLabels: ['Representative’s Social Security number (SSN) or tax ID', 'Payout bank account']
  });

  assert.equal(status.label, 'Action required');
  assert.equal(status.setupRequired, false);
  assert.deepEqual(status.requirements, ['Representative’s Social Security number (SSN) or tax ID', 'Payout bank account']);
});

test('past-due requirements without a disclosed field direct the user to Stripe for details', () => {
  const status = getStripeBankAccountStatus({ AccountId: 'acct_test', HasPastDueRequirements: true });
  assert.equal(status.label, 'Action required');
  assert.match(status.message, /past-due requirements in Stripe/);
});

test('past-due requirements during onboarding preserve the setup action', () => {
  const status = getStripeBankAccountStatus({ AccountId: 'acct_test', Status: 'onboarding', HasPastDueRequirements: true });
  assert.equal(status.label, 'Action required');
  assert.equal(status.setupRequired, true);
});

test('submitted Stripe details with a pending card capability show verification in progress', () => {
  const status = getStripeBankAccountStatus({
    AccountId: 'acct_test',
    Status: 'not_ready',
    DetailsSubmitted: true,
    CardPaymentsCapabilityStatus: 'pending',
    ChargesEnabled: false,
    PayoutsEnabled: false
  });

  assert.equal(status.label, 'Verification pending');
  assert.equal(status.setupRequired, false);
});

test('account verification can be pending even when the card capability is active', () => {
  const status = getStripeBankAccountStatus({
    AccountId: 'acct_test',
    DetailsSubmitted: true,
    IsVerificationPending: true,
    CardPaymentsCapabilityStatus: 'active',
    PayoutsEnabled: false
  });

  assert.equal(status.label, 'Verification pending');
  assert.equal(status.setupRequired, false);
});

test('setup is offered when Stripe is disconnected or onboarding is incomplete', () => {
  assert.equal(getStripeBankAccountStatus({ AccountId: null }).setupRequired, true);
  const status = getStripeBankAccountStatus({ AccountId: 'acct_test', Status: 'onboarding', DetailsSubmitted: false });
  assert.equal(status.label, 'Setup incomplete');
  assert.equal(status.setupRequired, true);
});

test('Stripe charges and payouts are only shown as enabled when Stripe confirms them', () => {
  const account = {
    AccountId: 'acct_test',
    DetailsSubmitted: true,
    CardPaymentsCapabilityStatus: 'active',
    ChargesEnabled: true,
    PayoutsEnabled: true
  };

  assert.equal(getStripeBankAccountStatus(account).label, 'Charges and payouts enabled');
  assert.equal(getStripeBankAccountStatus({ ...account, PayoutsEnabled: false }).label, 'Check Stripe status');
});

test('unknown or inactive provider status does not claim verification or restart setup', () => {
  for (const account of [
    { AccountId: 'acct_test', Status: 'not_ready', DetailsSubmitted: false },
    { AccountId: 'acct_test', DetailsSubmitted: true, CardPaymentsCapabilityStatus: 'inactive', ChargesEnabled: false, PayoutsEnabled: false }
  ]) {
    const status = getStripeBankAccountStatus(account);
    assert.equal(status.label, 'Check Stripe status');
    assert.equal(status.setupRequired, false);
  }
});
