const scopeIdentity = (value) => value ?? null;

export function makeApplicationLoadScope({ userId, organizationId, propertyId }) {
  const normalizedPropertyId = propertyId ?? null;
  const values = [
    scopeIdentity(userId),
    scopeIdentity(organizationId),
    normalizedPropertyId,
    normalizedPropertyId == null ? 'landlord' : 'property'
  ];
  return Object.freeze({
    userId: values[0],
    organizationId: values[1],
    propertyId: values[2],
    filter: values[3],
    scopeKey: JSON.stringify(values)
  });
}

export function createApplicationRequestGuard() {
  let generation = 0;
  let current = null;
  return {
    begin(scope) {
      generation += 1;
      current = Object.freeze({ generation, scopeKey: scope.scopeKey });
      return current;
    },
    isCurrent(request, scope) {
      return Boolean(
        request
        && current
        && request.generation === current.generation
        && request.scopeKey === current.scopeKey
        && request.scopeKey === scope?.scopeKey
      );
    }
  };
}

export function getPositiveApplicationId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}
