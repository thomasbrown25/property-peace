import assert from 'node:assert/strict';
import test from 'node:test';

const loadStartupPresentation = async () => {
  try {
    return await import('../src/features/startup/startupPresentation.ts');
  } catch (error) {
    return { loadError: error };
  }
};

test('keeps the animated intro visible until its sequence finishes', async () => {
  const { resolveStartupPresentation, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  assert.equal(
    resolveStartupPresentation({
      introComplete: false,
      authLoading: false,
      checkingLock: false,
    }),
    'animated-intro',
  );
});

test('shows a quiet waiting state after the intro while startup work remains', async () => {
  const { resolveStartupPresentation, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  assert.equal(
    resolveStartupPresentation({
      introComplete: true,
      authLoading: true,
      checkingLock: false,
    }),
    'waiting',
  );
  assert.equal(
    resolveStartupPresentation({
      introComplete: true,
      authLoading: false,
      checkingLock: true,
    }),
    'waiting',
  );
});

test('releases startup when the intro and startup work are complete', async () => {
  const { resolveStartupPresentation, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  assert.equal(
    resolveStartupPresentation({
      introComplete: true,
      authLoading: false,
      checkingLock: false,
    }),
    'ready',
  );
});

test('falls back to reduced motion when the native preference lookup stalls', async () => {
  const { resolveReducedMotionPreference, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  assert.equal(typeof resolveReducedMotionPreference, 'function');
  const result = await resolveReducedMotionPreference(() => new Promise(() => {}), 5);
  assert.equal(result, true);
});

test('uses the native reduced-motion preference when it resolves in time', async () => {
  const { resolveReducedMotionPreference, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  const result = await resolveReducedMotionPreference(() => Promise.resolve(false), 50);
  assert.equal(result, false);
});

test('cancels the bounded preference wait when startup unmounts', async () => {
  const { resolveReducedMotionPreference } = await loadStartupPresentation();
  const controller = new AbortController();
  const pending = resolveReducedMotionPreference(() => new Promise(() => {}), 60_000, controller.signal);
  controller.abort();
  assert.equal(await pending, true);
});
test('restores a visible final frame when the intro becomes a waiting screen', async () => {
  const { resolveStartupVisualState, loadError } = await loadStartupPresentation();

  assert.equal(loadError, undefined, 'startup presentation module should load');
  assert.deepEqual(resolveStartupVisualState(false), {
    dawnProgress: 1,
    logoLift: 0,
    logoOpacity: 1,
    logoScale: 1,
    sceneOpacity: 1,
  });
});
