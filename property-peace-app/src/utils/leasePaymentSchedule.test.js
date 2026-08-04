import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLeasePaymentSchedule } from './leasePaymentSchedule.js';

const proratedLease = {
  startDate: '2026-08-17T00:00:00',
  endDate: '2027-08-31T00:00:00',
  rentAmount: 2200,
  rentDueDay: 1,
  rentFrequency: 'Monthly',
  proratedRentDue: true,
  prorationMethod: 'calculated',
  proratedRentAmount: 1064.52
};

describe('buildLeasePaymentSchedule', () => {
  it('shows a prorated move-in cycle followed by full monthly cycles', () => {
    const schedule = buildLeasePaymentSchedule(proratedLease);

    assert.equal(schedule.cycles.length, 13);
    assert.deepEqual(schedule.cycles[0], {
      key: 'move-in-2026-08-17',
      label: 'AUG',
      dueDate: '2026-08-17',
      amount: 1064.52,
      isProrated: true
    });
    assert.deepEqual(schedule.cycles[1], {
      key: 'rent-2026-09-01',
      label: 'SEP',
      dueDate: '2026-09-01',
      amount: 2200,
      isProrated: false
    });
    assert.deepEqual(schedule.cycles.at(-1), {
      key: 'rent-2027-08-01',
      label: 'AUG',
      dueDate: '2027-08-01',
      amount: 2200,
      isProrated: false
    });
    assert.equal(schedule.totalContractValue, 27464.52);
  });

  it('calculates the move-in proration when a persisted calculated amount is unavailable', () => {
    const schedule = buildLeasePaymentSchedule({
      ...proratedLease,
      proratedRentAmount: null
    });

    assert.equal(schedule.cycles[0].amount, 1064.52);
    assert.equal(schedule.totalContractValue, 27464.52);
  });

  it('starts on the next regular due date when move-in proration is waived', () => {
    const schedule = buildLeasePaymentSchedule({
      ...proratedLease,
      proratedRentDue: false,
      isProratedRent: false,
      proratedRentAmount: null
    });

    assert.equal(schedule.cycles.length, 12);
    assert.equal(schedule.cycles[0].dueDate, '2026-09-01');
    assert.equal(schedule.cycles[0].amount, 2200);
    assert.equal(schedule.totalContractValue, 26400);
  });

  it('accepts PascalCase lease responses without losing proration', () => {
    const schedule = buildLeasePaymentSchedule({
      StartDate: proratedLease.startDate,
      EndDate: proratedLease.endDate,
      RentAmount: 2200,
      RentDueDay: 1,
      RentFrequency: 'Monthly',
      ProratedRentDue: true,
      ProrationMethod: 'custom',
      ProratedRentAmount: 900
    });

    assert.equal(schedule.cycles[0].amount, 900);
    assert.equal(schedule.cycles[0].isProrated, true);
    assert.equal(schedule.totalContractValue, 27300);
  });
});
