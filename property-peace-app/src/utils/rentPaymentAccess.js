export const RENT_PAYMENT_ACCESS_STATUS = Object.freeze({
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended'
});

export const RENT_PAYMENT_BLOCKER = Object.freeze({
  providerDisabled: 'provider_disabled',
  accessNotRequested: 'access_not_requested',
  accessPending: 'access_pending',
  accessRejected: 'access_rejected',
  accessSuspended: 'access_suspended',
  accessNotApproved: 'access_not_approved',
  connectedPayeeMissing: 'connected_payee_missing',
  connectedPayeeUnderReview: 'connected_payee_under_review',
  connectedPayeeNotReady: 'connected_payee_not_ready'
});

const accessValue = (access, name) => access?.[name] ?? access?.[`${name[0].toUpperCase()}${name.slice(1)}`];
const normalize = (value) => String(value || '').replace(/[ _-]/g, '').toLowerCase();
const blockerList = (readiness) => readiness?.blockers ?? readiness?.Blockers ?? [];
const isAllowed = (readiness) => readiness?.allowed === true || readiness?.Allowed === true;
const providerEnabled = (readiness) => readiness?.providerEnabled ?? readiness?.ProviderEnabled;

function view(status, title, message, actionLabel, canRequest = false, canConfigure = false, canPay = false) {
  return { status, title, message, actionLabel, canRequest, canConfigure, canPay };
}

function accessStatus(access) {
  return normalize(accessValue(access, 'status'));
}

const unwrapResponse = (response) => response?.data ?? response;

export async function loadRentPaymentAccessState({
  signal,
  loadAccess,
  loadFeatureReadiness,
  loadActionReadiness,
  selectFeatureReadiness
}) {
  const access = unwrapResponse(await loadAccess(signal));
  const result = { access, readiness: null, configureReadiness: null, payReadiness: null };

  if (accessStatus(access) !== normalize(RENT_PAYMENT_ACCESS_STATUS.approved)) return result;

  const settled = await Promise.allSettled([
    loadFeatureReadiness(signal),
    loadActionReadiness('Configure', signal),
    loadActionReadiness('Pay', signal)
  ]);

  const aborted = settled.find(({ status, reason }) =>
    status === 'rejected' && (reason?.name === 'AbortError' || reason?.code === 'ERR_CANCELED'));
  if (aborted) throw aborted.reason;

  const value = (result) => result.status === 'fulfilled' ? unwrapResponse(result.value) : null;
  const readinessError = settled
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Unable to load payment readiness.')
    .join(' ');
  const [aggregateResult, configureResult, payResult] = settled;

  return {
    access,
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

function hasRecipient(payReadiness) {
  return payReadiness?.connectedPayeeExists === true || payReadiness?.ConnectedPayeeExists === true;
}
/** Maps server access/readiness decisions into safe landlord-facing copy. */
export function getRentPaymentAccessPresentation({ access = null, aggregateReadiness = null, configureReadiness = null, payReadiness = null, error = null, readinessError = null } = {}) {
  const status = accessStatus(access);
  const safeReason = accessValue(access, 'decisionReason');
  const canConfigure = isAllowed(configureReadiness);
  const canPay = isAllowed(payReadiness);

  if (error) {
    return view(
      'unavailable',
      'Online rent payments temporarily unavailable',
      'Online rent payment access could not be loaded. Retry to check your organization status.',
      'Refresh status'
    );
  }
  if (status === normalize(RENT_PAYMENT_ACCESS_STATUS.approved) && readinessError) {
    return view(
      'approved-unavailable',
      'Payment setup temporarily unavailable',
      'Your organization is approved, but payment setup status could not be loaded. Retry to continue.',
      'Refresh status'
    );
  }
  if (hasProviderBlocker(aggregateReadiness, configureReadiness, payReadiness)) {
    return view('unavailable', 'Online rent payments temporarily unavailable', 'Online rent payments cannot be enabled right now. Please try again later.', 'Refresh status');
  }
  if (status === normalize(RENT_PAYMENT_ACCESS_STATUS.suspended)) {
    return view('suspended', 'Online rent payments suspended', safeReason || 'Online rent payments are currently suspended for your organization.', 'Refresh status');
  }
  if (!access || status === '' || status === 'notrequested') {
    return view('not-requested', 'Request online rent payments', 'Request approval to begin payment setup for your organization.', 'Request online rent payments', true);
  }
  if (status === normalize(RENT_PAYMENT_ACCESS_STATUS.pending)) {
    return view('pending', 'Request under review', 'Your request is under review. We will notify you when there is an update.', 'Refresh status');
  }
  if (status === normalize(RENT_PAYMENT_ACCESS_STATUS.rejected)) {
    return view('rejected', 'Request not approved', safeReason || 'Your request was not approved. You may submit a new request when you are ready.', 'Request online rent payments', true);
  }
  if (status === normalize(RENT_PAYMENT_ACCESS_STATUS.approved)) {
    if (canPay) return view('ready', 'Ready to collect rent online', 'Your organization is ready to collect rent online.', null, false, canConfigure, true);
    if (!hasRecipient(payReadiness)) return view('approved-onboarding', 'Finish payment setup', 'Your request is approved. Finish payment setup to continue.', 'Finish payment setup', false, canConfigure, false);
    return view('under-review', 'Connected account under review', 'Your payment account is under review. You can refresh this status for updates.', 'Refresh status', false, canConfigure, false);
  }
  return view('unavailable', 'Online rent payments temporarily unavailable', 'Online rent payments cannot be enabled right now. Please try again later.', 'Refresh status');
}

export function makeRentPaymentAccessScopeKey({ userId, organizationId }) {
  if (userId === null || userId === undefined || userId === '' || organizationId === null || organizationId === undefined || organizationId === '') return null;
  return JSON.stringify([String(userId), String(organizationId)]);
}

export function getRentPaymentAccessVisibleState({ state, scopeKey, canFetch }) {
  if (!canFetch) return { access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: false, error: null };
  if (state.scopeKey !== scopeKey) return { access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: true, error: null };
  return state;
}

export function createRentPaymentAccessRequestLifecycle(onStateChange) {
  let generation = 0;
  let activeScopeKey = null;
  let activeController = null;
  const empty = (scopeKey, loading) => ({ scopeKey, access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading, error: null });
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
      onStateChange(empty(scopeKey, true));
      const isCurrent = () => requestGeneration === generation && activeScopeKey === scopeKey;

      return Promise.resolve()
        .then(() => request({ signal: controller.signal }))
        .then((data) => {
          if (isCurrent()) onStateChange({ scopeKey, access: data?.access ?? null, readiness: data?.readiness ?? null, configureReadiness: data?.configureReadiness ?? null, payReadiness: data?.payReadiness ?? null, readinessError: data?.readinessError ?? null, loading: false, error: null });
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') onStateChange(empty(scopeKey, false));
          else onStateChange({ scopeKey, access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: false, error: error?.message || 'Unable to load online rent payment access.' });
        })
        .finally(() => { if (isCurrent()) activeController = null; });
    },
    reportError(scopeKey, error) {
      if (scopeKey !== activeScopeKey) return;
      onStateChange({ scopeKey, access: null, readiness: null, configureReadiness: null, payReadiness: null, readinessError: null, loading: false, error: error?.message || 'Unable to request online rent payment access.' });
    },    clear(scopeKey = null) {
      invalidate();
      activeScopeKey = scopeKey;
      onStateChange(empty(scopeKey, false));
    },
    dispose() {
      invalidate();
      activeScopeKey = null;
    }
  };
}
