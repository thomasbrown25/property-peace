export function getActiveFilterCount(filters = []) {
  return filters.filter((filter) => filter && filter.value !== filter.defaultValue).length;
}

export function hasActiveToolbarFilters(search = '', activeChips = []) {
  return search.trim().length > 0 || activeChips.length > 0;
}

export function resolveTransactionSearchLabel(value) {
  const label = typeof value === 'string' ? value.trim() : '';
  return label || 'Search financial records';
}
