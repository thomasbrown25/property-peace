export const RENT_PAYMENT_BLOCKER = Object.freeze({
  providerDisabled: 'provider_disabled',
  connectedPayeeMissing: 'connected_payee_missing',
  connectedPayeeNotReady: 'connected_payee_not_ready'
});

const normalize = (value) => String(value || '').replace(/[ _-]/g, '').toLowerCase();
const blockerList = (readiness) => readiness?.blockers ?? readiness?.Blockers ?? [];
const isAllowed = (readiness) => readiness?.allowed === true || readiness?.Allowed === true;
const providerEnabled = (readiness) => readiness?.providerEnabled ?? readiness?.ProviderEnabled;
const unwrapResponse = (response) => response?.data ?? response;
const emptyState = (scopeKey, loading = false) => ({ scopeKey, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading, error: null });

export async function loadRentPaymentAccessState({ signal, loadFeatureReadiness, loadActionReadiness, selectFeatureReadiness }) {
  const settled = await Promise.allSettled([
    loadFeatureReadiness(signal),
    loadActionReadiness('Configure', signal),
    loadActionReadiness('Pay', signal)
  ]);
  const aborted = settled.find(({ status, reason }) => status === 'rejected' && (reason?.name === 'AbortError' || reason?.code === 'ERR_CANCELED'));
  if (aborted) throw aborted.reason;
  const value = (result) => result.status === 'fulfilled' ? unwrapResponse(result.value) : null;
  const readinessError = settled.filter((result) => result.status === 'rejected').map((result) => result.reason?.message || 'Unable to load payment readiness.').join(' ');
  const [aggregateResult, configureResult, payResult] = settled;
  return {
    readiness: aggregateResult.status === 'fulfilled' ? selectFeatureReadiness(value(aggregateResult)) ?? null : null,
    configureReadiness: value(configureResult),
    payReadiness: value(payResult),
    ...(readinessError ? { readinessError } : {})
  };
}

function hasProviderBlocker(aggregateReadiness, ...readiness) {
  if (aggregateReadiness?.globalGateEnabled === false || aggregateReadiness?.GlobalGateEnabled === false || aggregateReadiness?.providerConfigured === false || aggregateReadiness?.ProviderConfigured === false) return true;
  return readiness.some((item) => providerEnabled(item) === false || blockerList(item).map(normalize).includes(normalize(RENT_PAYMENT_BLOCKER.providerDisabled)));
}

function view(status, title, message, actionLabel, canConfigure = false, canPay = false) {
  return { status, title, message, actionLabel, canConfigure, canPay };
}

/** Present provider/action readiness, never an internal organization approval record. */
export function getRentPaymentAccessPresentation({ aggregateReadiness = null, configureReadiness = null, payReadiness = null, error = null, readinessError = null } = {}) {
  const canConfigure = isAllowed(configureReadiness);
  const canPay = isAllowed(payReadiness);
  if (error || readinessError) return view('unavailable', 'Payment setup temporarily unavailable', 'Payment setup status could not be loaded. Retry to continue.', 'Refresh status');
  // Configure may permit onboarding before collection rollout. Do not apply Pay's provider gate to Configure.
  if (!canConfigure && hasProviderBlocker(aggregateReadiness, configureReadiness, payReadiness)) {
    return view('unavailable', 'Online rent payments temporarily unavailable', 'Payment processing is temporarily unavailable. Please try again later.', 'Refresh status');
  }
  if (canPay) return view('ready', 'Ready to collect rent online', 'Online rent payments are ready.', null, canConfigure, true);
  if (!canConfigure) return view('unavailable', 'Online rent payments temporarily unavailable', 'Payment setup is not available for this organization right now.', 'Refresh status');
  const hasRecipient = payReadiness?.connectedPayeeExists === true || payReadiness?.ConnectedPayeeExists === true;
  if (!hasRecipient) return view('onboarding', 'Set up online payments', 'Connect Stripe to begin accepting rent online.', 'Set up online payments', true);
  return view('setup-required', 'Complete Stripe setup', 'Check your Stripe account for outstanding verification requirements and payout availability.', 'Continue Stripe setup', true);
}

export function makeRentPaymentAccessScopeKey({ userId, organizationId }) {
  if (userId === null || userId === undefined || userId === '' || organizationId === null || organizationId === undefined || organizationId === '') return null;
  return JSON.stringify([String(userId), String(organizationId)]);
}

export function getRentPaymentAccessVisibleState({ state, scopeKey, canFetch }) {
  if (!canFetch) return emptyState(scopeKey);
  if (state.scopeKey !== scopeKey) return emptyState(scopeKey, true);
  return state;
}

export function createRentPaymentAccessRequestLifecycle(onStateChange) {
  let generation = 0;
  let activeScopeKey = null;
  let activeController = null;
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
      const isCurrent = () => requestGeneration === generation && activeScopeKey === scopeKey;
      return Promise.resolve()
        .then(() => request({ signal: controller.signal }))
        .then((data) => { if (isCurrent()) onStateChange({ ...emptyState(scopeKey), ...data, scopeKey, loading: false, error: null }); })
        .catch((error) => {
          if (!isCurrent()) return;
          if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') onStateChange(emptyState(scopeKey));
          else onStateChange({ ...emptyState(scopeKey), error: error?.message || 'Unable to load payment readiness.' });
        })
        .finally(() => { if (isCurrent()) activeController = null; });
    },
    clear(scopeKey = null) {
      invalidate();
      activeScopeKey = scopeKey;
      onStateChange(emptyState(scopeKey));
    },
    dispose() {
      invalidate();
      activeScopeKey = null;
    }
  };
}
