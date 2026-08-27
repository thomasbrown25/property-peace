import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ACTIVATION_STEP_KEYS,
  activationModeFromInput,
  projectActivationEnhancements,
  projectActivationLifecycle
} from './activationLifecycle.js';
import { readActivationModePreference, writeActivationModePreference } from './activationModePreference.js';
import { activationResponseForOrganization, validOrganizationId } from './activationOrganization.js';

const step = (key, status = 'incomplete', overrides = {}) => ({
  key,
  status,
  complete: status === 'complete',
  actionable: status === 'incomplete',
  ownerActionRequired: false,
  evidence: {},
  ...overrides
});

const payload = (overrides = {}) => ({
  organizationId: 7,
  role: 'Owner',
  evaluatedAt: '2026-08-09T20:00:00Z',
  progress: { completed: 2, total: 8 },
  context: { propertyId: null, unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null },
  steps: ACTIVATION_STEP_KEYS.map((key, index) => step(key, index < 2 ? 'complete' : 'incomplete')),
  ...overrides
});

test('adapter is a GET-only exact activation endpoint and unwraps the standard envelope', async () => {
  const source = await readFile(new URL('../api/activation.js', import.meta.url), 'utf8');
  assert.match(source, /axiosServices\.get\(['"]\/api\/activation['"],\s*\{[\s\S]*signal[\s\S]*['"]X-Organization-ID['"]:\s*organizationId/);
  assert.match(source, /response\?\.data\?\.data\s*\?\?\s*response\?\.data/);
  assert.doesNotMatch(source, /\.post\(|\.put\(|\.delete\(/);
});

test('organization binding accepts only a captured positive integer and exact response match', () => {
  assert.equal(validOrganizationId(7), true);
  for (const id of [null, undefined, 0, -1, 1.5, '7', Number.MAX_SAFE_INTEGER + 1]) assert.equal(validOrganizationId(id), false);
  assert.equal(activationResponseForOrganization(payload(), 7)?.organizationId, 7);
  assert.equal(activationResponseForOrganization({ ...payload(), organizationId: 8 }, 7), null);
  assert.equal(activationResponseForOrganization(payload(), null), null);
});

test('exact camelCase wire payload projects ordered truthful completion and progress', () => {
  const view = projectActivationLifecycle(payload());
  assert.equal(view.available, true);
  assert.equal(view.organizationId, 7);
  assert.equal(view.progress.completed, 2);
  assert.equal(view.progress.total, 8);
  assert.equal(view.progressLabel, '2 of 8 core steps complete');
  assert.deepEqual(view.steps.map((item) => item.key), ACTIVATION_STEP_KEYS);
  assert.equal(view.steps[0].isComplete, true);
  assert.equal(view.steps[2].isComplete, false);
  assert.equal(view.nextRequiredStep.key, 'property-unit');
  assert.equal(view.nextRequiredStep.link.route, '/landlord/properties/add');
});

test('missing, errored, malformed, PascalCase, contradictory, and out-of-order payloads fail closed', () => {
  const cases = [
    undefined,
    { error: new Error('offline') },
    { ...payload(), steps: undefined },
    { ...payload(), OrganizationId: 7, organizationId: undefined },
    { ...payload(), progress: { completed: 99, total: 8 } },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'complete', complete: false } : item) },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'unavailable', complete: false, actionable: false } : item) },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'incomplete', complete: false, actionable: false } : item) },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'blocked', complete: false, actionable: true, ownerActionRequired: true } : item) },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'waiting', complete: true, actionable: false, ownerActionRequired: true } : item), progress: { completed: 3, total: 8 } },
    { ...payload(), steps: [...payload().steps].reverse() },
    { ...payload(), steps: payload().steps.map((item) => item.key === 'lease' ? { ...item, status: 'done' } : item) },
    { ...payload(), context: undefined },
    { ...payload(), context: [] },
    { ...payload(), context: { propertyId: 1, unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null, path: '/admin' } },
    { ...payload(), context: { propertyId: '1', unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null } },
    { ...payload(), context: { propertyId: 0, unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null } },
    { ...payload(), context: { propertyId: Number.MAX_SAFE_INTEGER + 1, unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null } }
  ];
  for (const input of cases) {
    const view = projectActivationLifecycle(input);
    assert.equal(view.available, false);
    assert.equal(view.progress.completed, 0);
    assert.equal(view.steps.some((item) => item.isComplete), false);
    assert.equal(view.nextRequiredStep, null);
  }
});

