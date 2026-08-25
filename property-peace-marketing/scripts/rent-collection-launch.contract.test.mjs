import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("rent collection route uses the dedicated page without changing generic CTAs", async () => {
  const source = await read("../app/features/[slug]/page.tsx");
  const metadata = source.slice(source.indexOf("export async function generateMetadata"), source.indexOf("export default async function"));
  assert.equal(metadata.includes("RentCollectionFeaturePage"), false);
  assert.equal((source.match(/return <RentCollectionFeaturePage \/>/g) ?? []).length, 1);
  assert.equal(source.includes("renderRentCollectionHero"), false);
  assert.equal(source.includes("isRentCollectionFeature"), false);
  assert.equal(source.includes("Collect Rent Securely"), false);
  assert.equal((source.match(/View Pricing/g) ?? []).length >= 2, true);
});

test("rent collection page contains the requested launch sections and honest unavailable state", async () => {
  const source = await read("../components/Marketing/RentCollectionFeaturePage.tsx");
  const required = [
    "COLLECT RENT ONLINE",
    "The smooth, secure way to collect rent.",
    "Custom late fees",
    "automatic AI-assisted follow-ups",
    "secure bank connections",
    "Set Up Rent Payments",
    "View Pricing",
    "Included with Free",
    "Secure bank connections",
    "Automatic payment tracking",
    "Make rent collection a smooth automated process for you and your tenants",
    "Collect Rent Securely",
    "/blog/rental-property-cash-flow-template-landlords/",
    "A better tenant experience",
    "More than rent collection",
    "Approval comes before payment setup.",
    "Request Rent Payment Access",
    "not currently available",
  ];
  for (const claim of required) assert.equal(source.includes(claim), true, "Missing: " + claim);

  const eyebrow = source.slice(source.indexOf("COLLECT RENT ONLINE") - 160, source.indexOf("COLLECT RENT ONLINE"));
  assert.equal(/border|rounded|shadow/.test(eyebrow), false);
  assert.equal((source.match(/const trustItems = \[/g) ?? []).length, 1);
  assert.equal(/credit report|autopay|partial payment|instant transfer/i.test(source), false);
});

test("rent collection FAQ covers only supported payment behavior", async () => {
  const source = await read("../components/Marketing/RentCollectionFaq.tsx");
  assert.equal((source.match(/question:/g) ?? []).length, 8);
  for (const claim of [
    "owner or manager requests",
    "connected-payee review",
    "Stripe-hosted",
    "does not store raw bank-account or card credentials",
    "7 days for card payments",
    "14 days for ACH",
    "SMS messaging remains a Premium feature",
  ]) {
    assert.equal(source.includes(claim), true, "Missing: " + claim);
  }
  assert.equal(/build their credit|autopay|instant payout/i.test(source), false);
});

test("marketing launch state and both deploy workflows fail closed", async () => {
  const helper = await read("../lib/rent-payment-launch.ts");
  const devWorkflow = await read("../../.github/workflows/property-peace-marketing-deploy-dev.yml");
  const prodWorkflow = await read("../../.github/workflows/property-peace-marketing-deploy.yml");

  assert.equal(helper.includes('"unavailable" | "live"'), true);
  assert.equal(helper.includes('process.env.RENT_PAYMENTS_MARKETING_STATE === "live" ? "live" : "unavailable"'), true);
  for (const workflow of [devWorkflow, prodWorkflow]) {
    assert.equal(workflow.includes("RENT_PAYMENTS_MARKETING_STATE"), true);
    assert.equal(workflow.includes("vars.RENT_PAYMENTS_MARKETING_STATE"), true);
    assert.equal(workflow.includes("NEXT_PUBLIC_RENT_PAYMENT_LAUNCH"), false);
  }

  const literalNewlineMarker = String.fromCharCode(96) + "r" + String.fromCharCode(96) + "n";
  for (const source of [helper, devWorkflow, prodWorkflow]) {
    assert.equal(source.includes(literalNewlineMarker), false);
  }
});