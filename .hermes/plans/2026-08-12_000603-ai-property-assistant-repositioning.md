# Property Peace AI Property Assistant Repositioning Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Do not commit, push, deploy, or change production configuration unless Thomas explicitly authorizes each action.

**Goal:** Reposition Property Peace from a broad property-management platform into the AI property assistant for self-managing landlords, beginning with a substantially shorter, Percy-led marketing homepage and then aligning the rest of the marketing site and product experience without discarding the existing property-management foundation.

**Architecture:** Keep Property Peace’s existing property, unit, tenant, lease, maintenance, communication, document, and accounting domains as the authoritative operating system. Present Percy as the coordination and assistance layer: observe, prioritize, explain, prepare, and safely execute bounded actions. Implement the repositioning in stages so public claims never get ahead of currently verified Percy functionality or provider readiness.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion, existing Property Peace marketing components, .NET API and React app in later product phases.

---

## 1. Product decision and positioning contract

### Primary category

**AI property assistant for self-managing landlords**

Property Peace remains property-management software underneath, but the customer-facing promise changes from “all your management tools in one platform” to:

> Property Peace watches your rentals, shows you what needs attention, and helps you safely handle the next step.

### Primary audience

- Self-managing landlords with approximately 5–25 units.
- One-to-four-unit landlords remain the Free acquisition audience.
- The product continues to support portfolios through 50 units, but “1–50 units” becomes supporting proof rather than the central headline.
- Do not reposition toward enterprise property managers or full-service property management.

### Core customer outcome

> **Nothing important falls through the cracks.**

### Percy capability ladder

1. **Observe:** Detect changes, deadlines, unresolved work, and missing information.
2. **Explain:** Summarize what happened and why it matters using authorized source records.
3. **Prepare:** Draft messages, prefill workflows, organize evidence, and recommend next actions.
4. **Execute with confirmation:** Perform an exact, immutable, authorized action after review.
5. **Execute within policy:** Later phase only, for low-risk actions with explicit organization policies and auditability.

### Initial product wedges

Prioritize these in marketing and product demonstrations:

1. Daily portfolio briefing and attention management.
2. Tenant communication and follow-up.
3. Maintenance triage and coordination.
4. Lease and renewal deadlines.
5. Financial explanations and exception detection.

### Explicit non-goals

- Do not turn the homepage into a generic chatbot.
- Do not remove the existing domain system.
- Do not imply Percy is fully autonomous.
- Do not claim online payment processing while payment gates remain closed.
- Do not claim provider-backed screening, e-signature, SMS, or listing syndication beyond their verified readiness.
- Do not let Percy independently make screening, legal, lease-term, eviction, refund, payment, payout, or bank-account decisions.
- Do not introduce an AI token/credit pricing model during the initial repositioning.
- Do not change the current Free/Premium/Lifetime contract in this phase.

---

## 2. Rollout strategy

The repositioning should happen in four coordinated releases rather than one giant rewrite.

### Release A — Marketing homepage repositioning

- Rebuild the homepage around Percy and the “nothing falls through the cracks” outcome.
- Cut the homepage length materially.
- Replace broad feature inventory with three focused outcomes.
- Preserve existing routes and SEO pathways.
- Present currently implemented Percy behavior truthfully as a limited pilot until product readiness supports stronger claims.

### Release B — Marketing site alignment

- Align navigation, footer, pricing, demo, features index, AI-related feature pages, metadata, schema, FAQs, and high-intent landing pages.
- Preserve established property-management SEO terms as supporting language rather than deleting them.
- Introduce an intentional “AI property assistant” content cluster without changing working URLs unnecessarily.

### Release C — Product assistant overlay

- Add contextual Percy access and source-linked read-only assistance to the existing app.
- Prove trust and usefulness before redesigning the main app shell.

### Release D — Assistant-led product experience

- Introduce Today, Inbox, Work, approval queues, and bounded automation.
- Keep all domain records and deterministic operations authoritative.

---

# Part I — Marketing Homepage

## 3. New homepage content architecture

The current homepage mounts roughly thirteen sections and several long desktop-only feature demonstrations. The first implementation should reduce it to **seven purposeful sections**.

### Proposed homepage order

1. **Percy-led hero**
2. **Attention/outcome proof strip**
3. **How Percy helps: Observe → Prepare → Act safely**
4. **Three core landlord workflows**
5. **Trust and control**
6. **Simple pricing preview**
7. **Condensed FAQ + final CTA**

