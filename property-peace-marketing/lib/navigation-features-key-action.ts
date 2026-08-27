export type FeaturesDropdownKeyAction =
  | 'none'
  | 'open-and-focus-first-link'
  | 'focus-first-link'
  | 'close-and-restore-trigger';

export interface FeaturesDropdownKeyInput {
  key: string;
  dropdownOpen: boolean;
  target: 'trigger' | 'navigation';
  shiftKey?: boolean;
}

export function getFeaturesDropdownKeyAction({
  key,
  dropdownOpen,
  target,
  shiftKey = false,
}: FeaturesDropdownKeyInput): FeaturesDropdownKeyAction {
  if (target === 'trigger' && (key === 'Enter' || key === ' ' || key === 'ArrowDown')) {
    return 'open-and-focus-first-link';
  }

  if (target === 'trigger' && key === 'Tab' && dropdownOpen && !shiftKey) {
    return 'focus-first-link';
  }

  if (target === 'navigation' && key === 'Escape' && dropdownOpen) {
    return 'close-and-restore-trigger';
  }

  return 'none';
}

export interface FeaturesDropdownFocusInput {
  restoringFocus: boolean;
}

export function shouldOpenFeaturesDropdownOnFocus({ restoringFocus }: FeaturesDropdownFocusInput): boolean {
  return !restoringFocus;
}
