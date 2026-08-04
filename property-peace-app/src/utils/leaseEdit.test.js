import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLeaseEditInitialValues, buildLeaseEditPayload } from './leaseEdit.js';

const lease = {
  id: 42,
  name: 'Main lease',
  propertyId: 7,
  unitId: 11,
  organizationId: 3,
  startDate: '2026-08-17T00:00:00',
  endDate: '2027-08-17T00:00:00',
  rentAmount: 1500,
  leaseLength: 12,
  rentFrequency: 'Monthly',
  rentDueDay: 1,
  proratedRentDue: true,
  isProratedRent: true,
  prorationMethod: 'custom',
  proratedRentAmount: 700.25,
  depositAmount: 1500,
  petDepositAmount: 300,
  createChecklistOnStartDate: true,
  fees: [
    { id: 1, name: 'Pet Fee', amount: 125, dueDate: '2026-08-17T00:00:00', isLateFee: false },
    { id: 2, name: 'Key fee', amount: 40, dueDate: '2026-08-17T00:00:00', isLateFee: false },
    {
      id: 3,
      name: 'Late fee',
      amount: 50,
      dueDate: '2026-09-06T00:00:00',
      isLateFee: true,
      lateFeeType: 'OneTime',
      feeType: 'Flat',
      appliedAfterDays: 5
    }
  ],
  autoRenewLease: false
};

describe('buildLeaseEditInitialValues', () => {
  it('loads the create-drawer proration, move-in charge, and checklist fields', () => {
    const values = buildLeaseEditInitialValues(lease);

    assert.equal(values.proratedRentDue, true);
    assert.equal(values.prorationMethod, 'custom');
    assert.equal(values.proratedRentAmount, 700.25);
    assert.equal(values.securityDeposit, 1500);
    assert.equal(values.petDeposit, 300);
    assert.equal(values.petFee, 125);
    assert.deepEqual(values.otherMoveInCharges, [{ name: 'Key fee', amount: 40 }]);
    assert.equal(values.createChecklistOnStartDate, true);
  });

  it('supports PascalCase lease responses and valid falsey values', () => {
    const values = buildLeaseEditInitialValues({
      Id: 9,
      PropertyId: 2,
      UnitId: 4,
      StartDate: '2026-08-01T00:00:00',
      EndDate: '2027-08-01T00:00:00',
      RentAmount: 0,
      LeaseLength: 12,
      RentFrequency: 'Monthly',
      RentDueDay: 1,
      ProratedRentDue: false,
      DepositAmount: 0,
      PetDepositAmount: 0,
      CreateChecklistOnStartDate: false,
      Fees: []
    });

    assert.equal(values.rentAmount, 0);
    assert.equal(values.securityDeposit, 0);
    assert.equal(values.petDeposit, 0);
    assert.equal(values.proratedRentDue, false);
    assert.equal(values.createChecklistOnStartDate, false);
  });
});

describe('buildLeaseEditPayload', () => {
  it('persists the new fields while preserving existing late-fee configuration', () => {
    const values = {
      ...buildLeaseEditInitialValues(lease),
      proratedRentDue: false,
      securityDeposit: '1600',
      petDeposit: '350',
      petFee: '150',
      otherMoveInCharges: [{ name: 'Key replacement', amount: '45' }],
      createChecklistOnStartDate: false,
      allPaymentsOnTime: true
    };

    const payload = buildLeaseEditPayload(values, lease);

    assert.equal(payload.Id, 42);
    assert.equal(payload.DepositAmount, 1600);
    assert.equal(payload.PetDepositAmount, 350);
    assert.equal(payload.ProratedRentDue, false);
    assert.equal(payload.IsProratedRent, false);
    assert.equal(payload.ProrationMethod, null);
    assert.equal(payload.ProratedRentAmount, null);
    assert.equal(payload.CreateChecklistOnStartDate, false);
    assert.equal(payload.MarkPastPaymentsAsPaid, true);
    assert.deepEqual(
      payload.Fees.map(({ Name, Amount, IsLateFee, LateFeeType, AppliedAfterDays }) => ({ Name, Amount, IsLateFee, LateFeeType, AppliedAfterDays })),
      [
        { Name: 'Late fee', Amount: 50, IsLateFee: true, LateFeeType: 'OneTime', AppliedAfterDays: 5 },
        { Name: 'Pet Fee', Amount: 150, IsLateFee: false, LateFeeType: null, AppliedAfterDays: null },
        { Name: 'Key replacement', Amount: 45, IsLateFee: false, LateFeeType: null, AppliedAfterDays: null }
      ]
    );
  });
});
