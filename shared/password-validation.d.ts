export const PASSWORD_MIN_LENGTH: number;
export const PASSWORD_MAX_LENGTH: number;
export const PASSWORD_SPECIAL_CHARACTERS: string;
export const PASSWORD_SPECIAL_REGEX: RegExp;
export const PASSWORD_REQUIREMENTS_TEXT: string;

export interface PasswordRequirementStatus {
  label: string;
  met: boolean;
}

export function validatePassword(password: string): string | null;
export function passwordRequirementStatuses(
  password: string,
): PasswordRequirementStatus[];