test('evidence accepts only plain boolean dictionaries with known non-sensitive keys', () => {
  const accepted = projectActivationLifecycle(payload({
    steps: payload().steps.map((item) => ({
      ...item,
      evidence: item.key === 'property-unit' ? { hasProperty: true, hasUnit: false } : {}
    }))
  }));
  assert.equal(accepted.available, true);
  assert.deepEqual(accepted.steps[2].evidence, { hasProperty: true, hasUnit: false });

  class EvidenceRecord {
    constructor() {
      this.hasProperty = true;
    }
  }
  const malformedEvidence = [
    null,
    'hasProperty',
    ['hasProperty'],
    new EvidenceRecord(),
    { hasProperty: 1 },
    { hasProperty: 'true' },
    { hasProperty: null },
    { unknownEvidence: true },
    { path: true },
    { route: false },
    { token: true },
    { email: true },
    { amount: true },
    { content: true },
    { stripeAccountId: true },
    { stripePaymentIntentId: true }
  ];

  for (const evidence of malformedEvidence) {
    const input = payload({
      steps: payload().steps.map((item, index) => index === 0 ? { ...item, evidence } : item)
    });
    assert.equal(projectActivationLifecycle(input).available, false, `accepted evidence: ${JSON.stringify(evidence)}`);
  }
});

test('production context deep links use only validated server IDs, never caller IDs', () => {
  const scopedPayload = payload({
    progress: { completed: 4, total: 8 },
    steps: ACTIVATION_STEP_KEYS.map((key, index) => step(key, index < 4 ? 'complete' : 'incomplete', {
      evidence: { hasLease: key === 'lease' }
    }))
  });
  const scoped = projectActivationLifecycle({
    ...scopedPayload,
    context: { propertyId: 12, unitId: 34, listingId: null, applicationId: null, leaseId: 56, tenantId: 78 }
  });
  assert.equal(scoped.nextRequiredStep.key, 'lease');
  assert.equal(scoped.nextRequiredStep.link.route, '/landlord/leases/56/builder');

  const ignoredCallerIds = projectActivationLifecycle(scopedPayload, { context: { propertyId: 12, leaseId: 56 } });
  assert.equal(ignoredCallerIds.nextRequiredStep.link.route, '/landlord/leases/selection');
});

test('vacant, occupied, and import modes change priority and copy but never completion', () => {
  const base = payload({
    progress: { completed: 3, total: 8 },
    steps: ACTIVATION_STEP_KEYS.map((key, index) => step(key, index < 3 ? 'complete' : 'incomplete'))
  });
  const vacant = projectActivationLifecycle(base, { mode: 'vacant' });
  assert.equal(vacant.nextRequiredStep.key, 'listing-application');

  const occupiedSteps = ACTIVATION_STEP_KEYS.map((key, index) =>
    key === 'listing-application' ? step(key, 'notApplicable', { complete: true, actionable: false }) : step(key, index < 3 ? 'complete' : 'incomplete'));
  const occupiedPayload = payload({ progress: { completed: 4, total: 8 }, steps: occupiedSteps });
  const occupied = projectActivationLifecycle(occupiedPayload, { mode: 'occupied' });
  assert.equal(occupied.nextRequiredStep.key, 'lease');
  assert.equal(occupied.steps.find((item) => item.key === 'listing-application').statusLabel, 'Not applicable');
  assert.equal(occupied.steps.find((item) => item.key === 'listing-application').isComplete, false);
  assert.equal(occupied.steps.find((item) => item.key === 'listing-application').satisfiesCore, true);

  const importing = projectActivationLifecycle(base, { mode: 'import' });
  assert.match(importing.modeDescription, /properties and basic units only/i);
  assert.match(importing.modeDescription, /leases, tenants, rent, and communications/i);
  assert.equal(importing.progress.completed, vacant.progress.completed);
  assert.equal(activationModeFromInput(new URLSearchParams('mode=occupied')), 'occupied');
  assert.equal(activationModeFromInput({ mode: 'javascript:alert(1)' }), 'vacant');
});

