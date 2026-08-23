# Property Peace 1.0 — App Store Release Checklist

## Release record

- **Release owner:** [EVIDENCE REQUIRED]
- **App Store Connect app / Apple ID:** [EVIDENCE REQUIRED]
- **Bundle ID:** `com.propertypeace.mobile`
- **Marketing version:** `1.0.0`
- **Expected build number:** `1` (confirm archive/ASC; do not assume)
- **Git commit SHA used for build:** [EVIDENCE REQUIRED]
- **EAS project / account:** [EVIDENCE REQUIRED]
- **EAS build ID:** [EVIDENCE REQUIRED]
- **TestFlight build:** [EVIDENCE REQUIRED]
- **Production API environment:** [EVIDENCE REQUIRED]
- **Target submission date:** [EVIDENCE REQUIRED]
- **Final go/no-go approver:** [EVIDENCE REQUIRED]

> This packet prepares metadata and gates only. It does not sign a binary, create App Store Connect records, build, upload, deploy, install, or submit the app.

## Gate A — Local source and release configuration

- [ ] Working tree and intended release SHA recorded; unrelated dirty files are excluded from the release commit/build.
  - Evidence/command/output: [EVIDENCE REQUIRED]
- [ ] Peer-reviewed diff contains only intended v1 changes; no secrets, test credentials, local API URLs, debug menus, or mock data ship.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] `app.json` and generated native configuration confirm: name `Property Peace`, version `1.0.0`, unique build number, iPhone-only, portrait, bundle ID `com.propertypeace.mobile`, Apple Sign-In entitlement, required usage strings, `usesNonExemptEncryption: false`.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Production environment resolves to `https://api.propertypeace.io/` and production SignalR URL; release has no localhost/dev fallback in practice.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Lockfile is current and dependency/security/license review is approved.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Typecheck and all repository-approved tests pass from a clean checkout of the release SHA, including iOS compliance, registration/email, navigation, messages, maintenance, properties, startup, checklists, notification truthfulness, and product-quality suites.
  - Commands/results: [EVIDENCE REQUIRED]
- [ ] App icon, splash, and launch presentation reviewed at native resolution with no transparency/clipping where prohibited.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Camera, photo library, microphone/video, Face ID, Secure Store, Apple Authentication, file sharing/download, and Google Places use matches copy and permission timing.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] No device location, ATT prompt, ad SDK, mobile analytics SDK, push-notification entitlement, StoreKit, or unsupported capability appears unless packet and labels are updated.
  - Evidence: [EVIDENCE REQUIRED]

**Gate A owner/date/result:** [EVIDENCE REQUIRED]

## Gate B — EAS credentials, archive, and binary inspection

- [ ] EAS project linkage and build profile are documented and point to production configuration.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Apple Distribution certificate and App Store provisioning profile are valid, owned by the correct team, and include Sign in with Apple capability.
  - Evidence (no private keys): [EVIDENCE REQUIRED]
- [ ] App Store production build completed from the recorded release SHA without local uncommitted changes.
  - EAS build URL/ID: [EVIDENCE REQUIRED]
- [ ] Archive reports version `1.0.0`, correct unique build number, bundle ID `com.propertypeace.mobile`, minimum OS/device family, portrait orientation, and no iPad support.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Entitlements and embedded provisioning profile inspected; only intended capabilities are present.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Final dependency/native privacy-manifest scan completed; required-reason APIs and third-party manifests are valid.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Encryption/export owner confirms exempt/OS-provided encryption answer and `usesNonExemptEncryption` declaration match the archive.
  - Evidence/approver/date: [EVIDENCE REQUIRED]
- [ ] Upload to App Store Connect succeeds with no unresolved validation warnings/errors.
  - Upload/build processing evidence: [EVIDENCE REQUIRED]

**Gate B owner/date/result:** [EVIDENCE REQUIRED]

## Gate C — Apple agreements and App Store Connect

- [ ] Correct App Store Connect record, bundle ID, SKU, seller name, territories, availability, and pricing (free download unless business decides otherwise) confirmed.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Account Holder has accepted current developer agreements; tax and banking status do not block distribution.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Name, subtitle, promotional text, description, keywords, categories, URLs, copyright, and What’s New copied from `metadata.md`; portal character validation passes.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Support, marketing, privacy, terms, and contact URLs are public, HTTPS, mobile-readable, accurate, and live; privacy policy shows an appropriate current date and mobile-relevant disclosures.
  - URL check evidence/date: [EVIDENCE REQUIRED]
- [ ] Age-rating questionnaire completed truthfully, including authenticated messages and photo/video user content; resulting rating recorded.
  - Rating/evidence: [EVIDENCE REQUIRED]
- [ ] App Privacy answers signed off against `privacy-labels.md` by backend/privacy/legal owners; no unvalidated “Data Not Collected” claim.
  - Approvers/date/evidence: [EVIDENCE REQUIRED]
- [ ] Export compliance, content rights, advertising identifier, government encryption, and other compliance questions completed by accountable owner.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Six direct, live-app iPhone screenshots from `screenshot-manifest.md` pass dimensions/PII/claims review and upload successfully; no mock slides.
  - Media Manager evidence: [EVIDENCE REQUIRED]
- [ ] App Review contact is reachable throughout review.
  - Name/phone/email (store securely, not here): [EVIDENCE REQUIRED]
- [ ] Landlord and tenant review credentials are entered directly in App Store Connect—not Git—and work from an external network.
  - Credential verification date/owner (no secrets): [EVIDENCE REQUIRED]
