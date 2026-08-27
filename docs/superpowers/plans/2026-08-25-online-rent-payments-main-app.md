# Online Rent Payments — Main App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Give landlords a clear request/setup/status experience, administrators a secure review workspace reached from email, and tenants payment controls only when the complete backend readiness chain allows them.

**Architecture:** A focused API module and hook retrieve organization access plus action readiness. One pure presenter maps backend statuses/blockers to a stable UI model. Landlord settings and rent collection reuse a shared access panel; admin list/detail routes perform explicit POST decisions; tenant payment components remain fail-closed.

**Tech Stack:** React, React Router, MUI, Axios, Vite, Node test runner, existing Property Peace app patterns.

**Visual direction:** Quiet, structured operational status—not a promotional card grid. Use the existing navy/green system, clear status language, directional empty/error states, keyboard-visible focus, and reduced-motion-safe feedback.

---

## Task 1: Add client contracts and the pure access-state presenter

**Files:**

- Create: `property-peace-app/src/api/rentPaymentAccess.js`
- Create: `property-peace-app/src/utils/rentPaymentAccess.js`
- Create: `property-peace-app/src/utils/rentPaymentAccess.test.js`

### Step 1: Write failing presenter tests

Define fixture inputs for access status, configure readiness, pay readiness, provider state, and blockers. Assert the presenter returns:

```js
{
  status,
  title,
  message,
  actionLabel,
  canRequest,
  canConfigure,
  canPay
}
```

Required user-facing states:

| Presenter status | Title/action intent |
|---|---|
| `not-requested` | Request online rent payments |
| `pending` | Request under review |
| `rejected` | Request not approved; show safe reason and allow explicit resubmission |
| `approved-onboarding` | Finish payment setup |
| `under-review` | Connected account under review |
| `ready` | Ready to collect rent online |
| `suspended` | Online rent payments suspended |
| `unavailable` | Online rent payments temporarily unavailable |

Priority rules:

1. global/provider unavailable overrides approved/ready presentation;
2. suspended overrides onboarding/payee state;
3. no access row maps to `not-requested`;
4. approved without recipient maps to `approved-onboarding`;
5. approved with recipient not internally approved/ready maps to `under-review`;
6. pay action allowed maps to `ready`.

Run:

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/utils/rentPaymentAccess.test.js
```

Expected: FAIL because the presenter does not exist.

### Step 2: Implement the API module

Export:

```js
export const getRentPaymentAccess = () => api.get('/api/rent-payment-access');
export const requestRentPaymentAccess = () => api.post('/api/rent-payment-access/requests');
export const listRentPaymentAccessRequests = (status) => api.get('/api/admin/rent-payment-access/requests', { params: { status } });
export const getRentPaymentAccessRequest = (publicId) => api.get(`/api/admin/rent-payment-access/requests/${publicId}`);
export const approveRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/approve`, review);
export const rejectRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/reject`, review);
export const suspendRentPaymentAccessRequest = (publicId, review) => api.post(`/api/admin/rent-payment-access/requests/${publicId}/suspend`, review);
```

Use the app's existing configured Axios instance and error normalization conventions; do not instantiate an unauthenticated client.

### Step 3: Implement the pure presenter

Use exported constants for backend statuses and blocker codes. Copy only `DecisionReason` into user-visible rejected/suspended messages; never display admin internal notes.

Use neutral language for pending and unavailable states. Do not promise a review time.

### Step 4: Make tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-app/src/api/rentPaymentAccess.js property-peace-app/src/utils/rentPaymentAccess.js property-peace-app/src/utils/rentPaymentAccess.test.js
git commit -m "feat: add rent payment access client state"
```

---

## Task 2: Add the organization access hook

**Files:**

- Create: `property-peace-app/src/hooks/useRentPaymentAccess.js`
- Create: `property-peace-app/src/hooks/useRentPaymentAccess.test.js`
- Modify only if needed: `property-peace-app/src/hooks/useFeatureReadiness.js`

### Step 1: Write failing hook tests

Cover:

- fetches access when an active organization and authenticated user exist;
- combines access DTO with existing online-rent feature/action readiness data;
- POST request invalidates/refetches access and readiness;
- duplicate click while submitting is disabled;
- request errors remain retryable and do not render an approved state;
- organization change discards stale prior-organization data.

Use the repository's existing hook test style. If no browser hook harness exists, extract the reducer/query-key builder into a pure module and test that with Node, then add a source-contract test for hook wiring.

### Step 2: Implement the hook

Return:

```js
{
  access,
  readiness,
  presentation,
  loading,
  requesting,
  error,
  requestAccess,
  refresh
}
```

Use a query/cache key containing organization ID. Abort or ignore stale responses after organization changes/unmounts.

