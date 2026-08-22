import { validatePassword } from "@property-peace/shared/password-validation";

export interface RegistrationFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export type PreparedRegistration =
  | { error: string }
  | { data: RegistrationFields };

export function prepareRegistration(
  fields: RegistrationFields,
): PreparedRegistration {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const email = fields.email.trim();

  if (!firstName) return { error: "First name is required" };
  if (!lastName) return { error: "Last name is required" };
  if (!email) return { error: "Email is required" };

  const passwordError = validatePassword(fields.password);
  if (passwordError) return { error: passwordError };

  return {
    data: {
      email,
      password: fields.password,
      firstName,
      lastName,
    },
  };
}
