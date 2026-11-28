import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWrenMetricValue } from './wrenMetricValue.js';

test('Wren money metrics accept model-formatted currency without rendering NaN', () => {
  assert.equal(formatWrenMetricValue({ value: '$2,500', money: true }), '$2,500');
  assert.equal(formatWrenMetricValue({ value: '2500.00', money: true }), '$2,500');
});

test('Wren money metrics never expose NaN for malformed values', () => {
  assert.equal(formatWrenMetricValue({ value: 'not available', money: true }), 'not available');
  assert.equal(formatWrenMetricValue({ value: '', money: true }), '—');
});

test('Wren non-money metrics retain their supplied display value', () => {
  assert.equal(formatWrenMetricValue({ value: '55', money: false }), '55');
});