### Step 3: Run tests

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/hooks/useRentPaymentAccess.test.js
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-app/src/hooks/useRentPaymentAccess.js property-peace-app/src/hooks/useRentPaymentAccess.test.js property-peace-app/src/hooks/useFeatureReadiness.js
git commit -m "feat: load organization rent payment access"
```

---

## Task 3: Build the shared landlord access panel

**Files:**

- Create: `property-peace-app/src/components/rent-payments/RentPaymentAccessPanel.jsx`
- Create: `property-peace-app/src/components/rent-payments/RentPaymentAccessPanel.test.mjs`
- Modify: `property-peace-app/src/sections/landlord/settings/PaymentsSettings.jsx`
- Modify: `property-peace-app/src/pages/landlord/rent-collection.jsx`
- Modify: `property-peace-app/src/pages/landlord/rent-collection-single.jsx`

### Step 1: Write failing component contract tests

Assert the source and/or rendered component:

- displays each presenter title exactly once;
- shows `Request online rent payments` for `not-requested` and `rejected` resubmission;
- disables repeat submission while pending/requesting;
- uses `Finish payment setup` only when Configure is allowed;
- never exposes Stripe onboarding controls before approval;
- uses `Refresh status` for connected-payee review pending;
- displays the safe rejection/suspension reason;
- presents an actionable retry for request/load errors;
- has an `aria-live="polite"` status region and visible focus styles;
- does not mention Premium as a requirement.

### Step 2: Implement a restrained status panel

Structure:

- small `Online rent payments` label;
- state title and one short explanatory line;
- one primary action only;
- optional secondary `View pricing`/support link only when useful;
- a compact three-step progress line for Approved organizations: `Access approved` → `Payment setup` → `Ready to collect`.

Do not animate status movement when `prefers-reduced-motion: reduce`.

### Step 3: Integrate with Payments Settings

Replace the existing generic readiness block with `RentPaymentAccessPanel`. Mount the existing Stripe setup controls only when `presentation.canConfigure` is true. Keep demo-mode copy and provider setup error handling accurate.

### Step 4: Integrate rent collection pages

At the collection overview/detail entry point:

- not requested/rejected: show the shared request panel;
- pending/suspended/unavailable: show status without payment setup controls;
- approved onboarding: route primary action to payment settings/setup;
- under review: show the status and existing connected-account state;
- ready: show normal rent collection workflow.

Do not remove manual rent recording functionality if it is otherwise available; clearly separate manual records from online collection readiness.

### Step 5: Run tests and build

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/components/rent-payments/RentPaymentAccessPanel.test.mjs
npm run lint
npm run build
```

Expected: PASS.

### Step 6: Commit

```powershell
git add property-peace-app/src/components/rent-payments property-peace-app/src/sections/landlord/settings/PaymentsSettings.jsx property-peace-app/src/pages/landlord/rent-collection.jsx property-peace-app/src/pages/landlord/rent-collection-single.jsx
git commit -m "feat: add landlord rent payment request experience"
```

---

## Task 4: Build the admin review workspace and scanner-safe email landing route

**Files:**

- Create: `property-peace-app/src/sections/admin/rent-payment-access/RentPaymentAccessReviewWorkspace.jsx`
- Create: `property-peace-app/src/pages/admin/rent-payment-access.jsx`
- Create: `property-peace-app/src/sections/admin/rent-payment-access/RentPaymentAccessReviewWorkspace.test.mjs`
- Modify: `property-peace-app/src/routes/MainRoutes.jsx`
- Modify: `property-peace-app/src/menu-items/admin-pages.js`

### Step 1: Write failing route/workspace tests

Assert:

- `/admin/rent-payment-access` lazy-loads the admin list;
- `/admin/rent-payment-access/:publicId` loads the exact detail linked from email;
- opening the detail performs GET only;
- approve/reject/suspend require an explicit user click and POST;
- approve confirmation names the organization and says it unlocks onboarding, not tenant payments;
- reject/suspend require a user-safe reason;
- internal notes are visually labeled admin-only;
- stale row version (409) prompts refresh and does not report success;
- successful decision refreshes list/detail;
- list supports Pending/Approved/Rejected/Suspended filters;
- unauthorized response uses existing admin access handling.

### Step 2: Implement the admin page

Follow the existing `StripePayeeReviewWorkspace` data/feedback conventions, but keep access approval separate from connected-payee review. The detail view should show:

- organization name and ID;
- requester and request timestamp;
- current access status and audit timeline;
- safe reason and internal notes fields;
- `Approve access`, `Reject request`, and `Suspend access` actions allowed by current state;
- link to the separate Stripe payee review once an account exists.

### Step 3: Add routing and navigation

Add lazy import and both routes in `MainRoutes.jsx`. Add `Rent payment access` to the admin menu near Stripe payees. Do not put the platform-admin route in landlord navigation.

### Step 4: Run tests and build

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/sections/admin/rent-payment-access/RentPaymentAccessReviewWorkspace.test.mjs
npm run lint
npm run build
```

Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-app/src/sections/admin/rent-payment-access property-peace-app/src/pages/admin/rent-payment-access.jsx property-peace-app/src/routes/MainRoutes.jsx property-peace-app/src/menu-items/admin-pages.js
git commit -m "feat: add rent payment access admin review"
```

