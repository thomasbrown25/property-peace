# App Privacy Labels — Source-Based Working Map

## Status and decision rule

This is a source-based working document for the Property Peace iPhone app, not a completed legal attestation. It distinguishes what the mobile client clearly sends/receives from what still requires production backend, vendor, retention, and legal validation.

- **Confirmed in mobile source** means the submitted client contains a field or transmission path.
- **Recommended label** is the conservative App Store Connect selection suggested by that path.
- **Validation required** means the final answer cannot be established from mobile source alone.
- “Collected” follows Apple’s meaning: data transmitted off device and retained beyond the immediate request may count, even when the user intentionally supplies it. Merely displaying server data is not automatically a new collection event, but the service’s total collection and retention must be considered.

Do not publish “Data Not Collected” from `app.json`’s empty `NSPrivacyCollectedDataTypes` array. That manifest concerns Apple’s privacy-manifest mechanism and does not override the account, message, property, maintenance, and upload transmissions visible in the app.

## Proposed App Store Connect declarations

### Contact Info

#### Name — **Collect: Yes; linked to identity; not tracking**
- **Confirmed:** email registration sends first and last name; Sign in with Apple can send Apple-provided first/last name; landlords can create tenant records with first/last name.
- **Purposes:** App Functionality (account/profile and tenant-management workflows).
- **Validation required:** backend retention, support/marketing reuse, deletion behavior, and whether names are used for any additional purpose.

#### Email Address — **Collect: Yes; linked to identity; not tracking**
- **Confirmed:** registration, login, email verification, password reset, Apple private-relay/returned email handling through the backend, and tenant creation use email addresses.
- **Purposes:** App Functionality; potentially Account Management (represented in App Store Connect under App Functionality).
- **Validation required:** transactional email providers, support systems, marketing use/consent, retention, and deletion.

#### Phone Number — **Collect: Yes; linked to identity; not tracking**
- **Confirmed:** landlords may submit a tenant phone number; profiles can display a phone number; MFA can use an SMS destination.
- **Purposes:** App Functionality.
- **Validation required:** SMS provider, whether phone is optional in all flows, contact/marketing use, and retention.

#### Physical Address — **Collect: Yes; linked to identity/account/organization; not tracking**
- **Confirmed:** landlords submit property street address, city, state, and ZIP. Typed address queries/details pass through the Property Peace API’s Google Places proxy.
- **Purposes:** App Functionality.
- **Validation required:** Google Places/API logging and retention, backend retention, whether Apple treats organization-linked property addresses as identity-linked in the final account model. Use the conservative “linked” answer unless counsel confirms otherwise.

#### Other User Contact Info — **Not confirmed as a distinct mobile field**
- Do not select solely for entry permission or property details. Reassess if backend/profile fields expose additional contact handles.

### Financial Info

#### Payment Info — **Do not select from mobile source alone; backend/legal validation required**
- **Confirmed:** no payment-entry, checkout, StoreKit, or rent-collection submission exists in mobile v1.
- **Observed read-only/workflow data:** lease rent amounts and maintenance estimate/authorized/final-cost values may be displayed or entered as operational records.
- **Validation required:** whether the broader Property Peace account/backend associates payment-method data with mobile users, and Apple’s treatment of any submitted maintenance cost fields. The public policy mentions Stripe conditionally but states online rent processing is currently unavailable.

#### Credit Info — **Not found in mobile source; validate backend.**
#### Other Financial Info — **Potentially collect; legal classification required**
- Lease rent amounts and maintenance estimates/costs are handled as property records. Determine with legal/App Store owner whether these meet Apple’s “Other Financial Info” definition. If yes: linked, App Functionality, not tracking.

### Location

#### Precise Location / Coarse Location — **Do not select for device location based on current mobile source**
- No Core Location/expo-location dependency or device geolocation request was found.
- Property addresses and typed address searches belong under Physical Address, not device location.
- **Validation required:** verify production SDK/native binary and backend do not derive/store IP-based location for product use.

### Sensitive Info

- **No Apple-defined sensitive category is conclusively established from mobile source.**
- Maintenance reports can contain safety conditions, pet/access instructions, photos, and free text. Users could voluntarily include sensitive information.
- **Validation required:** legal must determine whether free-form maintenance/messages/support content requires “Sensitive Info,” considering production use and Apple’s current definitions. If selected: linked, App Functionality, not tracking.

### Contacts

- **Do not select.** No address-book/Contacts framework access was found. Manually entered tenant contact information is Contact Info, not access to the user’s device contacts.

### User Content

#### Emails or Text Messages — **Collect: Yes; linked; not tracking**
- **Confirmed:** authenticated users fetch, send, update, delete, and mark messages/conversations read.
- **Purposes:** App Functionality.
- **Validation required:** retention, moderation/access controls, notifications/email mirroring, support access, and deletion.

#### Photos or Videos — **Collect: Yes when user chooses; linked; not tracking**
- **Confirmed:** maintenance and inspection workflows can capture/select and upload photos or short videos. Camera/photo permission is user-triggered.
- **Purposes:** App Functionality.
- **Validation required:** cloud/file processor, metadata stripping (including EXIF), retention, access controls, backup, and deletion. Microphone may be used by the system camera while recording video, but no standalone audio-recording/upload flow was found.

