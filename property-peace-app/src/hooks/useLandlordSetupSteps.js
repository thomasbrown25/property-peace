import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchActivation } from 'api/activation';
import { useOrganization } from 'contexts/OrganizationContext';
import { projectActivationLifecycle } from 'utils/activationLifecycle';
import { activationResponseForOrganization, validOrganizationId } from 'utils/activationOrganization';

const unavailableView = (mode) => projectActivationLifecycle(null, { mode });

export default function useLandlordSetupSteps(options = {}) {
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const candidateOrganizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const organizationId = validOrganizationId(candidateOrganizationId) ? candidateOrganizationId : null;
  const mode = options.mode;
  const controllerRef = useRef(null);
  const requestRef = useRef(0);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState(() => ({
    organizationId: null,
    loading: true,
    error: null,
    payload: null
  }));

  const refresh = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    const requestId = ++requestRef.current;

    if (organizationLoading || organizationId === null) {
      setState({
        organizationId: null,
        loading: organizationLoading,
        error: null,
        payload: null
      });
      return undefined;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ organizationId, loading: true, error: null, payload: null });

    fetchActivation(organizationId, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        const boundPayload = activationResponseForOrganization(payload, organizationId);
        const viewModel = projectActivationLifecycle(boundPayload);
        setState({
          organizationId,
          loading: false,
          error: viewModel.available ? null : new Error('Activation status is unavailable for the current organization.'),
          payload: viewModel.available ? boundPayload : null
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setState({ organizationId, loading: false, error, payload: null });
      });

    return () => controller.abort();
  }, [organizationId, organizationLoading, requestVersion]);

  return useMemo(() => {
    const stateBelongsToCurrentOrganization = organizationId !== null && state.organizationId === organizationId;
    const visibleState = stateBelongsToCurrentOrganization
      ? state
      : {
          organizationId,
          loading: organizationLoading || organizationId !== null,
          error: null,
          payload: null
        };
    const viewModel = visibleState.payload
      ? projectActivationLifecycle(visibleState.payload, { mode })
      : unavailableView(mode);
    return {
      ...visibleState,
      viewModel,
      isLoading: visibleState.loading,
      organizationRequired: !organizationLoading && organizationId === null,
      view: viewModel,
      refresh,
      organization: currentOrganization
    };
  }, [state, organizationId, organizationLoading, mode, refresh, currentOrganization]);
}
