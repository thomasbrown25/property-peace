import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  availableMaintenanceActions, buildCreateMaintenancePayload, classifySignals, emergencyInstructions,
  createEvidenceUploadEntries, currentCycleTroubleshootingSteps, evidenceSelection, uploadPendingEvidence,
  maintenanceActorForRoute, maintenanceActorFromUser, maintenanceUserId, normalizeWorkflowToken, safeTroubleshootingStep, slaState, statusLabel,
  tenantEvidencePurpose, workflowActivitiesFromMaintenanceDetail, workflowFromMaintenanceDetail, workflowProjectionWarning
} from './maintenanceWorkflow.js';

test('status contract normalizes numeric-style API names without collapsing workflow states', () => {
  assert.equal(normalizeWorkflowToken('Awaiting_Approval'), 'awaitingapproval');
  assert.equal(statusLabel('InProgress'), 'In progress');
  assert.equal(statusLabel('AwaitingTenant'), 'Awaiting tenant');
});

test('deterministic emergency rules are independent of AI and take precedence', () => {
  assert.equal(classifySignals(['NoRunningWater']), 'Urgent');
  assert.equal(classifySignals(['NoRunningWater', 'GasOdor']), 'Emergency');
  assert.equal(classifySignals([]), 'Routine');
  assert.match(emergencyInstructions(['ElectricalSparking']).body, /911/);
  assert.equal(emergencyInstructions(['OnlyToiletUnusable']), null);
});

test('create payload exactly maps structured intake and bounds preferred windows to three', () => {
  const windows = [1, 2, 3, 4].map((day) => ({ startsAtUtc: `2026-08-1${day}T13:00`, endsAtUtc: `2026-08-1${day}T15:00`, accessInstructions: 'Ring bell' }));
  const payload = buildCreateMaintenancePayload({ propertyId: '12', unitId: '34', category: 'Plumbing', location: 'Kitchen sink', description: 'Water is leaking', signals: ['UncontrolledFlooding', 'UncontrolledFlooding'], files: [{}], preferredWindows: windows, accessPermission: 'contact', hasPets: true, petDetails: 'One dog' });
  assert.deepEqual(Object.keys(payload), ['propertyId', 'unitId', 'title', 'description', 'location', 'signals', 'hasPhotos', 'preferredWindows']);
  assert.equal(payload.propertyId, 12); assert.equal(payload.unitId, 34); assert.equal(payload.preferredWindows.length, 3);
  assert.deepEqual(payload.signals, ['UncontrolledFlooding']); assert.equal(payload.hasPhotos, true);
  assert.match(payload.preferredWindows[0].accessInstructions, /Contact tenant before entry\. Pets: One dog/);
});

test('SLA state reports upcoming, at-risk and overdue deadlines', () => {
  const now = new Date('2026-08-09T12:00:00Z');
  assert.equal(slaState('2026-08-10T12:00:00Z', now).tone, 'success');
  assert.equal(slaState('2026-08-09T14:00:00Z', now).tone, 'warning');
  assert.deepEqual(slaState('2026-08-09T10:00:00Z', now), { tone: 'error', label: '2h overdue', overdue: true, milliseconds: -7200000 });
});

test('action map exposes only API-valid role and state transitions', () => {
  assert.equal(availableMaintenanceActions({ role: 'manager', request: { status: 'Reported' } }).acknowledge, true);
  assert.equal(availableMaintenanceActions({ role: 'tenant', request: { status: 'Reported' } }).acknowledge, false);
  const workflow = { assignment: { estimateRequired: true }, estimate: { id: 2, version: 1, status: 'Submitted' }, workOrder: { id: 3, version: 2, status: 'Issued' }, appointment: { id: 4, version: 1, status: 'Proposed' } };
  const manager = availableMaintenanceActions({ role: 'manager', request: { status: 'AwaitingApproval' }, workflow });
  assert.equal(manager.decideEstimate, true); assert.equal(manager.issueWorkOrder, false); assert.equal(manager.start, true);
  assert.equal(availableMaintenanceActions({ role: 'tenant', request: { status: 'Assigned' }, workflow }).confirmAppointment, true);
});

test('auth actor detection follows the load-user Roles shape and fails closed', () => {
  assert.equal(maintenanceActorFromUser({ Roles: ['Landlord'] }), 'manager');
  assert.equal(maintenanceActorFromUser({ roles: ['Vendor'] }), 'assigned');
  assert.equal(maintenanceActorFromUser({ Roles: [{ roleName: 'Tenant' }] }), 'tenant');
  assert.equal(maintenanceActorFromUser({ role: 'Landlord' }), 'unknown');
  assert.equal(maintenanceUserId({ Id: 42 }), 42);
});

