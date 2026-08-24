export type NavigationSurface = 'transparent' | 'white';

export interface NavigationSurfaceInput {
  pathname: string;
  scrolled: boolean;
  pointerInside: boolean;
  focusInside: boolean;
  dropdownOpen: boolean;
  mobileMenuOpen: boolean;
}

export function getNavigationSurface({
  pathname,
  scrolled,
  pointerInside,
  focusInside,
  dropdownOpen,
  mobileMenuOpen,
}: NavigationSurfaceInput): NavigationSurface {
  if (pathname !== '/') return 'white';
  return scrolled || pointerInside || focusInside || dropdownOpen || mobileMenuOpen
    ? 'white'
    : 'transparent';
}
