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

function hasProviderBlocker(aggregateReadiness, ...readiness) {
  if (aggregateReadiness?.globalGateEnabled === false || aggregateReadiness?.GlobalGateEnabled === false || aggregateReadiness?.providerConfigured === false || aggregateReadiness?.ProviderConfigured === false) return true;
  return readiness.some((item) => providerEnabled(item) === false || blockerList(item).map(normalize).includes(normalize(RENT_PAYMENT_BLOCKER.providerDisabled)));
}

function hasRecipient(payReadiness) {
  return payReadiness?.connectedPayeeExists === true || payReadiness?.ConnectedPayeeExists === true;
}
/** Maps server access/readiness decisions into safe landlord-facing copy. */
export function getRentPaymentAccessPresentation({ access = null, aggregateReadiness = null, configureReadiness = null, payReadiness = null } = {}) {
  const status = accessStatus(access);
  const safeReason = accessValue(access, 'decisionReason');
  const canConfigure = isAllowed(configureReadiness);
  const canPay = isAllowed(payReadiness);

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
  if (!canFetch) return { access: null, readiness: null, configureReadiness: null, payReadiness: null, loading: false, error: null };
  if (state.scopeKey !== scopeKey) return { access: null, readiness: null, configureReadiness: null, payReadiness: null, loading: true, error: null };
  return state;
}

export function createRentPaymentAccessRequestLifecycle(onStateChange) {
  let generation = 0;
  let activeScopeKey = null;
  let activeController = null;
  const empty = (scopeKey, loading) => ({ scopeKey, access: null, readiness: null, configureReadiness: null, payReadiness: null, loading, error: null });
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
          if (isCurrent()) onStateChange({ scopeKey, access: data?.access ?? null, readiness: data?.readiness ?? null, configureReadiness: data?.configureReadiness ?? null, payReadiness: data?.payReadiness ?? null, loading: false, error: null });
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') onStateChange(empty(scopeKey, false));
          else onStateChange({ scopeKey, access: null, readiness: null, loading: false, error: error?.message || 'Unable to load online rent payment access.' });
        })
        .finally(() => { if (isCurrent()) activeController = null; });
    },
    reportError(scopeKey, error) {
      if (scopeKey !== activeScopeKey) return;
      onStateChange({ scopeKey, access: null, readiness: null, configureReadiness: null, payReadiness: null, loading: false, error: error?.message || 'Unable to request online rent payment access.' });
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
