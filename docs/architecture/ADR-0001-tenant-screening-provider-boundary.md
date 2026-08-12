# ADR-0001: Tenant Screening Provider Boundary and Launch Candidate

- **Status:** Proposed pre-decision — commercial, security, compliance, and legal diligence required; no launch provider selected
- **Date:** 2026-08-06
- **Owners:** Product and Engineering
- **Scope:** TurboTenant competitive roadmap, Milestone 3
- **Decision type:** Architecture and provisional vendor direction

> This is an engineering decision record, not legal advice. Property Peace must obtain provider contracts, security review, and qualified FCRA/state/local counsel approval before enabling production tenant screening.

## Context

Property Peace currently has a partial RentSpree integration. A landlord can initiate a background check, and the API reads applicant identity data from a rental application and sends it to provider-specific services. The current implementation does not provide the required applicant consent, authoritative quote, payment/payer evidence, provider-neutral lifecycle, durable webhook processing, dispute handling, adverse-action workflow, or report-retention controls. It also stores an SSN-shaped value on `RentalApplication`; the new screening path must not depend on or perpetuate raw SSN storage.

Milestone 3 requires a safe applicant-mediated screening workflow with transparent pricing and a replaceable provider boundary. No provider is approved or enabled by this ADR.

## Decision

### Provisional vendor direction

The Milestone 3 launch-provider decision is deliberately still open because required private commercial, technical, security, and legal terms are unavailable and no sales outreach has yet been completed. Public-source research narrows diligence as follows; it does not satisfy the plan's provider-selection gate.

- **RentSpree:** clearest tenant-specific API evidence; public $39.99/$49.99 packages; landlord or applicant payer where permitted; applicant-hosted TransUnion identity flow; public API-partner threshold of 100 screenings/month; private webhook, retention, dispute, credentialing, and contract terms unknown.
- **SmartMove:** public $25/$40/$49 hosted pay-as-you-go flow; landlord or applicant payer where permitted; applicant-hosted authorization and identity; B2B partnership path exists; API, minimums, callback, retention, and commercial terms unknown.
- **Checkr:** public tenant product starts at $24.99 and generic API documentation is technically mature; whether API tenant/housing packages are contractually available for housing decisions is unverified.

1. **Primary diligence candidate: RentSpree API.** Public material provides the clearest tenant-specific integration evidence and a provider-hosted TransUnion identity flow. This direction is conditional on expected volume, contract terms, technical documentation, security review, and legal approval.
2. **Low-volume hosted fallback: TransUnion SmartMove.** Its public hosted applicant flow and pay-as-you-go pricing are clear. It is not an approved API choice until TransUnion supplies acceptable B2B integration terms and technical documentation.
3. **Parallel diligence candidate: Checkr.** Checkr has strong public generic API, invitation, webhook, dispute, and adverse-action documentation. Public evidence does not establish that general API accounts may order tenant/housing screening products for housing decisions, so it must not be treated as an approved housing-screening provider without written confirmation.

### Architecture

Property Peace will introduce a provider-neutral screening aggregate and orchestration boundary. Provider names, payloads, report formats, and callback statuses remain inside adapters.

The canonical lifecycle is:

- `Invited`
- `ConsentPending`
- `PaymentPending`
- `Processing`
- `Complete`
- `ActionRequired`
- `Expired`
- `Disputed`
- `Failed`

Provider adapters may map richer provider states into these values, but provider-specific strings must not become domain state.

The provider boundary will support, as contract capabilities permit:

- creating a provider-hosted applicant session;
- obtaining normalized status and minimal report metadata;
- verifying and parsing signed callbacks;
- canceling or expiring an incomplete order;
- retrieving short-lived, authorized report access or initiating provider-hosted access;
- polling/reconciliation when callbacks are delayed or missed.

### Sensitive data boundary

- Applicants enter SSN/ITIN, identity-document, and similarly sensitive identity data directly in the provider-hosted flow.
- The new Property Peace screening path will not collect or persist raw SSNs, bank credentials, or identity-document images.
- Property Peace stores only provider references, masked/non-sensitive display data where contractually permitted, normalized state, audit evidence, and the minimum result facts required for the authorized housing decision.
- General rental-application update contracts must not accept provider-owned status, score, report URL, pass/fail, or decision fields.

