import { describe, expect, it } from 'vitest';
import { getActiveFilterCount, hasActiveToolbarFilters } from './transactionFilterToolbarUtils';

describe('getActiveFilterCount', () => {
  it('counts only advanced filters that differ from their defaults', () => {
    expect(getActiveFilterCount([
      { key: 'category', value: 'Repairs', defaultValue: 'all' },
      { key: 'status', value: 'all', defaultValue: 'all' },
      { key: 'receipt', value: 'missing', defaultValue: 'all' }
    ])).toBe(2);
  });

  it('treats empty advanced-filter definitions as inactive', () => {
    expect(getActiveFilterCount([])).toBe(0);
    expect(getActiveFilterCount()).toBe(0);
  });
});

describe('hasActiveToolbarFilters', () => {
  it('treats search-only filtering as active', () => {
    expect(hasActiveToolbarFilters('repair', [])).toBe(true);
  });

  it('detects chips and ignores whitespace-only search text', () => {
    expect(hasActiveToolbarFilters('   ', [])).toBe(false);
    expect(hasActiveToolbarFilters('', [{ key: 'status' }])).toBe(true);
  });
});