#### Customer Support — **Do not select from mobile source alone; validate**
- In-app support opens an email composer (`mailto:`) rather than submitting a support form through the app. Messages may nonetheless include applicant/tenant/property-team communications, not necessarily customer support.
- **Validation required:** whether support correspondence is associated with the account in backend/help-desk systems.

#### Other User Content — **Collect: Yes; linked; not tracking**
- **Confirmed examples:** property/unit records; tenant records; checklist answers/condition/notes; maintenance descriptions, exact in-property location, safety signals, access/pet instructions, appointment/cancellation/reopen reasons, troubleshooting responses, and property-workflow notes.
- **Purposes:** App Functionality.
- **Validation required:** full backend schema, document/file behavior, retention, access, and deletion.

#### Gameplay Content / Other category-specific user content — **Not applicable from source.**

### Browsing History

- **Not found in mobile source.** External legal/support pages open via system linking. Validate production SDK/network telemetry.

### Search History

- **Potential collection; backend/vendor validation required.** Typed property-address queries are sent to a Property Peace API endpoint that proxies Google Places autocomplete/details.
- Determine whether queries are retained or linked beyond serving the request. If retained, select Search History: linked, App Functionality, not tracking. If not retained beyond the request, document evidence and omit.

### Identifiers

#### User ID — **Collect: Yes; linked; not tracking**
- **Confirmed:** user IDs, organization IDs, tenant/landlord roles, conversation IDs, property/unit/lease/request/checklist IDs, and authenticated JWT sessions are used to operate scoped account features.
- **Purposes:** App Functionality; Fraud Prevention or Security may apply to authentication/session identifiers.
- **Validation required:** backend/security logging, retention, and whether organization IDs should also be treated as Other IDs.

#### Device ID — **Not found as an app-authored collection path; validate binary/SDK/backend.**
- No advertising identifier or ATT request was found.

### Purchases

- **Do not select based on mobile v1 commerce.** No in-app purchase, checkout, rent-payment, or external purchase-link path exists.
- Lease/rent records may be financial records but are not purchase-history events in the submitted app. Validate broader account/backend semantics.

### Usage Data

- **Product Interaction / Advertising Data / Other Usage Data: not found as app-authored analytics collection.** No mobile analytics or advertising SDK appears in `package.json`.
- **Validation required:** API gateway logs, SignalR telemetry, hosting/CDN, authentication provider telemetry, and any SDK injected by build configuration. The marketing website’s cookie/analytics disclosures do not prove mobile-app analytics.

### Diagnostics

- **Crash Data / Performance Data / Other Diagnostic Data: not found as an app-authored collection path.** No crash-reporting SDK appears in `package.json`.
- Console logging exists, but source alone does not show off-device collection.
- **Validation required:** EAS/Expo production settings, OS diagnostics choices, server request/error logs, and any release-only SDK/configuration.

### Surroundings, Body, Health & Fitness, Other Data

- **Not found.** Camera captures user-selected evidence; the app does not implement environment scanning, health, fitness, or body measurements.
- Reassess “Other Data” only after a complete production data inventory.

## Linkage summary

Use **Data Linked to the User = Yes** for the confirmed contact info, messages, photos/videos, other user content, and user IDs because each is submitted or accessed in an authenticated user/organization/property context. Do not claim de-identification based only on UI behavior. Account deletion says some personal data is anonymized and some legal/financial/lease records may be retained; backend evidence is required.

## Tracking summary

**Working answer: Tracking = No.**

Evidence in mobile source:
- `app.json` sets `NSPrivacyTracking` to `false`.
- No ATT permission request, ad network, or mobile advertising/analytics SDK was found in the inspected package/config.
- Data flows observed are first-party account/app-functionality flows.

**Submission blocker:** Backend/legal/vendor owners must confirm that no mobile data is linked with third-party data for advertising/measurement or shared with data brokers, and that Google/Apple auth and Google Places data are used only to provide those requested services. If that confirmation fails, revise tracking answers and implement any required ATT behavior before submission.

## Backend/legal validation checklist

- **[BLOCKER]** Inventory production API/database fields reached by mobile, including implicit server data such as IP address, user agent, timestamps, and security logs.
- **[BLOCKER]** List every production subprocesser/SDK: hosting, database, file storage, email, SMS/MFA, Apple auth, Google auth/Places, monitoring, support, and backups.
- **[BLOCKER]** Record purpose, retention, linkage, disclosure, deletion/anonymization, and tracking status for each data type.
- **[BLOCKER]** Reconcile this label with the August 2026 privacy-policy source, especially its broader web analytics and conditional Stripe/DocuSign disclosures.
- **[BLOCKER]** Verify the production archive dependency list and privacy manifests; source package review is not binary verification.
- **[BLOCKER]** Obtain final sign-off from privacy/legal and the App Store Connect Account Holder/Admin. Record owner, date, and evidence in `release-checklist.md`.
