import assert from "node:assert/strict";
import test from "node:test";

import { prepareAccount, prepareRegistration, prepareGoogleRegistration } from "../src/features/auth/registrationValidation.ts";

const validRegistration = {
  email: "landlord@example.com",
  password: "CalmHome1!",
  firstName: "Ada",
  lastName: "Lovelace",
  organizationName: "Oak Street Rentals",
  phoneNumber: "(212) 555-0123",
  timezone: "America/New_York",
};

test("account step requires a valid email and shared password rules before sending code", () => {
  assert.deepEqual(prepareAccount({ email: "   ", password: validRegistration.password }), { error: "Email is required" });
  assert.deepEqual(prepareAccount({ email: "not-an-email", password: validRegistration.password }), { error: "Enter a valid email address" });
  assert.deepEqual(prepareAccount({ email: validRegistration.email, password: "alllowercase1!" }), { error: "Password must contain at least one uppercase letter" });
  assert.deepEqual(prepareAccount({ email: "  LANDLORD@Example.COM  ", password: validRegistration.password }), {
    data: { email: "landlord@example.com", password: validRegistration.password },
  });
});

test("details step requires meaningful first, last and workspace names", () => {
  for (const [field, label] of [["firstName", "First name"], ["lastName", "Last name"], ["organizationName", "Workspace name"]]) {
    assert.deepEqual(prepareRegistration({ ...validRegistration, [field]: "   " }), { error: `${label} is required` });
    assert.deepEqual(prepareRegistration({ ...validRegistration, [field]: "A" }), { error: `${label} must be at least 2 characters` });
    assert.deepEqual(prepareRegistration({ ...validRegistration, [field]: "12" }), { error: `${label} must include a letter` });
  }
  assert.deepEqual(prepareRegistration({ ...validRegistration, firstName: "A".repeat(101) }), { error: "First name is too long" });
  assert.deepEqual(prepareRegistration({ ...validRegistration, organizationName: "A".repeat(101) }), { error: "Workspace name is too long" });
});

test("details step requires a complete valid US phone number", () => {
  assert.deepEqual(prepareRegistration({ ...validRegistration, phoneNumber: "   " }), { error: "Phone number is required" });
  for (const phoneNumber of ["555-1234", "1234567890", "212555012", "+442071838750"]) {
    assert.deepEqual(prepareRegistration({ ...validRegistration, phoneNumber }), { error: "Enter a complete, valid US phone number" });
  }
});

test("normalizes landlord registration into the web-compatible API payload", () => {
  assert.deepEqual(prepareRegistration({
    ...validRegistration,
    email: "  LANDLORD@Example.COM  ",
    firstName: "  Ada  ",
    lastName: "  Lovelace  ",
    organizationName: "  Oak Street Rentals  ",
    phoneNumber: "  (212) 555-0123  ",
  }), {
    data: {
      email: "landlord@example.com",
      password: "CalmHome1!",
      firstname: "Ada",
      lastname: "Lovelace",
      phoneNumber: "(212) 555-0123",
      roles: ["Landlord"],
      businessName: "Oak Street Rentals",
      businessEmail: "landlord@example.com",
      businessPhone: "(212) 555-0123",
      timezone: "America/New_York",
    },
  });
});

test("Google registration requires verified provider email, access token and complete details", () => {
  const profile = { email: "LANDLORD@example.com", emailVerified: true, accessToken: "google-token" };
  assert.deepEqual(prepareGoogleRegistration(validRegistration, { ...profile, emailVerified: false }), { error: "Google email is not verified" });
  assert.deepEqual(prepareGoogleRegistration(validRegistration, { ...profile, accessToken: "" }), { error: "Google access token is required" });
  assert.deepEqual(prepareGoogleRegistration({ ...validRegistration, phoneNumber: "" }, profile), { error: "Phone number is required" });
  const result = prepareGoogleRegistration({ ...validRegistration, email: "spoofed@example.com", password: "" }, profile);
  assert.equal(result.data.email, "landlord@example.com");
  assert.equal(result.data.password, "");
  assert.equal(result.data.googleAccessToken, "google-token");
});