test('canonical plural detail collections select current workflow resources', () => {
  const workflow = workflowFromMaintenanceDetail({
    assignment: { assignedToUserId: 9 },
    estimates: [{ id: 1, version: 1 }, { id: 2, version: 2 }],
    workOrders: [{ id: 3, version: 1, status: 'Cancelled' }, { id: 4, version: 2, status: 'Issued' }],
    appointments: [{ id: 5, version: 1, status: 'Proposed' }],
    completions: [{ id: 6, version: 1, status: 'Submitted' }]
  });
  assert.equal(workflow.estimate.id, 2); assert.equal(workflow.workOrder.id, 4);
  assert.equal(workflow.appointment.id, 5); assert.equal(workflow.completion.id, 6);
  assert.equal(availableMaintenanceActions({ role: 'manager', userId: 9, request: { status: 'Assigned' }, workflow }).submitEstimate, true);
});

test('troubleshooting maps only allowlisted bounded API step codes', () => {
  assert.equal(safeTroubleshootingStep('HVAC'), 'check-thermostat-settings');
  assert.equal(safeTroubleshootingStep('Electrical'), 'check-gfci-reset');
  assert.equal(safeTroubleshootingStep('roof'), null);
});

test('tenant troubleshooting is scoped to the current resolution cycle', () => {
  const request = {
    resolutionCycle: 2,
    troubleshootingSteps: [
      { id: 1, resolutionCycleKey: '1', sequence: 1, outcome: 'Failed' },
      { id: 2, resolutionCycleKey: '2', sequence: 2, outcome: 'Pending' },
      { id: 3, resolutionCycleKey: '1', sequence: 3, outcome: 'Completed' }
    ]
  };
  assert.deepEqual(currentCycleTroubleshootingSteps(request).map((step) => step.id), [2]);
  assert.deepEqual(currentCycleTroubleshootingSteps({ resolutionCycle: 3, troubleshootingSteps: request.troubleshootingSteps }), []);
});

test('all Milestone 8 web mutation requests carry required idempotency keys', async () => {
  const api = await readFile(new URL('../api/maintenanceWorkflow.js', import.meta.url), 'utf8');
  assert.match(api, /'Idempotency-Key'/);
  assert.match(api, /crypto\.randomUUID\(\)/);
});

