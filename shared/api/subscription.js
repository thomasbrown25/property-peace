import ApiClient from './client.js';

export class SubscriptionAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getSubscriptionPlans() {
    return this.client.get('/api/subscription/plans');
  }

  async getCurrentSubscription() {
    return this.client.get('/api/subscription/current');
  }

  async getSubscriptionStatus() {
    return this.client.get('/api/subscription/status');
  }

  async createSubscription(planId, billingCycle, paymentMethodId) {
    return this.client.post('/api/subscription/subscribe', {
      planId,
      billingCycle,
      paymentMethodId
    });
  }

  async upgradeSubscription(newPlanId, prorate = true, billingCycle = null) {
    return this.client.post('/api/subscription/upgrade', {
      newPlanId,
      prorate,
      billingCycle
    });
  }

  async downgradeSubscription(newPlanId, prorate = true, billingCycle = null) {
    return this.client.post('/api/subscription/downgrade', {
      newPlanId,
      prorate,
      billingCycle
    });
  }

  async cancelSubscription(cancelAtPeriodEnd = true) {
    return this.client.post(`/api/subscription/cancel?cancelAtPeriodEnd=${cancelAtPeriodEnd}`);
  }

  async resumeSubscription() {
    return this.client.post('/api/subscription/resume');
  }

  async pauseSubscription(pauseAtPeriodEnd = true) {
    return this.client.post(`/api/subscription/pause?pauseAtPeriodEnd=${pauseAtPeriodEnd}`);
  }

  async resumePausedSubscription() {
    return this.client.post('/api/subscription/resume-paused');
  }

  async startTrial() {
    return this.client.post('/api/subscription/start-trial');
  }

  async getPaymentHistory() {
    return this.client.get('/api/subscription/payment-history');
  }

  async createCustomerPortalSession(returnUrl) {
    return this.client.post('/api/subscription/customer-portal', { returnUrl });
  }

  async createCheckoutSession(planId, billingCycle, successUrl, cancelUrl) {
    return this.client.post('/api/subscription/checkout-session', {
      planId,
      billingCycle,
      successUrl,
      cancelUrl
    });
  }
}

export default SubscriptionAPI;
