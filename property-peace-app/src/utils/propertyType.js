// API enum values may arrive with PascalCase or legacy punctuation.
const normalizePropertyType = (type) => String(type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const isDetachedSingleUnitType = (type) =>
  ['singlefamily', 'singleunit', 'townhouse', 'condominium'].includes(normalizePropertyType(type));