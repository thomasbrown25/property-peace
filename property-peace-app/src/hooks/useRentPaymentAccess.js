import { useCallback, useEffect, useRef, useState } from 'react';

import { getFeatureReadiness, FEATURE_KEYS } from 'api/featureReadiness';
import { getRentPaymentAccess, requestRentPaymentAccess } from 'api/rentPaymentAccess';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { findFeatureReadiness } from 'utils/featureReadiness';
import {
  createRentPaymentAccessRequestLifecycle,
  getRentPaymentAccessPresentation,
  getRentPaymentAccessVisibleState,
  makeRentPaymentAccessScopeKey
} from 'utils/rentPaymentAccess';

const unwrap = (response) => response?.data ?? response;

function actionReadiness(readiness, action) {
  const actions = readiness?.actions ?? readiness?.Actions;
  if (Array.isArray(actions)) return actions.find((item) => String(item?.action ?? item?.Action).toLowerCase() === action.toLowerCase()) ?? null;
  const actionDecision = actions?.[action] ?? actions?.[action[0].toUpperCase() + action.slice(1)];
  if (actionDecision) return actionDecision;

  // Until the API includes action decisions in this response, legacy readiness
  // can only authorize landlord configuration. Payment stays fail-closed.
  return {
    allowed: action === 'configure' && readiness?.canInvoke === true,
    providerEnabled: readiness?.providerConfigured,
    blockers: readiness?.blockers ?? []
  };
}

export default function useRentPaymentAccess() {
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  const [state, setState] = useState({ scopeKey: null, access: null, readiness: null, loading: false, error: null });
  const [requesting, setRequesting] = useState(false);
  const lifecycleRef = useRef(null);
  const requestingRef = useRef(false);
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
      request: async () => {
        const [accessResponse, readinessItems] = await Promise.all([getRentPaymentAccess(), getFeatureReadiness()]);
        return { access: unwrap(accessResponse), readiness: findFeatureReadiness(readinessItems, FEATURE_KEYS.onlineRentCollection) ?? null };
      }
    });
  }, [canFetch, scopeKey]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => lifecycleRef.current?.dispose(), []);

  const requestAccess = useCallback(async () => {
    if (requestingRef.current || !canFetch) return;
    requestingRef.current = true;
    setRequesting(true);
    try {
      await requestRentPaymentAccess();
      await refresh();
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  }, [canFetch, refresh]);

  const visible = getRentPaymentAccessVisibleState({ state, scopeKey, canFetch });
  const configureReadiness = actionReadiness(visible.readiness, 'configure');
  const payReadiness = actionReadiness(visible.readiness, 'pay');
  const presentation = getRentPaymentAccessPresentation({ access: visible.access, configureReadiness, payReadiness });

  return { access: visible.access, readiness: visible.readiness, presentation, loading: visible.loading, requesting, error: visible.error, requestAccess, refresh };
}
