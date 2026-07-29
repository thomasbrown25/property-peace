import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLeaseSubmissionPayload, calculateProratedRent, isLeaseReadyToCreate } from './leaseDraft.js';

const completeValues = {
  propertyId: 7,
  name: '',
  leaseStartDate: '2026-08-01',
  leaseEndDate: '2027-08-01',
  rentAmount: '1500',
  leaseLength: 12,
  rentFrequency: 'monthly',
  rentDueDay: 1,
  autoRenewLease: false,
  createChecklistOnStartDate: true,
  allPaymentsOnTime: false
};

describe('isLeaseReadyToCreate', () => {
  it('requires every field needed to create a non-draft lease', () => {
    assert.equal(isLeaseReadyToCreate(completeValues), true);

    for (const field of ['propertyId', 'leaseStartDate', 'leaseEndDate', 'rentAmount', 'leaseLength', 'rentFrequency', 'rentDueDay']) {
      assert.equal(isLeaseReadyToCreate({ ...completeValues, [field]: '' }), false, field);
    }
  });

  it('accepts zero rent as a completed required amount', () => {
    assert.equal(isLeaseReadyToCreate({ ...completeValues, rentAmount: 0 }), true);
  });

  it('requires a positive prorated amount when proration is enabled', () => {
    assert.equal(isLeaseReadyToCreate({ ...completeValues, proratedRentDue: true, proratedRentAmount: 0 }), false);
    assert.equal(isLeaseReadyToCreate({ ...completeValues, proratedRentDue: true, proratedRentAmount: 725.81 }), true);
  });
});

describe('buildLeaseSubmissionPayload', () => {
  it('preserves missing required details as null when saving a draft', () => {
    const payload = buildLeaseSubmissionPayload(
      {
        ...completeValues,
        leaseStartDate: '',
        leaseEndDate: '',
        rentAmount: '',
        leaseLength: '',
        rentFrequency: '',
        rentDueDay: ''
      },
      11,
      true
    );

    assert.deepEqual(
      {
        PropertyId: payload.PropertyId,
        UnitId: payload.UnitId,
        StartDate: payload.StartDate,
        EndDate: payload.EndDate,
        RentAmount: payload.RentAmount,
        LeaseLength: payload.LeaseLength,
        RentFrequency: payload.RentFrequency,
        RentDueDay: payload.RentDueDay,
        IsDrafted: payload.IsDrafted,
        IsActive: payload.IsActive
      },
      {
        PropertyId: 7,
        UnitId: 11,
        StartDate: null,
        EndDate: null,
        RentAmount: null,
        LeaseLength: null,
        RentFrequency: null,
        RentDueDay: null,
        IsDrafted: true,
        IsActive: false
      }
    );
  });

  it('marks a completed submission as active and includes checklist scheduling', () => {
    const payload = buildLeaseSubmissionPayload(completeValues, 11, false);

    assert.equal(payload.IsDrafted, false);
    assert.equal(payload.IsActive, true);
    assert.equal(payload.CreateChecklistOnStartDate, true);
    assert.equal(payload.RentFrequency, 'Monthly');
    assert.equal(payload.StartDate instanceof Date, true);
  });

  it('includes proration and optional move-in charges', () => {
    const payload = buildLeaseSubmissionPayload({
      ...completeValues,
      proratedRentDue: true,
      prorationMethod: 'custom',
      proratedRentAmount: '700.25',
      securityDeposit: '1500',
      petDeposit: '300',
      petFee: '125',
      otherMoveInCharges: [{ name: 'Key fee', amount: '40' }]
    }, 11, false);

    assert.equal(payload.ProratedRentDue, true);
    assert.equal(payload.IsProratedRent, true);
    assert.equal(payload.ProrationMethod, 'custom');
    assert.equal(payload.ProratedRentAmount, 700.25);
    assert.equal(payload.DepositAmount, 1500);
    assert.equal(payload.PetDepositAmount, 300);
    assert.deepEqual(
      payload.Fees.map(({ Name, Amount, IsLateFee }) => ({ Name, Amount, IsLateFee })),
      [
        { Name: 'Pet Fee', Amount: 125, IsLateFee: false },
        { Name: 'Key fee', Amount: 40, IsLateFee: false }
      ]
    );
  });
});

describe('calculateProratedRent', () => {
  it('uses the actual days in the month through the day before the next due date', () => {
    assert.equal(calculateProratedRent('2026-08-17', 1, 1500), 725.81);
  });

  it('returns no proration when the lease starts on the due day', () => {
    assert.equal(calculateProratedRent('2026-08-01', 1, 1500), 0);
  });
});
