const EMPTY_STATE = (scopeKey) => ({
  scopeKey,
  items: [],
  generating: false,
  generationAttempted: false,
  generationError: null,
  detailModal: null,
  approveLoading: false,
  approveState: null,
  actions: {}
});

const part = (value) => (value === undefined || value === null || value === '' ? null : String(value));

export function makePortfolioScopeKey({ userId, organizationId, organizationLoading = false }) {
  if (organizationLoading) return null;
  const user = part(userId);
  const organization = part(organizationId);
  return user && organization ? JSON.stringify([user, organization]) : null;
}

/** Pure lifecycle used to enforce the same stale-completion rule as the page. */
export function createPortfolioScopeLifecycle(onState) {
  let generation = 0;
  let state = EMPTY_STATE(null);

  const publish = (next) => {
    state = next;
    onState(next);
  };

  return {
    switchScope(scopeKey) {
      generation += 1;
      publish(EMPTY_STATE(scopeKey));
    },
    publishSummary(items, overrides = {}) {
      publish({
        ...state,
        ...overrides,
        scopeKey: state.scopeKey,
        items: [...items]
      });
    },
    refresh(request) {
      generation += 1;
      publish(EMPTY_STATE(state.scopeKey));
      return request();
    },
    visibleState(scopeKey) {
      return state.scopeKey === scopeKey ? state : null;
    },
    async runAction(actionId, request) {
      const token = { generation, scopeKey: state.scopeKey };
      publish({ ...state, actions: { ...state.actions, [actionId]: 'loading' } });
      const result = await request();
      if (token.generation !== generation || token.scopeKey !== state.scopeKey) return false;
      publish({
        ...state,
        actions: { ...state.actions, [actionId]: result?.success ? 'completed' : 'failed' }
      });
      return true;
    }
  };
}

export function createPortfolioScopeGuard() {
  let generation = 0;
  let scopeKey = null;
  return {
    switchScope(nextScopeKey) {
      if (nextScopeKey === scopeKey) return;
      generation += 1;
      scopeKey = nextScopeKey;
    },
    invalidate(currentScopeKey = scopeKey) {
      generation += 1;
      scopeKey = currentScopeKey;
    },
    capture() {
      return Object.freeze({ generation, scopeKey });
    },
    isCurrent(token, currentScopeKey) {
      return Boolean(token && token.generation === generation && token.scopeKey === scopeKey && scopeKey === currentScopeKey);
    }
  };
}
