import test from 'node:test';
import assert from 'node:assert/strict';
import { isDetachedSingleUnitType } from './propertyType.js';

test('classifies detached single-unit types regardless of API casing or punctuation', () => {
  for (const type of ['singleFamily', 'SingleFamily', 'single-family', 'SingleUnit', 'townhouse', 'Townhouse', 'Condominium']) {
    assert.equal(isDetachedSingleUnitType(type), true, type);
  }
  for (const type of ['multiUnit', 'smallMultiFamily', 'apartmentBuilding', 'other', undefined]) {
    assert.equal(isDetachedSingleUnitType(type), false, String(type));
  }
});