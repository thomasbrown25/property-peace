import test from 'node:test';
import assert from 'node:assert/strict';
import { agreementDraft, agreementPath } from './extendedStayAgreement.js';

test('agreement builder uses a distinct owner-only path and unrestricted half-open local dates', () => {
  assert.equal(agreementPath('10'), '/api/short-stay/units/10/extended-stay-agreements');
  assert.deepEqual(agreementDraft('2026-11-01', '2028-11-01', ' Alex '),
    { startDate: '2026-11-01', endDate: '2028-11-01', occupantName: 'Alex' });
  assert.throws(() => agreementDraft('2026-11-01', '2026-11-01', 'Alex'));
  assert.throws(() => agreementDraft('2026-11-01', '2026-11-02', ' '));
  assert.throws(() => agreementDraft('11/01/2026', '2026-11-02', 'Alex'));
});
