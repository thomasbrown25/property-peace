import { describe, expect, it } from 'vitest';
import { isStartedActiveLease } from './leaseStatus';

describe('isStartedActiveLease', () => {
  const now = new Date('2026-07-29T12:00:00');

  it('rejects a placeholder lease whose active flag is not explicitly active', () => {
    expect(isStartedActiveLease({ isActive: false }, now)).toBe(false);
    expect(isStartedActiveLease({ IsActive: false }, now)).toBe(false);
    expect(isStartedActiveLease({ isActive: 'false' }, now)).toBe(false);
    expect(isStartedActiveLease({}, now)).toBe(false);
  });

  it('rejects active flags when the lease has not started', () => {
    expect(isStartedActiveLease({ isActive: true }, now)).toBe(false);
    expect(isStartedActiveLease({ isActive: true, startDate: '2026-07-30' }, now)).toBe(false);
  });

  it('rejects draft and ended leases', () => {
    expect(isStartedActiveLease({ isActive: true, isDrafted: true, startDate: '2026-07-01' }, now)).toBe(false);
    expect(isStartedActiveLease({ isActive: true, startDate: '2026-07-01', endDate: '2026-07-28' }, now)).toBe(false);
  });

  it('accepts current leases with camelCase or PascalCase fields', () => {
    expect(isStartedActiveLease({ isActive: true, startDate: '2026-07-01', endDate: '2026-07-29' }, now)).toBe(true);
    expect(isStartedActiveLease({ IsActive: 1, StartDate: '2026-07-01', EndDate: '2026-08-01' }, now)).toBe(true);
  });
});
