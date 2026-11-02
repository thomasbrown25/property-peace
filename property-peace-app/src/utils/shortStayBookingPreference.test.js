import test from 'node:test';
import assert from 'node:assert/strict';
import { listingPayload } from './shortStaySetup.js';
const draft = { nightlyBasePrice: '100', minimumNights: '1', capacity: '2', cleaningFee: '0' };
test('owner booking preference defaults manual, survives saves and rejects invalid values', () => {
  assert.equal(listingPayload(draft).bookingAcceptancePreference, 'RequireOwnerApproval');
  assert.equal(listingPayload({ ...draft, bookingAcceptancePreference: 'AutoConfirmAfterVerifiedPayment' }).bookingAcceptancePreference, 'AutoConfirmAfterVerifiedPayment');
  assert.equal(listingPayload({ ...draft, bookingAcceptancePreference: 'RequireOwnerApproval' }).bookingAcceptancePreference, 'RequireOwnerApproval');
  assert.throws(() => listingPayload({ ...draft, bookingAcceptancePreference: 'AnythingElse' }), /booking acceptance/i);
});
