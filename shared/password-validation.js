export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
export const PASSWORD_SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;
export const PASSWORD_REQUIREMENTS_TEXT =
  "Password must be " +
  PASSWORD_MIN_LENGTH +
  "-" +
  PASSWORD_MAX_LENGTH +
  " characters and include at least one uppercase letter, one lowercase letter, one number, and one special character (" +
  PASSWORD_SPECIAL_CHARACTERS +
  ").";

const COMMON_PASSWORDS = [
  "password",
  "password123",
  "12345678",
  "qwerty",
  "abc123",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "password1",
];

export function validatePassword(password) {
  if (!password || !password.trim()) return "Password is required";
  if (password !== password.trim())
    return "Password cannot start or end with spaces";
  if (password.length < PASSWORD_MIN_LENGTH)
    return (
      "Password must be at least " + PASSWORD_MIN_LENGTH + " characters long"
    );
  if (password.length > PASSWORD_MAX_LENGTH)
    return "Password must not exceed " + PASSWORD_MAX_LENGTH + " characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  if (!PASSWORD_SPECIAL_REGEX.test(password)) {
    return (
      "Password must contain at least one special character (" +
      PASSWORD_SPECIAL_CHARACTERS +
      ")"
    );
  }
  if (COMMON_PASSWORDS.some((common) => password.toLowerCase() === common)) {
    return "Password is too common. Please choose a more unique password";
  }
  return null;
}

export function passwordRequirementStatuses(password) {
  return [
    { label: "8+ chars", met: password.length >= PASSWORD_MIN_LENGTH },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special char", met: PASSWORD_SPECIAL_REGEX.test(password) },
  ];
}
