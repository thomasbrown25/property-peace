import { useState } from 'react';
import { subscriptionAPI } from 'api';

export function useSubscriptionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const subscribe = async (planId, billingCycle, paymentMethodId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.createSubscription(planId, billingCycle, paymentMethodId);
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to create subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const upgrade = async (newPlanId, prorate = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.upgradeSubscription(newPlanId, prorate);
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to upgrade subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const downgrade = async (newPlanId, prorate = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.downgradeSubscription(newPlanId, prorate);
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to downgrade subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (cancelAtPeriodEnd = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.cancelSubscription(cancelAtPeriodEnd);
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resume = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.resumeSubscription();
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to resume subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pause = async (pauseAtPeriodEnd = true) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.pauseSubscription(pauseAtPeriodEnd);
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to pause subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resumePaused = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.resumePausedSubscription();
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to resume paused subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startTrial = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.startTrial();
      if (!response.success) {
        throw new Error(response.message);
      }
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to start trial');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    subscribe,
    upgrade,
    downgrade,
    cancel,
    resume,
    pause,
    resumePaused,
    startTrial,
    loading,
    error
  };
}