### Immutable evidence

Each screening order records immutable snapshots of:

- organization, property/unit, listing, and application identity; before any quote or provider order is created, the server must prove that these records exist, remain eligible for screening, belong to the authenticated organization, and represent a real applicant-initiated housing transaction;
- requesting staff member and verified management authority;
- permissible-purpose certification and version;
- screening package and checks;
- an authoritative quote shown before consent, with separately itemized landlord-paid and applicant-paid portions, provider cost, allowed platform fee, taxes/fees where known, currency, jurisdiction, payer, quote expiration, and pricing-policy version; authorization and payment must reject expired or changed quotes, enforce configured jurisdictional caps, and reject any markup not expressly permitted by contract and law;
- disclosure/authorization text versions;
- consent actor, timestamp, IP-derived audit metadata, user agent, and provider authorization reference;
- rental criteria/policy version used for any later decision;
- provider and provider-order reference;
- lifecycle transition history.

Raw client idempotency keys must not be retained; store a scoped cryptographic hash.

### Applicant and staff views

Applicant and staff responses are separate contracts.

- Applicants see the package, itemized price, payer, disclosure, consent status, next action, provider continuation link, processing state, dispute/help information, and notices they are entitled to receive.
- Authorized staff see only orders for the authenticated organization and an application/property they are authorized to manage. Report access is purpose-scoped, time-limited, and audit logged.
- Neither view exposes reusable provider credentials or durable report URLs.

### Webhooks and reconciliation

- Provider callbacks must be signature verified before parsing or persistence.
- Callback events are stored in a durable inbox with a provider-scoped unique event identifier, payload hash, receipt timestamp, processing lease, result, and failure metadata.
- Duplicate and out-of-order callbacks are idempotent. State transitions are monotonic except for explicit dispute/correction/reconsideration transitions.
- Polling reconciliation covers missed callbacks where the provider contract supports it.
- Multi-step writes are transactional. Provider success followed by local persistence failure must be reconciled without creating duplicate paid orders.

### Decisions, disputes, and adverse action

Provider recommendations do not automatically approve or reject an application.

- A human-authorized, versioned rental decision records the actual criteria and report facts relied upon.
- A relevant dispute freezes automated decisioning and preserves both original and corrected report/decision history.
- Denial and conditional terms influenced by a consumer report enter an auditable adverse-action workflow.
- Notices include the applicable CRA identity/contact details, the statement that the CRA did not make the decision, dispute rights, and the right to request a free report within the applicable period, plus counsel-approved state/local disclosures.
- Notice content/version, delivery attempts, delivery evidence, and reconsideration are retained according to the approved policy.

### Retention, deletion, and support access

- Full consumer reports are not stored by default when provider-hosted access is available.
- Retention periods come from the executed provider contract and counsel-approved policy; they must not be inferred from public marketing pages.
- Expired artifacts are securely deleted under the approved disposal process, subject to documented legal holds.
- Every report access is organization-scoped and audit logged.
- Screening-related operational and security incidents are recorded in a durable incident log linked to the screening order, provider events, affected data/resources, detection source, actors, containment, remediation, notifications, and closure evidence.
- Support access requires explicit, time-bounded elevation with actor, reason, case reference, and access log. Impersonation alone does not grant consumer-report access.

### Readiness and rollout

Tenant screening remains fail closed. Subscription entitlement and operational readiness remain separate.

Production enablement requires all of the following:

1. Executed provider contract authorizing the intended tenant/housing use.
2. Provider credentialing and permissible-purpose approval.
3. Written pricing, payer, jurisdiction, refund, incomplete-order, and minimum-volume terms.
4. Private API/sandbox documentation and acceptable authentication, webhook, retry, ordering, rate-limit, and SLA behavior.
5. Security/privacy review, data-flow inventory, subprocessor review, incident terms, and retention/deletion policy.
6. FCRA and state/local counsel approval of consent, decision, adverse-action, fee, dispute, and recordkeeping workflows.
7. Sandbox acceptance covering duplicate orders, signed webhook replay, out-of-order callbacks, missed callbacks, payment failure, expiration, disputes, corrected reports, adverse action, deletion, and organization isolation.
8. Applied and verified database migration in the intended environment.
9. Independent specification, security, and code-quality review.
10. Explicit configuration and feature-readiness approval; absent or incomplete configuration remains unavailable.

