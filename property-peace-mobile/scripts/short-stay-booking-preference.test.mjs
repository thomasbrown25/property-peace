import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyListing, listingPayload } from '../src/features/properties/shortStayOwner.ts';
test('mobile owner preference defaults manual, round trips and rejects invalid options', () => {
  const base = { ...emptyListing(), nightlyBasePrice: '100' };
  assert.equal(listingPayload(base).bookingAcceptancePreference, 'RequireOwnerApproval');
  assert.equal(listingPayload({ ...base, bookingAcceptancePreference: 'AutoConfirmAfterVerifiedPayment' }).bookingAcceptancePreference, 'AutoConfirmAfterVerifiedPayment');
  assert.equal(listingPayload({ ...base, bookingAcceptancePreference: 'Other' }), null);
  const screen = readFileSync(new URL('../src/screens/landlord/ShortStayOwnerScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /AutoConfirmAfterVerifiedPayment/);
  assert.match(screen, /RequireOwnerApproval/);
});
