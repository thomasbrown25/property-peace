// Rent intents and payment methods belong to the lease's connected account, never the platform.
export function requireRentStripeAccount(stripeAccountId) {
  if (typeof stripeAccountId !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(stripeAccountId)) {
    throw new Error('The rent recipient’s Stripe account is unavailable. Please refresh or contact your landlord.');
  }
  return stripeAccountId;
}

export function createRentStripeLoader(loadStripe) {
  const instances = new Map();
  return (publishableKey, stripeAccountId) => {
    const account = requireRentStripeAccount(stripeAccountId);
    if (!publishableKey) throw new Error('The payment system is unavailable. Please try again later.');
    const key = JSON.stringify([publishableKey, account]);
    if (!instances.has(key)) instances.set(key, loadStripe(publishableKey, { stripeAccount: account }));
    return instances.get(key);
  };
}

export function createRentMethodsApi(http) {
  return {
    async list(leaseId, stripeAccountId) {
      const response = await http.get(rentMethodUrl(leaseId));
      const data = response.data?.data;
      if (!response.data?.success || requireRentStripeAccount(data?.stripeAccountId) !== stripeAccountId || !Array.isArray(data?.paymentMethods)) {
        throw new Error('Saved payment methods are unavailable for this rent recipient.');
      }
      return data.paymentMethods;
    },
    async mutate(leaseId, methodId, action) {
      if (!methodId || !['default', 'remove'].includes(action)) throw new Error('Invalid payment method operation.');
      const path = rentMethodUrl(leaseId, `/${encodeURIComponent(methodId)}${action === 'default' ? '/default' : ''}`);
      const response = action === 'default' ? await http.post(path) : await http.delete(path);
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to update payment method.');
    }
  };
}

export function rentMethodUrl(leaseId, suffix = '') {
  if (leaseId == null || String(leaseId).trim() === '') throw new Error('Select a lease to manage payment methods.');
  return `/api/stripe/payment-methods${suffix}?leaseId=${encodeURIComponent(leaseId)}`;
}
