import assert from 'node:assert/strict';
import test from 'node:test';

import * as toolbarUtils from './transactionFilterToolbarUtils.js';
import { getActiveFilterCount } from './transactionFilterToolbarUtils.js';

test('untouched Activity type and account filters count as zero and one changed filter counts as one', () => {
  const untouched = [
    { key: 'type', value: 'all', defaultValue: 'all' },
    { key: 'account', value: 'all', defaultValue: 'all' }
  ];

  assert.equal(getActiveFilterCount(untouched), 0);
  assert.equal(getActiveFilterCount([{ ...untouched[0], value: 'income' }, untouched[1]]), 1);
});

test('transaction search has a caller-specific accessible name with a safe default', () => {
  assert.equal(typeof toolbarUtils.resolveTransactionSearchLabel, 'function');
  assert.equal(
    toolbarUtils.resolveTransactionSearchLabel('Search posted activity'),
    'Search posted activity'
  );
  assert.equal(toolbarUtils.resolveTransactionSearchLabel('   '), 'Search financial records');
  assert.equal(toolbarUtils.resolveTransactionSearchLabel(), 'Search financial records');
});
