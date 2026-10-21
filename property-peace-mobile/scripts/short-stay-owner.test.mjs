import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyListing, parseLodgingTaxRate, parseLocalDate, validLocalRange, parseMoney, listingPayload, ratePayload, airbnbTimestamp, isOwnerBlock } from '../src/features/properties/shortStayOwner.ts';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('local calendar dates are strict and ranges use exclusive checkout', () => {
  assert.equal(parseLocalDate('2026-02-28'), '2026-02-28');
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z', '']) assert.equal(parseLocalDate(date), null);
  assert.equal(validLocalRange('2026-12-31', '2027-01-01'), true);
  assert.equal(validLocalRange('2026-01-01', '2026-01-01'), false);
  assert.equal(validLocalRange('2026-01-02', '2026-01-01'), false);
  assert.equal(validLocalRange('2026-01-01', '2027-01-03'), false);
});
test('draft and rate payloads reject invalid values and use backend contract names', () => {
  assert.equal(parseMoney('1.23'), 1.23);
  for (const value of ['1.234', '-1', '0', 'NaN', '']) assert.equal(parseMoney(value), null);
  assert.deepEqual(ratePayload('42.50'), { nightlyRate: 42.5 });
  assert.equal(ratePayload('0'), null);
  const draft = { ...emptyListing(), nightlyBasePrice: '115.00', minimumNights: '2', capacity: '3', cleaningFee: '0', checkInTime: '15:00', checkOutTime: '11:00', amenities: 'Wifi' };
  assert.deepEqual(listingPayload(draft), { nightlyBasePrice: 115, minimumNights: 2, capacity: 3, cleaningFee: 0, checkInTime: '15:00', checkOutTime: '11:00', houseRules: null, amenities: 'Wifi', cancellationPolicy: null, publicTitle: '', publicSummary: '', lodgingTaxRatePercent: null, attestLodgingTaxResponsibility: false });
  assert.equal(listingPayload({ ...draft, capacity: '0' }), null);
  assert.equal(listingPayload({ ...draft, cleaningFee: '0.001' }), null);
  assert.equal(listingPayload({ ...draft, checkInTime: '25:00' }), null);
});
test('lodging tax stays null until intentionally configured; zero needs attestation', () => {
  const draft = { ...emptyListing(), nightlyBasePrice: '100' };
  assert.equal(parseLodgingTaxRate(''), null);
  assert.equal(listingPayload(draft).lodgingTaxRatePercent, null);
  assert.equal(listingPayload({ ...draft, lodgingTaxRatePercent: '0' }), null);
  assert.equal(listingPayload({ ...draft, attestLodgingTaxResponsibility: true }), null);
  for (const invalid of ['-1', '100.0001', '1.23456', '1e2', 'NaN', '01', '0.']) {
    assert.equal(parseLodgingTaxRate(invalid), undefined);
    assert.equal(listingPayload({ ...draft, lodgingTaxRatePercent: invalid, attestLodgingTaxResponsibility: true }), null);
  }
  assert.deepEqual([0, 7.125, 100].map(rate => listingPayload({ ...draft, lodgingTaxRatePercent: String(rate), attestLodgingTaxResponsibility: true }).lodgingTaxRatePercent), [0, 7.125, 100]);
});
test('guest copy survives unrelated mobile saves and validates lengths', () => {
  const draft = { ...emptyListing(), nightlyBasePrice: '100', publicTitle: 'Garden studio', publicSummary: 'Walk to the park.' };
  assert.equal(listingPayload(draft).publicTitle, 'Garden studio');
  assert.equal(listingPayload({ ...draft, cleaningFee: '30' }).publicSummary, draft.publicSummary);
  assert.equal(listingPayload({ ...draft, publicTitle: 'x'.repeat(101) }), null);
  assert.equal(listingPayload({ ...draft, publicSummary: 'y'.repeat(1201) }), null);
  const screen = source('../src/screens/landlord/ShortStayOwnerScreen.tsx');
  assert.match(screen, /Publicly visible to guests/);
  assert.match(screen, /private addresses/);
});

