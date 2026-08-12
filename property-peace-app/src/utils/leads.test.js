import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEAD_STATUSES,
  buildLeadQuery,
  formatZonedDateTime,
  getLeadErrorMessage,
  normalizeInquiryResult,
  toUtcIso,
  toZonedLocalInput
} from './leads.js';

test('buildLeadQuery sends only the lead pipeline contract filters', () => {
  assert.equal(buildLeadQuery({ status: 'qualified', ownerUserId: '12', listingId: 34, followUpFromUtc: '2026-08-06T00:00:00Z', source: 'referral' }),
    '?status=qualified&ownerUserId=12&listingId=34&followUpFromUtc=2026-08-06T00%3A00%3A00Z');
  assert.equal(buildLeadQuery({ status: 'all', ownerUserId: '', listingId: 0 }), '');
  assert.deepEqual(LEAD_STATUSES, ['new', 'contacted', 'qualified', 'showingScheduled', 'applied', 'lost']);
});

test('formats UTC instants in an explicit timezone and never relabels local input as UTC', () => {
  assert.equal(formatZonedDateTime('2026-11-01T05:30:00Z', 'America/New_York', 'en-US'), 'Nov 1, 2026, 1:30 AM EDT');
  assert.equal(formatZonedDateTime('not-a-date', 'UTC'), 'Not set');
  assert.match(toUtcIso('2026-08-06T12:30', 'America/New_York'), /^2026-08-06T16:30:00\.000Z$/);
  assert.equal(toUtcIso('2026-03-08T02:30', 'America/New_York'), null, 'spring-forward gap is nonexistent');
  assert.equal(toUtcIso('2026-11-01T01:30', 'America/New_York'), null, 'fall-back overlap is ambiguous');
  assert.equal(toZonedLocalInput('2026-08-06T16:30:00Z', 'America/New_York'), '2026-08-06T12:30');
});

test('normalizes inquiry receipts without exposing token-shaped response fields', () => {
  assert.deepEqual(normalizeInquiryResult({ receipt: 'receipt-42', verificationStatus: 'pending', token: 'secret', accessToken: 'secret-2' }), {
    receipt: 'receipt-42', verificationStatus: 'pending'
  });
  assert.equal(normalizeInquiryResult({ token: 'secret' }), null);
});

test('maps authorization, missing, conflict, and generic failures to honest messages', () => {
  assert.match(getLeadErrorMessage({ status: 401 }), /sign in/i);
  assert.match(getLeadErrorMessage({ status: 403 }), /permission/i);
  assert.match(getLeadErrorMessage({ status: 404 }), /not found/i);
  assert.match(getLeadErrorMessage({ status: 412 }), /changed/i);
  assert.doesNotMatch(getLeadErrorMessage({ title: 'email sent successfully' }), /sent successfully/i);
});