SEO pathways and resource links should remain discoverable but move into a compact lower-page/footer treatment rather than interrupting the primary story.

### Components removed from the homepage composition

Remove these from `app/page.tsx` in their current standalone form:

- `OnboardingWorkflow`
- `PainPoints`
- first inline `CTA`
- `ProofBand` as a large animated narrative
- `SeoPathways` as a full six-card section
- `ResourceHighlights` as a large homepage section
- `TrustClarity` in its current rent-record-centric form
- desktop-only standalone `AiSummaries`
- desktop-only standalone `MaintenanceAgent`
- desktop-only standalone `RentEstimates`
- desktop-only standalone `RentalAccounting`

Do not delete the components immediately. First remove them from homepage composition, verify no other route imports them, then retire or repurpose them in a later cleanup task.

---

## 4. Homepage copy direction

### Hero

**Eyebrow:**

> Meet Percy, your AI property assistant

Because current marketing validation requires pilot disclosure, the initial shipped form may need:

> Meet Percy — limited pilot

**H1:**

> Your AI assistant for managing rental properties

**Supporting copy:**

> Percy watches maintenance, tenant messages, lease deadlines, rent records, and follow-ups—then shows you what needs attention and helps you prepare the next step.

**Primary CTA:** `Start free`

**Secondary CTA:** `See how Percy works`

The secondary CTA should scroll to the “How Percy helps” section or open a real walkthrough; it should not lead to a fake interactive demo.

**Supporting proof:**

- Free for up to 5 units
- No credit card required
- Built for self-managing landlords

### Hero visual

Replace the current generic house-background emphasis and `HeroProductStepper` with a focused **Today briefing preview**.

The preview should show honest representative states rather than fake live customer data:

- “3 items need attention”
- A lease renewal approaching
- An unanswered tenant message
- An aging maintenance request
- A clearly labeled “Percy can prepare…” action
- Source chips such as Lease, Message, Maintenance
- A distinct approval state—not an implication that Percy already sent or changed something

Use a polished product-preview composition in React. Do not bake operational text into a background image. If the live app does not yet contain Today, label the marketing preview as a representative Percy workflow and avoid implying that exact screen is currently deployed.

### Outcome proof strip

Replace broad or unsubstantiated social proof with three product promises:

- **Know what needs attention** — Percy organizes deadlines, messages, and unresolved work.
- **Prepare the next step faster** — Draft replies and prefilled workflows remain editable.
- **Stay in control** — Important external, legal, and financial actions require approval.

### How Percy helps

Use a three-step narrative:

1. **Percy watches the work**
   - Reads authorized Property Peace records and detects deadlines or stalled work.
2. **Percy prepares the next step**
   - Summarizes context, recommends an action, and drafts the work.
3. **You review and decide**
   - See the exact target, content, sources, and impact before consequential actions.

This section should visually demonstrate the trust model rather than present another generic icon grid.

### Three workflow stories

Use three concise, outcome-focused panels:

#### Tenant communication

> Catch unanswered questions, summarize long threads, and prepare clear follow-ups without rereading every conversation.

#### Maintenance coordination

> Turn a tenant report into an organized issue, identify missing information, and prepare vendor or tenant communication.

#### Leases and deadlines

> See upcoming renewals, incomplete signatures, and move-in steps before they become urgent.

Each panel should contain:

- One concrete problem
- One Percy-assisted next step
- One source/evidence indicator
- One link to the relevant existing feature page

Financial explanations can appear as a smaller fourth supporting use case or later homepage iteration. Do not overload the first page with every domain.

### Trust and control

Replace the current rent-record-focused `TrustClarity` section with:

**Heading:**

> Helpful AI, with you in control

**Points:**

- Answers link back to Property Peace records.
- Drafts stay drafts until reviewed.
- Consequential actions show an exact preview.
- Legal and financial decisions remain deterministic and confirmation-gated.
- Percy only works within the active user, organization, role, and resource permissions.
- Provider-dependent capabilities are labeled clearly when unavailable or in pilot.

Avoid overly technical security implementation claims on the public homepage. Keep details in a trust/help page when later created.

### Pricing preview

Keep pricing stable during the repositioning:

- Free: $0, up to 5 units, no credit card required.
- Premium: $14.99/month, unlimited units.
- Lifetime remains absent from public marketing.