test('role projection is read-only for Viewer and preserves owner-only blockers for Manager', () => {
  const ownerBlock = payload({ steps: ACTIVATION_STEP_KEYS.map((key, index) => step(
    key,
    key === 'property-unit' ? 'blocked' : index < 2 ? 'complete' : 'incomplete',
    {
      actionable: key === 'property-unit' ? false : index >= 2,
      ownerActionRequired: key === 'property-unit'
    }
  )) });
  const viewer = projectActivationLifecycle({ ...ownerBlock, role: 'Viewer' });
  assert.equal(viewer.readOnly, true);
  assert.equal(viewer.nextRequiredStep, null);
  assert.equal(viewer.progressPressure, false);
  assert.ok(viewer.steps.every((item) => item.link === null));

  const manager = projectActivationLifecycle({ ...ownerBlock, role: 'Manager' });
  assert.equal(manager.waitingForOwner, true);
  assert.equal(manager.nextRequiredStep.label, 'Waiting for an Owner');
  assert.equal(manager.nextRequiredStep.link, null);

  const owner = projectActivationLifecycle(payload());
  assert.equal(owner.waitingForOwner, false);
  assert.equal(owner.nextRequiredStep.key, 'property-unit');
  assert.ok(owner.nextRequiredStep.link);
});

test('real production routes resume listing, application, unit, lease, tenant, rent, and message scopes', () => {
  const routesFor = (context, mode = 'vacant') => Object.fromEntries(
    projectActivationLifecycle(payload({ context }), { mode }).steps.map((item) => [item.key, item.link?.route])
  );
  const context = { propertyId: 12, unitId: 34, listingId: 45, applicationId: 46, leaseId: 56, tenantId: 78 };
  const scoped = routesFor(context);
  assert.equal(scoped['property-unit'], '/landlord/property/12/add-units');
  assert.equal(scoped['listing-application'], '/landlord/listings/45/setup');
  assert.equal(scoped.lease, '/landlord/leases/56/builder');
  assert.equal(scoped['tenant-invite'], '/landlord/leases/56/add-tenant?tenantId=78');
  assert.equal(scoped['rent-readiness'], '/landlord/leases/56');
  assert.equal(scoped.communication, '/landlord/messages');

  const noLease = routesFor({ ...context, listingId: null, leaseId: null });
  assert.equal(noLease['listing-application'], '/landlord/listings?tab=applications&applicationId=46');
  assert.equal(noLease['tenant-invite'], '/landlord/renters/78');
  assert.equal(noLease['rent-readiness'], '/landlord/leases');
  assert.equal(routesFor({ ...context, unitId: null }, 'import')['property-unit'], '/landlord/property/12/add-units/import');

  const empty = { propertyId: null, unitId: null, listingId: null, applicationId: null, leaseId: null, tenantId: null };
  assert.equal(routesFor(empty)['rent-readiness'], '/landlord/leases');
  assert.notEqual(routesFor(empty)['rent-readiness'], '/landlord/settings?tab=payments');
});

