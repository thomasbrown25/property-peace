const scopePart = (value) => (value === undefined || value === null || value === '' ? null : String(value));

export function getCurrentOrganizationId(currentOrganization) {
  return currentOrganization?.id ?? currentOrganization?.Id ?? null;
}

export function isAICenterScopeEligible({ userId, currentOrganization, organizationLoading }) {
  return Boolean(scopePart(userId) && scopePart(getCurrentOrganizationId(currentOrganization)) && !organizationLoading);
}

export function makeAICenterScope({ userId, organizationId }) {
  const normalized = Object.freeze({
    userId: scopePart(userId),
    organizationId: scopePart(organizationId)
  });

  return Object.freeze({
    ...normalized,
    scopeKey: JSON.stringify([normalized.userId, normalized.organizationId])
  });
}

export function isAICenterRuntimeReady({ runtime, stateGeneration }) {
  return Boolean(runtime?.eligible && stateGeneration === runtime.generation);
}

export function getAICenterReadinessMarker(presentation) {
  const active = presentation?.canInvoke === true;
  return Object.freeze({
    label: presentation?.title || 'Unavailable',
    active,
    toolDetail: active ? 'Organization-scoped tools available' : 'Unavailable until Percy readiness opens'
  });
}

export function createAICenterScopeGuard() {
  let generation = 0;
  let currentScopeKey = null;
  let currentEligible = false;
  let runtimeSignature = null;

  const snapshot = () => Object.freeze({
    generation,
    scopeKey: currentScopeKey,
    eligible: currentEligible
  });

  const synchronize = (scope, eligible) => {
    const scopeKey = scope?.scopeKey ?? null;
    const nextEligible = Boolean(eligible && scopeKey);
    const nextSignature = JSON.stringify([scopeKey, nextEligible]);

    // This is intentionally safe to call during render. It closes the window
    // before effect cleanup when OrganizationContext keeps the same organization
    // object but temporarily becomes ineligible while reloading.
    if (nextSignature !== runtimeSignature) {
      generation += 1;
      currentScopeKey = scopeKey;
      currentEligible = nextEligible;
      runtimeSignature = nextSignature;
    }

    return snapshot();
  };

  return {
    synchronize,
    getRuntime: snapshot,
    beginScope(scope, eligible = true) {
      synchronize(scope, eligible);
      // A new load for an otherwise identical runtime supersedes prior work.
      generation += 1;
      return snapshot();
    },
    capture(scope) {
      return Object.freeze({
        generation,
        scopeKey: scope?.scopeKey ?? null,
        eligible: currentEligible
      });
    },
    isCurrent(request, scope) {
      const suppliedEligible = scope?.eligible ?? true;
      return Boolean(
        request
        && request.eligible
        && currentEligible
        && suppliedEligible
        && request.generation === generation
        && request.scopeKey === currentScopeKey
        && request.scopeKey === scope?.scopeKey
      );
    },
    dispose() {
      generation += 1;
      currentScopeKey = null;
      currentEligible = false;
      runtimeSignature = null;
    }
  };
}
