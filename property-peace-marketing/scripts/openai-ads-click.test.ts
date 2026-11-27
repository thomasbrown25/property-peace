import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenAiAdsClickCookie,
  getOpenAiAdsClickReference,
  isValidOpenAiAdsClickReference,
  shouldRequestOpenAiAdsMeasurementConsent,
  syncOpenAiAdsClickReference,
} from "../lib/openai-ads-click";

test("accepts OpenAI click references without altering their opaque value", () => {
  const oppref = "gAAAAA+click/reference_value=1";

  assert.equal(isValidOpenAiAdsClickReference(oppref), true);
  assert.equal(
    buildOpenAiAdsClickCookie(oppref, "propertypeace.io"),
    "__Secure-pp-openai-ads-click=gAAAAA%2Bclick%2Freference_value%3D1; Path=/; Domain=.propertypeace.io; Max-Age=2592000; SameSite=Lax; Secure",
  );
});

test("rejects malformed click references and does not create cookies outside production", () => {
  assert.equal(isValidOpenAiAdsClickReference(""), false);
  assert.equal(isValidOpenAiAdsClickReference("has whitespace"), false);
  assert.equal(isValidOpenAiAdsClickReference("has\ncontrol"), false);
  assert.equal(isValidOpenAiAdsClickReference("x".repeat(2049)), false);
  assert.equal(buildOpenAiAdsClickCookie("valid-reference", "localhost"), null);
});

test("creates an expired parent-domain cookie when consent is denied", () => {
  assert.equal(
    buildOpenAiAdsClickCookie(null, "www.propertypeace.io"),
    "__Secure-pp-openai-ads-click=; Path=/; Domain=.propertypeace.io; Max-Age=0; SameSite=Lax; Secure",
  );
});

test("requires a current OpenAI Ads choice only for old analytics consent on a valid ad landing", () => {
  assert.equal(
    shouldRequestOpenAiAdsMeasurementConsent(true, false, "opaque-click-reference"),
    true,
  );
  assert.equal(shouldRequestOpenAiAdsMeasurementConsent(false, false, "opaque-click-reference"), false);
  assert.equal(shouldRequestOpenAiAdsMeasurementConsent(true, true, "opaque-click-reference"), false);
  assert.equal(shouldRequestOpenAiAdsMeasurementConsent(true, false, null), false);
  assert.equal(getOpenAiAdsClickReference("?oppref=opaque%2Bclick"), "opaque+click");
});

test("stores a landing-page click only after consent and clears it when consent is withdrawn", () => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  const cookies: string[] = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hostname: "propertypeace.io",
        search: "?oppref=opaque%2Bclick%2Freference",
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      set cookie(value: string) {
        cookies.push(value);
      },
    },
  });

  try {
    syncOpenAiAdsClickReference(true);
    syncOpenAiAdsClickReference(false);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: priorWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: priorDocument });
  }

  assert.deepEqual(cookies, [
    "__Secure-pp-openai-ads-click=opaque%2Bclick%2Freference; Path=/; Domain=.propertypeace.io; Max-Age=2592000; SameSite=Lax; Secure",
    "__Secure-pp-openai-ads-click=; Path=/; Domain=.propertypeace.io; Max-Age=0; SameSite=Lax; Secure",
  ]);
});

test("does not overwrite a valid click reference during ordinary or malformed navigation", () => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  const cookies: string[] = [];
  const location = { hostname: "propertypeace.io", search: "?oppref=first-click" };

  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { set cookie(value: string) { cookies.push(value); } },
  });

  try {
    syncOpenAiAdsClickReference(true);
    location.search = "";
    syncOpenAiAdsClickReference(true);
    location.search = "?oppref=invalid%20click";
    syncOpenAiAdsClickReference(true);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: priorWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: priorDocument });
  }

  assert.deepEqual(cookies, [
    "__Secure-pp-openai-ads-click=first-click; Path=/; Domain=.propertypeace.io; Max-Age=2592000; SameSite=Lax; Secure",
  ]);
});

test("stores the landing reference when the visitor consents after navigating", () => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  const cookies: string[] = [];
  const location = { hostname: "propertypeace.io", search: "?oppref=landing-click" };

  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { set cookie(value: string) { cookies.push(value); } },
  });

  try {
    const originalClick = getOpenAiAdsClickReference(location.search);
    location.search = "";
    syncOpenAiAdsClickReference(true, originalClick);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: priorWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: priorDocument });
  }

  assert.equal(cookies[0]?.split(";")[0], "__Secure-pp-openai-ads-click=landing-click");
});
