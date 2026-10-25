// One coordinator per open checkout. The create's idempotency key and amount cannot
// change while it is in flight; reconcile the newest valid amount only after create.
export function createPaymentIntentSync({ post, onState }) {
  let intent = null;
  let desired = null;
  let inFlight = false;
  let disposed = false;
  let blocked = false;
  let scopeKey = null;
  let initialPayload = null;

  const keyFor = (scope) => JSON.stringify([scope.leaseId, scope.chargeId ?? null, scope.operationId]);
  const publish = (extra = {}) => {
    if (!disposed) onState({ paymentIntentId: intent?.paymentIntentId ?? null, clientSecret: intent?.clientSecret ?? null,
      intentAmountCents: intent?.amountCents ?? null, ...extra });
  };
  const run = async () => {
    if (disposed || inFlight || blocked || !desired?.payload || (intent && intent.amountCents === desired.amountCents)) return;
    inFlight = true;
    const creating = !intent;
    const target = creating ? (initialPayload ??= desired) : desired;
    try {
      const response = await post(creating ? '/api/stripe/create-payment-intent' : '/api/stripe/update-payment-intent',
        creating ? target.payload : { ...target.payload, paymentIntentId: intent.paymentIntentId });
      if (disposed) return;
      const data = response?.data?.data;
      if (!response?.data?.success || (creating && (!data?.paymentIntentId || !data?.clientSecret))) {
        throw new Error(response?.data?.message || 'Failed to initialize payment');
      }
      intent = { paymentIntentId: intent?.paymentIntentId || data.paymentIntentId,
        clientSecret: intent?.clientSecret || data.clientSecret, amountCents: target.amountCents };
    } catch (error) {
      if (!disposed) { blocked = true; publish({ error }); }
    } finally {
      inFlight = false;
      if (!disposed && !blocked) {
        if (desired?.payload && desired.amountCents !== intent?.amountCents) void run();
        publish({ error: null });
      }
    }
  };
  return {
    sync({ scope, payload, amountCents }) {
      if (disposed) return;
      const key = keyFor(scope);
      if (scopeKey !== null && scopeKey !== key) { disposed = true; return; }
      scopeKey = key;
      desired = { payload, amountCents };
      void run();
    },
    retry() { blocked = false; void run(); },
    dispose() { disposed = true; },
    get ready() { return !disposed && !blocked && !inFlight && !!desired?.payload && !!intent && intent.amountCents === desired.amountCents; }
  };
}
