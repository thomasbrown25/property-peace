import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMinorAmount,
  getPayerLabel,
  getSafeNavigationUrl,
  navigateTopLevel,
  normalizeOptions,
  screeningErrorState,
  exchangeMetadata
} from './screening.js';

test('authoritative quote options preserve server policy and derive all payer presentations', () => {
  const options = normalizeOptions({
    options: [
      { packageCode: 'essential', payer: 1, rentalCriteriaVersion: 'criteria-7', landlordAmountMinor: 4500, applicantAmountMinor: 0 },
      { packageCode: 'essential', payer: 2, rentalCriteriaVersion: 'criteria-7', landlordAmountMinor: 0, applicantAmountMinor: 4500 },
      { packageCode: 'essential', payer: 2, rentalCriteriaVersion: 'criteria-7', landlordAmountMinor: 1500, applicantAmountMinor: 3000 }
    ]
  });
  assert.equal(options.length, 3);
  assert.deepEqual(options.map(getPayerLabel), ['Landlord pays', 'Applicant pays', 'Split payment']);
  assert.equal(options[0].rentalCriteriaVersion, 'criteria-7');
});

test('money is formatted from server minor units without invented defaults', () => {
  assert.equal(formatMinorAmount(4599, 'USD'), '$45.99');
  assert.equal(formatMinorAmount(undefined, 'USD'), 'Provided after order creation');
});

test('navigation exchange allows only short-lived HTTPS URLs from no-store same-origin JSON', () => {
  const now = new Date('2026-08-07T12:00:00.000Z');
  const metadata = {
    now,
    pageOrigin: 'https://app.propertypeace.com',
    responseUrl: 'https://app.propertypeace.com/api/screenings/applicant/report-access',
    contentType: 'application/json; charset=utf-8',
    cacheControl: 'private, no-store'
  };
  assert.equal(
    getSafeNavigationUrl({ accessUrl: 'https://reports.example.test/review', expiresAt: '2026-08-07T12:05:00Z' }, metadata),
    'https://reports.example.test/review'
  );
  assert.throws(
    () => getSafeNavigationUrl({ accessUrl: 'http://reports.example.test/review', expiresAt: '2026-08-07T12:05:00Z' }, metadata),
    /HTTPS/
  );
  assert.throws(
    () => getSafeNavigationUrl({ accessUrl: 'https://reports.example.test/review', expiresAt: '2026-08-07T12:20:00Z' }, metadata),
    /short-lived/
  );
  assert.throws(
    () =>
      getSafeNavigationUrl(
        { accessUrl: 'https://reports.example.test/review', expiresAt: '2026-08-07T12:05:00Z' },
        { ...metadata, cacheControl: 'private' }
      ),
    /no-store/
  );
  assert.throws(
    () =>
      getSafeNavigationUrl(
        { accessUrl: 'https://reports.example.test/review', expiresAt: '2026-08-07T12:05:00Z' },
        { ...metadata, responseUrl: 'https://api.example.test/exchange' }
      ),
    /same-origin/
  );
});

test('validated exchanges navigate the top-level browsing context', () => {
  let assigned = '';
  const browsingContext = {
    top: {
      location: {
        assign: (url) => {
          assigned = url;
        }
      }
    }
  };
  navigateTopLevel('https://reports.example.test/review', browsingContext);
  assert.equal(assigned, 'https://reports.example.test/review');
});

test('exchange metadata supports authenticated axios responses without weakening validation', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://app.propertypeace.com' } };
  try {
    assert.deepEqual(
      exchangeMetadata({
        config: { url: '/api/screenings/22/report-access' },
        request: { responseURL: 'https://app.propertypeace.com/api/screenings/22/report-access' },
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
      }),
      {
        pageOrigin: 'https://app.propertypeace.com',
        responseUrl: 'https://app.propertypeace.com/api/screenings/22/report-access',
        contentType: 'application/json',
        cacheControl: 'no-store'
      }
    );
  } finally {
    globalThis.window = originalWindow;
  }
});

test('expired and revoked applicant responses map to a terminal access state', () => {
  assert.deepEqual(screeningErrorState(410), { kind: 'expired', title: 'This screening link is no longer active' });
  assert.deepEqual(screeningErrorState(403), { kind: 'denied', title: 'Screening access was denied' });
  assert.deepEqual(screeningErrorState(503), { kind: 'unavailable', title: 'Screening is temporarily unavailable' });
});
