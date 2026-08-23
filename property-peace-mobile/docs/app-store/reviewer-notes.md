# App Review Notes — Property Peace 1.0

## Review summary

Property Peace is an account-based property-management app for iPhone. The submitted mobile v1 supports active landlord/administrator and tenant roles.

- **Landlord/administrator:** dashboard, properties, inspection checklists, tenant records, maintenance workflows, messages, notifications, settings, and read-only lease summaries.
- **Tenant:** maintenance reporting and follow-up, messages, and settings.
- **Not supported in mobile v1:** vendor/other-role workflows; creating or fully managing leases; lease detail editing; online rent collection; payment processing; and in-app purchases.
- Lease creation and full lease management remain web-only. The mobile app does not link to a purchase or checkout page.

## Review access — credential blockers

> **CREDENTIAL BLOCKER — DO NOT SUBMIT UNTIL REPLACED IN APP STORE CONNECT. Never commit real credentials to this file or the repository.**

### Landlord/administrator review account

- Email: **[CREDENTIAL BLOCKER: ENTER LANDLORD REVIEW EMAIL DIRECTLY IN APP STORE CONNECT]**
- Password: **[CREDENTIAL BLOCKER: ENTER LANDLORD REVIEW PASSWORD DIRECTLY IN APP STORE CONNECT]**
- Organization: **[DATA BLOCKER: ENTER SEEDED REVIEW ORGANIZATION NAME]**
- MFA state: **[CREDENTIAL BLOCKER: STATE “DISABLED” OR PROVIDE A RELIABLE REVIEW-SAFE MFA METHOD]**

### Tenant review account

- Email: **[CREDENTIAL BLOCKER: ENTER TENANT REVIEW EMAIL DIRECTLY IN APP STORE CONNECT]**
- Password: **[CREDENTIAL BLOCKER: ENTER TENANT REVIEW PASSWORD DIRECTLY IN APP STORE CONNECT]**
- Linked home/lease: **[DATA BLOCKER: ENTER SEEDED PROPERTY + UNIT LABEL]**
- MFA state: **[CREDENTIAL BLOCKER: STATE “DISABLED” OR PROVIDE A RELIABLE REVIEW-SAFE MFA METHOD]**

### Required seeded data

**[DATA BLOCKER: CONFIRM BEFORE SUBMISSION]** The landlord account must have a small, coherent portfolio with at least one property/unit, tenant, read-only lease, inspection checklist, maintenance request, conversation, and notification. The tenant account must have an active linked lease scope, a maintenance request with safe/non-emergency sample content, and a conversation with the same property team. Use fictional people, addresses, messages, media, and financial values only.

If credentials expire, require a private corporate network, depend on a developer’s phone/email for MFA, or cannot reach production from Apple’s review environment, submission is blocked.

## Sign-in paths

### Email and password

1. Launch the app and choose the email/password fields.
2. Enter one of the review accounts above and tap **Sign In**.
3. The app routes the authenticated user to the role-appropriate mobile experience.

### Sign in with Apple

- On iPhone, a native **Sign in with Apple** button appears on sign-in and sign-up screens when Apple Authentication is available.
- The app requests name and email from Apple. Apple may return name/email only on first authorization.
- The Apple identity token and a nonce are sent to the Property Peace API for authentication. No Apple credential should be placed in Review Notes.
- If the production Apple service configuration or reviewer path has not passed a fresh-device test, treat that as a **CREDENTIAL/CONFIGURATION BLOCKER** and do not submit.

### Multi-factor authentication (MFA)

- An account configured for MFA receives a six-digit challenge after primary sign-in.
- Supported challenge displays are an authenticator-app code or an SMS code sent to the masked verified number.
- Apple reviewers must not depend on a code sent to a team member. Prefer dedicated review accounts with MFA disabled if policy permits; otherwise provide a stable review-owned path and precise instructions directly in App Store Connect.
- **[CREDENTIAL BLOCKER: DOCUMENT THE FINAL REVIEW MFA ARRANGEMENT IN APP STORE CONNECT.]**

Registration also verifies email with a six-digit code. Registration is not required to evaluate the seeded review accounts.

## Suggested walkthrough

### Landlord/administrator account

1. Sign in and review the **Home** dashboard portfolio snapshot and recent activity.
2. Open **Properties** to view a seeded property; use **Add property** only if the seeded environment allows disposable test records.
3. Open **Checklists**, select the seeded property, and open an inspection. Photo attachment is optional.
4. Open **Maintenance** and select the seeded request to review available workflow actions.
5. Open **Messages** and the seeded conversation. If sending a message, use “App Review test — please disregard.”
6. From the dashboard profile menu, open **Leases** to see the read-only notice and lease summary.
7. Open **Settings** from the profile menu for Face ID/device unlock, legal links, support, sign-out, and account deletion.

### Tenant account

1. Sign in and open **Repairs**.
2. Open the seeded maintenance request to inspect its status and timeline.
3. Tap **Report an issue** to view the structured form. Do not submit emergency content; submitting does not contact 911.
4. Open **Messages** and **Settings** from the tab bar.

## Account deletion

Account deletion is initiated inside the app:

1. Sign in.
2. Open **Settings** (tenant: bottom tab; landlord/administrator: avatar/profile menu → **Settings**).
3. Scroll to **Delete account**.
4. Tap **Delete account**, then **Continue**, then the final **Delete account** confirmation.

The client calls `DELETE /api/user`. The in-app copy states that access is permanently removed and the personal profile is anonymized, while financial, lease, or legal records may be retained when required. Active leases or subscriptions may need resolution. **Do not delete either seeded reviewer account during routine review**; use a separate disposable deletion-test account if Apple requests an end-to-end test.

- Disposable account: **[CREDENTIAL BLOCKER: PROVIDE ONLY IN APP STORE CONNECT IF NEEDED]**
- Backend deletion/anonymization verification: **[DATA BLOCKER: RECORD VALIDATION OWNER + EVIDENCE BEFORE SUBMISSION]**

## Commerce and payments

- There are no in-app purchases, StoreKit products, or external purchase links in mobile v1.
- The mobile app does not sell digital content or subscriptions.
- Rent amounts, lease summaries, and reminders are informational/read-only. The app does not collect rent or process rent payments.
- Maintenance estimates and authorized/final costs are property-workflow records, not purchases of digital goods in the app.
- The public privacy policy discusses Stripe conditionally for online rent processing, but also states online rent processing is currently unavailable. That broader service disclosure does not mean the submitted mobile binary offers payment processing.

## Support

- Support URL: https://www.propertypeace.io/contact-us
- Support email: support@propertypeace.io
- Privacy: https://www.propertypeace.io/privacy
- Terms: https://www.propertypeace.io/terms

**[DATA BLOCKER: CONFIRM ALL URLS ARE PUBLIC, MOBILE-READABLE, AND LIVE IN PRODUCTION BEFORE SUBMISSION.]**
