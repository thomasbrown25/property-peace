import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAICenterScopeGuard,
  getAICenterReadinessMarker,
  isAICenterRuntimeReady,
  isAICenterScopeEligible,
  makeAICenterScope
} from './aiCenterScope.js';

test('AI Center readiness marker and tool availability fail closed', () => {
  assert.deepEqual(getAICenterReadinessMarker({ canInvoke: false, title: 'Setup required' }), {
    label: 'Setup required',
    active: false,
    toolDetail: 'Unavailable until Percy readiness opens'
  });
  assert.deepEqual(getAICenterReadinessMarker({ canInvoke: true, title: 'Pilot access' }), {
    label: 'Pilot access',
    active: true,
    toolDetail: 'Organization-scoped tools available'
  });
});

test('AI Center rejects an organization A completion after switching the same user to organization B', () => {
  const guard = createAICenterScopeGuard();
  const organizationA = makeAICenterScope({ userId: 7, organizationId: 101 });
  const organizationB = makeAICenterScope({ userId: 7, organizationId: 202 });

  const generationA = guard.beginScope(organizationA);
  const staleConversationLoad = guard.capture(organizationA);
  const staleChatStream = guard.capture(organizationA);

  const generationB = guard.beginScope(organizationB);
  const currentSettingsLoad = guard.capture(organizationB);

  assert.notEqual(organizationA.scopeKey, organizationB.scopeKey);
  assert.ok(generationB.generation > generationA.generation);
  assert.equal(guard.isCurrent(staleConversationLoad, organizationB), false);
  assert.equal(guard.isCurrent(staleChatStream, organizationB), false);
  assert.equal(guard.isCurrent(currentSettingsLoad, organizationB), true);
});

test('AI Center also advances scope when the active user changes within an organization', () => {
  const guard = createAICenterScopeGuard();
  const firstUser = makeAICenterScope({ userId: 7, organizationId: 101 });
  guard.beginScope(firstUser);
  const firstUserRequest = guard.capture(firstUser);

  guard.beginScope(makeAICenterScope({ userId: 8, organizationId: 101 }));

  assert.equal(guard.isCurrent(firstUserRequest, firstUser), false);
});

test('AI Center dispose rejects late completion before it can publish or start follow-up work', async () => {
  let resolveInitial;
  const initial = new Promise((resolve) => { resolveInitial = resolve; });
  const guard = createAICenterScopeGuard();
  const scope = makeAICenterScope({ userId: 7, organizationId: 101 });
  guard.beginScope(scope);
  const request = guard.capture(scope);
  const published = [];
  let followUpCalls = 0;

  const completion = (async () => {
    const conversations = await initial;
    if (!guard.isCurrent(request, scope)) return;
    published.push(conversations);
    followUpCalls += 1;
  })();

  guard.dispose();
  resolveInitial([{ id: 'late-conversation' }]);
  await completion;

  assert.deepEqual(published, []);
  assert.equal(followUpCalls, 0);
});

test('AI Center requires a resolved current organization, never a user organization fallback', () => {
  assert.equal(isAICenterScopeEligible({ userId: 7, currentOrganization: null, organizationLoading: false }), false);
  assert.equal(isAICenterScopeEligible({ userId: 7, currentOrganization: { id: 101 }, organizationLoading: true }), false);
  assert.equal(isAICenterScopeEligible({ userId: 7, currentOrganization: { id: 101 }, organizationLoading: false }), true);
  assert.equal(isAICenterScopeEligible({ userId: null, currentOrganization: { id: 101 }, organizationLoading: false }), false);
});

test('AI Center synchronously invalidates same-scope work while organization context reloads', async () => {
  const guard = createAICenterScopeGuard();
  const scopeA = makeAICenterScope({ userId: 7, organizationId: 101 });
  const publications = [];
  let snackbarCalls = 0;
  let actionRequests = 0;
  let reloadRequests = 0;
  let resolveConversation;
  const conversation = new Promise((resolve) => { resolveConversation = resolve; });

  guard.synchronize(scopeA, true);
  const initialLoad = guard.beginScope(scopeA, true);
  const loadedStateGeneration = initialLoad.generation;
  const pendingRequest = guard.capture(scopeA);
  const completion = (async () => {
    const result = await conversation;
    if (!guard.isCurrent(pendingRequest, guard.getRuntime())) return;
    publications.push(result);
    snackbarCalls += 1;
  })();

  // OrganizationContext retains A while it reloads. This transition happens
  // during render, before effect cleanup has a chance to dispose the request.
  const loadingRuntime = guard.synchronize(scopeA, false);
  if (isAICenterRuntimeReady({ runtime: loadingRuntime, stateGeneration: loadedStateGeneration })) actionRequests += 1;

  assert.equal(loadingRuntime.eligible, false);
  assert.equal(isAICenterRuntimeReady({ runtime: loadingRuntime, stateGeneration: loadedStateGeneration }), false);
  assert.equal(guard.isCurrent(pendingRequest, loadingRuntime), false);
  assert.equal(actionRequests, 0);

  resolveConversation({ id: 'stale-A' });
  await completion;
  assert.deepEqual(publications, []);
  assert.equal(snackbarCalls, 0);

  // Returning to the identical durable scope gets a fresh runtime generation;
  // old A work stays stale and a clean effect-driven reload can become current.
  const returningRuntime = guard.synchronize(scopeA, true);
  assert.equal(isAICenterRuntimeReady({ runtime: returningRuntime, stateGeneration: loadedStateGeneration }), false);
  assert.equal(guard.isCurrent(pendingRequest, returningRuntime), false);
  const reload = guard.beginScope(scopeA, true);
  reloadRequests += 1;

  assert.equal(reloadRequests, 1);
  assert.equal(isAICenterRuntimeReady({ runtime: reload, stateGeneration: reload.generation }), true);
  assert.equal(guard.isCurrent(reload, guard.getRuntime()), true);
});