Until Percy entitlement and usage limits are finalized, avoid promising unlimited AI usage. Describe Percy as a limited pilot and ensure the Free card does not imply Premium-only/unavailable functionality.

### FAQ

Condense to five homepage questions:

1. What is an AI property assistant?
2. What can Percy help with today?
3. Will Percy message tenants or change records without approval?
4. Is Property Peace still property-management software?
5. Can I start free?

The answer to #2 must follow actual readiness at implementation time. Avoid aspirational claims presented as current behavior.

### Final CTA

**Heading:**

> Spend less time checking everything. Know what needs attention.

**Body:**

> Start with your first properties, leases, and tenant records. Property Peace keeps the details organized so Percy can help you stay ahead of the work.

**Buttons:** `Start free` and `Book a walkthrough`

---

## 5. Homepage implementation tasks

### Task 1: Freeze a truthful capability matrix

**Objective:** Establish exactly which Percy statements may be marketed as available, pilot, prepared-only, planned, or unavailable.

**Files:**
- Create: `property-peace-marketing/lib/percy-capabilities.ts`
- Modify: `property-peace-marketing/scripts/check-marketing-claims.mjs`
- Reference: API/app Percy routes and feature-readiness contracts

**Steps:**

1. Inventory current Percy summaries, imports, notifications, maintenance support, and workflow actions from app/API source.
2. Classify each capability as `available`, `pilot`, `prepareOnly`, `planned`, or `unavailable`.
3. Define public labels and prohibited language for each status.
4. Add claim checks that fail if the homepage implies autonomous execution or operational provider functions that are not ready.
5. Run `npm run test:marketing-claims`; expect PASS.

**Acceptance:** Every homepage Percy claim maps to a verified capability status and has an appropriate label.

### Task 2: Add focused homepage claim regression checks

**Objective:** Protect the new positioning and prevent the homepage from drifting back to unsupported breadth or autonomy claims.

**Files:**
- Modify: `property-peace-marketing/scripts/check-marketing-claims.mjs`

**Checks to add:**

- Require “AI property assistant” or approved equivalent in homepage source/metadata.
- Require source/control/approval language.
- Forbid `fully autonomous`, `handles everything`, `sends automatically`, `24/7 property manager`, and unsupported labor-replacement claims.
- Keep all existing payment, screening, e-signature, SMS, listing, Lifetime, and pricing safeguards.
- Replace obsolete required hero patterns only after the new truthful copy is ready.

**Verification:**

Run before implementation and observe expected RED failures; run after copy implementation and expect PASS.

### Task 3: Build the new Percy-led hero

**Objective:** Make the category and customer outcome immediately clear above the fold.

**Files:**
- Modify: `property-peace-marketing/components/Sections/Hero.tsx`
- Create or substantially replace: `property-peace-marketing/components/Sections/PercyTodayPreview.tsx`
- Retire from homepage after dependency check: `property-peace-marketing/components/Sections/HeroProductStepper.tsx`
- Review assets: `property-peace-marketing/public/images/landing/`

**Implementation requirements:**

- Render critical hero copy visible in SSR; do not use initial opacity zero.
- Preserve Property Peace’s navy, green, white, boxy-button visual language.
- Reduce reliance on the generic house image; make the assistant workflow preview the memorable visual.
- Ensure preview content is explicitly representative if Today is not yet shipped in-app.
- Keep both CTAs accessible and visible on phone widths.
- Preserve no-credit-card and Free-up-to-5-units truth.

**Verification:**

- Desktop screenshot around 1440×900.
- Mobile screenshot around 390×844.
- Confirm H1, both CTAs, proof text, and key preview card are visible without hydration delay.
- Exercise the secondary CTA.

### Task 4: Build the assistant outcome strip

**Objective:** Explain the value in three scan-friendly promises without unverified customer-count or ranking claims.

**Files:**
- Create: `property-peace-marketing/components/Sections/PercyOutcomeBand.tsx`
- Modify: `property-peace-marketing/app/page.tsx`

**Verification:**

- Confirm the band does not look like fake social proof.
- Confirm mobile layout remains one concise stack, not three oversized cards.

### Task 5: Build “How Percy helps”

**Objective:** Explain Observe → Prepare → Review/Act through one coherent visual workflow.

**Files:**
- Create: `property-peace-marketing/components/Sections/HowPercyHelps.tsx`
- Modify: `property-peace-marketing/app/page.tsx`

**Implementation requirements:**

