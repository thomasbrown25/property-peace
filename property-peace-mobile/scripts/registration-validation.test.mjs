import assert from "node:assert/strict";
import test from "node:test";

import { prepareRegistration } from "../src/features/auth/registrationValidation.ts";

const validRegistration = {
  email: "tenant@example.com",
  password: "CalmHome1!",
  firstName: "Ada",
  lastName: "Lovelace",
};

test("requires both first and last name before creating an account", () => {
  assert.deepEqual(
    prepareRegistration({ ...validRegistration, firstName: "   " }),
    {
      error: "First name is required",
    },
  );
  assert.deepEqual(
    prepareRegistration({ ...validRegistration, lastName: "   " }),
    {
      error: "Last name is required",
    },
  );
});

test("uses the shared account password rules for mobile registration", () => {
  assert.deepEqual(
    prepareRegistration({ ...validRegistration, password: "alllowercase1!" }),
    {
      error: "Password must contain at least one uppercase letter",
    },
  );
});

test("normalizes required registration fields for a valid account", () => {
  assert.deepEqual(
    prepareRegistration({
      ...validRegistration,
      email: "  tenant@example.com  ",
      firstName: "  Ada  ",
      lastName: "  Lovelace  ",
    }),
    {
      data: {
        email: "tenant@example.com",
        password: "CalmHome1!",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    },
  );
});
