import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  canManagePaidBilling,
  getPlanPricePresentation,
  shouldStartCheckoutForPlanChange
} from './subscriptionPresentation.js';

describe('subscription packaging presentation', () => {
  it('labels the annual total as yearly and shows a monthly equivalent', () => {
    assert.deepEqual(getPlanPricePresentation({ monthlyPrice: 14.99, annualPrice: 152.9 }, 'Annual'), {
      amount: 152.9,
      cadence: '/year',
      supportingText: '$12.74/mo equivalent'
    });
  });

  it('labels monthly pricing as monthly', () => {
    assert.deepEqual(getPlanPricePresentation({ monthlyPrice: 14.99, annualPrice: 152.9 }, 'Monthly'), {
      amount: 14.99,
      cadence: '/mo',
      supportingText: null
    });
  });

  it('labels internal Lifetime access without a recurring cadence', () => {
    assert.deepEqual(getPlanPricePresentation({ monthlyPrice: 0, annualPrice: 0 }, 'Lifetime'), {
      amount: 0,
      cadence: '',
      supportingText: 'Lifetime access'
    });
  });

  it('renders the shared supporting-text contract on the current-plan page', async () => {
    const currentPlanSource = await readFile(new URL('../pages/landlord/subscription/current-plan.jsx', import.meta.url), 'utf8');
    assert.match(currentPlanSource, /pricePresentation\.supportingText/);
    assert.doesNotMatch(currentPlanSource, /pricePresentation\.monthlyEquivalent/);
  });

  it('offers Stripe billing management only for active provider-backed Premium subscriptions', () => {
    assert.equal(canManagePaidBilling({ status: 'Active', isOrphaned: false, plan: { name: 'Premium' } }), true);
    assert.equal(canManagePaidBilling({ status: 'Paused', isOrphaned: false, plan: { name: 'Premium' } }), true);
    assert.equal(canManagePaidBilling({ status: 'Active', plan: { name: 'Free' } }), false);
    assert.equal(canManagePaidBilling({ status: 'Active', isOrphaned: false, plan: { name: 'Lifetime Plan' } }), false);
    assert.equal(canManagePaidBilling({ status: 'Active', isOrphaned: true, plan: { name: 'Premium' } }), false);
    assert.equal(canManagePaidBilling({ status: 'Trial', plan: { name: 'Premium' } }), false);
  });

  it('routes a paymentless Free upgrade through checkout', () => {
    assert.equal(shouldStartCheckoutForPlanChange({ status: 'Active', cancelAtPeriodEnd: false, plan: { name: 'Free' } }), true);
    assert.equal(shouldStartCheckoutForPlanChange({ status: 'Trial', plan: { name: 'Premium' } }), true);
    assert.equal(shouldStartCheckoutForPlanChange({ status: 'Active', cancelAtPeriodEnd: false, plan: { name: 'Premium' } }), false);
    assert.equal(shouldStartCheckoutForPlanChange({ status: 'Active', cancelAtPeriodEnd: true, plan: { name: 'Free' } }), false);
  });
});
