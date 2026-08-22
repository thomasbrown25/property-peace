import assert from "node:assert/strict";
import test from "node:test";

import {
  passwordRequirementStatuses,
  validatePassword,
} from "./password-validation.js";

test("accepts a password that satisfies every account password rule", () => {
  assert.equal(validatePassword("CalmHome1!"), null);
});

test("rejects passwords at each account password boundary", () => {
  const cases = [
    ["", "Password is required"],
    [" CalmHome1!", "Password cannot start or end with spaces"],
    ["Short1!", "Password must be at least 8 characters long"],
    ["A1!" + "a".repeat(126), "Password must not exceed 128 characters"],
    ["calmhome1!", "Password must contain at least one uppercase letter"],
    ["CALMHOME1!", "Password must contain at least one lowercase letter"],
    ["CalmHome!", "Password must contain at least one number"],
    [
      "CalmHome1",
      "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
    ],
  ];

  for (const [password, expectedError] of cases) {
    assert.equal(validatePassword(password), expectedError);
  }
});

test("reports live requirement statuses independently while a password is typed", () => {
  assert.deepEqual(passwordRequirementStatuses("Calmhome"), [
    { label: "8+ chars", met: true },
    { label: "Uppercase", met: true },
    { label: "Lowercase", met: true },
    { label: "Number", met: false },
    { label: "Special char", met: false },
  ]);
});
