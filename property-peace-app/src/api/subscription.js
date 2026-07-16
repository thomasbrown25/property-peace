import axios from 'utils/axios';

// Get all available subscription plans
export const getSubscriptionPlans = async () => {
  const response = await axios.get('/api/subscription/plans');
  return response.data;
};

// Get current user's subscription
export const getCurrentSubscription = async () => {
  const response = await axios.get('/api/subscription/current');
  return response.data;
};

// Get subscription status
export const getSubscriptionStatus = async () => {
  const response = await axios.get('/api/subscription/status');
  return response.data;
};

// Create a new subscription
export const createSubscription = async (planId, billingCycle, paymentMethodId) => {
  const response = await axios.post('/api/subscription/subscribe', {
    planId,
    billingCycle,
    paymentMethodId
  });
  return response.data;
};

// Upgrade subscription
export const upgradeSubscription = async (newPlanId, prorate = true, billingCycle = null) => {
  const response = await axios.post('/api/subscription/upgrade', {
    newPlanId,
    prorate,
    billingCycle
  });
  return response.data;
};

// Downgrade subscription
export const downgradeSubscription = async (newPlanId, prorate = true, billingCycle = null) => {
  const response = await axios.post('/api/subscription/downgrade', {
    newPlanId,
    prorate,
    billingCycle
  });
  return response.data;
};

// Cancel subscription
export const cancelSubscription = async (cancelAtPeriodEnd = true) => {
  const response = await axios.post(`/api/subscription/cancel?cancelAtPeriodEnd=${cancelAtPeriodEnd}`);
  return response.data;
};

// Resume subscription
export const resumeSubscription = async () => {
  const response = await axios.post('/api/subscription/resume');
  return response.data;
};

// Pause subscription
export const pauseSubscription = async (pauseAtPeriodEnd = true) => {
  const response = await axios.post(`/api/subscription/pause?pauseAtPeriodEnd=${pauseAtPeriodEnd}`);
  return response.data;
};

// Resume paused subscription
export const resumePausedSubscription = async () => {
  const response = await axios.post('/api/subscription/resume-paused');
  return response.data;
};

// Start free trial
export const startTrial = async () => {
  const response = await axios.post('/api/subscription/start-trial');
  return response.data;
};

// Get payment history/invoices
export const getPaymentHistory = async () => {
  const response = await axios.get('/api/subscription/payment-history');
  return response.data;
};

// Create customer portal session
export const createCustomerPortalSession = async (returnUrl) => {
  const response = await axios.post('/api/subscription/customer-portal', { returnUrl });
  return response.data;
};

// Create checkout session for subscription
export const createCheckoutSession = async (planId, billingCycle, successUrl, cancelUrl) => {
  const response = await axios.post('/api/subscription/checkout-session', {
    planId,
    billingCycle,
    successUrl,
    cancelUrl
  });
  return response.data;
};

export const subscriptionAPI = {
  getAvailablePlans: getSubscriptionPlans,
  getCurrentSubscription,
  getSubscriptionStatus: getSubscriptionStatus,
  subscribe: createSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  resumeSubscription,
  pauseSubscription,
  resumePausedSubscription,
  startTrial,
  getPaymentHistory,
  createCustomerPortalSession,
  createCheckoutSession
};

export default subscriptionAPI;

