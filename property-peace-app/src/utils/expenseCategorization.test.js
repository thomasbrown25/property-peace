import test from 'node:test';
import assert from 'node:assert/strict';

import { categorizeExpense } from './expenseCategorization.js';

const cases = [
  ['electric bill for unit 2', 'Utilities'],
  ['water heater utility bill', 'Utilities'],
  ['monthly HOA dues', 'HOA'],
  ['landscaping and lawn service', 'Landscaping'],
  ['move-out cleaning service', 'Cleaning'],
  ['property management fee', 'Property Management'],
  ['new kitchen capital improvement', 'Capital Improvements'],
  ['rental application fee', 'Application Fee'],
  ['tenant background screening', 'Screening'],
  ['car rental for property inspection', 'Car Rental'],
  ['water tank replacement', 'Water tank']
];

for (const [description, expected] of cases) {
  test(`categorizes ${description} as ${expected}`, () => {
    assert.equal(categorizeExpense(description).category, expected);
  });
}

test('repair and maintenance remain deterministic after specific rules', () => {
  assert.equal(categorizeExpense('repair broken sink').category, 'Repairs');
  assert.equal(categorizeExpense('routine HVAC maintenance').category, 'Maintenance');
  assert.equal(categorizeExpense('gas furnace repair').category, 'Repairs');
  assert.equal(categorizeExpense('gas furnace maintenance').category, 'Maintenance');
  assert.equal(categorizeExpense('electric panel repair').category, 'Repairs');
  assert.equal(categorizeExpense('water pipe maintenance').category, 'Maintenance');
});

test('utility bills remain Utilities despite repair-term precedence', () => {
  assert.equal(categorizeExpense('electric bill for unit 4').category, 'Utilities');
  assert.equal(categorizeExpense('monthly water bill').category, 'Utilities');
});
