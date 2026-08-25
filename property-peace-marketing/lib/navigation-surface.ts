export type NavigationSurface = 'transparent' | 'white';

export interface NavigationSurfaceInput {
  pathname: string;
  desktopIntentEnabled: boolean;
  scrolled: boolean;
  pointerInside: boolean;
  focusInside: boolean;
  dropdownOpen: boolean;
  mobileMenuOpen: boolean;
}

export function getNavigationSurface({
  pathname,
  desktopIntentEnabled,
  scrolled,
  pointerInside,
  focusInside,
  dropdownOpen,
  mobileMenuOpen,
}: NavigationSurfaceInput): NavigationSurface {
  if (pathname !== '/') return 'white';
  const desktopIntentActive =
    desktopIntentEnabled && (pointerInside || focusInside || dropdownOpen);
  return scrolled || desktopIntentActive || mobileMenuOpen ? 'white' : 'transparent';
}
