# Online Rent Payments — Marketing and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Replace the current rent-collection feature page with an accurate, branded live experience; present online payments as included with Free and approval-required; and keep live claims behind an explicit coordinated build-time launch state.

**Architecture:** A dedicated rent-collection page component owns the approved section sequence instead of forcing the content through the generic feature grid. A server/build-time launch-state helper selects live versus unavailable claims during static export. Contract tests enforce exact hero copy, prohibited claims, pricing placement, FAQ accuracy, and the required resource link.

**Tech Stack:** Next.js static export, React, TypeScript, Tailwind/existing marketing styles, Node contract tests, GitHub Actions, Azure Static Web Apps.

**Visual direction:** Preserve Property Peace's Poppins/Inter typography, deep navy, green, blue-gray, mint, and white. Use a calm white hero, one purposeful rent-journey animation, a centered automation section, an editorial resource block, a dark navy tenant-benefit band, a broader workflow section, and a compact FAQ accordion. References define structure only; do not copy TurboTenant/Guesty wording or artwork.

---

## Task 1: Add a fail-closed marketing launch state

**Files:**

- Create: `property-peace-marketing/lib/rent-payment-launch.ts`
- Create: `property-peace-marketing/scripts/rent-payment-launch-state.contract.test.mjs`
- Modify: `.github/workflows/property-peace-marketing-deploy.yml`
- Modify: `.github/workflows/property-peace-marketing-deploy-dev.yml`

### Step 1: Write failing launch-state tests

Require this contract:

```ts
export type RentPaymentsMarketingState = 'unavailable' | 'live';
export function getRentPaymentsMarketingState(): RentPaymentsMarketingState;
export function rentPaymentsMarketingLive(): boolean;
```

Assert:

- missing environment variable returns `unavailable`;
- `unavailable` returns unavailable;
- only exact `live` returns live;
- malformed values fail closed to unavailable and emit no secrets;
- build workflows pass the repository/environment variable deliberately rather than hard-coding live.

Run:

```powershell
Set-Location property-peace-marketing
node --test scripts/rent-payment-launch-state.contract.test.mjs
```

Expected: FAIL.

### Step 2: Implement the helper

Read `RENT_PAYMENTS_MARKETING_STATE` at build time. Keep it server/build-only; do not expose a client-side runtime toggle.

### Step 3: Wire both workflows

For the `npm run build` step in:

- `.github/workflows/property-peace-marketing-deploy.yml`
- `.github/workflows/property-peace-marketing-deploy-dev.yml`

add:

```yaml
env:
  RENT_PAYMENTS_MARKETING_STATE: ${{ vars.RENT_PAYMENTS_MARKETING_STATE }}
```

Preserve existing dev URL variables in the dev workflow. An unset repository/environment variable must build unavailable copy.

### Step 4: Make tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-marketing/lib/rent-payment-launch.ts property-peace-marketing/scripts/rent-payment-launch-state.contract.test.mjs .github/workflows/property-peace-marketing-deploy.yml .github/workflows/property-peace-marketing-deploy-dev.yml
git commit -m "feat: gate rent payment marketing launch"
```

---

## Task 2: Replace the rent-collection hero and obsolete disclaimer

**Files:**

- Create: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Modify: `property-peace-marketing/components/Marketing/RentCollectionHeroMock.tsx`
- Modify: `property-peace-marketing/app/features/[slug]/page.tsx`
- Create: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`

### Step 1: Write failing hero contract tests

Require the live page to contain:

```text
COLLECT RENT ONLINE
The smooth, secure way to collect rent.
Set custom late fees, send automatic payment reminders, and give tenants secure bank and card payment options—all from one organized rent ledger.
Set Up Rent Payments
View Pricing
```

Require exactly three hero trust items:

```text
Included with Free
Secure bank connections
Automatic payment tracking
```

Reject:

- a bordered/rounded chip class on `COLLECT RENT ONLINE`;
- `Start free` as the primary rent-page CTA;
- the old unavailable paragraph beginning `Keep rent records, overdue calculations...`;
- `Property Peace does not currently process online rent payments` in live mode;
- Premium/SMS copy in the hero mock;
- autopay, instant payout, credit reporting, and autonomous AI execution claims.

