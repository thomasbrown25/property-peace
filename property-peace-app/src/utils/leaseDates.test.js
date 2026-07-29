import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateLeaseEndDate } from './leaseDates.js';

describe('calculateLeaseEndDate', () => {
  it('sets a month-to-month lease end date to one calendar month after its start date', () => {
    assert.equal(calculateLeaseEndDate('2026-01-31', -1), '2026-02-28');
    assert.equal(calculateLeaseEndDate('2028-01-31', -1), '2028-02-29');
    assert.equal(calculateLeaseEndDate('2026-07-15', -1), '2026-08-15');
  });

  it('keeps fixed lease lengths expressed in months', () => {
    assert.equal(calculateLeaseEndDate('2026-07-15', 12), '2027-07-15');
  });
});
