import assert from 'node:assert/strict';
import test from 'node:test';
import * as navigationSurface from '../lib/navigation-surface.ts';

const staleHomeState = {
  pathname: '/',
  desktopIntentEnabled: true,
  scrolled: true,
  pointerInside: true,
  focusInside: true,
  dropdownOpen: false,
  mobileMenuOpen: false,
};

test('returning home at the top clears stale navigation surface state', () => {
  assert.equal(
    typeof navigationSurface.getNavigationRouteTransitionState,
    'function',
    'navigation should expose its route-transition reset',
  );

  const resetState = navigationSurface.getNavigationRouteTransitionState({ scrollY: 0 });

  assert.deepEqual(resetState, {
    scrolled: false,
    pointerInside: false,
    focusInside: false,
  });
  assert.equal(
    navigationSurface.getNavigationSurface({ ...staleHomeState, ...resetState }),
    'transparent',
  );
});

test('route transition keeps a white surface when the restored page is actually scrolled', () => {
  assert.equal(
    typeof navigationSurface.getNavigationRouteTransitionState,
    'function',
    'navigation should expose its route-transition reset',
  );

  const resetState = navigationSurface.getNavigationRouteTransitionState({ scrollY: 48 });

  assert.deepEqual(resetState, {
    scrolled: true,
    pointerInside: false,
    focusInside: false,
  });
  assert.equal(
    navigationSurface.getNavigationSurface({ ...staleHomeState, ...resetState }),
    'white',
  );
});
