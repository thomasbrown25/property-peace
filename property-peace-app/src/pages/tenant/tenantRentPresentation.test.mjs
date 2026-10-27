import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const list = readFileSync(new URL('../../components/payments/LeaseChargeList.jsx', import.meta.url), 'utf8');
const payments = readFileSync(new URL('./payments.jsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('./dashboard.jsx', import.meta.url), 'utf8');

test('charge list shows a single accumulated rent balance, not installment rows', () => {
  assert.match(list, /charges\.filter\(\(item\) => String\(item\.type[^\n]+!== 'rent'\)/);
  assert.match(list, /Accumulated rent balance/);
  assert.match(list, /formatCurrency\(rentBalance\)/);
  assert.match(payments, /rentBalance=\{loadingPayments \? null : summary\.amountDue\}/);
});

test('charge list keeps fee checkout separate and deposits read-only', () => {
  assert.match(list, /onPayFee\(item\)/);
  assert.match(list, /Deposits cannot be paid online here/);
  assert.match(list, /\['Fees', fees\], \['Deposits · read-only', deposits\]/);
  assert.doesNotMatch(list, /onPayRentInstallment|onPayDeposit/);
});

test('dashboard amount and checkout represent rent only, excluding fees and deposits', () => {
  assert.match(dashboard, /const totalAmountDue = rentAmountDue;/);
  assert.match(dashboard, /Accumulated rent balance/);
  assert.doesNotMatch(dashboard, /isTotalPayment: true|allocationOrder: paymentAllocation\.allocationOrder/);
  assert.match(dashboard, /Rent checkout applies oldest-first across the lease/);
});
