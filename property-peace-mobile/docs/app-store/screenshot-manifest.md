# App Store Screenshot Manifest — iPhone v1.0

## Non-negotiable capture rule

Every submitted image must be a direct screenshot of the production-candidate Property Peace app rendering live, seeded test data during an actual walkthrough. Do not submit mockups, slide designs, device frames, composited headlines, Figma screens, browser pages, stretched images, or screens from an unshipped build. Minor Apple-permitted cropping must not hide UI or change the screen’s meaning; the preferred workflow is no editing beyond file naming.

## Accepted-device-size strategy

- Property Peace is iPhone-only (`supportsTablet: false`), portrait-only; prepare iPhone portrait screenshots only.
- Capture all six shots on one production-candidate build and one consistent **6.9-inch App Store screenshot class** at a native accepted resolution (for example, 1320×2868 or 1290×2796 when offered by the selected device/tool).
- Before capture, open the target version’s Media Manager in App Store Connect and record the exact currently accepted dimensions below. Apple’s portal is authoritative.
- Use App Store Connect’s supported automatic scaling for smaller iPhone display classes when the portal offers it. If the portal requires a separate class or rejects the source set, recapture the same storyboard natively on an accepted device class; do not resize, stretch, pad, or upscale files.
- A Simulator is acceptable only for preflight composition. The final set required by this project must come from a **live walkthrough of the release-candidate app**, with at least one physical-iPhone capture/visual comparison recorded in the release checklist. Prefer final capture on a physical iPhone whose native screenshot dimensions App Store Connect accepts; if no owned physical device matches an accepted class, capture the final accepted-size set in an iOS Simulator connected to the live production-candidate service, then separately complete the physical-iPhone parity gate.

**Portal-verified primary class:** [EVIDENCE REQUIRED: class + pixel dimensions + verification date]

**Capture device/OS:** [EVIDENCE REQUIRED: model or Simulator runtime + iOS version]

**Build:** [EVIDENCE REQUIRED: version/build + TestFlight/EAS build ID]

## Capture prerequisites

1. Install/open the exact release candidate that will be submitted; verify `Property Peace 1.0.0 (build)` in Settings.
2. Connect to the production-candidate API configuration; do not use hardcoded local/demo screens.
3. Sign in with the dedicated fictional landlord screenshot account. Complete MFA/Sign in with Apple preflight separately; do not show credentials or one-time codes in screenshots.
4. Set portrait orientation, 100% display zoom, default text size, light appearance, English (U.S.), and a clean status bar. Use a stable Wi-Fi/cellular connection.
5. Disable personal notifications, Focus banners, low-battery warnings, VPN overlays, AssistiveTouch, screen-recording indicators, and developer menus. Set a neutral status-bar time only through an approved capture environment; never paint it in afterward.
6. Wait for all data and images to load. No spinners, error banners, skeletons, keyboard, alerts, permission dialogs, profile menu overlays, debug output, or transient toasts.
7. Confirm the seeded data checklist below and remove any real-person or real-property information.
8. Capture full-screen PNGs in order. Do not crop out the native app chrome or bottom navigation.
9. Inspect each PNG at 100% for secrets, PII, clipping, stale/error states, duplicated content, and unsupported claims.

## Clean test-data requirements

Use a dedicated, resettable fictional organization such as **Cedar Lane Demo**. Required:

- One fictional landlord name and avatar/initials; use a reserved example-domain email if an email is visible.
- 2–4 fictional properties and units with coherent occupancy counts. Use clearly fictional/non-deliverable addresses approved by the team; never use a real tenant’s address.
- 2–3 fictional tenants with example-domain emails/555-style phone data where valid for the locale.
- At least one read-only lease with internally consistent dates and rent amount; no bank/card details.
- One move-in or move-out inspection with several realistic room/item rows, varied non-alarming conditions, notes, and team-owned stock photos cleared for App Store use.
- Two or three maintenance requests with safe, ordinary issues (for example, dripping faucet or closet door), coherent statuses, dates, assignments, and no graphic, dangerous, discriminatory, or medical content.
- One conversation with natural, concise fictional messages and no phone numbers, access codes, payment instructions, links, profanity, or placeholder lorem ipsum.
- Two or three concise notifications matching the seeded records.
- No production customer records, real addresses, personal photos, tokens, QR codes, credentials, one-time codes, internal URLs, admin IDs, or accidental faces/license plates/mail.

