import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPercyMetricValue } from './percyMetricValue.js';

test('Percy money metrics accept model-formatted currency without rendering NaN', () => {
  assert.equal(formatPercyMetricValue({ value: '$2,500', money: true }), '$2,500');
  assert.equal(formatPercyMetricValue({ value: '2500.00', money: true }), '$2,500');
});

test('Percy money metrics never expose NaN for malformed values', () => {
  assert.equal(formatPercyMetricValue({ value: 'not available', money: true }), 'not available');
  assert.equal(formatPercyMetricValue({ value: '', money: true }), '—');
});

test('Percy non-money metrics retain their supplied display value', () => {
  assert.equal(formatPercyMetricValue({ value: '55', money: false }), '55');
});
