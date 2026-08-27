# Property Peace — App Store Metadata (v1.0)

> Submission copy for the iPhone app `com.propertypeace.mobile`, version `1.0.0`. Character counts below include spaces and punctuation. Recheck App Store Connect fields before submission because Apple can change field rules.

## Product page copy

**Name (14/30):** Property Peace

**Subtitle (27/30):** Rentals, repairs & messages

**Promotional text (153/170):** Keep rental work moving from your iPhone. Review your portfolio, coordinate maintenance, complete property inspections, and message tenants in one place.

**Description (1,348/4,000):**

Property Peace gives landlords and tenants a focused way to handle everyday rental tasks from iPhone.

For landlords and property administrators:
• See a portfolio snapshot and recent activity
• Add and review properties
• Complete move-in and move-out inspection checklists, including photos
• Review tenants and add tenant contact details
• Acknowledge, assign, estimate, schedule, and track maintenance work
• Message tenants and applicants
• Review notifications and account settings
• View lease summaries and rent amounts

For tenants:
• Report maintenance issues with structured safety details
• Attach photos or short videos as evidence
• Follow status, appointments, troubleshooting steps, and completion updates
• Message the property team

Property Peace mobile is designed for active landlord, administrator, and tenant accounts. Vendor and other role workflows are not supported in version 1.0.

Lease records are read-only on mobile. Creating or fully managing leases remains available in the Property Peace web app. Rent information and reminders may be viewed, but the mobile app does not collect rent or process payments.

Some features require an internet connection and an active Property Peace account. Camera and photo-library access are optional and requested only when you choose to attach inspection or maintenance evidence.

**Keywords (89/100):** landlord,tenant,rental,property,maintenance,inspection,checklist,repairs,leases,messaging

## Classification recommendation

- **Primary category:** Business
- **Secondary category:** Productivity
- **Rationale:** The current app supports operational rental-property workflows rather than consumer shopping, finance transactions, or lifestyle content.

## URLs

- **Marketing URL:** https://www.propertypeace.io/
- **Support URL:** https://www.propertypeace.io/contact-us
- **Privacy Policy URL:** https://www.propertypeace.io/privacy
- **Terms of Use (reference/localization notes):** https://www.propertypeace.io/terms
- **Support email:** support@propertypeace.io

Before submission, open every URL without authentication on a mobile browser and confirm it returns the intended production page. Source inspection found these routes in `property-peace-marketing/app/`; live availability is a release gate, not established by this packet.

## Version information

**Version:** 1.0.0

**What’s New in Version 1.0 (245/4,000):**

Welcome to Property Peace on iPhone. Version 1.0 includes property and tenant overviews, inspection checklists, maintenance reporting and workflows, messages, notifications, account settings, and read-only lease summaries for supported accounts.

**Copyright:** © 2026 Brownstone Hub LLC

Confirm the seller/legal entity and year in App Store Connect before submission; Brownstone Hub LLC is the operator named in the inspected Terms of Use source.

## Age-rating recommendation

- **Working recommendation:** Complete Apple’s questionnaire truthfully with the expectation of the lowest general-audience rating (commonly 4+) if all content-frequency answers remain “None.”
- **User-generated content capability:** Yes—authenticated users can exchange messages and upload maintenance/inspection photos or videos. Do not answer “No” merely because the app is business-focused.
- **Expected content answers from mobile source:** no gambling, contests, alcohol/tobacco/drugs, sexual content/nudity, horror, profanity as app-authored content, weapons, or medical treatment content was found. Maintenance emergency guidance says to contact emergency services; it is not medical advice.
- **Validation required:** Product/legal must verify moderation, blocking/reporting, account controls, and actual production content before answering Apple’s user-generated-content and age-rating questions. If Apple’s current questionnaire produces a higher rating, use Apple’s result rather than this working recommendation.

## Export compliance

- `app.json` currently declares `ios.config.usesNonExemptEncryption: false`.
- The mobile app uses HTTPS/TLS and platform authentication/security libraries; no app-authored proprietary encryption implementation was found in the inspected source.
- **Recommended App Store Connect response:** The app does not use non-exempt encryption, subject to final counsel/export-owner confirmation and inspection of the archived binary/third-party SDK list.
- **Submission gate:** Confirm the production archive contains only exempt/OS-provided encryption and that the App Store Connect export-compliance answers match the binary. This packet is not legal advice and does not itself establish an exemption.

## Scope guardrails

Do not add claims for online rent payment, rent collection, in-app purchases, subscriptions sold in-app, digital lease signing, mobile lease creation/details, vendor workflows, tablet support, background location, push notifications, analytics, or AI-based triage unless the submitted binary and production service have been separately verified to support them. Current source explicitly presents safety signals as a deterministic checklist, not AI.