- Use connected progression rather than a generic icon grid.
- Include source indicators and an exact confirmation preview.
- Clearly distinguish a suggestion, draft, approved action, and completed action.
- Do not claim provider delivery when only a local action was prepared.

**Verification:**

- Inspect desktop and mobile pixels.
- Verify keyboard reading/order and adequate contrast.

### Task 6: Build three workflow stories

**Objective:** Demonstrate concrete landlord outcomes without recreating the old long feature catalog.

**Files:**
- Create: `property-peace-marketing/components/Sections/PercyWorkflows.tsx`
- Modify: `property-peace-marketing/app/page.tsx`
- Link to existing relevant feature routes.

**Required stories:**

- Tenant communication
- Maintenance coordination
- Lease/renewal attention

**Verification:**

- Each story links to a real route.
- No card implies unavailable automatic actions.
- Section remains concise on desktop and mobile.

### Task 7: Replace trust section

**Objective:** Make control, sources, permissions, and confirmation part of the selling proposition.

**Files:**
- Create: `property-peace-marketing/components/Sections/PercyTrust.tsx`
- Remove homepage import of: `property-peace-marketing/components/Sections/TrustClarity.tsx`
- Modify: `property-peace-marketing/app/page.tsx`

**Verification:**

- Confirm legal/financial actions are not described as autonomous.
- Confirm public copy avoids implementation-level security promises that have not been independently substantiated.

### Task 8: Condense pricing, FAQ, and CTA

**Objective:** Close the page with clear packaging and low-friction next steps.

**Files:**
- Modify: `property-peace-marketing/components/Sections/Pricing.tsx`
- Modify: `property-peace-marketing/components/Sections/FAQ.tsx`
- Modify: `property-peace-marketing/components/Sections/CTA.tsx`
- Keep plan contract in: `property-peace-marketing/components/Sections/PricingPlans.tsx`

**Verification:**

- Free remains up to 5 units.
- Premium remains $14.99/month and annual values remain consistent.
- Lifetime remains absent.
- Percy is not promised without entitlement/readiness evidence.
- FAQ accordion remains accessible and clickable.

### Task 9: Recompose and shorten the homepage

**Objective:** Replace the current long sequence with the seven-section narrative.

**Files:**
- Modify: `property-peace-marketing/app/page.tsx`

**Target composition:**

```tsx
<Hero />
<PercyOutcomeBand />
<HowPercyHelps />
<PercyWorkflows />
<PercyTrust />
<Pricing />
<FAQ />
<CTA featured />
```

If this is still too long during browser review, combine `PercyOutcomeBand` into the hero and keep the page to seven mounted sections total.

**Acceptance:**

- The homepage no longer reads as a tour of every product module.
- The first three viewport heights establish category, outcome, and operating model.
- Mobile users encounter no desktop-only block that carries essential positioning.
- Overall rendered page height is materially lower than the current homepage at matching viewport width.

---

# Part II — Marketing Site Alignment

## 6. Metadata and SEO strategy

Do not erase valuable property-management search relevance. Use a dual-layer strategy:

- **Customer-facing category:** AI property assistant.
- **Supporting search language:** property-management software, landlord software, rental-management software, maintenance requests, lease management, rent tracking, and landlord accounting.

### Homepage metadata proposal

**Title:**

> AI Property Assistant for Landlords | Property Peace

**Description:**

> Property Peace helps self-managing landlords stay ahead of tenant messages, maintenance, lease deadlines, rent records, and follow-ups with Percy, an AI property assistant available through a limited pilot. Start free for up to 5 units.

This wording must be adjusted if the capability matrix supports a stronger or narrower readiness statement.

### Files

- Modify: `property-peace-marketing/app/page.tsx`
- Modify: `property-peace-marketing/app/layout.tsx`
- Modify: `property-peace-marketing/lib/otto-seo.ts`
- Modify as required: `property-peace-marketing/lib/structured-data.ts`
- Verify: generated metadata in `out/index.html`

### SEO rules

- Keep existing URLs unless a route has a misleading purpose and a redirect plan is approved.
- Keep `property management software` in supporting copy and metadata on relevant routes.
- Do not make unsubstantiated “#1” claims.
- Update OG/Twitter title, description, and alt text consistently.
- Ensure Search Atlas overrides do not overwrite the new homepage metadata with old positioning.

---

## 7. Navigation and footer alignment

### Navigation direction

