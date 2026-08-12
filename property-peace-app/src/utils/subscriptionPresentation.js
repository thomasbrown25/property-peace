export function getPlanPricePresentation(plan, billingCycle) {
  if (billingCycle === 'Lifetime' || plan?.name?.trim().toLowerCase() === 'lifetime plan') {
    return {
      amount: 0,
      cadence: '',
      supportingText: 'Lifetime access'
    };
  }

  if (billingCycle === 'Annual') {
    const annualTotal = Number(plan?.annualPrice ?? 0);
    return {
      amount: annualTotal,
      cadence: '/year',
      supportingText: `$${(annualTotal / 12).toFixed(2)}/mo equivalent`
    };
  }

  return {
    amount: Number(plan?.monthlyPrice ?? 0),
    cadence: '/mo',
    supportingText: null
  };
}

export function canManagePaidBilling(subscription) {
  const planName = subscription?.plan?.name?.trim().toLowerCase();
  return Boolean(subscription)
    && planName === 'premium'
    && subscription?.isOrphaned === false
    && ['Active', 'Paused'].includes(subscription?.status);
}

export function shouldStartCheckoutForPlanChange(subscription) {
  const planName = subscription?.plan?.name?.trim().toLowerCase();
  return !subscription
    || subscription.status === 'Trial'
    || subscription.status !== 'Active'
    || (planName === 'free' && !subscription.cancelAtPeriodEnd);
}