test('evidence selection enforces the exact API media allowlist, count, and per-kind size limits', () => {
  const file = (name, type, size) => ({ name, type, size });
  const valid = [
    file('photo.jpg', 'image/jpeg', 10 * 1024 * 1024), file('photo.png', 'image/png', 1),
    file('photo.webp', 'image/webp', 1), file('clip.mp4', 'video/mp4', 100 * 1024 * 1024),
    file('clip.mov', 'video/quicktime', 1)
  ];
  assert.deepEqual(evidenceSelection([], valid), { accepted: valid, errors: [] });
  const rejected = evidenceSelection(valid, [
    file('gif.gif', 'image/gif', 1), file('large.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1),
    file('large.mov', 'video/quicktime', 100 * 1024 * 1024 + 1),
    ...Array.from({ length: 6 }, (_, index) => file(`${index}.png`, 'image/png', 1))
  ]);
  assert.deepEqual(rejected.accepted, []);
  assert.match(rejected.errors.join(' '), /JPEG, PNG, WebP, MP4, or QuickTime/);
  assert.match(rejected.errors.join(' '), /10 MB/);
  assert.match(rejected.errors.join(' '), /100 MB/);
  assert.match(rejected.errors.join(' '), /10 files/);
});

test('partial evidence retry retains File objects, skips successful uploads, and reuses failed upload keys', async () => {
  const files = [{ name: 'one.jpg' }, { name: 'two.jpg' }];
  const entries = createEvidenceUploadEntries(files, (() => { let value = 0; return () => `key-${++value}`; })());
  const attempts = [];
  const first = await uploadPendingEvidence(entries, async (file, key) => {
    attempts.push([file.name, key]);
    if (file === files[1]) throw new Error('network response lost');
  });
  assert.equal(first[0].status, 'uploaded'); assert.equal(first[1].status, 'failed');
  assert.equal(first[1].file, files[1]);
  const second = await uploadPendingEvidence(first, async (file, key) => attempts.push([file.name, key]));
  assert.deepEqual(attempts, [['one.jpg', 'key-1'], ['two.jpg', 'key-2'], ['two.jpg', 'key-2']]);
  assert.ok(second.every((entry) => entry.status === 'uploaded'));
});

test('workflow timeline prefers canonical activityEvents and falls back to activities', () => {
  const activities = [{ id: 1, eventType: 'Fallback' }];
  const activityEvents = [{ id: 2, eventType: 'Assigned', occurredAtUtc: '2026-08-09T12:00:00Z' }];
  assert.equal(workflowActivitiesFromMaintenanceDetail({ activities, activityEvents }), activityEvents);
  assert.equal(workflowActivitiesFromMaintenanceDetail({ activities }), activities);
  assert.deepEqual(workflowActivitiesFromMaintenanceDetail({ activityEvents: null, activities: null }), []);
});

test('route and active organization context resolve dual-role users without tenant-first privilege confusion', () => {
  const dualRole = { Roles: ['Tenant', 'Landlord'] };
  assert.equal(maintenanceActorForRoute(dualRole, '/landlord/maintenance/9'), 'manager');
  assert.equal(maintenanceActorForRoute(dualRole, '/tenant/maintenance/9'), 'tenant');
  assert.equal(maintenanceActorForRoute({ Roles: ['Tenant'] }, '/landlord/maintenance/9', { userRole: 'Manager' }), 'manager');
  assert.equal(maintenanceActorForRoute({ Roles: ['Tenant'] }, '/landlord/maintenance/9'), 'unknown');
});

test('action gating mirrors cancellation and active-resource backend rules', () => {
  const active = { assignment: { assignedToUserId: 8, estimateRequired: false }, workOrder: { id: 3, version: 1, status: 'Issued' }, appointment: { id: 4, version: 1, status: 'Confirmed' } };
  const manager = availableMaintenanceActions({ role: 'manager', request: { status: 'Assigned' }, workflow: active });
  assert.equal(manager.issueWorkOrder, false, 'duplicate active work orders are server-invalid');
  assert.equal(manager.cancelWorkOrder, true);
  assert.equal(manager.cancelAppointment, true);
  assert.equal(availableMaintenanceActions({ role: 'tenant', request: { status: 'Scheduled' }, workflow: active }).cancelAppointment, true);
  assert.equal(availableMaintenanceActions({ role: 'tenant', request: { status: 'Resolved' }, workflow: active }).confirmAppointment, false);
});

test('tenant evidence purpose is explicit and frozen outside API-valid stages', () => {
  assert.equal(tenantEvidencePurpose({ status: 'Reported', resolutionCycle: 1 }), 'Intake');
  assert.equal(tenantEvidencePurpose({ status: 'Assigned', resolutionCycle: 2 }), 'Reopen');
  assert.equal(tenantEvidencePurpose({ status: 'Assigned', resolutionCycle: 1 }), null);
  assert.equal(tenantEvidencePurpose({ status: 'AwaitingTenant', resolutionCycle: 2 }), null);
});

test('timeline projection lag is disclosed when canonical request and activity timestamps disagree', () => {
  assert.match(workflowProjectionWarning({ updatedAtUtc: '2026-08-09T12:05:00Z', activities: [{ occurredAtUtc: '2026-08-09T12:00:00Z' }] }), /pending/i);
  assert.equal(workflowProjectionWarning({ updatedAtUtc: '2026-08-09T12:00:00Z', activities: [{ occurredAtUtc: '2026-08-09T12:00:00Z' }] }), null);
});

test('maintenance pages use readiness-scoped vendors, activity summaries, and no dead legacy mutations', async () => {
  const landlord = await readFile(new URL('../pages/landlord/maintenance.jsx', import.meta.url), 'utf8');
  const tenant = await readFile(new URL('../pages/tenant/maintenance-detail.jsx', import.meta.url), 'utf8');
  const list = await readFile(new URL('../pages/landlord/maintenances.jsx', import.meta.url), 'utf8');
  assert.match(landlord, /isReadyForAssignment/);
  assert.doesNotMatch(landlord, /landlordId/);
  assert.match(`${landlord}\n${tenant}`, /event\.summary/);
  assert.doesNotMatch(list, /resolveMaintenanceRequest|reopenMaintenanceRequest|deleteMaintenance\(/);
});

test('landlord maintenance list has no fake create, legacy aggregate mutation, mounted legacy drawers, or drag affordance', async () => {
  const list = await readFile(new URL('../pages/landlord/maintenances.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(list, /openMaintenanceAddDrawer|New request|Create your first request/);
  assert.doesNotMatch(list, /updateMaintenance|buildUpdatePayload|changePriority|changeStatus/);
  assert.doesNotMatch(list, /LandlordMaintenanceDrawer|MaintenanceEditDrawer|VendorAssignDrawer/);
  assert.doesNotMatch(list, /@dnd-kit|DndContext|DragOverlay|useDraggable|useDroppable|Drop a request here|cursor:\s*[^,}]*grab/);
  assert.match(list, /Open request details/);
});

test('tenant maintenance detail renders and gates only current-cycle troubleshooting steps', async () => {
  const tenant = await readFile(new URL('../pages/tenant/maintenance-detail.jsx', import.meta.url), 'utf8');
  assert.match(tenant, /currentCycleTroubleshootingSteps\(request\)/);
  assert.doesNotMatch(tenant, /request\?\.troubleshootingSteps\?\.length|request\.troubleshootingSteps\?\.map|request\.troubleshootingSteps\?\.some/);
});
