function emptyState(scopeKey, loading) {
  return {
    scopeKey,
    data: null,
    loading,
    error: null
  };
}

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Failed to load organization summary';
}

export function makeOrganizationSummaryScopeKey({ userId, organizationId }) {
  if (userId === null || userId === undefined || userId === '' || organizationId === null || organizationId === undefined || organizationId === '') {
    return null;
  }

  return JSON.stringify([String(userId), String(organizationId)]);
}

export function getVisibleOrganizationSummaryState({ state, scopeKey, canFetch }) {
  if (!canFetch) return { data: null, loading: false, error: null };
  if (state.scopeKey !== scopeKey) return { data: null, loading: true, error: null };
  return state;
}

export function canFetchOrganizationSummary({ scopeKey, organizationLoading, isTenantOnly }) {
  return Boolean(scopeKey) && !organizationLoading && !isTenantOnly;
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
}

/**
 * Owns the request generation for organization summaries. Aborting is an
 * optimization; the generation and scope checks are what prevent adapters
 * which ignore AbortSignal from publishing stale state.
 */
export function createOrganizationSummaryRequestLifecycle(onStateChange) {
  let generation = 0;
  let activeController = null;
  let activeScopeKey = null;

  const invalidate = () => {
    generation += 1;
    activeController?.abort();
    activeController = null;
  };

  return {
    begin({ scopeKey, request }) {
      invalidate();
      activeScopeKey = scopeKey;
      const requestGeneration = generation;
      const controller = new AbortController();
      activeController = controller;
      onStateChange(emptyState(scopeKey, true));

      const isCurrent = () => requestGeneration === generation && scopeKey === activeScopeKey;

      return (async () => {
        try {
          const response = await request({ signal: controller.signal });
          if (!isCurrent()) return;

          if (!response?.data?.success || !response.data.data) {
            throw new Error(response?.data?.message || 'Failed to fetch organization summary');
          }

          onStateChange({
            scopeKey,
            data: response.data.data,
            loading: false,
            error: null
          });
        } catch (error) {
          if (!isCurrent()) return;

          if (isAbortError(error)) {
            onStateChange(emptyState(scopeKey, false));
            return;
          }

          onStateChange({
            scopeKey,
            data: null,
            loading: false,
            error: errorMessage(error)
          });
        } finally {
          if (isCurrent()) activeController = null;
        }
      })();
    },

    clear(scopeKey = null) {
      invalidate();
      activeScopeKey = scopeKey;
      onStateChange(emptyState(scopeKey, false));
    },

    dispose() {
      invalidate();
      activeScopeKey = null;
    }
  };
}
