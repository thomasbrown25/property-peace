import assert from 'node:assert/strict';
import test from 'node:test';
import { getNavigationSurface } from '../lib/navigation-surface.ts';

const idleHome = {
  pathname: '/',
  scrolled: false,
  pointerInside: false,
  focusInside: false,
  dropdownOpen: false,
  mobileMenuOpen: false,
};

test('idle homepage at the top uses the transparent surface', () => {
  assert.equal(getNavigationSurface(idleHome), 'transparent');
});

test('homepage intent states use the white surface', () => {
  for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
    assert.equal(getNavigationSurface({ ...idleHome, [key]: true }), 'white', key);
  }
});

test('secondary routes always use the white surface', () => {
  assert.equal(getNavigationSurface({ ...idleHome, pathname: '/resources' }), 'white');
});
