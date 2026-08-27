import { jwtDecode } from 'jwt-decode';

const SESSION_KEY = 'impersonationSession';
const LEGACY_KEYS = ['impersonationAccessToken', 'impersonationRefreshToken', 'impersonationMetadata'];
const ADMIN_TOKEN_KEYS = ['serviceToken', 'token'];
const TAB_NAME_PREFIX = '__propertyPeaceTab=';
let failedClosed = false;

const readJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// window.name is not cloned by window.open, but survives reloads in the same tab. This lets us
// reject a sessionStorage snapshot inherited by a newly opened tab.
const getTabId = () => {
  const parts = window.name.split('|');
  const marker = parts.find((part) => part.startsWith(TAB_NAME_PREFIX));
  if (marker) return marker.slice(TAB_NAME_PREFIX.length);
  const id = createId();
  window.name = [...parts.filter(Boolean), `${TAB_NAME_PREFIX}${id}`].join('|');
  return id;
};

const removeStoredSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  LEGACY_KEYS.forEach((key) => sessionStorage.removeItem(key));
};

const dispatchChanged = () => window.dispatchEvent(new Event('impersonation-changed'));

const isJwtStructured = (token) => {
  try {
    const decoded = jwtDecode(token);
    return Boolean(decoded.exp);
  } catch {
    return false;
  }
};

const isCompleteSession = (session) => Boolean(
  session?.version === 2 &&
  session.ownerTabId && session.ownerTabId === getTabId() &&
  isJwtStructured(session.accessToken) &&
  session.refreshToken &&
  session.metadata?.targetUserId &&
  session.metadata?.accessTokenExpiresAt &&
  session.metadata?.sessionExpiresAt &&
  new Date(session.metadata.accessTokenExpiresAt).getTime() > 0 &&
  new Date(session.metadata.sessionExpiresAt).getTime() > Date.now()
);

const hasStoredImpersonationData = () => Boolean(
  sessionStorage.getItem(SESSION_KEY) || LEGACY_KEYS.some((key) => sessionStorage.getItem(key))
);

const readSession = ({ clearInvalid = true } = {}) => {
  const session = readJson(sessionStorage.getItem(SESSION_KEY));
  if (isCompleteSession(session)) return session;

  if (clearInvalid && hasStoredImpersonationData()) {
    failedClosed = true;
    removeStoredSession();
    dispatchChanged();
    window.dispatchEvent(new CustomEvent('impersonation-expired', { detail: { reason: 'invalid-session' } }));
  }
  return null;
};

export const getImpersonationSession = () => readSession();
export const getImpersonationAccessToken = () => readSession()?.accessToken || null;
export const getImpersonationRefreshToken = () => readSession()?.refreshToken || null;
export const getImpersonationMetadata = () => readSession()?.metadata || null;
export const isImpersonating = () => Boolean(readSession());

export const isAdminSessionPersistent = () =>
  ADMIN_TOKEN_KEYS.some((key) => Boolean(localStorage.getItem(key)));

export const setAdminAccessToken = (token, isPersistent = true) => {
  ADMIN_TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  if (token) {
    const storage = isPersistent ? localStorage : sessionStorage;
    storage.setItem('serviceToken', token);
  }
};

export const getAdminAccessToken = () =>
  sessionStorage.getItem('serviceToken') || sessionStorage.getItem('token') ||
  localStorage.getItem('serviceToken') || localStorage.getItem('token');

// Never fall back to an administrator credential when impersonation storage is present but invalid.
export const getActiveAccessToken = () => {
  if (failedClosed) return null;
  if (hasStoredImpersonationData()) return readSession()?.accessToken || null;
  return getAdminAccessToken();
};

export const getTokenExpiration = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
};

const getField = (source, ...keys) => keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '');

export const getUserOrganizationId = (user) => getField(
  user,
  'currentOrganizationId', 'CurrentOrganizationId', 'organizationId', 'OrganizationId'
);

