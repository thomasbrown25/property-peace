const dismissedInSession = new Set();
const storageKey = (scopeKey) => `propertyPeace:online-payments-intro:${scopeKey}`;

export function hasSeenOnlinePaymentsIntro(scopeKey, storage) {
  if (dismissedInSession.has(scopeKey)) return true;
  try {
    return (storage ?? globalThis.localStorage)?.getItem(storageKey(scopeKey)) === 'true';
  } catch {
    return false;
  }
}

export function dismissOnlinePaymentsIntro(scopeKey, storage) {
  dismissedInSession.add(scopeKey);
  try {
    (storage ?? globalThis.localStorage)?.setItem(storageKey(scopeKey), 'true');
  } catch {
    // Keep the dismissal for this app session when browser storage is unavailable.
  }
}
