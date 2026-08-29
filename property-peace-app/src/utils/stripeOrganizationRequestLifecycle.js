const isMissing = (value) => value === null || value === undefined || value === '';

export function makeStripeOrganizationScopeKey(organizationId) {
  return isMissing(organizationId) ? null : JSON.stringify(['stripe-organization', String(organizationId)]);
}

export function canManageStripeAccount(status) {
  return (status?.canManageAccount ?? status?.CanManageAccount) === true;
}

export function canCreateInitialStripeAccount({
  statusLoadedSuccessfully,
  status,
  rentCanInvoke,
  organizationId
}) {
  if (statusLoadedSuccessfully !== true || !status || rentCanInvoke !== true || isMissing(organizationId)) return false;
  return isMissing(status.accountId ?? status.AccountId);
}

export function getInitialStripeOnboardingUrl(response) {
  if (response?.success !== true) return null;
  const accountId = response.data?.accountId ?? response.data?.AccountId;
  const onboardingUrl = response.data?.onboardingUrl ?? response.data?.OnboardingUrl;
  return typeof accountId === 'string' && accountId.trim() && typeof onboardingUrl === 'string' && onboardingUrl.trim()
    ? onboardingUrl
    : null;
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
}

/**
 * Scopes Stripe requests to the current organization. AbortController is only
 * an optimization: generation, scope, and channel checks prevent stale
 * publication even when an HTTP adapter ignores AbortSignal.
 */
export function createStripeOrganizationRequestLifecycle(onScopeReset) {
  let generation = 0;
  let activeScopeKey = null;
  const channels = new Map();

  const invalidate = () => {
    generation += 1;
    for (const request of channels.values()) request.controller.abort();
    channels.clear();
  };

  const isCurrentRequest = ({ scopeKey, requestGeneration, channel, token }) =>
    activeScopeKey === scopeKey &&
    generation === requestGeneration &&
    channels.get(channel)?.token === token;

  return {
    setScope(scopeKey) {
      invalidate();
      activeScopeKey = scopeKey;
      onScopeReset(scopeKey);
    },

    isCurrent(scopeKey) {
      return Boolean(scopeKey) && activeScopeKey === scopeKey;
    },

    capture(scopeKey) {
      const capturedGeneration = generation;
      return {
        isCurrent: () => Boolean(scopeKey) && activeScopeKey === scopeKey && generation === capturedGeneration
      };
    },

    run({ scopeKey, channel, request, onSuccess, onError, onFinally }) {
      if (!scopeKey || scopeKey !== activeScopeKey) return Promise.resolve();

      const previous = channels.get(channel);
      previous?.controller.abort();

      const controller = new AbortController();
      const token = Symbol(channel);
      const requestGeneration = generation;
      channels.set(channel, { controller, token });
      const context = {
        signal: controller.signal,
        isCurrent: () => isCurrentRequest({ scopeKey, requestGeneration, channel, token })
      };

      return (async () => {
        try {
          const value = await request(context);
          if (!context.isCurrent()) return;
          onSuccess?.(value);
        } catch (error) {
          if (!context.isCurrent() || isAbortError(error)) return;
          onError?.(error);
        } finally {
          if (!context.isCurrent()) return;
          channels.delete(channel);
          onFinally?.();
        }
      })();
    },

    dispose() {
      invalidate();
      activeScopeKey = null;
    }
  };
}