test('explicit clean, vacant, occupied, import, accepted invited Manager, and Viewer scenarios project safely', () => {
  const clean = projectActivationLifecycle(payload({ progress: { completed: 0, total: 8 }, steps: ACTIVATION_STEP_KEYS.map((key) => step(key)) }));
  assert.equal(clean.nextRequiredStep.key, 'account');
  assert.equal(clean.progress.completed, 0);

  const vacant = projectActivationLifecycle(payload(), { mode: 'vacant' });
  const occupied = projectActivationLifecycle(payload(), { mode: 'occupied' });
  const importing = projectActivationLifecycle(payload(), { mode: 'import' });
  assert.equal(vacant.mode, 'vacant');
  assert.equal(occupied.mode, 'occupied');
  assert.equal(importing.mode, 'import');
  assert.deepEqual(importing.progress, vacant.progress);

  const acceptedInviteSteps = ACTIVATION_STEP_KEYS.map((key, index) => step(key, index < 6 ? 'complete' : 'incomplete', {
    evidence: key === 'tenant-invite' ? { inviteSent: true, inviteAccepted: true } : {}
  }));
  const manager = projectActivationLifecycle(payload({ role: 'Manager', progress: { completed: 6, total: 8 }, steps: acceptedInviteSteps }));
  assert.equal(manager.steps.find((item) => item.key === 'tenant-invite').isComplete, true);
  assert.equal(manager.nextRequiredStep.key, 'rent-readiness');
  const viewer = projectActivationLifecycle(payload({ role: 'Viewer', progress: { completed: 6, total: 8 }, steps: acceptedInviteSteps }));
  assert.equal(viewer.readOnly, true);
  assert.equal(viewer.nextRequiredStep, null);
});

test('versioned mode preference is per organization, validated, and storage-failure safe', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readActivationModePreference(storage, 7), 'vacant');
  assert.equal(writeActivationModePreference(storage, 7, 'occupied'), true);
  assert.equal(writeActivationModePreference(storage, 8, 'import'), true);
  assert.equal(readActivationModePreference(storage, 7), 'occupied');
  assert.equal(readActivationModePreference(storage, 8), 'import');
  assert.equal(writeActivationModePreference(storage, 7, 'javascript:alert(1)'), false);
  values.set('propertyPeace.activationMode.v1.organization.7', JSON.stringify({ version: 2, mode: 'import' }));
  assert.equal(readActivationModePreference(storage, 7), 'vacant');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.equal(readActivationModePreference(broken, 7), 'vacant');
  assert.equal(writeActivationModePreference(broken, 7, 'vacant'), false);
});

test('enhancements are separate and dedicated SMS is shown only from explicit truthful readiness', () => {
  const view = projectActivationLifecycle({ ...payload(), planLabel: 'Premium', cancelAtPeriodEnd: false }, {
    enhancements: { dedicatedSms: { ready: true, phoneNumber: '+15551234567' } }
  });
  assert.equal(view.progress.total, 8);
  assert.deepEqual(view.enhancements, [{ key: 'dedicated-sms', label: 'Dedicated SMS', ready: true, detail: '+15551234567', blocking: false }]);
  assert.deepEqual(projectActivationEnhancements({ planLabel: 'Premium', cancelAtPeriodEnd: false }), []);
  assert.deepEqual(projectActivationEnhancements({ dedicatedSms: { ready: false } }), []);
});

test('billing-authorized payment readiness is optional, truthful, and never changes core progress', () => {
  const withPayment = (paymentSetupCompleted, currentlyReady) => payload({
    steps: payload().steps.map((item) => item.key === 'rent-readiness'
      ? { ...item, evidence: { rentScheduleConfigured: false, manualTrackingConfigured: false, paymentSetupCompleted, currentlyReady } }
      : item)
  });

  const notReady = projectActivationLifecycle(withPayment(true, false));
  assert.equal(notReady.progress.completed, 2);
  assert.deepEqual(notReady.enhancements[0], {
    key: 'online-payments',
    label: 'Online payments',
    ready: false,
    detail: 'Connected, but not currently ready. Keep tracking rent manually.',
    blocking: false
  });

  const ready = projectActivationLifecycle(withPayment(true, true));
  assert.equal(ready.enhancements[0].ready, true);
  const hidden = projectActivationLifecycle(payload());
  assert.equal(hidden.enhancements.some((item) => item.key === 'online-payments'), false);
});

test('tutorial and dismissal flags cannot alter core truth', () => {
  const original = projectActivationLifecycle(payload());
  const decorated = projectActivationLifecycle({ ...payload(), tutorialComplete: true, dismissed: true }, {
    tutorialComplete: true, dismissed: true
  });
  assert.deepEqual(decorated.steps.map((item) => item.isComplete), original.steps.map((item) => item.isComplete));
  assert.deepEqual(decorated.progress, original.progress);
});