Suggested top-level navigation:

- **How Percy helps**
- **Solutions**
- **Features**
- **Resources**
- **Pricing**
- `Log in`
- `Start free`

“How Percy helps” should either anchor to the homepage section or become a dedicated `/percy` route in Release B. Do not add a route until enough real content exists to justify it.

### Solution grouping

- Tenant communication
- Maintenance
- Leasing and renewals
- Portfolio oversight
- Money and records

### Files

- Modify: `property-peace-marketing/components/Layout/Navigation.tsx`
- Modify: `property-peace-marketing/components/Layout/Footer.tsx`
- Modify if labels change: `property-peace-marketing/app/sitemap/page.tsx`
- Verify mobile navigation and mega-menu overlays.

### Acceptance

- Percy is visible in primary navigation without hiding direct feature discovery.
- Existing SEO routes remain reachable.
- Mobile menu remains compact and does not overlay/darken closed page content.

---

## 8. Pricing and packaging alignment

### Initial decision

Do not change price or unit limits during this repositioning.

### Public packaging

- Free: $0, up to 5 units.
- Premium: $14.99/month, unlimited units.
- Lifetime: internal/admin-only and never public.

### Percy packaging

Before changing plan cards, decide and implement server-owned entitlement for:

- Read-only Percy questions
- Daily/weekly briefings
- Draft preparation
- Context breadth/history
- Number or cost of assistant operations
- Automation policy access

Until that contract exists:

- Use “limited Percy Pilot” language.
- Do not publish arbitrary chat limits.
- Do not promise unlimited Percy usage.
- Do not imply all Free users receive Premium-only AI capabilities.

### Files

- Modify after entitlement decision: `property-peace-marketing/components/Sections/PricingPlans.tsx`
- Modify: `property-peace-marketing/app/pricing/page.tsx`
- Modify claim tests.
- Later coordinate with API/app subscription entitlement source of truth.

---

## 9. Secondary page alignment priority

Do not rewrite every page at once. Update in this order:

### Tier 1 — Must align with homepage release

- `app/layout.tsx`
- `app/page.tsx`
- `app/pricing/page.tsx`
- `app/demo/page.tsx`
- `app/features/page.tsx`
- `components/Layout/Navigation.tsx`
- `components/Layout/Footer.tsx`
- `lib/otto-seo.ts`

### Tier 2 — Core Percy/wedge pages

- `app/features/ai-summaries` via `app/features/[slug]/page.tsx`
- `app/maintenance/ai-maintenance/page.tsx`
- `app/maintenance/in-app-messaging/page.tsx`
- `app/maintenance-request-software-for-landlords/page.tsx`
- tenant communication feature route
- lease management/renewal-related feature routes

### Tier 3 — Supporting SEO pages

Preserve search intent while adding assistant-led differentiation:

- `app/property-management-software-for-small-landlords/page.tsx`
- `app/free-landlord-software/page.tsx`
- `app/landlord-software/page.tsx`
- `app/rental-management-software/page.tsx`
- `app/property-management-app/page.tsx`
- `app/property-management-spreadsheet-alternative/page.tsx`
- `app/landlord-accounting-software/page.tsx`
- rent and lease subroutes

### Tier 4 — Content and comparisons

- Blog/resource index framing
- New source-reviewed AI property assistant articles
- Comparison page framing
- Help center and FAQ coverage

Do not mass-rewrite legal terms or privacy copy as marketing content. Review only AI/privacy disclosures that are materially affected by actual data processing changes.

---

# Part III — Main App Repositioning

## 10. Product phase 1: Percy overlay

**Goal:** Prove usefulness without rebuilding navigation.

### Functions

- Persistent Ask Percy entry.
- Contextual Percy panel on property, lease, maintenance, messaging, and money pages.
- Read-only, source-linked portfolio questions.
- Conversation and maintenance summaries.
- Draft messages.
- Clearly labeled assumptions and missing information.
- Organization/user/context isolation.

### Required architecture

- API-owned authorized context retrieval.
- Deterministic queries/calculations for financial and lease facts.
- Server-generated source links.
- Redaction before model/provider use.
- No direct model-to-mutation path.
- Conversation state scoped by user + organization.

### Exit criteria

- Percy cannot access cross-organization records.
- Every factual answer links to records actually read.
- Financial totals match deterministic server results.
- Changing active organization clears visible and in-flight context.
- No assistant mutation is enabled.

