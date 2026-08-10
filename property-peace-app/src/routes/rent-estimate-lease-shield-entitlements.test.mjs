import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('RentEstimateCard fails closed through the centralized entitlement hook', () => {
  const source = read('../components/RentEstimateCard.jsx');
  assert.match(source, /useEntitlement\(RENT_ESTIMATE_FEATURE\)/);
  assert.doesNotMatch(source, /isPremium|cancelAtPeriodEnd|planName/);
  for (const state of ['loading', 'upgrade', 'setup', 'unavailable', 'unauthorized']) assert.match(source, new RegExp(`['\"]${state}['\"]`));
});

test('LeaseShield uses centralized read and manage decisions and no plan-name authorization', () => {
  const source = read('../pages/landlord/lease-shield.jsx');
  assert.match(source, /useEntitlement\(LEASE_SHIELD_READ_FEATURE\)/);
  assert.match(source, /useEntitlement\(LEASE_SHIELD_MANAGE_FEATURE\)/);
  assert.doesNotMatch(source, /isPremium|cancelAtPeriodEnd|planName|useSubscription/);
  for (const state of ['loading', 'upgrade', 'setup', 'unavailable', 'unauthorized']) assert.match(source, new RegExp(`['\"]${state}['\"]`));
});