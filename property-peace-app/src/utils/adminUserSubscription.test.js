import { describe, expect, it } from 'vitest';
import { getAdminUserSubscriptionState } from './adminUserSubscription';

describe('getAdminUserSubscriptionState', () => {
  it('recognizes the Lifetime plan by plan name', () => {
    expect(
      getAdminUserSubscriptionState({
        plan: { name: 'Lifetime Plan' },
        billingCycle: 'Lifetime',
        status: 'Active'
      })
    ).toEqual({
      planName: 'Lifetime Plan',
      billingCycle: 'Lifetime',
      status: 'Active',
      isLifetime: true
    });
  });

  it('recognizes lifetime access from a lifetime billing cycle', () => {
    expect(
      getAdminUserSubscriptionState({
        subscriptionPlan: { name: 'Premium' },
        BillingCycle: 'Lifetime',
        Status: 'Active'
      }).isLifetime
    ).toBe(true);
  });

  it('returns an assignable empty state when the user has no subscription', () => {
    expect(getAdminUserSubscriptionState(null)).toEqual({
      planName: 'No plan assigned',
      billingCycle: 'N/A',
      status: 'None',
      isLifetime: false
    });
  });
});
