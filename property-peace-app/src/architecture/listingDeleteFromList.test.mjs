import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../pages/landlord/listings.jsx', import.meta.url), 'utf8');
const action = readFileSync(new URL('../store/listing/listing.action.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../api/listing.js', import.meta.url), 'utf8');

test('the listing row drawer opens deletion confirmation separately from row navigation', () => {
  assert.match(page, /onDelete\(listing\)/);
  assert.match(page, /<Box\s+\{\.\.\.rowTriggerProps\}[\s\S]*?<ActionsDrawer\s+id=\{\x60listing-actions-/);
  assert.match(page, /Delete listing/);
  assert.match(page, /<Dialog open=\{Boolean\(listingToDelete\)\}|<Dialog\s+open=\{Boolean\(listingToDelete\)\}/);
  assert.match(page, /Applications? (?:will remain|will be kept)/);
  assert.match(page, /dispatch\(deleteListing\(getId\(listingToDelete\)\)\)/);
  assert.match(page, /disabled=\{deleting\}/);
});

test('deletion uses the listing-only API and Redux removes only the deleted listing', () => {
  assert.match(api, /axiosServices\.delete\(`\/api\/listing\/\$\{id\}`\)/);
  assert.match(action, /type: LISTING_ACTION_TYPES\.DELETE_LISTING_SUCCESS/);
  const reducer = readFileSync(new URL('../store/listing/listing.reducer.js', import.meta.url), 'utf8');
  assert.match(reducer, /listings: state\.listings\.filter\(listing => listing\.id !== payload\)/);
});
