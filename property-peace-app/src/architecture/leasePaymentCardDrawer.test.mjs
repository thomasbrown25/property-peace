import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('lease rent tiles open a payment drawer by mouse or keyboard with their cycle context', () => {
  const view = source('../sections/landlord/leases/LeaseDetailView.jsx');
  assert.match(view, /paymentsForLeaseCycle\(lease, payments, index\)/);
  assert.match(view, /onRecordPayment\(\{[^}]*cycleDueDate: cycle\.dueDate/s);
  assert.match(view, /onKeyDown=\{\(event\) => \{/);
  assert.match(view, /role="button"/);
});

test('record drawer displays selected receipts without a submission action and prefills the first for unrecorded cycles', () => {
  const page = source('../pages/landlord/lease.jsx');
  const drawer = source('../components/drawers/RecordPaymentDrawer.jsx');
  assert.match(page, /onRecordPayment=\{\(options = \{\}\) => drawer\.openPaymentAddDrawer/);
  assert.match(drawer, /firstOfCycleMonth\(initial\.cycleDueDate\)/);
  assert.match(drawer, /Array\.isArray\(cycleSelection\?\.cyclePayments\)/);
  assert.match(drawer, /!viewingCyclePayments && !isComplete && selectedLease/);
});
