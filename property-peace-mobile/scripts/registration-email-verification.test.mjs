import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CODE_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  normalizeVerificationCode,
  secondsRemaining,
} from "../src/features/auth/emailVerification.ts";

const read = (url) => readFileSync(new URL(url, import.meta.url), "utf8");

test("matches the API's six-digit, ten-minute verification contract", () => {
  assert.equal(CODE_EXPIRY_SECONDS, 10 * 60);
  assert.equal(RESEND_COOLDOWN_SECONDS, 30);
  assert.equal(normalizeVerificationCode(" 12a34-567 "), "123456");
  assert.equal(normalizeVerificationCode("123"), "123");
});

test("reports bounded code lifetime for expiry messaging", () => {
  assert.equal(secondsRemaining(1_000, 1_000), CODE_EXPIRY_SECONDS);
  assert.equal(secondsRemaining(1_000, 1_000 + 599_001), 1);
  assert.equal(secondsRemaining(1_000, 1_000 + 600_000), 0);
  assert.equal(secondsRemaining(1_000, 1_000 + 700_000), 0);
});

test("mobile auth calls the real cookie-backed verification API contracts", () => {
  const service = read("../src/services/authService.ts");
  const client = read("../src/services/apiClient.ts");
  const controller = read("../../property-peace-api/Controllers/UserController.cs");
  const apiVerification = read("../../property-peace-api/Services/EmailVerificationService/EmailVerificationService.cs");

  assert.match(controller, /HttpPost\("send-verification-code"\)/);
  assert.match(controller, /HttpPost\("verify-code"\)/);
  assert.match(controller, /Response\.Cookies\.Append\(EmailVerificationCookieName, response\.Data/);
  assert.match(controller, /MaxAge = TimeSpan\.FromMinutes\(10\)/);
  assert.match(apiVerification, /ExpiresAt = nowUtc\.AddMinutes\(10\)/);
  assert.match(service, /post<.*>\(['"]\/api\/user\/check-email['"],\s*\{ email \}\)/);
  assert.match(service, /post<.*>\(['"]\/api\/user\/send-verification-code['"],\s*\{ email \}\)/);
  assert.match(service, /post<.*>\(['"]\/api\/user\/verify-code['"],\s*\{ email, code \}\)/);
  assert.match(client, /withCredentials:\s*true/, "verification proof cookie must survive verify -> register");
});

test("registration UI performs send, verify, register and remains iPhone keyboard safe", () => {
  const screen = read("../src/screens/auth/RegisterScreen.tsx");

  assert.match(screen, /authService\.sendRegistrationCode/);
  assert.match(screen, /authService\.verifyRegistrationCode/);
  assert.match(screen, /dispatch\(register\(/);
  assert.match(screen, /autoComplete=["']one-time-code["']/);
  assert.match(screen, /keyboardType=["']number-pad["']/);
  assert.match(screen, /keyboardDismissMode=["']interactive["']/);
  assert.match(screen, /contentInsetAdjustmentBehavior=["']automatic["']/);
  assert.match(screen, /AppleSignInButton/);
});