- [ ] Review Notes include final MFA arrangement and seeded-data labels; all credential/data blocker placeholders are resolved in App Store Connect.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Sign in with Apple service ID/app ID/key/domain/return configuration and production backend verification are approved.
  - Evidence (no secrets): [EVIDENCE REQUIRED]

**Gate C owner/date/result:** [EVIDENCE REQUIRED]

## Gate D — TestFlight functional review

- [ ] Processed build is assigned to an internal TestFlight group; tester access and compliance state are green.
  - Build/group evidence: [EVIDENCE REQUIRED]
- [ ] Fresh install, upgrade/reinstall, first launch, foreground/background, network loss/retry, token expiry, and sign-out tested.
  - Matrix/results: [EVIDENCE REQUIRED]
- [ ] Email/password sign-in, Sign in with Apple (new authorization and returning user), email verification, forgot password, and MFA (authenticator and SMS where production-supported) tested.
  - Results: [EVIDENCE REQUIRED]
- [ ] Landlord/admin role: dashboard, properties/add property/address autocomplete, checklists/photos, tenants/add tenant, maintenance workflow, messages, notifications, read-only leases, settings tested.
  - Results: [EVIDENCE REQUIRED]
- [ ] Tenant role: repairs list, structured report, optional camera/library evidence, emergency safety interstitial, request detail/timeline, appointments/completion/reopen behavior, messages, settings tested.
  - Results: [EVIDENCE REQUIRED]
- [ ] Vendor and other unsupported roles receive the explicit unsupported-role experience and cannot enter broken landlord/tenant navigation.
  - Results: [EVIDENCE REQUIRED]
- [ ] Lease mobile UI is read-only; mobile cannot create/manage lease details. Rent collection/payment and external purchase links are absent.
  - Results: [EVIDENCE REQUIRED]
- [ ] Legal/support links and support email open correctly from logged-out and Settings paths as applicable.
  - Results: [EVIDENCE REQUIRED]
- [ ] Account deletion tested with a disposable account: two confirmations, API success, sign-out/access removal, and documented backend anonymization/retention outcome. Seeded reviewer accounts remain intact.
  - Results/backend evidence: [EVIDENCE REQUIRED]
- [ ] No P0/P1 defects; lower-severity accepted risks have owner, rationale, and follow-up.
  - Defect report: [EVIDENCE REQUIRED]

**Gate D owner/date/result:** [EVIDENCE REQUIRED]

## Gate E — Physical iPhone and media proof

- [ ] Exact TestFlight release candidate installed on at least one supported physical iPhone; device model, iOS version, and install source recorded.
  - Device/build evidence: [EVIDENCE REQUIRED]
- [ ] Safe areas, Dynamic Type at default and one larger setting, keyboard avoidance, scrolling, bottom tabs, touch targets, VoiceOver labels on critical actions, and reduced motion reviewed.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Face ID/biometric opt-in, background lock, retry, device-passcode fallback behavior, and sign-out tested on hardware.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Camera photo, camera video with audio permission where applicable, multi-select photo library, denied permissions, upload retry, private evidence view/share, and temporary-file cleanup tested.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Real network transitions tested (Wi-Fi ↔ cellular, offline, slow/recovered) during messages, maintenance, uploads, and refresh.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Sign in with Apple tested on hardware with a fresh authorization and a returning authorization; relay-email/name behavior verified.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Live-app screenshot storyboard walked end-to-end against clean fictional data. Final accepted-size set and physical-device parity comparison approved; no mockups or production PII.
  - Capture log/path/reviewer: [EVIDENCE REQUIRED]
- [ ] Battery/thermal behavior and crash-free smoke session are acceptable for the walkthrough.
  - Duration/result: [EVIDENCE REQUIRED]

**Gate E owner/date/result:** [EVIDENCE REQUIRED]

## Gate F — Submission and post-submission readiness

- [ ] Final build selected; all metadata/localizations/screenshots/privacy/export/age-rating/review fields show complete.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Manual release vs automatic release choice, phased release choice, territory timing, and version release notes approved.
  - Decision: [EVIDENCE REQUIRED]
- [ ] Final packet reviewed for unsupported claims: no payment/rent collection, in-app purchase, vendor role, mobile lease management, tablet, push, AI triage, digital signing, or unverified analytics claims.
  - Approver/date: [EVIDENCE REQUIRED]
- [ ] Production API, auth, email verification, SMS/MFA, Apple auth, Google Places, SignalR/messages, and file storage are monitored with on-call ownership during review/release.
  - Runbook/status links: [EVIDENCE REQUIRED]
- [ ] Reviewer credentials and seed data remain active through review; support contact monitors Apple messages.
  - Owner/date: [EVIDENCE REQUIRED]
- [ ] Submission confirmation and review-status URL recorded.
  - Evidence: [EVIDENCE REQUIRED]
- [ ] Rejection response owner and rollback/hold plan documented; no server-side feature is enabled that changes commerce/privacy/scope without a metadata review.
  - Plan: [EVIDENCE REQUIRED]

**Gate F owner/date/result:** [EVIDENCE REQUIRED]

## Final sign-offs

- **Engineering:** [NAME / DATE / GO-NO-GO / EVIDENCE]
- **QA:** [NAME / DATE / GO-NO-GO / EVIDENCE]
- **Product:** [NAME / DATE / GO-NO-GO / EVIDENCE]
- **Privacy/legal:** [NAME / DATE / GO-NO-GO / EVIDENCE]
- **App Store Connect owner:** [NAME / DATE / GO-NO-GO / EVIDENCE]
- **Release owner:** [NAME / DATE / FINAL DECISION]

Any unchecked blocker or empty credential/data blocker in App Store Connect is **NO-GO**. Metadata completion is not equivalent to signing, binary verification, upload, TestFlight approval, or App Store submission.