---

## 11. Product phase 2: Today

**Goal:** Make Property Peace an attention-management product.

### New default workspace

- Daily briefing
- Needs-attention queue
- Upcoming deadlines
- Waiting-for-approval queue
- Recent changes
- Automation results/exceptions
- Ask Percy composer

### Data model principle

Today is primarily a server-owned projection of authoritative domain records. Do not create a duplicate task record for work that can be derived from lease, message, maintenance, application, document, or accounting state.

### Priority rules

Prioritization should begin deterministic:

- Explicit deadlines
- Overdue state
- Unanswered commitments
- Safety/emergency classifications
- Aging thresholds
- Provider failures
- User-configured importance

The model may explain priority; it should not secretly define legal, financial, or emergency severity.

---

## 12. Product phase 3: Prepared actions

**Goal:** Let Percy reduce work while the landlord remains in control.

### Initial prepared actions

- Draft a tenant reply.
- Prepare maintenance follow-up.
- Prefill vendor outreach.
- Prepare renewal communication.
- Prefill existing lease/listing/accounting workflows.
- Create internal reminder.

### Confirmation contract

Every consequential proposal includes:

- Action type
- Exact target
- Complete content/terms
- Reason
- Source records
- Organization and approving actor
- Impact category
- Expiry
- Proposal version/payload hash
- Changes since preparation
- Confirm, edit, decline

Execution reauthorizes and uses the existing domain service. Repeated confirmation returns the existing result instead of executing twice.

---

## 13. Product phase 4: Inbox and Work

### Inbox

Distinct filters over different authoritative records:

- Messages
- Approvals
- Exceptions
- Updates
- Follow-ups

### Work

Cross-domain operational projection:

- Needs attention
- Waiting on me
- Waiting on tenant
- Waiting on vendor
- Scheduled
- Automated
- Completed

Do not flatten messages, approvals, and failures into one ambiguous database entity.

### Mobile navigation target

- Today
- Inbox
- Work
- Portfolio
- More

Percy should be available through a persistent action or context sheet.

---

## 14. Product phase 5: Bounded automation

Only enable after read, prepare, confirmation, idempotency, audit, and recovery paths are proven.

### Good early automation candidates

- Daily/weekly briefings
- Internal reminders
- Routine acknowledgments from approved templates
- Approved maintenance troubleshooting questions
- Aging-work escalation
- Deterministic document classification
- Team notifications

### Always confirmation-gated

- Sensitive or non-template tenant communication
- New vendor contact or assignment
- Estimate approval
- Listing publication
- Renewal offers and lease changes
- Screening initiation/decisions
- Legal documents/notices
- Ledger adjustments/write-offs
- Refunds and money movement
- Sharing sensitive documents
- Bulk communication

---

# Part IV — Validation and Delivery

## 15. Marketing verification matrix

### Automated checks

Run from `property-peace-marketing`:

```bash
npm run test:marketing-claims
npm run lint
npm run build
```

Expected:

- Marketing claim test passes.
- ESLint introduces no new errors.
- Static export completes.

If WSL optional dependencies fail, copy the required root/marketing/shared workspace to `/tmp`, run `npm ci` only in the verified `/tmp` path, and keep live `node_modules` and lockfiles untouched.

### Generated-file hygiene

After build:

- Inspect `public/sitemap.xml`.
- Inspect `public/rss.xml`.
- Revert timestamp-only churn.
- Keep intentional content additions only.

### Metadata checks

Inspect built `out/index.html` for:

- New title and description
- Canonical
- OpenGraph title/description
- Twitter title/description
- Structured data consistency
- Search Atlas override consistency
- Correct icon references

### Browser checks

Serve the export and verify:

- Desktop: approximately 1440×900
- Tablet: approximately 768×1024
- Mobile: approximately 390×844

Exercise:

- Primary CTA
- Secondary hero CTA
- Workflow links
- Pricing CTA
- One FAQ
- Mobile menu open/close
- Sticky CTA behavior
- Cookie consent layering

Check browser console for hydration, navigation, and asset errors.

### Visual acceptance

- Category is understandable within five seconds.
- Percy is the lead, not a small feature mention.
- The page still feels unmistakably Property Peace.
- The page is materially shorter and less repetitive.
- No fake customer metrics, fake live activity, or unsupported provider behavior appears.
- Mobile retains the complete story rather than hiding essential Percy sections.

---