Run:

```powershell
Set-Location property-peace-marketing
node --test scripts/rent-collection-page.contract.test.mjs
```

Expected: FAIL.

### Step 2: Route rent collection to a dedicated page component

In `[slug]/page.tsx`, render `RentCollectionFeaturePage` when `slug === 'rent-collection'`. Pass the launch state to it. Leave other feature pages on the generic renderer.

In unavailable state, render accurate wait/request context without the live payment claims. In live state, render the full approved page.

### Step 3: Build the hero

- Plain uppercase eyebrow: no background, border, capsule, or rounded chip.
- H1 and subtext exactly as approved above.
- Primary CTA goes to the existing app signup/login setup entry and reads `Set Up Rent Payments`.
- Secondary CTA reads `View Pricing`.
- Render exactly three compact trust items below the CTAs.
- Rework `RentCollectionHeroMock` into one rent journey: tenant selects a provider-enabled bank/card method → payment is processing → rent ledger records status. Avoid simulating instant settlement.
- Use a single orchestrated animation and disable it for reduced motion.

### Step 4: Make tests pass and visually inspect responsive layout

```powershell
node --test scripts/rent-collection-page.contract.test.mjs
npm run build
```

Expected: PASS. Inspect desktop and mobile: eyebrow is visibly plain, H1 does not orphan awkwardly, CTAs remain reachable, and mock labels remain legible.

### Step 5: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/components/Marketing/RentCollectionHeroMock.tsx property-peace-marketing/app/features/[slug]/page.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs
git commit -m "feat: redesign rent collection hero"
```

---

## Task 3: Build the automated-process section and remove generic grids

**Files:**

- Modify: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Modify test: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`

### Step 1: Extend failing contract tests

Require centered heading:

```text
Make rent collection a smooth automated process for you and your tenants
```

Require an original comparison paragraph conveying:

```text
General-purpose transfer apps and paper checks move money, but they are not built around leases, rent due dates, late fees, reminders, and a property-level payment record. Property Peace keeps those landlord and tenant needs together.
```

The final copy may be tightened, but it must retain that meaning and must not copy the user's reference sentence verbatim.

Require one CTA labeled `Collect Rent Securely`.

Reject headings `What you get` and `Everything included` and the existing six-card/two-column generic inclusion grids on this page.

### Step 2: Implement the centered section

Use generous white space and a narrow readable text measure. Explain:

- tenant method choice based on secure bank/card connections;
- custom late fee policy;
- automatic reminders;
- rent-ledger updates;
- access approval before setup.

The CTA should use the same setup destination as the hero. Do not imply approval is automatic.

### Step 3: Run tests

```powershell
Set-Location property-peace-marketing
node --test scripts/rent-collection-page.contract.test.mjs
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs
git commit -m "feat: explain automated rent collection workflow"
```

---

## Task 4: Add the rent collection resource section

**Files:**

- Modify: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Modify test: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`
- Verify existing source: `property-peace-marketing/lib/blog-posts.ts`

### Step 1: Write failing resource tests

Require a visible editorial/resource section and an internal link to:

```text
/blog/rental-property-cash-flow-template-landlords/
```

Require descriptive anchor text such as `Rental property cash flow template` and supporting text that connects predictable rent records to cash-flow planning. Reject a bare URL as the link label.

### Step 2: Implement the resource block

Use the screenshot only as structural reference: a dark navy editorial band with a concise heading, supporting copy, primary article card, and up to two related feature links already verified to exist. Do not copy TurboTenant's “one-stop shop” wording.

Make the cash-flow article the featured card. If no suitable related routes are verified, use one strong card rather than dead or invented links.

### Step 3: Run tests

```powershell
node --test scripts/rent-collection-page.contract.test.mjs
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs
git commit -m "feat: add rent collection resources"
```

---

## Task 5: Add the tenant-benefit section

**Files:**

- Modify: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Modify test: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`

### Step 1: Write failing tenant-section tests

Require a section titled with original Property Peace wording, for example:

```text
A simpler way for tenants to pay
```

Require accurate benefits:

