import ApiClient from '../client.js';

export class AdminSubscriptionAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getAdminPlans() {
    return this.client.get('/api/admin/subscription/plans');
  }

  async savePlan(plan) {
    return this.client.post('/api/admin/subscription/plans', plan);
  }

  async getAllUserSubscriptions() {
    return this.client.get('/api/admin/subscription/users');
  }

  async updateSubscriptionPlan(subscriptionId, userId, newPlanId, prorate = true, isUpgrade = true) {
    return this.client.post(`/api/admin/subscription/subscription/${subscriptionId}/update-plan`, {
      userId,
      newPlanId,
      prorate,
      isUpgrade
    });
  }

  async syncSubscriptionsAndCleanup() {
    return this.client.post('/api/admin/subscription/sync-and-cleanup');
  }
}

export default AdminSubscriptionAPI;