## 16. Product verification principles

Before any app-level Percy release:

- Organization and role isolation tests
- Resource ownership tests
- Deterministic financial/lease fact parity tests
- Source-link integrity tests
- Prompt/context redaction tests
- Active-user and active-organization switching tests
- Proposal expiry and stale-source tests
- Idempotent confirmation/replay tests
- Duplicate external-side-effect tests
- Provider ambiguous-outcome recovery tests
- Audit receipt and sensitive-data logging tests
- Mobile and desktop behavior
- Independent adversarial security review after final edits

---

## 17. Analytics and validation plan

The repositioning should be validated as a product hypothesis, not treated as correct because the copy sounds stronger.

### Marketing events

- Hero primary CTA click
- “See how Percy works” click
- Percy workflow-card click by use case
- Pricing view
- Registration completion
- Demo request

### Activation measures

- Properties/units imported or created
- Current lease/tenant data established
- First Percy answer viewed
- First source link opened
- First prepared action edited/approved
- Return to Today within seven days

### Product-value measures

- Time from login to identifying priority work
- Recommendation acceptance/edit/dismissal rate
- Unanswered-message aging
- Maintenance response/resolution time
- Renewal actions completed before deadline
- Administrative time saved, reported by users
- Unauthorized action denials
- Duplicate side effects
- Percy correction rate

### Initial customer validation

Before or alongside Release A, run 5–10 interviews/demos with self-managing landlords around 5–25 units. Test these messages separately:

1. “Nothing important falls through the cracks.”
2. “Your AI assistant for managing rental properties.”
3. “The organizational help of a property manager without giving up control.”

Do not use the third as a public claim until legal/positioning review confirms it does not imply licensed property-management services.

---

## 18. Decisions to make before implementation reaches pricing/product automation

These are not blockers for the initial homepage design, but must be resolved before stronger public claims:

1. Which Percy functions are genuinely available today versus limited pilot?
2. Is the hero preview an existing app screen, a labeled representative preview, or part of the same release as a real Today screen?
3. What Percy access belongs to Free versus Premium?
4. Are usage limits based on completed workflows, expensive operations, units, or another server-owned metric?
5. What communication actions, if any, may run within policy without per-action approval?
6. Is `Today` the default immediately or opt-in during beta?
7. Should `/percy` become a dedicated marketing route after the homepage is validated?

Default decisions for Release A:

- Treat Percy as a limited pilot.
- Use a clearly representative workflow preview if Today is not yet deployed.
- Keep pricing unchanged.
- Do not promise a precise AI allowance.
- Keep consequential actions approval-based.
- Preserve current URLs.

---

## 19. Recommended implementation sequence

1. Capability/readiness inventory and claim matrix.
2. Homepage wireframe and copy review with Thomas before coding.
3. Marketing-claim tests in RED state.
4. New hero and Today preview.
5. Outcome band and How Percy Helps.
6. Three core workflow stories.
7. Trust/control section.
8. Condensed pricing, FAQ, and final CTA.
9. Homepage recomposition and responsive polish.
10. Metadata/OTTO/schema alignment.
11. Navigation/footer alignment.
12. Full marketing checks, build, and browser verification.
13. Review screenshots and copy with Thomas.
14. Only after explicit approval: commit/push to `dev`.
15. Secondary marketing pages in priority tiers.
16. Product Percy overlay.
17. Today workspace.
18. Prepared actions and approvals.
19. Inbox/Work projections.
20. Bounded automation after trust and safety gates pass.

---

## 20. Definition of done for the first repositioning release

Release A is complete when:

- The homepage leads with “AI property assistant,” Percy, and the core outcome.
- The homepage is materially shorter than the current page.
- The visible narrative is Hero → Outcomes → How it works → Workflows → Trust → Pricing/FAQ → CTA.
- Every claim maps to a verified readiness status.
- Existing Free/Premium packaging remains accurate.
- Stripe payment and transfer gates remain closed and no online-payment claim is introduced.
- Existing SEO routes remain intact.
- Homepage metadata, OG/Twitter metadata, OTTO overrides, and structured data agree.
- Marketing claim tests, lint, and production build pass.
- Desktop, tablet, and mobile pixels are reviewed.
- CTA and FAQ interactions work.
- Generated sitemap/RSS churn is cleaned.
- Final diff receives copy, design, accessibility, and claim-safety review.
- No commit, push, or deployment occurs without explicit authorization.
