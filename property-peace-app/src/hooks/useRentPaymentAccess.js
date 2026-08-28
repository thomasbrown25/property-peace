import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getRentPaymentAccess,
  getRentPaymentActionReadiness,
  getRentPaymentFeatureReadiness,
  requestRentPaymentAccess
} from 'api/rentPaymentAccess';
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
  const [state, setState] = useState({ scopeKey: null, access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: false, error: null });
  const [requesting, setRequesting] = useState(false);
  const lifecycleRef = useRef(null);
  const requestingRef = useRef(false);
  const requestControllerRef = useRef(null);
  const mountedRef = useRef(false);
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
      request: ({ signal }) =>
        loadRentPaymentAccessState({
          signal,
          loadAccess: getRentPaymentAccess,
          loadFeatureReadiness: getRentPaymentFeatureReadiness,
          loadActionReadiness: getRentPaymentActionReadiness,
          selectFeatureReadiness: (items) => findFeatureReadiness(items, FEATURE_KEYS.onlineRentCollection)
        })
    });
  }, [canFetch, scopeKey]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
      requestControllerRef.current?.abort();
      lifecycleRef.current?.dispose();
    };
  }, [refresh]);

  const requestAccess = useCallback(async () => {
    if (requestingRef.current || !canFetch) return;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestingRef.current = true;
    setRequesting(true);
    try {
      await requestRentPaymentAccess(controller.signal);
      await refresh();
    } catch (error) {
      lifecycleRef.current.reportError(scopeKey, error);
    } finally {
      requestingRef.current = false;
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      if (mountedRef.current) setRequesting(false);
    }
  }, [canFetch, refresh, scopeKey]);

  const visible = getRentPaymentAccessVisibleState({ state, scopeKey, canFetch });
  const presentation = getRentPaymentAccessPresentation({
    access: visible.access,
    aggregateReadiness: visible.readiness,
    configureReadiness: visible.configureReadiness,
    payReadiness: visible.payReadiness,
    error: visible.error,
    readinessError: visible.readinessError
  });

  return { access: visible.access, readiness: visible.readiness, presentation, loading: visible.loading, requesting, error: visible.error, readinessError: visible.readinessError, requestAccess, refresh };
}