import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../sections/landlord/settings/PayoutAssignments.jsx', import.meta.url), 'utf8');

test('payout assignments truthfully present one connected-account destination', () => {
  assert.match(source, />Payout account</);
  assert.doesNotMatch(source, /\['Income', 'Deposit'\]/);
  assert.match(source, /lease-specific payout account/i);
});

test('landlords can open Stripe embedded account management without exposing bank credentials', () => {
  assert.match(source, /ConnectAccountManagement/);
  assert.match(source, /Manage bank account securely with Stripe/);
  assert.match(source, /\/api\/stripe\/account-management-session/);
  assert.doesNotMatch(source, /routingNumber|accountNumber/);
});
