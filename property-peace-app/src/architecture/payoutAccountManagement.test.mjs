import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bankAccountsSource = await readFile(new URL('../sections/landlord/settings/PaymentsSettings.jsx', import.meta.url), 'utf8');
const payoutAssignmentsSource = await readFile(new URL('../sections/landlord/settings/PayoutAssignments.jsx', import.meta.url), 'utf8');

test('Bank Accounts lists saved payout destinations and opens Stripe account management for add and edit actions', () => {
  assert.match(bankAccountsSource, /bankAccountAPI\.getBankAccounts\(\)/);
  assert.match(bankAccountsSource, /bankAccounts\.map\(\(account\)/);
  assert.match(bankAccountsSource, /Add bank account with Stripe/);
  assert.match(bankAccountsSource, /Edit in Stripe/);
  assert.match(bankAccountsSource, /ConnectAccountManagement/);
  assert.match(bankAccountsSource, /\/api\/stripe\/account-management-session/);
  assert.doesNotMatch(bankAccountsSource, /routingNumber|accountNumber/);
});

test('Payout Assignments shows every property and edits its single truthful income and deposit destination', () => {
  assert.match(payoutAssignmentsSource, /Property payout assignments/);
  assert.match(payoutAssignmentsSource, /\['Income', 'Deposit'\]/);
  assert.match(payoutAssignmentsSource, /Both labels currently use the same payout account/);
  assert.match(payoutAssignmentsSource, /addOrUpdateProperty/);
  assert.match(payoutAssignmentsSource, /operatingAccountId: selectedAccount \? accountId\(selectedAccount\) : null/);
  assert.match(payoutAssignmentsSource, /Save assignment/);
  assert.doesNotMatch(payoutAssignmentsSource, /routingNumber|accountNumber/);
});
