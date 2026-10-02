export type NavigationSurface = 'transparent' | 'navy' | 'white';

export interface NavigationSurfaceInput {
  pathname: string;
  desktopIntentEnabled: boolean;
  scrolled: boolean;
  pointerInside: boolean;
  focusInside: boolean;
  dropdownOpen: boolean;
  mobileMenuOpen: boolean;
}

export interface NavigationRouteTransitionStateInput {
  scrollY: number;
}

export function getNavigationRouteTransitionState({
  scrollY,
}: NavigationRouteTransitionStateInput) {
  return {
    scrolled: scrollY > 24,
    pointerInside: false,
    focusInside: false,
  };
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
  if (pathname !== '/') return 'navy';
  const desktopIntentActive =
    desktopIntentEnabled && (pointerInside || focusInside || dropdownOpen);
  return scrolled || desktopIntentActive || mobileMenuOpen ? 'navy' : 'transparent';
}