test('Airbnb timestamps use the property IANA zone and only API OwnerBlock entries are removable', () => {
  assert.match(airbnbTimestamp('2026-12-01T02:30:00Z', 'America/New_York'), /Nov 30, 2026.*9:30 PM/);
  assert.equal(airbnbTimestamp(null, 'UTC'), 'Never');
  assert.equal(isOwnerBlock({ id: -1, source: 'Airbnb' }), false);
  assert.equal(isOwnerBlock({ id: 7, source: 'OwnerBlock' }), true);
  assert.equal(isOwnerBlock({ id: -7, source: 'OwnerBlock' }), false);
  assert.equal(isOwnerBlock({ id: 7, source: 'Owner' }), false);
  assert.equal(isOwnerBlock({ id: 7, source: 'Airbnb' }), false);
});

test('inventory report API uses authenticated no-store GET with a bounded local range', () => {
  const api = source('../src/api/shortStayAPI.ts');
  assert.match(api, /apiClient\.get<ApiResponse<ShortStayInventoryReport>>\(`\$\{unitPath\(unitId\)\}\/inventory-report`, \{ params: \{ start, end \}, headers: \{ 'Cache-Control': 'no-store' \} \}\)/);
  assert.match(api, /86400000 > 90/);
  assert.match(api, /if \(!response\?\.success\) throw/);
});

test('owner screen is separate from monthly listings and uses authenticated API', () => {
  const detail = source('../src/screens/landlord/PropertyDetailScreen.tsx');
  const screen = source('../src/screens/landlord/ShortStayOwnerScreen.tsx');
  const nav = source('../src/navigation/MainNavigator.tsx');
  const api = source('../src/api/shortStayAPI.ts');
  assert.match(detail, /unitRentalMode\(unit\) === 'ShortTerm'/);
  assert.match(detail, /navigate\('ShortStayOwner'/);
  assert.match(nav, /PropertiesStack.Screen name="ShortStayOwner"/);
  assert.match(screen, /Owner setup only\. Guests cannot book yet\./);
  assert.match(screen, /deleteBlock/);
  assert.match(screen, /deleteRate/);
  assert.match(api, /import apiClient/);
  assert.doesNotMatch(api, /fetch\(/);
  assert.match(api, /nightlyBasePrice/);
});
test('Airbnb owner API uses authenticated client and only sends URL in connect body', () => {
  const api = source('../src/api/shortStayAPI.ts');
  assert.match(api, /apiClient\.get<ApiResponse<AirbnbCalendarStatus>>\(`\$\{unitPath\(unitId\)\}\/airbnb-calendar`\)/);
  assert.match(api, /apiClient\.put<ApiResponse<AirbnbCalendarStatus>>\(`\$\{unitPath\(unitId\)\}\/airbnb-calendar`, \{ url \}\)/);
  assert.match(api, /apiClient\.post<ApiResponse<AirbnbCalendarStatus>>\(`\$\{unitPath\(unitId\)\}\/airbnb-calendar\/refresh`\)/);
  assert.match(api, /apiClient\.delete<ApiResponse<AirbnbCalendarStatus>>\(`\$\{unitPath\(unitId\)\}\/airbnb-calendar`\)/);
});
test('owner short-stay endpoints use the authenticated API', () => {
  const api = source('../src/api/shortStayAPI.ts');
  assert.match(api, /api\/short-stay\/properties\/\$\{encodeURIComponent\(id\)\}\/timezone/);
  assert.match(api, /api\/short-stay\/units\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(api, /getListing\(unitId/);
  assert.match(api, /putListing\(unitId/);
  assert.match(api, /params: \{ start, end \}/);
  assert.match(api, /calendar\/blocks/);
  assert.match(api, /calendar\/rates\/\$\{date\}/);
  assert.match(api, /if \(!response\?\.success\)/);
  assert.match(api, /validLocalRange\(startDate, endDate\)/);
  assert.match(api, /parseLocalDate\(date\)/);
});