---

## Task 5: Gate tenant payment UI by complete Pay readiness

**Files:**

- Modify: `property-peace-app/src/pages/tenant/payments.jsx`
- Modify: `property-peace-app/src/components/drawers/PaymentModal.jsx`
- Modify tests: relevant tenant payment tests under `property-peace-app/src/`
- Create if absent: `property-peace-app/src/pages/tenant/payments.readiness.test.mjs`

### Step 1: Write failing tenant gating tests

Assert:

- Pay not allowed hides/disables online payment initiation;
- pending organization access never exposes payment elements;
- approved organization plus incomplete onboarding/payee review never exposes payment elements;
- suspended/global unavailable closes an already-open payment modal and prevents submission;
- Pay allowed renders only payment methods returned as enabled by the API;
- API 403/409 readiness failures are shown as a safe refreshable state, not retried as a duplicate charge;
- manual payment history remains viewable when online payment creation is unavailable.

### Step 2: Apply readiness at every entry point

Use backend readiness as authority. Frontend gating is usability and defense in depth, not authorization. Recheck readiness immediately before opening the modal and rely on the API's action gate on submission.

Do not render ACH/card labels when the API does not report those capabilities.

### Step 3: Run tests and build

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/pages/tenant/payments.readiness.test.mjs
npm run lint
npm run build
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-app/src/pages/tenant/payments.jsx property-peace-app/src/components/drawers/PaymentModal.jsx property-peace-app/src/pages/tenant/payments.readiness.test.mjs
git commit -m "feat: gate tenant online rent payments"
```

---

## Task 6: Update Free-plan and stale unavailable presentation

**Files:**

- Modify: `property-peace-app/src/components/subscription/PricingTable.jsx`
- Modify: `property-peace-app/src/components/subscription/PlanComparisonTable.jsx`
- Modify: `property-peace-app/src/components/subscription/PlanCard.jsx`
- Modify: `property-peace-app/src/sections/admin/settings/AdminSettingsForm.jsx`
- Modify: `property-peace-app/src/components/SEO/SEOHead.jsx`
- Modify test: `property-peace-app/src/routes/milestone11.test.mjs`
- Create: `property-peace-app/src/components/subscription/rent-payments-free.contract.test.mjs`

### Step 1: Write failing claim tests

Require:

- Free includes `Online rent payments` with concise `Approval required` context;
- UI never suggests upgrading to Premium to request or use payments;
- Percy and SMS remain Premium;
- stale `online payments are unavailable` SEO/app claims are removed from live application copy;
- approval does not imply immediate tenant payment readiness.

### Step 2: Update subscription and settings copy

Make entitlement and operational state separate:

- entitlement: included with Free;
- availability: request approval and finish payment setup;
- Premium: Percy/SMS and existing paid benefits.

Remove Online Rent Collection from `all premium features` text in admin settings.

### Step 3: Update SEO/source contracts

Change stale source assertions in `milestone11.test.mjs` and `SEOHead.jsx` to accurate live-but-approval-required language.

### Step 4: Run tests and build

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/routes/milestone11.test.mjs src/components/subscription/rent-payments-free.contract.test.mjs
npm run lint
npm run build
```

Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-app/src/components/subscription property-peace-app/src/sections/admin/settings/AdminSettingsForm.jsx property-peace-app/src/components/SEO/SEOHead.jsx property-peace-app/src/routes/milestone11.test.mjs
git commit -m "feat: present rent payments as a free feature"
```

---

## Task 7: Main-app verification

### Step 1: Run focused tests

```powershell
Set-Location property-peace-app
node --experimental-default-type=module --test src/utils/rentPaymentAccess.test.js src/hooks/useRentPaymentAccess.test.js src/components/rent-payments/RentPaymentAccessPanel.test.mjs src/sections/admin/rent-payment-access/RentPaymentAccessReviewWorkspace.test.mjs src/pages/tenant/payments.readiness.test.mjs src/components/subscription/rent-payments-free.contract.test.mjs
```

Expected: PASS.

### Step 2: Lint and build

```powershell
npm run lint
npm run build
```

Expected: PASS.

### Step 3: Manual state walkthrough

Using a non-production environment, verify:

1. Free Owner sees Request online rent payments.
2. Request produces Pending and repeat clicks do not duplicate.
3. Email link opens authenticated admin detail without mutation.
4. Approval changes landlord action to Finish payment setup.
5. Onboarding completion changes to Connected account under review.
6. Separate payee approval changes to Ready to collect only when provider readiness passes.
7. Tenant sees payment methods only in Ready state.
8. Suspension or global kill switch removes payment actions on refresh and prevents API submission.
9. Reject/resubmit and stale review conflict both give clear recovery instructions.

### Step 4: Accessibility walkthrough

Keyboard through every action and modal; verify focus return after decisions, status updates announce politely, errors are text-not-color-only, and reduced motion removes nonessential transitions.

### Step 5: Commit verification corrections

```powershell
git add property-peace-app
git commit -m "test: verify rent payment app states"
```

