import assert from 'node:assert/strict';
import test from 'node:test';
import { categorizeExpense } from './expense-categorization.js';

const cases = [
  ['electric bill for unit 2', 'Utilities'],
  ['monthly HOA dues', 'HOA'],
  ['gas furnace repair', 'Repairs'],
  ['routine HVAC maintenance', 'Maintenance'],
  ['water tank replacement', 'Water tank'],
  ['car rental for property inspection', 'Car Rental'],
];

for (const [description, category] of cases) {
  test(`categorizes ${description} as ${category}`, () => {
    assert.equal(categorizeExpense(description).category, category);
  });
}

test('falls back to Other and limits the generated name to 50 characters', () => {
  assert.deepEqual(categorizeExpense(''), { category: 'Other', name: '' });
  assert.equal(categorizeExpense('x'.repeat(70)).name, 'x'.repeat(50));
});
