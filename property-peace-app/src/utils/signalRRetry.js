const TERMINAL_AUTH_STATUSES = new Set([401, 403]);
const NESTED_ERROR_FIELDS = ['innerError', 'error', 'cause', 'response', 'data'];
const TERMINAL_AUTH_MESSAGE = /\b(?:401|403|unauthorized|forbidden)\b/i;

/**
 * SignalR wraps negotiate failures differently by transport and browser. Do not
 * schedule another attempt until the authentication context changes when the
 * server has explicitly rejected the current one.
 */
export function isTerminalSignalRAuthError(error) {
  const visited = new Set();

  const inspect = (candidate) => {
    if (!candidate || visited.has(candidate)) {
      return false;
    }

    if (typeof candidate === 'string') {
      return TERMINAL_AUTH_MESSAGE.test(candidate);
    }

    if (typeof candidate !== 'object') {
      return false;
    }

    visited.add(candidate);

    if (
      TERMINAL_AUTH_STATUSES.has(Number(candidate.statusCode)) ||
      TERMINAL_AUTH_STATUSES.has(Number(candidate.status)) ||
      TERMINAL_AUTH_STATUSES.has(Number(candidate.httpStatusCode)) ||
      (typeof candidate.message === 'string' && TERMINAL_AUTH_MESSAGE.test(candidate.message))
    ) {
      return true;
    }

    return NESTED_ERROR_FIELDS.some((field) => inspect(candidate[field]));
  };

  return inspect(error);
}
