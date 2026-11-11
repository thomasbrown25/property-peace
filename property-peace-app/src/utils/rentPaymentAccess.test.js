import test from 'node:test';
import assert from 'node:assert/strict';
import { getRentPaymentAccessPresentation, loadRentPaymentAccessState } from './rentPaymentAccess.js';

const configure = { allowed: true, providerEnabled: true };
const pay = { allowed: true, providerEnabled: true, connectedPayeeExists: true };
const blocked = { allowed: false, providerEnabled: true, connectedPayeeExists: true };

test('loads readiness without querying or requiring organization approval', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const result = await loadRentPaymentAccessState({
    signal,
    loadAccess: () => { throw new Error('obsolete endpoint must not be called'); },
    loadFeatureReadiness: async (received) => { assert.equal(received, signal); calls.push('feature'); return { data: [{ feature: 'OnlineRentCollection' }] }; },
    loadActionReadiness: async (action, received) => { assert.equal(received, signal); calls.push(action); return { data: action === 'Configure' ? configure : pay }; },
    selectFeatureReadiness: (items) => items[0]
  });
  assert.deepEqual(calls, ['feature', 'Configure', 'Pay']);
  assert.deepEqual(result.configureReadiness, configure);
  assert.deepEqual(result.payReadiness, pay);
  assert.equal('access' in result, false);
});

test('legacy organization request statuses do not control setup or payment readiness', () => {
  for (const status of [undefined, 'NotRequested', 'Pending', 'Rejected', 'Suspended', 'Approved']) {
    const result = getRentPaymentAccessPresentation({ access: { status }, configureReadiness: configure, payReadiness: pay });
    assert.equal(result.status, 'ready');
    assert.equal(result.canPay, true);
    assert.equal(result.canConfigure, true);
    assert.doesNotMatch(JSON.stringify(result), /approv|review|request/i);
  }
});

test('missing recipient offers Stripe onboarding only when Configure is authorized', () => {
  const result = getRentPaymentAccessPresentation({ configureReadiness: configure, payReadiness: { ...blocked, connectedPayeeExists: false } });
  assert.equal(result.status, 'onboarding');
  assert.equal(result.actionLabel, 'Set up online payments');
  assert.equal(result.canConfigure, true);
  assert.equal(result.canPay, false);
});

test('existing incomplete Stripe account offers setup, not internal review', () => {
  const result = getRentPaymentAccessPresentation({ configureReadiness: configure, payReadiness: blocked });
  assert.equal(result.status, 'setup-required');
  assert.match(result.message, /Stripe.*verification/);
  assert.equal(result.canPay, false);
});

test('provider rollout blocks collection but can independently permit pre-onboarding', () => {
  const providerBlocked = { allowed: false, providerEnabled: false, blockers: ['provider_disabled'] };
  const unavailable = getRentPaymentAccessPresentation({ aggregateReadiness: { globalGateEnabled: false }, configureReadiness: providerBlocked, payReadiness: providerBlocked });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.canConfigure, false);
  assert.equal(unavailable.canPay, false);
  const onboarding = getRentPaymentAccessPresentation({ aggregateReadiness: { globalGateEnabled: false }, configureReadiness: configure, payReadiness: providerBlocked });
  assert.equal(onboarding.canConfigure, true);
  assert.equal(onboarding.canPay, false);
});

test('unknown, denied and failed readiness never enable actions', () => {
  for (const input of [{}, { configureReadiness: blocked, payReadiness: blocked }, { error: 'failed', configureReadiness: configure, payReadiness: pay }, { readinessError: 'failed', configureReadiness: configure, payReadiness: pay }]) {
    const result = getRentPaymentAccessPresentation(input);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.canConfigure, false);
    assert.equal(result.canPay, false);
  }
});

test('partial readiness failures remain visible and aborts propagate', async () => {
  const options = {
    loadFeatureReadiness: async () => { throw new Error('feature failed'); },
    loadActionReadiness: async () => ({ data: configure }),
    selectFeatureReadiness: (items) => items[0]
  };
  const result = await loadRentPaymentAccessState(options);
  assert.equal(result.readinessError, 'feature failed');
  assert.equal(result.configureReadiness.allowed, true);
  await assert.rejects(loadRentPaymentAccessState({ ...options, loadFeatureReadiness: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); } }), { name: 'AbortError' });
});
