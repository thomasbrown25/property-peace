import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { subscriptionAPI } from 'api';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';

// Shared cache for subscription status to prevent duplicate API calls
const subscriptionStatusCache = {
  data: null,
  timestamp: null,
  promise: null,
  TTL: 5 * 60 * 1000, // 5 minutes cache TTL
};

// Shared cache for subscription to prevent duplicate API calls
const subscriptionCache = {
  data: null,
  timestamp: null,
  promise: null,
  organizationId: null,
  TTL: 5 * 60 * 1000, // 5 minutes cache TTL
};

// Utility function to clear subscription caches (call after subscription changes)
export function clearSubscriptionCache() {
  subscriptionStatusCache.data = null;
  subscriptionStatusCache.timestamp = null;
  subscriptionStatusCache.promise = null;
  subscriptionCache.data = null;
  subscriptionCache.timestamp = null;
  subscriptionCache.promise = null;
  subscriptionCache.organizationId = null;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { pathname } = useLocation();
  const { currentOrganization } = useOrganization();
  const auth = useAuth();
  const mountedRef = useRef(true);

  const userRoles = Array.isArray(auth?.user?.Roles) ? auth?.user?.Roles : Array.isArray(auth?.user?.roles) ? auth?.user?.roles : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const isTenantOnly = normalizedRoles.includes('tenant') && !normalizedRoles.includes('landlord') && !normalizedRoles.includes('admin');
  const isAdminOnly = normalizedRoles.includes('admin') && !normalizedRoles.includes('landlord');
  const isOnAdminRoute = pathname.startsWith('/admin/');

  // Admin portal does not use org or subscription - skip to avoid 400s
  const skipSubscription = isAdminOnly || isOnAdminRoute;

  const cacheKey = skipSubscription ? null : (currentOrganization?.id ?? (isTenantOnly ? 'tenant' : null));

  const fetchSubscription = useCallback(async (force = false) => {
    if (skipSubscription) {
      if (mountedRef.current) {
        setSubscription(null);
        setLoading(false);
      }
      return;
    }
    if (cacheKey == null && !isTenantOnly) {
      setSubscription(null);
      setLoading(true); // Stay "loading" until we have org and fetch; avoids nav showing upgrade briefly
      return;
    }

    if (!force && subscriptionCache.data && subscriptionCache.organizationId === cacheKey) {
      const cacheAge = Date.now() - subscriptionCache.timestamp;
      if (cacheAge < subscriptionCache.TTL) {
        if (mountedRef.current) {
          setSubscription(subscriptionCache.data);
          setLoading(false);
          setError(null);
        }
        return;
      }
    }

    if (subscriptionCache.promise && subscriptionCache.organizationId === cacheKey) {
      try {
        const cachedData = await subscriptionCache.promise;
        if (mountedRef.current) {
          setSubscription(cachedData);
          setLoading(false);
          setError(null);
        }
        return;
      } catch (err) {}
    }

    const requestPromise = (async () => {
      try {
        if (mountedRef.current) {
          setLoading(true);
          setError(null);
        }
        const response = await subscriptionAPI.getCurrentSubscription();
        if (response.success) {
          subscriptionCache.data = response.data;
          subscriptionCache.timestamp = Date.now();
          subscriptionCache.organizationId = cacheKey;
          if (mountedRef.current) {
            setSubscription(response.data);
          }
        } else {
          if (response.statusCode !== 404 && mountedRef.current) {
            setError(response.message);
          }
          subscriptionCache.data = null;
          subscriptionCache.timestamp = Date.now();
          subscriptionCache.organizationId = cacheKey;
          if (mountedRef.current) {
            setSubscription(null);
          }
        }
        return subscriptionCache.data;
      } catch (err) {
        console.debug('Subscription fetch error:', err);
        subscriptionCache.data = null;
        subscriptionCache.timestamp = Date.now();
        subscriptionCache.organizationId = cacheKey;
        if (mountedRef.current) {
          setSubscription(null);
        }
        if (err?.response?.status !== 404 && err?.statusCode !== 404 && mountedRef.current) {
          setError(err.message || 'Failed to fetch subscription');
        }
        throw err;
      } finally {
        subscriptionCache.promise = null;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    subscriptionCache.promise = requestPromise;
    await requestPromise;
  }, [cacheKey, isTenantOnly, skipSubscription]);

  useEffect(() => {
    mountedRef.current = true;
    if (skipSubscription) {
      setSubscription(null);
      setLoading(false);
      subscriptionCache.data = null;
      subscriptionCache.organizationId = null;
    } else if (currentOrganization || isTenantOnly) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(true); // Not yet resolved; avoids nav showing upgrade before we know plan
      subscriptionCache.data = null;
      subscriptionCache.organizationId = null;
    }
    return () => {
      mountedRef.current = false;
    };
  }, [cacheKey, isTenantOnly, skipSubscription, currentOrganization, fetchSubscription]);

  return { subscription, loading, error, refetch: () => fetchSubscription(true) };
}

const DEFAULT_SUBSCRIPTION_STATUS = {
  hasActiveSubscription: true,
  currentPropertyCount: 0,
  canAddProperty: true,
  remainingPropertySlots: 999,
  isTrialActive: false,
  trialDaysRemaining: null
};

export function useSubscriptionStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { pathname } = useLocation();
  const auth = useAuth();
  const mountedRef = useRef(true);

  const userRoles = Array.isArray(auth?.user?.Roles) ? auth?.user?.Roles : Array.isArray(auth?.user?.roles) ? auth?.user?.roles : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const isAdminOnly = normalizedRoles.includes('admin') && !normalizedRoles.includes('landlord');
  const isOnAdminRoute = pathname.startsWith('/admin/');
  const skipSubscriptionStatus = isAdminOnly || isOnAdminRoute;

  const fetchStatus = useCallback(async (force = false) => {
    if (skipSubscriptionStatus) {
      if (mountedRef.current) {
        setStatus(DEFAULT_SUBSCRIPTION_STATUS);
        setLoading(false);
        setError(null);
      }
      return;
    }
    // Check cache first (unless forced refresh)
    if (!force && subscriptionStatusCache.data) {
      const cacheAge = Date.now() - subscriptionStatusCache.timestamp;
      if (cacheAge < subscriptionStatusCache.TTL) {
        if (mountedRef.current) {
          setStatus(subscriptionStatusCache.data);
          setLoading(false);
          setError(null);
        }
        return;
      }
    }

    // If there's already a request in flight, wait for it
    if (subscriptionStatusCache.promise) {
      try {
        const cachedData = await subscriptionStatusCache.promise;
        if (mountedRef.current) {
          setStatus(cachedData);
          setLoading(false);
          setError(null);
        }
        return;
      } catch (err) {
        // If the in-flight request failed, continue to make a new one
      }
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        if (mountedRef.current) {
          setLoading(true);
          setError(null);
        }
        const response = await subscriptionAPI.getSubscriptionStatus();
        let statusData;
        if (response.success) {
          statusData = response.data;
        } else {
          // Don't set error for expected failures - just set default status
          if (response.statusCode !== 404 && response.statusCode !== 401) {
            if (mountedRef.current) {
              setError(response.message);
            }
          }
          // Set default status if no subscription
          statusData = {
            hasActiveSubscription: false,
            currentPropertyCount: 0,
            canAddProperty: true,
            remainingPropertySlots: 1
          };
        }
        
        subscriptionStatusCache.data = statusData;
        subscriptionStatusCache.timestamp = Date.now();
        if (mountedRef.current) {
          setStatus(statusData);
        }
        return statusData;
      } catch (err) {
        // Silently handle errors - set default status
        console.debug('Subscription status fetch error:', err);
        const defaultStatus = {
          hasActiveSubscription: false,
          currentPropertyCount: 0,
          canAddProperty: true,
          remainingPropertySlots: 1
        };
        subscriptionStatusCache.data = defaultStatus;
        subscriptionStatusCache.timestamp = Date.now();
        if (mountedRef.current) {
          setStatus(defaultStatus);
        }
        // Only set error for unexpected errors
        if (err?.response?.status !== 404 && err?.response?.status !== 401 && err?.statusCode !== 404 && err?.statusCode !== 401) {
          if (mountedRef.current) {
            setError(err.message || 'Failed to fetch subscription status');
          }
        }
        throw err;
      } finally {
        subscriptionStatusCache.promise = null;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    subscriptionStatusCache.promise = requestPromise;
    await requestPromise;
  }, [skipSubscriptionStatus]);

  useEffect(() => {
    mountedRef.current = true;

    // Skip API call if user is not authenticated - wait for auth to be ready
    if (!auth?.isLoggedIn || !auth?.isInitialized) {
      setStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Admin portal does not use org or subscription - skip to avoid 400s
    if (skipSubscriptionStatus) {
      setStatus(DEFAULT_SUBSCRIPTION_STATUS);
      setLoading(false);
      setError(null);
      return;
    }

    fetchStatus();

    return () => {
      mountedRef.current = false;
    };
  }, [auth?.isLoggedIn, auth?.isInitialized, auth?.user?.Roles, auth?.user?.roles, skipSubscriptionStatus, fetchStatus]);

  return { status, loading, error, refetch: () => fetchStatus(true) };
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionAPI.getSubscriptionPlans();
      if (response.success) {
        setPlans(response.data || []);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  };

  return { plans, loading, error, refetch: fetchPlans };
}

