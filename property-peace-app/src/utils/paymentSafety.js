export function getTenantPaymentSubmissionCopy(payment) {
  const status = String(payment?.status || '').toLowerCase();

  if (status === 'processing') {
    return {
      title: 'Payment processing',
      message:
        'Your bank payment was submitted and may take several business days to finish. Your rent balance updates only after Property Peace receives final confirmation. Check Payment History for updates.',
      tone: 'info'
    };
  }

  return {
    title: 'Payment confirmation received',
    message:
      'Your payment was confirmed by the payment provider. Property Peace is verifying and applying it to your rent balance. Check Payment History for the final status.',
    tone: 'info'
  };
}

const FINAL_STATUSES = new Set(['completed', 'paid']);
const KNOWN_NON_FINAL_STATUSES = new Map([
  ['created', { status: 'created', label: 'Created', retryable: false }],
  ['processing', { status: 'processing', label: 'Processing', retryable: false }],
  ['failed', { status: 'failed', label: 'Failed', retryable: true }],
  ['canceled', { status: 'canceled', label: 'Canceled', retryable: true }],
  ['cancelled', { status: 'canceled', label: 'Canceled', retryable: true }],
  ['disputed', { status: 'disputed', label: 'Disputed', retryable: true }]
]);

export function classifyPaymentStatus(payment) {
  const raw = payment?.status ?? payment?.Status;
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  if (FINAL_STATUSES.has(normalized)) {
    return { status: normalized, label: 'Paid', creditsRent: true, retryable: false };
  }

  const known = KNOWN_NON_FINAL_STATUSES.get(normalized);
  if (known) return { ...known, creditsRent: false };

  return { status: 'needs-review', label: 'Needs review', creditsRent: false, retryable: false };
}

export function isBalanceCreditingPayment(payment) {
  return classifyPaymentStatus(payment).creditsRent;
}

export function canManuallyManagePayment(payment) {
  if (payment?.type !== 'payment') return false;

  const providerId =
    payment?.stripePaymentIntentId ||
    payment?.StripePaymentIntentId ||
    payment?.stripeChargeId ||
    payment?.StripeChargeId;
  const method = String(payment?.method || payment?.Method || '').toLowerCase();
  const isProviderRecorded = Boolean(providerId) || method.includes('online') || method.includes('stripe');

  return !isProviderRecorded;
}
