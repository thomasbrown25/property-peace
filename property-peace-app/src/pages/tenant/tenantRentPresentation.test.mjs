import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const list = readFileSync(new URL('../../components/payments/LeaseChargeList.jsx', import.meta.url), 'utf8');
const payments = readFileSync(new URL('./payments.jsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('./dashboard.jsx', import.meta.url), 'utf8');
const lease = readFileSync(new URL('./lease.jsx', import.meta.url), 'utf8');

test('My Lease shows the four rent overview cards in priority order', () => {
  const labels = [...lease.matchAll(/<StatCard\s[\s\S]*?label="([^"]+)"/g)].map(([, label]) => label);
  assert.deepEqual(labels, ['Amount Due', 'Next payment date', 'Monthly Rent', 'Overdue Amount']);
});

test('My Lease formats due and overdue amounts from the selected lease balance', () => {
  assert.ok(lease.includes("'/api/rent-collection/tenant/my-rent'"));
  assert.ok(lease.includes('normalizeRentBalance(leaseRecord)'));
  assert.ok(/label="Amount Due"\s+value=\{rentBalance \? formatCurrency\(rentBalance\.rentDue\) : null\}/.test(lease));
  assert.ok(/label="Overdue Amount"\s+value=\{rentBalance \? formatCurrency\(rentBalance\.overdueAmount\) : null\}/.test(lease));
});

test('My Lease colors only positive overdue values red', () => {
  const overdueCard = lease.match(/label="Overdue Amount"[\s\S]*?\/>/)?.[0];
  assert.ok(overdueCard?.includes('overdue={(rentBalance?.overdueAmount ?? 0) > 0}'));
  assert.equal((lease.match(/\boverdue=\{/g) ?? []).length, 1);
  assert.ok(/color=\{overdue \? 'error\.main' : undefined\}[^>]*>\s*\{value \|\| '—'\}/.test(lease));
});

test('Lease Terms puts monthly rent and the right-aligned due day in one row', () => {
  const leaseTerms = lease.slice(lease.indexOf('{/* Lease Terms */}'), lease.indexOf('{/* Landlord Info */}'));
  const row = leaseTerms.match(/<Stack direction="row"[^>]*justifyContent="space-between"[^>]*>\s*<Box>[\s\S]*?<\/Stack>/)?.[0];
  assert.ok(row);
  assert.match(row, /Monthly Rent[\s\S]*?formatCurrency\(selectedLease\.rentAmount \|\| 0\)[\s\S]*?<Box sx=\{\{ textAlign: 'right' \}\}>[\s\S]*?Rent Due Day/);
  assert.doesNotMatch(row, /Auto-Renew/);
});

test('tenant dashboard shows Rent Status, Lease Summary, and Announcements in that order at both widths', () => {
  assert.match(
    dashboard,
    /<Grid size=\{\{ xs: 12, md: 4 \}\}>\s*<MainCard\s+title="Rent Status"[\s\S]*?<Grid size=\{\{ xs: 12, md: 4 \}\}>\s*<MainCard\s+title="Lease Summary"[\s\S]*?<Grid size=\{\{ xs: 12, md: 4 \}\}>\s*<Announcements \/>/
  );
});

test('charge list shows a single accumulated rent balance, not installment rows', () => {
  assert.match(list, /charges\.filter\(\(item\) => String\(item\.type[^\n]+!== 'rent'\)/);
  assert.match(list, /Accumulated rent balance/);
  assert.match(list, /formatCurrency\(rentBalance\)/);
  assert.match(payments, /rentBalance=\{loadingPayments \? null : summary\.amountDue\}/);
});

test('tenant Payments puts the overview below the lease selector and before balances and history', () => {
  assert.match(payments, /<TenantLeaseFilter\b[\s\S]*?label="Amount Due"[\s\S]*?label="Last Payment"[\s\S]*?<LeaseChargeList\b[\s\S]*?Payment History/);
  assert.doesNotMatch(list, /Make Payment action below/);
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
