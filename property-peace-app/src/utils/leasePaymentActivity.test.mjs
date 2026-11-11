import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { describeLeasePaymentActivity, getLeasePaymentOrigin } from './leasePaymentActivity.js';

for (const method of ['Manual Entry', 'manual-payment', 'Cash', 'Check', 'Bank Transfer']) {
  test(`landlord ${method} is manual entry`, () => {
    assert.equal(getLeasePaymentOrigin({ method, createdByUserId: 42 }), 'manual entry');
    assert.equal(getLeasePaymentOrigin({ Method: method, CreatedByUserId: 42 }), 'manual entry');
  });
}

for (const method of ['Auto-payment', 'AutoPay', 'auto payment', ' AUTO-PAY ']) {
  test(`explicit ${method} stays auto-payment`, () => {
    assert.equal(getLeasePaymentOrigin({ method, stripePaymentIntentId: 'pi_auto' }), 'auto-payment');
    assert.equal(getLeasePaymentOrigin({ Method: method }), 'auto-payment');
  });
}

test('tenant online/card/bank payments are not automatic, even with a saved method or creator', () => {
  for (const method of ['Online Payment', 'Stripe', 'card', 'us_bank_account', 'ACH']) {
    assert.equal(getLeasePaymentOrigin({ method, stripePaymentIntentId: 'pi_tenant', createdByUserId: 42, stripePaymentMethodId: 'pm_saved' }), 'tenant-payment');
    assert.equal(getLeasePaymentOrigin({ Method: method, StripePaymentIntentId: 'pi_tenant', CreatedByUserId: 42 }), 'tenant-payment');
  }
  assert.equal(getLeasePaymentOrigin({ StripeChargeId: 'ch_tenant' }), 'tenant-payment');
});

test('missing or ambiguous provenance never claims an origin', () => {
  for (const payment of [{}, { method: 'ACH' }, { method: 'card', stripePaymentMethodId: 'pm_saved' }, { createdByUserId: 42 }, { method: 'not autopay' }]) {
    assert.equal(getLeasePaymentOrigin(payment), null);
  }
});

test('lease activity renders each payment origin rather than hardcoding auto-payment', () => {
  const source = readFileSync(new URL('../sections/landlord/leases/LeaseDetailView.jsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ getLeasePaymentOrigin \} from 'utils\/leasePaymentActivity'/);
  assert.match(source, /sub:.*getLeasePaymentOrigin\(p\)/);
  assert.doesNotMatch(source, /on time · auto-payment/);
});

const lease = { startDate: '2026-01-01', endDate: '2026-04-30', rentAmount: 1000, rentDueDay: 1, lateFeeGracePeriod: 5 };
const pay = (paymentDate, amount = 1000, extra = {}) => ({ paymentDate, amount, status: 'Completed', ...extra });

test('assigns timing from the installment completed by each rent payment, including grace and splits', () => {
  const first = pay('2026-01-04', 400, { method: 'Manual Entry' });
  const second = pay('2026-01-06', 600, { method: 'Manual Entry' });
  const late = pay('2026-02-07', 1000, { method: 'Online Payment', stripePaymentIntentId: 'pi_123' });
  const result = describeLeasePaymentActivity(lease, [late, second, first]);
  assert.deepEqual(result.map(x => x.timing), ['late', 'on-time', null]);
  assert.deepEqual(result.map(x => x.origin), ['tenant-payment', 'manual entry', 'manual entry']);
});

test('does not claim auto-pay or timing for unknown, incomplete, non-rent or adjustment records', () => {
  const records = [
    pay('2026-01-02', 300, { method: 'ACH' }),
    pay('2026-01-02', 700, { method: 'Online Payment' }),
    pay('2026-01-02', 1000, { method: 'Manual Entry', depositId: 3 }),
    pay('2026-01-02', 1000, { method: 'Manual Entry', feeId: 2 }),
    pay('2026-01-02', 1000, { method: 'Online Payment', status: 'Processing' }),
    pay('2026-01-02', -100, { method: 'Stripe loss adjustment' })
  ];
  const result = describeLeasePaymentActivity(lease, records);
  assert.equal(result[0].origin, null);
  assert.equal(result[1].origin, 'tenant-payment');
  assert.equal(result.filter(x => x.timing).length, 1, 'only the payment completing the installment should carry a timing label');
  assert.equal(result[2].timing, null);
  assert.equal(result[3].timing, null);
  assert.equal(result[4].timing, null);
  assert.equal(result[5].timing, null);
});

test('does not label early partial payment or draft/missing schedule as on time', () => {
  const first = pay('2026-01-03', 200);
  assert.equal(describeLeasePaymentActivity(lease, [first])[0].timing, null);
  assert.equal(describeLeasePaymentActivity(lease, [pay('2026-01-03')], true)[0].timing, null);
  assert.equal(describeLeasePaymentActivity({}, [pay('2026-01-03')])[0].timing, null);
});
