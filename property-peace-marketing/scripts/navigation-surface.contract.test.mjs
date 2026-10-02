import assert from 'node:assert/strict';
import test from 'node:test';
import { getNavigationSurface } from '../lib/navigation-surface.ts';

const idleHome = {
  pathname: '/',
  desktopIntentEnabled: true,
  scrolled: false,
  pointerInside: false,
  focusInside: false,
  dropdownOpen: false,
  mobileMenuOpen: false,
};

test('idle homepage at the top uses the transparent surface', () => {
  assert.equal(getNavigationSurface(idleHome), 'transparent');
});

test('homepage scroll and intent states use navy without switching logo or text palette', () => {
  for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
    assert.equal(getNavigationSurface({ ...idleHome, [key]: true }), 'navy', key);
  }
});

test('mobile homepage ignores pointer and focus intent until scroll or menu open', () => {
  const mobileHome = { ...idleHome, desktopIntentEnabled: false };

  for (const key of ['pointerInside', 'focusInside', 'dropdownOpen']) {
    assert.equal(getNavigationSurface({ ...mobileHome, [key]: true }), 'transparent', key);
  }

  assert.equal(getNavigationSurface({ ...mobileHome, scrolled: true }), 'navy', 'scrolled');
  assert.equal(
    getNavigationSurface({ ...mobileHome, mobileMenuOpen: true }),
    'navy',
    'mobileMenuOpen',
  );
});

test('listings photo hero shares the transparent-at-top navigation behavior', () => {
  for (const pathname of ['/listings', '/listings/']) {
    const idle = { ...idleHome, pathname };
    assert.equal(getNavigationSurface(idle), 'transparent', pathname);
    for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
      assert.equal(getNavigationSurface({ ...idle, [key]: true }), 'navy', `${pathname}: ${key}`);
    }
  }
});

test('about, pricing, and resources photo heroes share transparent-at-top navigation behavior', () => {
  for (const pathname of ['/about', '/about/', '/pricing', '/pricing/', '/resources', '/resources/']) {
    const idle = { ...idleHome, pathname };
    assert.equal(getNavigationSurface(idle), 'transparent', pathname);
    for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
      assert.equal(getNavigationSurface({ ...idle, [key]: true }), 'navy', `${pathname}: ${key}`);
    }
  }
});

test('non-photographic routes use navy at the top and after scrolling or opening menus', () => {
  for (const pathname of ['/features/rent-collection', '/features/maintenance-tracking', '/blog', '/demo']) {
    for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
      assert.equal(getNavigationSurface({ ...idleHome, pathname, [key]: true }), 'navy', `${pathname}: ${key}`);
    }
    assert.equal(getNavigationSurface({ ...idleHome, pathname }), 'navy', pathname);
  }
});
