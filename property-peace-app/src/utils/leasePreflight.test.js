import { describe, expect, it } from 'vitest';
import { areAllLeasePreflightChecksComplete, computeLeasePreflightChecks } from './leasePreflight';

describe('computeLeasePreflightChecks', () => {
  const validLease = {
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    rentDueDay: 1,
    rentAmount: 1500,
    depositAmount: 0,
    tenants: [{ id: 1 }],
    landlordName: 'Owner',
    petsAllowed: false,
    smokingAllowed: false,
    utilityServiceResponsibilities: [{ name: 'Water' }],
    maintenanceResponsibilities: [{ name: 'HVAC' }],
    builtBefore1978: false
  };

  const check = (lease, label) => computeLeasePreflightChecks(lease)
    .flatMap((section) => section.checks)
    .find((item) => item.label === label)?.ok;

  it('treats false smokingAllowed as an explicit answer', () => {
    expect(check(validLease, 'Smoking policy set')).toBe(true);
  });

  it('accepts a zero security deposit', () => {
    expect(check(validLease, 'Security deposit')).toBe(true);
  });

  it.each([null, undefined])('rejects a %s security deposit', (depositAmount) => {
    expect(check({ ...validLease, depositAmount }, 'Security deposit')).toBe(false);
  });

  it('rejects an empty security deposit while preserving numeric zero', () => {
    expect(check({ ...validLease, depositAmount: '' }, 'Security deposit')).toBe(false);
    expect(check({ ...validLease, depositAmount: 0 }, 'Security deposit')).toBe(true);
  });

  it.each([0, 32, -1, '', null, undefined])('rejects an invalid rent due day (%s)', (rentDueDay) => {
    expect(check({ ...validLease, rentDueDay }, 'Rent due day')).toBe(false);
  });

  it.each(['', '   ', null, undefined])('requires valid date-only strings (%s)', (date) => {
    expect(check({ ...validLease, startDate: date }, 'Start date')).toBe(false);
    expect(check({ ...validLease, endDate: date }, 'End date')).toBe(false);
  });

  it.each(['2026-02-30', '2026-13-01', '08/01/2026', '2026-8-1', 'not-a-date'])('rejects malformed or impossible dates (%s)', (date) => {
    expect(check({ ...validLease, startDate: date }, 'Start date')).toBe(false);
    expect(check({ ...validLease, endDate: date }, 'End date')).toBe(false);
  });

  it('requires the end date to be strictly after the start date', () => {
    expect(check({ ...validLease, endDate: validLease.startDate }, 'End date')).toBe(false);
    expect(check({ ...validLease, endDate: '2026-07-31' }, 'End date')).toBe(false);
    expect(check(validLease, 'End date')).toBe(true);
  });

  it('requires a non-empty landlord name when no landlord record is selected', () => {
    expect(check({ ...validLease, landlordName: '   ', leaseLandlords: [] }, 'Landlord info')).toBe(false);
  });

  it.each(['', '   '])('rejects empty pet and smoking answers (%s)', (answer) => {
    expect(check({ ...validLease, petsAllowed: answer }, 'Pet policy set')).toBe(false);
    expect(check({ ...validLease, smokingAllowed: answer }, 'Smoking policy set')).toBe(false);
  });

  it.each([0, -1, null, undefined])('requires rent greater than zero (%s)', (rentAmount) => {
    expect(check({ ...validLease, rentAmount }, 'Monthly rent')).toBe(false);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN])('rejects non-finite money values (%s)', (amount) => {
    expect(check({ ...validLease, rentAmount: amount }, 'Monthly rent')).toBe(false);
    expect(check({ ...validLease, depositAmount: amount }, 'Security deposit')).toBe(false);
  });

  it('computes completion from every individual check', () => {
    expect(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks(validLease))).toBe(true);
    expect(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks({ ...validLease, builtBefore1978: null }))).toBe(false);
    expect(areAllLeasePreflightChecksComplete([])).toBe(false);
  });
});
