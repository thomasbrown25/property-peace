const normalizeConversationId = (value) => (value === undefined || value === null ? null : String(value));
const normalizePart = (value) => (value === undefined || value === null ? '' : String(value));

const sameAttempt = (attempt, context) => Boolean(
  attempt
  && attempt.message === normalizePart(context?.message)
  && attempt.conversationId === normalizeConversationId(context?.conversationId)
  && attempt.scopeKey === normalizePart(context?.scopeKey)
);

export function createPercyChatRequestAttempt(clientRequestIdFactory = () => crypto.randomUUID()) {
  let retainedAttempt = null;

  const clear = () => {
    retainedAttempt = null;
  };

  return {
    begin(context) {
      if (!sameAttempt(retainedAttempt, context)) {
        retainedAttempt = Object.freeze({
          message: normalizePart(context?.message),
          conversationId: normalizeConversationId(context?.conversationId),
          scopeKey: normalizePart(context?.scopeKey),
          clientRequestId: clientRequestIdFactory()
        });
      }
      return retainedAttempt;
    },
    fail(attempt) {
      if (retainedAttempt?.clientRequestId !== attempt?.clientRequestId) return;
      // Deliberately retained so an identical retry uses the same server idempotency key.
    },
    succeed(attempt) {
      if (retainedAttempt?.clientRequestId === attempt?.clientRequestId) clear();
    },
    inputChanged(nextMessage) {
      if (retainedAttempt && retainedAttempt.message !== normalizePart(nextMessage)) clear();
    },
    contextChanged(context) {
      if (!retainedAttempt) return;
      if (
        retainedAttempt.conversationId !== normalizeConversationId(context?.conversationId)
        || retainedAttempt.scopeKey !== normalizePart(context?.scopeKey)
      ) clear();
    }
  };
}