// During impersonation this deliberately has no Redux/localStorage fallback. An absent target
// organization is safer than sending the administrator's organization with a target credential.
export const getActiveOrganizationId = (ordinaryUser = null) => {
  if (failedClosed) return null;
  const session = readSession();
  if (session) {
    const fromMetadata = getField(session.metadata, 'targetOrganizationId', 'currentOrganizationId');
    const fromUser = getUserOrganizationId(session.metadata?.targetUser);
    if (fromMetadata || fromUser) return fromMetadata || fromUser;
    try {
      const claims = jwtDecode(session.accessToken);
      return getField(claims, 'currentOrganizationId', 'CurrentOrganizationId', 'organizationId', 'OrganizationId', 'org_id');
    } catch {
      return null;
    }
  }
  if (hasStoredImpersonationData()) return null;
  return getUserOrganizationId(ordinaryUser) || localStorage.getItem('currentOrganizationId');
};

export const normalizeImpersonationResponse = (response) => {
  const envelope = response?.data?.data ?? response?.data ?? response;
  const user = envelope?.user ?? envelope?.targetUser ?? envelope?.loadUser ?? envelope;
  const accessToken =
    envelope?.jwtToken ?? envelope?.JWTToken ?? envelope?.accessToken ?? envelope?.AccessToken ?? user?.jwtToken ?? user?.JWTToken;
  const refreshToken =
    envelope?.refreshToken ?? envelope?.impersonationRefreshToken ?? envelope?.RefreshToken;
  const accessTokenExpiresAt =
    envelope?.accessTokenExpiresAt ?? envelope?.AccessTokenExpiresAt ?? getTokenExpiration(accessToken);
  const sessionExpiresAt =
    envelope?.sessionExpiresAt ?? envelope?.SessionExpiresAt ?? envelope?.expiresAt ?? envelope?.expiresUtc ?? envelope?.expiration;

  return { envelope, user, accessToken, refreshToken, accessTokenExpiresAt, sessionExpiresAt };
};

export const saveImpersonationSession = ({ accessToken, refreshToken, metadata }) => {
  const completeMetadata = {
    ...metadata,
    accessTokenExpiresAt: metadata?.accessTokenExpiresAt || getTokenExpiration(accessToken)
  };
  if (!accessToken || !refreshToken || !completeMetadata.targetUserId || !completeMetadata.sessionExpiresAt) {
    throw new Error('Impersonation response did not include a complete session.');
  }
  const session = { version: 2, ownerTabId: getTabId(), accessToken, refreshToken, metadata: completeMetadata };
  failedClosed = false;
  // A single write prevents readers from observing token/metadata fragments.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  LEGACY_KEYS.forEach((key) => sessionStorage.removeItem(key));
  dispatchChanged();
};

export const updateImpersonationSession = (updates = {}) => {
  const session = readSession();
  if (!session) throw new Error('Impersonation session is unavailable.');
  const next = {
    ...session,
    ...updates,
    metadata: { ...session.metadata, ...(updates.metadata || {}) }
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  dispatchChanged();
};

export const updateImpersonationAccessToken = (accessToken, refreshToken, accessTokenExpiresAt, sessionExpiresAt) => {
  if (!accessToken) throw new Error('Impersonation refresh did not include an access token.');
  updateImpersonationSession({
    accessToken,
    refreshToken: refreshToken || getImpersonationRefreshToken(),
    metadata: {
      accessTokenExpiresAt: accessTokenExpiresAt || getTokenExpiration(accessToken),
      ...(sessionExpiresAt ? { sessionExpiresAt } : {})
    }
  });
};

export const setActiveOrganizationId = (organizationId) => {
  if (isImpersonating()) {
    updateImpersonationSession({ metadata: { targetOrganizationId: organizationId?.toString() || null } });
    return;
  }
  if (organizationId) localStorage.setItem('currentOrganizationId', organizationId.toString());
  else localStorage.removeItem('currentOrganizationId');
};

export const clearActiveOrganizationId = () => setActiveOrganizationId(null);

export const clearImpersonationSession = () => {
  failedClosed = false;
  removeStoredSession();
  dispatchChanged();
};

export const notifyImpersonationExpired = () => {
  window.dispatchEvent(new CustomEvent('impersonation-expired'));
};
