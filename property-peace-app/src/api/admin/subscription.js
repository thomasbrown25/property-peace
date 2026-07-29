import axios from 'utils/axios';

// Get all subscription plans (admin)
export const getAdminPlans = async () => {
  const response = await axios.get('/api/admin/subscription/plans');
  return response.data;
};

// Create or update subscription plan (admin)
export const savePlan = async (plan) => {
  const response = await axios.post('/api/admin/subscription/plans', plan);
  return response.data;
};

// Get all user subscriptions (admin)
export const getAllUserSubscriptions = async () => {
  const response = await axios.get('/api/admin/subscription/users');
  return response.data;
};

// Get one user's subscription (admin)
export const getUserSubscription = async (userId) => {
  const response = await axios.get(`/api/admin/subscription/user/${userId}`);
  return response.data;
};

// Update subscription plan (admin)
export const updateSubscriptionPlan = async (subscriptionId, userId, newPlanId, prorate = true, isUpgrade = true) => {
  const response = await axios.post(`/api/admin/subscription/subscription/${subscriptionId}/update-plan`, {
    userId,
    newPlanId,
    prorate,
    isUpgrade
  });
  return response.data;
};

// Assign hidden Lifetime Plan to a user (admin)
export const assignLifetimePlan = async ({ userId, email }) => {
  const response = await axios.post('/api/admin/subscription/assign-lifetime', {
    userId,
    email
  });
  return response.data;
};

// Sync subscriptions to Stripe and cleanup unused prices (admin)
export const syncSubscriptionsAndCleanup = async () => {
  const response = await axios.post('/api/admin/subscription/sync-and-cleanup');
  return response.data;
};

// Sync Stripe plan IDs into the database (matches by product name)
export const syncStripePlans = async () => {
  const response = await axios.post('/api/admin/subscription/sync-stripe');
  return response.data;
};

// Create Stripe products + prices for any paid plans that don't have them yet
export const provisionStripeProducts = async () => {
  const response = await axios.post('/api/admin/subscription/provision-stripe');
  return response.data;
};

export const adminSubscriptionAPI = {
  getPlans: getAdminPlans,
  savePlan,
  getAllUserSubscriptions,
  getUserSubscription,
  updateSubscriptionPlan,
  assignLifetimePlan,
  syncSubscriptionsAndCleanup,
  syncStripePlans,
  provisionStripeProducts
};

export default adminSubscriptionAPI;

