import { useState, useEffect, useCallback, useRef } from 'react';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import {
  canFetchOrganizationSummary,
  createOrganizationSummaryRequestLifecycle,
  getVisibleOrganizationSummaryState,
  makeOrganizationSummaryScopeKey
} from './organizationSummaryRequestLifecycle';

/**
 * Hook to fetch organization summary data for AI Copilot.
 * Summary state is isolated by the active user and authoritative current organization.
 * @returns {Object} - { data, loading, error, refetch }
 */
export default function useOrganizationSummary() {
  const auth = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const [state, setState] = useState({ scopeKey: null, data: null, loading: true, error: null });
  const lifecycleRef = useRef(null);

  if (!lifecycleRef.current) {
    lifecycleRef.current = createOrganizationSummaryRequestLifecycle(setState);
  }

  const user = auth?.user;
  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email ?? null;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const scopeKey = makeOrganizationSummaryScopeKey({ userId, organizationId });
  const userRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  const normalizedRoles = userRoles.map((role) => String(role).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const hasAdminRole = normalizedRoles.includes('admin');
  const isTenantOnly = hasTenantRole && !hasLandlordRole && !hasAdminRole;
  const canFetch = canFetchOrganizationSummary({ scopeKey, organizationLoading, isTenantOnly });

  const fetchSummary = useCallback(() => {
    if (!canFetch) {
      lifecycleRef.current.clear(scopeKey);
      return Promise.resolve();
    }

    return lifecycleRef.current.begin({
      scopeKey,
      request: ({ signal }) => axiosServices.get('/api/ai-copilot/organization-summary', { signal })
    });
  }, [canFetch, scopeKey]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => () => {
    lifecycleRef.current?.dispose();
  }, []);

  // Effects clear and reload state after a scope/eligibility change. Hide retained
  // data synchronously during the intervening render as an additional guard.
  const visibleState = getVisibleOrganizationSummaryState({ state, scopeKey, canFetch });

  return {
    data: visibleState.data,
    loading: visibleState.loading,
    error: visibleState.error,
    refetch: fetchSummary
  };
}
