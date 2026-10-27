import { validatePassword } from "@property-peace/shared/password-validation";
import type { RegisterData } from "../../services/authService";

export interface AccountFields {
  email: string;
  password: string;
}

export interface RegistrationFields extends AccountFields {
  firstName: string;
  lastName: string;
  organizationName: string;
  phoneNumber: string;
  timezone: string;
}

type Prepared<T> = { error: string } | { data: T };

export function prepareAccount(fields: AccountFields): Prepared<AccountFields> {
  const email = fields.email.trim().toLowerCase();
  if (!email) return { error: "Email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
  if (!fields.password) return { error: "Password is required" };
  const passwordError = validatePassword(fields.password);
  if (passwordError) return { error: passwordError };
  return { data: { email, password: fields.password } };
}

function meaningfulText(value: string, label: string, maxLength: number): string | null {
  if (!value) return `${label} is required`;
  if (value.length < 2) return `${label} must be at least 2 characters`;
  if (value.length > maxLength) return `${label} is too long`;
  if (!/[A-Za-z]/.test(value)) return `${label} must include a letter`;
  return null;
}

export function prepareRegistration(fields: RegistrationFields): Prepared<RegisterData> {
  const account = prepareAccount(fields);
  if ("error" in account) return account;
  return prepareDetails(fields, account.data);
}

export function prepareGoogleRegistration(
  fields: RegistrationFields,
  profile: { email: string; emailVerified: boolean; accessToken: string },
): Prepared<RegisterData> {
  if (!profile.emailVerified) return { error: "Google email is not verified" };
  if (!profile.accessToken) return { error: "Google access token is required" };
  const email = profile.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
  const details = prepareDetails(fields, { email, password: "" });
  if ("error" in details) return details;
  return { data: { ...details.data, googleAccessToken: profile.accessToken } };
}

function prepareDetails(fields: RegistrationFields, account: AccountFields): Prepared<RegisterData> {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const businessName = fields.organizationName.trim();
  const phoneNumber = fields.phoneNumber.trim();

  for (const [value, label, maxLength] of [
    [firstName, "First name", 100],
    [lastName, "Last name", 100],
    [businessName, "Workspace name", 100],
  ] as const) {
    const error = meaningfulText(value, label, maxLength);
    if (error) return { error };
  }
  if (!phoneNumber) return { error: "Phone number is required" };
  // US NANP: optional +1, ten digits, area/exchange codes cannot start with 0 or 1.
  const digits = phoneNumber.replace(/\D/g, "");
  if (!/^(?:1)?[2-9]\d{2}[2-9]\d{6}$/.test(digits) ||
      !/^(?:\+?1[\s.()-]*)?[\s.()-]*\d[\d\s.()-]*$/.test(phoneNumber)) {
    return { error: "Enter a complete, valid US phone number" };
  }

  return {
    data: {
      email: account.email,
      password: account.password,
      firstname: firstName,
      lastname: lastName,
      phoneNumber,
      roles: ["Landlord"],
      businessName,
      businessEmail: account.email,
      businessPhone: phoneNumber,
      timezone: fields.timezone,
    },
  };
}
