import { useCallback, useEffect, useRef, useState } from 'react';
import { getRentPaymentActionReadiness, getRentPaymentFeatureReadiness } from 'api/rentPaymentAccess';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { findFeatureReadiness, FEATURE_KEYS } from 'utils/featureReadiness';
import {
  createRentPaymentAccessRequestLifecycle,
  getRentPaymentAccessPresentation,
  getRentPaymentAccessVisibleState,
  loadRentPaymentAccessState,
  makeRentPaymentAccessScopeKey
} from 'utils/rentPaymentAccess';

export default function useRentPaymentAccess() {
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  const [state, setState] = useState({ scopeKey: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: false, error: null });
  const lifecycleRef = useRef(null);
  if (!lifecycleRef.current) lifecycleRef.current = createRentPaymentAccessRequestLifecycle(setState);
  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email ?? null;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const scopeKey = makeRentPaymentAccessScopeKey({ userId, organizationId });
  const canFetch = Boolean(scopeKey) && !organizationLoading;
  const refresh = useCallback(() => {
    if (!canFetch) {
      lifecycleRef.current.clear(scopeKey);
      return Promise.resolve();
    }
    return lifecycleRef.current.begin({
      scopeKey,
      request: ({ signal }) => loadRentPaymentAccessState({
        signal,
        loadFeatureReadiness: getRentPaymentFeatureReadiness,
        loadActionReadiness: getRentPaymentActionReadiness,
        selectFeatureReadiness: (items) => findFeatureReadiness(items, FEATURE_KEYS.onlineRentCollection)
      })
    });
  }, [canFetch, scopeKey]);
  useEffect(() => {
    refresh();
    return () => lifecycleRef.current?.dispose();
  }, [refresh]);
  const visible = getRentPaymentAccessVisibleState({ state, scopeKey, canFetch });
  const presentation = getRentPaymentAccessPresentation({
    aggregateReadiness: visible.readiness,
    configureReadiness: visible.configureReadiness,
    payReadiness: visible.payReadiness,
    error: visible.error,
    readinessError: visible.readinessError
  });
  return { readiness: visible.readiness, presentation, loading: visible.loading, error: visible.error, readinessError: visible.readinessError, refresh };
}