## Alternatives considered

### Continue coupling directly to RentSpree

Rejected. It would spread provider status and payload assumptions into application, UI, persistence, and compliance workflows, making replacement and safe recovery difficult.

### Build a direct credit-bureau integration immediately

Rejected pending qualification. Public SmartMove material confirms a hosted flow and a B2B partnership path but does not publish sufficient API, credentialing, minimum-volume, webhook, retention, or commercial terms.

### Use Checkr immediately

Rejected pending written housing-use confirmation. Generic Checkr API capabilities are promising, but public evidence does not prove tenant-product/API entitlement for housing decisions.

### Keep landlord-entered/stored SSNs

Rejected for the new path. Provider-hosted collection materially reduces sensitive-data exposure and matches the documented RentSpree and SmartMove applicant flows.

### Automatically approve/reject from provider scores

Rejected. Provider outputs must not silently become rental decisions, and adverse-action obligations depend on the actual decision and reasons.

## Public evidence reviewed

Retrieved 2026-08-06:

- RentSpree pricing: https://www.rentspree.com/pricing
- RentSpree API integration: https://www.rentspree.com/enterprise/api-service-integration
- RentSpree SSN/ITIN handling: https://support.rentspree.com/en/does-the-ssn/itin-number-appear-on-the-tenant-screening-reports
- TransUnion SmartMove pricing: https://www.mysmartmove.com/landlord-tenant-screening
- SmartMove applicant flow: https://www.mysmartmove.com/how-it-works
- SmartMove B2B partnership: https://www.mysmartmove.com/partner-with-us
- SmartMove adverse action: https://www.mysmartmove.com/adverse-action
- TransUnion rental-screening disputes: https://www.transunion.com/client-support/rental-screening-disputes
- Checkr Tenant: https://tenant.checkr.com/
- Checkr API and webhooks: https://docs.checkr.com/
- Checkr partner documentation: https://docs.checkr.com/partners/
- FTC landlord FCRA guidance: https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know
- FTC Disposal Rule guidance: https://www.ftc.gov/business-guidance/resources/disposing-consumer-report-information-rule-tells-how
- CFPB permissible-purpose guidance: https://www.consumerfinance.gov/rules-policy/final-rules/fair-credit-reporting-permissible-purposes-for-furnishing-using-and-obtaining-consumer-reports/
- CFPB dispute-investigation guidance: https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2022-07-reasonable-investigation-of-consumer-reporting-disputes/

## Unanswered provider and legal diligence

Before selecting or enabling a provider, obtain written answers for:

- authorization for tenant/housing screening and Property Peace’s intended business model;
- credentialing, site inspection, business documentation, landlord vetting, and permissible-purpose certification;
- setup fees, minimums, wholesale prices, taxes, failed/incomplete-order charges, refunds, and payer restrictions;
- jurisdiction-specific applicant fee caps and prohibited markups;
- hosted-session lifetime, identity-data ownership, data residency, subprocessors, and PII returned to Property Peace;
- sandbox, authentication, rate limits, callback signatures, event catalog, retries, ordering, replay, and SLA;
- report-access and retention periods, export restrictions, legal holds, deletion, and contract termination;
- dispute ownership, corrected-report behavior, callback support, and reconsideration duties;
- allocation of disclosure, authorization, report-copy, adverse-action, state/local notice, and recordkeeping responsibilities;
- delivery evidence, accessibility/language support, indemnity, insurance, breach notice, audit rights, and regulatory-change handling;
- for Checkr, explicit written confirmation of tenant credit/criminal/eviction/identity/income API products for housing decisions.

## Consequences

This design requires more domain and audit infrastructure than the current direct request/poll flow. In exchange, it minimizes sensitive data, keeps provider integrations replaceable, makes lifecycle recovery testable, supports transparent pricing, and creates evidence required for responsible screening decisions.

Implementation may proceed behind a closed readiness gate using a non-network fake provider and contract tests. Real provider activation cannot proceed until the rollout gates above are satisfied.
