import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bankAccountsSource = await readFile(new URL('../sections/landlord/settings/PaymentsSettings.jsx', import.meta.url), 'utf8');
const payoutAssignmentsSource = await readFile(new URL('../sections/landlord/settings/PayoutAssignments.jsx', import.meta.url), 'utf8');
const propertyHookSource = await readFile(new URL('../hooks/useFetchProperties.js', import.meta.url), 'utf8');
const propertyActionSource = await readFile(new URL('../store/property/property.action.js', import.meta.url), 'utf8');
const bankAccountControllerSource = await readFile(
  new URL('../../../property-peace-api/Controllers/BankAccountController.cs', import.meta.url),
  'utf8'
);

test('Bank Accounts shows the payment entity first and provides add, edit, and remove management actions', () => {
  assert.match(bankAccountsSource, /bankAccountAPI\.getBankAccounts\(currentOrganization/);
  assert.match(bankAccountsSource, /bankAccounts\.map\(\(account\)/);
  assert.ok(bankAccountsSource.indexOf('Payment entity') < bankAccountsSource.indexOf('Connected bank accounts'));
  assert.match(bankAccountsSource, /Add bank account/);
  assert.match(bankAccountsSource, /Edit entity/);
  assert.match(bankAccountsSource, />\s*Edit\s*</);
  assert.match(bankAccountsSource, />\s*Remove\s*</);
  assert.match(bankAccountsSource, /openBankAccountManagement\('remove'\)/);
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

test('bank accounts and properties remain scoped when the active organization changes', () => {
  assert.match(bankAccountControllerSource, /GetCurrentOrganizationIdOrForbid\(\)/);
  assert.doesNotMatch(bankAccountControllerSource.slice(0, bankAccountControllerSource.indexOf('[HttpGet("{id}")]')), /GetCurrentUserOrganizationAsync/);
  assert.match(propertyHookSource, /loadedOrganizationId === organizationId/);
  assert.match(propertyHookSource, /getProperties\(organizationId\)/);
  assert.match(propertyActionSource, /'X-Organization-Id': organizationId\.toString\(\)/);
  assert.match(payoutAssignmentsSource, /setEditingProperty\(null\)/);
  assert.match(payoutAssignmentsSource, /organizationVersionRef\.current \+= 1/);
  assert.match(payoutAssignmentsSource, /addOrUpdateProperty\([\s\S]*saveOrganizationId/);
});