**Seed reset owner:** [EVIDENCE REQUIRED]

**Data/privacy approval:** [EVIDENCE REQUIRED: reviewer + date]

## Six-shot storyboard

### 01 — Landlord Home / portfolio snapshot

- **Real screen:** `DashboardScreen` / **Home** tab.
- **State:** top of the loaded dashboard; greeting, portfolio snapshot (properties, units, occupied, open repairs), and first quick actions visible. Profile menu closed.
- **Story:** Establishes the real landlord dashboard and supported portfolio overview.
- **Prerequisite:** Seed counts must match the properties/units and maintenance records used in later shots; recent activity must not expose PII.
- **Filename:** `01-landlord-home-[WIDTH]x[HEIGHT].png`

### 02 — Properties / portfolio list

- **Real screen:** `PropertiesScreen` / **Properties** tab.
- **State:** loaded property list with 2–4 fictional property cards; choose a scroll position that shows complete cards and the actual add/search controls if present in the release candidate.
- **Story:** Shows mobile property review without claiming full web listing/media setup.
- **Prerequisite:** Every visible address and image is fictional or licensed test data; no empty/error state.
- **Filename:** `02-properties-[WIDTH]x[HEIGHT].png`

### 03 — Inspection checklist editor

- **Real screen:** `ChecklistEditorScreen`, reached via **Checklists** → seeded property → seeded inspection.
- **State:** a real in-progress move-in or move-out inspection with room/item rows, conditions, and at least one cleared sample photo visible; no permission dialog.
- **Story:** Demonstrates the shipped inspection/checklist workflow and optional evidence.
- **Prerequisite:** Checklist exists on the server and is accessible to the screenshot landlord; all stock evidence has release approval.
- **Filename:** `03-inspection-checklist-[WIDTH]x[HEIGHT].png`

### 04 — Maintenance workflow detail

- **Real screen:** `LandlordMaintenanceDetailScreen`, reached via **Maintenance** → seeded request.
- **State:** loaded ordinary repair showing title, status, property/unit context, and genuine workflow/timeline content. Choose a stable section with no modal or keyboard.
- **Story:** Shows maintenance coordination without suggesting emergency response, payment processing, or a vendor mobile role.
- **Prerequisite:** Use a non-emergency issue; any estimate/cost shown is a fictional workflow record and internally consistent.
- **Filename:** `04-maintenance-workflow-[WIDTH]x[HEIGHT].png`

### 05 — Messages conversation

- **Real screen:** `ConversationDetailScreen`, reached via **Messages** → seeded conversation.
- **State:** loaded thread between fictional property team and tenant/applicant; keyboard dismissed; several complete message bubbles and timestamps visible.
- **Story:** Demonstrates authenticated in-app communication.
- **Prerequisite:** No real conversation, contact data, links, access codes, rent-payment request, or unsupported attachment claim.
- **Filename:** `05-messages-[WIDTH]x[HEIGHT].png`

### 06 — Tenant repairs overview

- **Real screen:** `TenantMaintenanceScreen` / tenant **Repairs** tab, captured after signing out of the landlord account and into the seeded tenant account.
- **State:** top of loaded screen showing **Repairs & maintenance**, **Report an issue**, Current/History tabs, and at least one safe seeded request card.
- **Story:** Makes the two-sided landlord/tenant v1 scope clear using a shipped tenant screen.
- **Prerequisite:** Tenant has an active linked lease scope; request corresponds to the fictional property team data; no emergency state.
- **Filename:** `06-tenant-repairs-[WIDTH]x[HEIGHT].png`

## Capture log

For every shot record:

- **Shot / filename:**
- **UTC capture time:**
- **Device + iOS:**
- **Version/build:**
- **Account role:**
- **Source screen/route:**
- **Pixel dimensions:**
- **Live API environment:**
- **Data reset/version:**
- **Captured by:**
- **PII/claims review by + date:**
- **App Store Connect upload result:**

## Rejection checks

- Six files are native screenshots of the submitted app—not promotional slides.
- Screens match the release candidate and contain no web-only lease creation/detail, rent collection, vendor-role, purchase, or payment UI.
- No shot implies push notifications, tablet support, AI triage, digital signing, or capabilities absent from v1.
- No credentials, tokens, private URLs, real PII, copyrighted third-party media without permission, or production records.
- No status bars, tabs, text, photos, or controls are clipped; no image is upscaled.
- Localization in App Store Connect matches screenshot language.