- secure bank or card options when enabled;
- clear payment status/records;
- payment from phone or computer;
- automatic reminders that reduce missed due dates;
- no requirement to coordinate paper checks.

Reject claims for credit score reporting, guaranteed partial payments, autopay, instant settlement, or a specific convenience fee unless verified and sourced from live configuration.

### Step 2: Implement the dark navy tenant band

Use the existing brand palette and original visual assets already in the repository. Do not copy the screenshot's stock photo, orange rings, or checkmark list verbatim. Prefer a product-led tenant payment/status composition or an existing approved image.

Use a two-column layout on desktop and a linear content-first layout on mobile. Keep contrast AA-compliant.

### Step 3: Run tests and inspect contrast/responsiveness

```powershell
node --test scripts/rent-collection-page.contract.test.mjs
npm run build
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs
git commit -m "feat: add tenant rent payment benefits"
```

---

## Task 6: Add the broader rental-workflow section

**Files:**

- Modify: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Modify test: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`

### Step 1: Write failing workflow tests

Require an original heading such as:

```text
Keep the rest of the rental workflow connected
```

Require only capabilities verified in the app, selected from:

- property and lease records;
- maintenance requests;
- expenses and cash-flow reporting;
- documents;
- tenant communication/reminders;
- payment history/rent ledger.

Reject TurboTenant-specific claims such as lawyer-prepared state-specific leases, syndication to dozens of sites, free criminal screening, integrated tax accounting, or direct deposits unless the Property Peace repository proves them.

### Step 2: Implement the workflow section

Use a left-aligned editorial list and a right-side product/testimonial-style proof block only if a real approved testimonial exists in the repository. If no approved testimonial exists, use product UI proof instead; do not fabricate a quote, person, company, or location.

Link each capability only to routes verified in the marketing sitemap/feature registry.

### Step 3: Run tests

```powershell
node --test scripts/rent-collection-page.contract.test.mjs
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs
git commit -m "feat: connect the rental workflow story"
```

---

## Task 7: Add accurate rent collection FAQs

**Files:**

- Create: `property-peace-marketing/components/Marketing/RentCollectionFaq.tsx`
- Modify: `property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx`
- Create: `property-peace-marketing/scripts/rent-collection-page.interaction.test.tsx`
- Modify test: `property-peace-marketing/scripts/rent-collection-page.contract.test.mjs`

### Step 1: Write failing FAQ content/interaction tests

Use these questions:

1. `How do landlords collect rent online with Property Peace?`
2. `Is online rent collection included with the Free plan?`
3. `Why does my organization need approval before setting up rent payments?`
4. `How do tenants pay rent online?`
5. `Can Property Peace track rent payments automatically?`
6. `Does Property Peace support automatic rent reminders and custom late fees?`
7. `How secure are online rent payments?`
8. `How quickly will rent payments reach my bank account?`

Answers must state:

- Free inclusion, with organization approval required;
- approval unlocks onboarding but does not skip Stripe verification or Property Peace's separate connected-payee review;
- tenant methods depend on provider/account configuration;
- payment/ledger status updates are automated from verified payment events;
- reminders are automatic, not autonomous AI actions;
- late fees are configurable;
- secure connections are handled through Stripe without Property Peace storing raw bank/card credentials;
- payout timing depends on method, processing, reviews, and Property Peace's safety holds; no instant-arrival promise;
- platform transfers may remain unavailable while the separate transfer control is disabled.

Interaction tests must verify keyboard-operable accordion buttons, `aria-expanded`, `aria-controls`, one predictable open state, and readable no-JS/static content if the existing component supports it.

### Step 2: Implement the FAQ

Follow existing Property Peace accordion styling, not the screenshot's exact gray cards. Use concise original answers and add FAQ structured data through the repository's existing SEO pattern when present.

### Step 3: Run FAQ tests

```powershell
Set-Location property-peace-marketing
node --test scripts/rent-collection-page.contract.test.mjs
npx tsx --test scripts/rent-collection-page.interaction.test.tsx
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-marketing/components/Marketing/RentCollectionFaq.tsx property-peace-marketing/components/Marketing/RentCollectionFeaturePage.tsx property-peace-marketing/scripts/rent-collection-page.contract.test.mjs property-peace-marketing/scripts/rent-collection-page.interaction.test.tsx
git commit -m "feat: add rent collection FAQs"
```

---

## Task 8: Update pricing, privacy, SEO, and repository-wide claims

**Files:**

- Modify: `property-peace-marketing/components/Sections/PricingPlans.tsx`
- Modify: `property-peace-marketing/scripts/check-marketing-claims.mjs`
- Modify: `property-peace-marketing/lib/otto-seo.ts`
- Modify: `property-peace-marketing/components/Sections/FeaturesSection.tsx`
- Modify: `property-peace-marketing/components/Marketing/FeatureHeroMock.tsx`
- Modify: `property-peace-marketing/app/small-landlord-tools/page.tsx`
- Modify: `property-peace-marketing/app/rental-management-software/page.tsx`
- Modify: `property-peace-marketing/app/rent-collection-software-for-landlords/page.tsx`
- Modify: `property-peace-marketing/app/landlord-software/page.tsx`
- Modify: `property-peace-marketing/app/features/page.tsx`
- Modify: `property-peace-marketing/app/blog/[slug]/page.tsx`
- Modify: `property-peace-marketing/app/property-management-app/page.tsx`
- Modify the actual privacy page/component found by the claim scanner
- Preserve and include existing user changes: `property-peace-marketing/components/Sections/FAQ.tsx`
- Preserve and include existing user changes: `property-peace-marketing/scripts/homepage-faq-navy.interaction.test.tsx`
- Preserve and include existing user changes: `property-peace-marketing/scripts/homepage-navy-text.contract.test.mjs`

### Step 1: Make the claim checker fail for the new rules

Update `check-marketing-claims.mjs` to require:

- online rent payments listed in Free with approval context;
- no Premium-only online rent claim;
- no “currently unavailable” language in live state;
- Stripe/privacy disclosure saying Stripe is used for approved organizations when a user initiates payment;
- no autopay, instant payout, credit reporting, autonomous AI, guaranteed approval, or bypassed verification claims;
- no SMS/Percy inclusion in Free.

The unavailable build may retain an honest unavailable statement, but must not render the live page.

Run:

```powershell
Set-Location property-peace-marketing
npm run test:marketing-claims
```

Expected: FAIL until the inventory is updated.

### Step 2: Update Free pricing

Add `Online rent payments (approval required)` to the Free card. Keep Percy and SMS Premium. Do not attach a per-transaction fee number unless the product configuration and legal copy have a verified source.

### Step 3: Replace stale unavailable claims

Use consistent wording:

```text
Online rent payments are included with Free. Organizations request access, complete secure payment setup, and pass account review before tenants can pay online.
```

Adapt grammar per page without changing meaning. Do not imply all organizations are approved.

### Step 4: Update privacy accurately

State that, for approved organizations and initiated payments, Stripe processes payment and connected-account information under its own terms; Property Peace stores provider identifiers, status, and ledger records, not raw bank/card credentials. Confirm wording against actual implementation before merging.

### Step 5: Preserve earlier homepage FAQ work

Do not revert the existing uncommitted edits in the three listed FAQ/test files. Run their tests together with the new rent-page tests and include them in the marketing commit if they are part of this working branch.

### Step 6: Run claims and contracts

```powershell
npm run test:marketing-claims
node --test scripts/homepage-navy-text.contract.test.mjs scripts/rent-collection-page.contract.test.mjs scripts/rent-payment-launch-state.contract.test.mjs
npx tsx --test scripts/homepage-faq-navy.interaction.test.tsx scripts/rent-collection-page.interaction.test.tsx
```

Expected: PASS.

### Step 7: Commit

```powershell
git add property-peace-marketing .github/workflows/property-peace-marketing-deploy.yml .github/workflows/property-peace-marketing-deploy-dev.yml
git commit -m "feat: launch accurate rent payment marketing claims"
```

---

## Task 9: Create and execute the rollout checklist

**Files:**

- Create or update: `docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md`
- Create: `docs/releases/online-rent-payments-launch-checklist.md`

### Step 1: Add pre-deploy checks

Checklist must require:

- API/access migration reviewed and backed up through normal deployment process;
- global provider flag false;
- transfer flag false;
- marketing state unavailable;
- admin notification cohort and main-app base URL verified;
- no organization pre-approved by migration;
- Accounts v2 compatibility verdict PASS before provider enablement.

### Step 2: Add sandbox pilot checks

Use the owner's explicit pilot organization only:

1. request access;
2. confirm durable Pending row and one audit event;
3. simulate email failure and confirm admin queue visibility;
4. open email review link and confirm GET does not mutate;
5. approve by POST and confirm audit actor;
6. complete recipient onboarding;
7. confirm tenant payment remains blocked before connected-payee review;
8. approve connected payee;
9. run one controlled card and one controlled ACH payment;
10. verify webhooks, idempotency, ledger updates, refunds/failures, 7/14-day holds;
11. confirm transfers remain blocked.

### Step 3: Add production enablement order

Only after sandbox/pilot evidence:

1. deploy API and apps with flags false;
2. explicitly enable provider collection for production;
3. approve the pilot organization;
4. complete onboarding/payee review and controlled production verification;
5. keep transfers false through the full hold validation;
6. enable transfers in a separate authorized change;
7. set GitHub repository/environment variable `RENT_PAYMENTS_MARKETING_STATE=live`;
8. run the marketing production workflow;
9. verify live page, Free pricing, CTA destination, and app request path.

This plan documents mutations; it does not authorize the implementation agent to change Azure or Stripe production configuration. Obtain explicit user authorization at rollout time.

### Step 4: Add monitoring and rollback

Monitor request creation/notification failures, approval actions, onboarding errors, PaymentIntent failures, webhook failures/lag, disputes/refunds, hold releases, transfer failures, and organization isolation errors. Use identifiers, counts, and safe statuses only.

Rollback:

1. transfer flag false;
2. payment provider flag false;
3. marketing state unavailable and redeploy;
4. preserve reconciliation/webhooks for in-flight payments;
5. suspend only affected organizations where possible.

### Step 5: Commit

```powershell
git add docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md docs/releases/online-rent-payments-launch-checklist.md
git commit -m "docs: add online rent payments rollout checklist"
```

---

## Task 10: Marketing verification

### Step 1: Run unavailable build

```powershell
Set-Location property-peace-marketing
Remove-Item Env:RENT_PAYMENTS_MARKETING_STATE -ErrorAction SilentlyContinue
npm run test:marketing-claims
npm run lint
npm run build
```

Expected: PASS; exported page does not make live payment claims.

### Step 2: Run live build locally

```powershell
$env:RENT_PAYMENTS_MARKETING_STATE = 'live'
npm run test:marketing-claims
npm run lint
npm run build
Remove-Item Env:RENT_PAYMENTS_MARKETING_STATE
```

Expected: PASS; exported page contains exact hero copy and the live section sequence.

### Step 3: Run all rent/homepage contract tests

```powershell
node --test scripts/homepage-navy-text.contract.test.mjs scripts/rent-collection-page.contract.test.mjs scripts/rent-payment-launch-state.contract.test.mjs
npx tsx --test scripts/homepage-faq-navy.interaction.test.tsx scripts/rent-collection-page.interaction.test.tsx
```

Expected: PASS.

### Step 4: Visual QA at representative widths

Inspect 390px, 768px, 1280px, and 1536px widths:

- plain eyebrow/no chip border;
- hero copy and CTA hierarchy;
- exactly three trust items;
- centered automation section;
- resource card link target;
- dark tenant band contrast;
- broader workflow layout;
- FAQ keyboard focus/open states;
- reduced-motion behavior;
- no horizontal overflow or clipped mock text.

### Step 5: Final claim scan

```powershell
rg -n -i "does not currently process|online rent.*unavailable|autopay|instant payout|credit reporting|ai follow.?ups|online rent.*premium|premium.*online rent" property-peace-marketing property-peace-app
```

Expected: no contradictory live claims. Any allowed historical/editorial occurrence must be reviewed manually and documented, not ignored wholesale.

