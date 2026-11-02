import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addManualLeaseCharge, getLeaseChargeDefinitions, leaseDetailCharges, manualChargePayload } from './leaseDetailCharges.mjs';

test('builder-defined rent, one-time fees and all deposit variants display without turning late-fee rules into charges', () => {
  const rows = leaseDetailCharges({ RentAmount: 1250, RentFrequency: 'Monthly', RentDueDay: 5, StartDate: '2026-11-01', DepositAmount: 800, PetDepositAmount: 150,
    Fees: [{ Id: 1, Name: 'Move-in', Amount: 45, DueDate: '2026-11-01' }, { Id: 2, Name: 'Late fee', Amount: 20, IsLateFee: true }],
    LeaseDeposits: [{ Id: 3, Name: 'Key deposit', Amount: 35, DueDate: '2026-11-02' }] });
  assert.deepEqual(rows.recurring, [{ name: 'Rent', amount: 1250, frequency: 'Monthly', dueDay: 5 }]);
  assert.deepEqual(rows.fees, [{ id: 1, name: 'Move-in', amount: 45, dueDate: '2026-11-01' }]);
  assert.deepEqual(rows.deposits.map(({ name, amount }) => [name, amount]), [['Security deposit', 800], ['Pet deposit', 150], ['Key deposit', 35]]);
  assert.equal(rows.lateFees.length, 1);
});

test('camelCase lease and empty collections do not invent recurring charges or zero deposits', () => {
  const rows = leaseDetailCharges({ rentAmount: 0, fees: [{ name: 'Cleaning', amount: 10, isLateFee: false }], depositAmount: 0 });
  assert.equal(rows.recurring.length, 0);
  assert.equal(rows.deposits.length, 0);
  assert.equal(rows.fees[0].name, 'Cleaning');
});

test('manual charge validates name amount and due date', () => {
  assert.deepEqual(manualChargePayload({ name: '  Keys ', amount: '25.50', dueDate: '2026-11-02' }), { name: 'Keys', amount: 25.5, dueDate: '2026-11-02T00:00:00' });
  for (const form of [{ name: ' ', amount: 25, dueDate: '2026-11-02' }, { name: 'Keys', amount: 0, dueDate: '2026-11-02' }, { name: 'Keys', amount: 'NaN', dueDate: '2026-11-02' }, { name: 'Keys', amount: 25, dueDate: '' }, { name: 'Keys', amount: 25, dueDate: '2026-02-31' }]) {
    assert.throws(() => manualChargePayload(form));
  }
});

test('scoped endpoints add only a single fee or deposit, never replace lease collections', async () => {
  const calls = [];
  const client = { post: async (...args) => { calls.push(args); return { data: { success: true } }; } };
  const form = { name: 'Keys', amount: '25', dueDate: '2026-11-02' };
  await addManualLeaseCharge(client, 42, 'fee', form);
  await addManualLeaseCharge(client, 42, 'deposit', form);
  assert.deepEqual(calls.map(([url]) => url), ['/api/Lease/42/fees', '/api/Lease/42/deposits']);
  assert.deepEqual(calls[0][1], { name: 'Keys', amount: 25, dueDate: '2026-11-02T00:00:00' });
  await assert.rejects(addManualLeaseCharge({ post: async () => ({ data: { success: false, message: 'No' } }) }, 42, 'fee', form), /No/);
  await assert.rejects(addManualLeaseCharge(client, 42, 'recurring', form));
  assert.equal(calls.length, 2);
});

test('definitions load on demand from scoped endpoint, including named deposits after a save', async () => {
  let saved = false;
  const calls = [];
  const client = {
    get: async (url) => { calls.push(url); return { data: { success: true, data: {
      rentAmount: 1000, fees: [{ name: 'Move-in', amount: 25 }],
      leaseDeposits: saved ? [{ name: 'Keys', amount: 30 }] : []
    } } }; },
    post: async () => { saved = true; return { data: { success: true } }; }
  };
  assert.equal(leaseDetailCharges(await getLeaseChargeDefinitions(client, 42)).deposits.length, 0);
  await addManualLeaseCharge(client, 42, 'deposit', { name: 'Keys', amount: '30', dueDate: '2026-11-02' });
  assert.equal(leaseDetailCharges(await getLeaseChargeDefinitions(client, 42)).deposits[0].name, 'Keys');
  assert.deepEqual(calls, ['/api/Lease/42/charge-definitions', '/api/Lease/42/charge-definitions']);
  await assert.rejects(getLeaseChargeDefinitions({ get: async () => ({ data: { success: false } }) }, 42));
});

test('canonical lease detail renders the Charges tab and uses the scoped form', () => {
  const detail = readFileSync(new URL('./LeaseDetailView.jsx', import.meta.url), 'utf8');
  const charges = readFileSync(new URL('./LeaseChargesTab.jsx', import.meta.url), 'utf8');
  assert.match(detail, /<Tab label="Charges"/);
  assert.match(detail, /<LeaseChargesTab leaseId=\{/);
  assert.match(charges, /addManualLeaseCharge\(axios, leaseId, kind, form\)/);
  assert.match(charges, /getLeaseChargeDefinitions\(axios, leaseId\)/);
  assert.match(charges, /await refresh\(\)/);
  assert.match(charges, /requestId\.current/);
  assert.doesNotMatch(charges, /onRefresh|leaseDetailCharges\(lease\)/);
  assert.match(charges, /not available on this server yet/);
  assert.doesNotMatch(charges, /updateLease|axios\.post\(['"]\/api\/Lease['"]/);
});
