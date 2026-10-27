import test from 'node:test';
import assert from 'node:assert/strict';
import { initialUnitCount, missingInitialUnits, modeLabel, propertyModeLabel, targetRentalMode, rentalMode } from './rentalMode.js';

test('creation seeds one API-managed single-family unit and no multi-unit placeholders', () => {
  assert.equal(initialUnitCount('singleFamily'), 1);
  assert.equal(initialUnitCount('multiUnit', [{ name: '101' }, { name: '102' }]), 2);
  assert.deepEqual(missingInitialUnits([{ name: 'Unit 1' }], [{ id: 12, name: 'Unit 1' }]), []);
  assert.deepEqual(missingInitialUnits([{ name: 'Unit 1' }], []), [{ name: 'Unit 1' }]);
  assert.deepEqual(missingInitialUnits([{ name: '101' }, { name: '102' }], [{ id: 7, name: '101' }]), [{ name: '102' }]);
});

test('legacy units default to long-term and mixed inventories are labeled from units', () => {
  assert.equal(rentalMode({}), 'longTerm');
  assert.equal(modeLabel({ rentalMode: 'shortTerm' }), 'Short-term');
  assert.equal(targetRentalMode({ rentalMode: 'shortTerm' }), 'longTerm');
  assert.equal(propertyModeLabel({ units: [{ rentalMode: 'shortTerm' }, {}] }), 'Mixed');
  assert.equal(propertyModeLabel({ units: [{ rentalMode: 'shortTerm' }] }), 'Short-term');
  assert.equal(propertyModeLabel({ units: [{}] }), 'Long-term');
});
