import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDate, calendarRange, listingPayload, blockPayload, ratePayload, setupError } from './shortStaySetup.js';

test('local dates reject rollover, timestamps and impossible dates; ranges use exclusive end', () => {
  assert.equal(isLocalDate('2026-02-28'), true);
  for (const date of ['2026-02-29', '2026-2-28', '2026-02-28T00:00:00Z', '']) assert.equal(isLocalDate(date), false);
  assert.deepEqual(calendarRange('2026-03-01', '2026-04-01'), { start: '2026-03-01', end: '2026-04-01' });
  assert.throws(() => calendarRange('2026-03-02', '2026-03-02'));
  assert.throws(() => calendarRange('2026-01-01', '2027-02-01'));
  assert.throws(() => blockPayload('2026-03-01', '2026-03-03', 'x'.repeat(501)));
  assert.deepEqual(blockPayload('2026-03-01', '2026-03-03', 'Repair'), { startDate: '2026-03-01', endDate: '2026-03-03', reason: 'Repair' });
  assert.throws(() => blockPayload('2026-03-04', '2026-03-03', ''));
});

test('draft and rate validation use actual API contract and cent precision', () => {
  assert.deepEqual(listingPayload({ nightlyBasePrice: '101.25', minimumNights: '2', capacity: '4', cleaningFee: '0', checkInTime: '15:00', checkOutTime: '', houseRules: '', amenities: '', cancellationPolicy: '' }), {
    nightlyBasePrice: 101.25, minimumNights: 2, capacity: 4, cleaningFee: 0, lodgingTaxRatePercent: null, attestLodgingTaxResponsibility: false, checkInTime: '15:00', checkOutTime: null, houseRules: '', amenities: '', cancellationPolicy: ''
  });
  assert.throws(() => listingPayload({ nightlyBasePrice: '1.234', minimumNights: '1', capacity: '1', cleaningFee: '0' }));
  assert.deepEqual(ratePayload('2026-03-01', '99.50'), { nightlyRate: 99.5 });
  assert.throws(() => ratePayload('2026-02-29', '99'));
  assert.throws(() => ratePayload('2026-03-01', '0'));
  assert.throws(() => ratePayload('2026-03-01', '1000000'));
});

test('lodging tax stays unset unless explicitly entered and attested; reset clears both', () => {
  const draft = { nightlyBasePrice: '101', minimumNights: '1', capacity: '2', cleaningFee: '0' };
  assert.equal(listingPayload(draft).lodgingTaxRatePercent, null);
  assert.deepEqual([listingPayload({ ...draft, lodgingTaxRatePercent: '0' }, true).lodgingTaxRatePercent,
    listingPayload({ ...draft, lodgingTaxRatePercent: '8.1250' }, true).lodgingTaxRatePercent], [0, 8.125]);
  assert.throws(() => listingPayload({ ...draft, lodgingTaxRatePercent: '8.125' }), /confirm/i);
  assert.throws(() => listingPayload(draft, true), /enter a lodging tax rate/i);
  for (const bad of ['-1', '101', '8.12345', '1e1', 'NaN', '0.00001'])
    assert.throws(() => listingPayload({ ...draft, lodgingTaxRatePercent: bad }, true), /lodging tax rate/i);
  const reset = listingPayload({ ...draft, lodgingTaxRatePercent: '' }, false);
  assert.equal(reset.lodgingTaxRatePercent, null);
  assert.equal(reset.attestLodgingTaxResponsibility, false);
});

test('curated guest copy travels with unrelated saves and enforces field limits', () => {
  const draft = { nightlyBasePrice: '101', minimumNights: '1', capacity: '2', cleaningFee: '0', publicTitle: 'Garden studio', publicSummary: 'Walk to the park.' };
  const saved = listingPayload(draft);
  assert.equal(saved.publicTitle, 'Garden studio');
  assert.equal(saved.publicSummary, 'Walk to the park.');
  assert.equal(listingPayload({ ...draft, nightlyBasePrice: '125' }).publicSummary, saved.publicSummary);
  assert.throws(() => listingPayload({ ...draft, publicTitle: 'x'.repeat(101) }), /public title/i);
  assert.throws(() => listingPayload({ ...draft, publicSummary: 'y'.repeat(1201) }), /public summary/i);
});

test('conflicts have actionable guidance and errors preserve service message', () => {
  assert.match(setupError({ status: 409, message: 'Property requires a valid IANA time zone' }), /time zone/i);
  assert.match(setupError({ status: 409, message: 'Overlapping block' }), /refresh/i);
  assert.match(setupError({ status: 400, message: 'Invalid request' }), /Invalid request/);
});
