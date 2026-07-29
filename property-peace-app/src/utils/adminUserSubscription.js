const getField = (source, ...keys) => keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '');

export const getAdminUserSubscriptionState = (subscription) => {
  if (!subscription) {
    return {
      planName: 'No plan assigned',
      billingCycle: 'N/A',
      status: 'None',
      isLifetime: false
    };
  }

  const plan = getField(subscription, 'plan', 'Plan', 'subscriptionPlan', 'SubscriptionPlan') || {};
  const planName = getField(plan, 'name', 'Name') || 'Unknown plan';
  const billingCycle = getField(subscription, 'billingCycle', 'BillingCycle') || 'N/A';
  const status = getField(subscription, 'status', 'Status') || 'Unknown';
  const isLifetime = String(planName).toLowerCase().includes('lifetime') || String(billingCycle).toLowerCase() === 'lifetime';

  return { planName, billingCycle, status, isLifetime };
};
