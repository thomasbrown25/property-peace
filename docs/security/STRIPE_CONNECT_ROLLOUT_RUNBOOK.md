# Stripe Connect payee-risk rollout runbook

Status: **implemented locally in the `dev` checkout; uncommitted, not enabled, and not deployed**

This runbook is the operational checklist for enabling Property Peace rent payments after the application changes, database migration, Stripe Dashboard controls, and live-mode verification are complete. The payment and transfer kill switches must remain off until every required gate is signed off.

## Data and identity boundary

- Stripe-hosted Connect onboarding is required only for users who will receive funds (landlords, property managers, or other approved payees).
- Ordinary members and tenants are not subjected to payee KYC merely to join or pay rent.
- Property Peace stores Stripe account IDs, verification/capability state, internal review decisions, property-authority evidence references, and limited risk metadata.
- Property Peace must not collect or store raw SSNs, identity-document images, or full bank-account details. Stripe collects and stores those values.
- Stripe verification is not proof that a person owns or is authorized to manage a property. Internal Property Peace approval remains a separate requirement.

## Application controls implemented

- Separate charges and transfers; destination information is snapshotted on the rent-payment aggregate.
- Fail-closed `Stripe:RentPaymentsEnabled` and `Stripe:TransfersEnabled` switches.
- Minimum elapsed-time holds of 7 days for card payments and 14 days for ACH/bank payments.
- Durable dispute/refund blocking and transfer-reversal handling.
- `refund.created` independently retrieves the authoritative cumulative refunded charge amount and queues only the unrecovered reversal increment; processing does not depend on a later `charge.refunded` event.
- Connected-payee lifecycle: Onboarding, StripeVerified, UnderReview, PayoutApproved, Suspended.
- Admin-only review APIs and UI with required property/management-authority evidence and an explicit organization scope. Approval is valid only for that organization.
- Fresh connected-account validation before transfer: details submitted, payouts enabled, active transfer capability, no currently due or past-due requirements, no disabled reason, an unchanged digest of the complete external bank-account set, an actual manual payout schedule, no Instant Payout method, approved destination, and organization-scoped internal approval.
- New-payee limits for the first 90 days: per-payment and rolling-volume ceilings, including pending and ambiguous transfer reservations, serialized per destination with a SQL Server application lock.
- Exclusive webhook inbox claims with expiring leases; an active duplicate cannot execute side effects and stale workers cannot complete a newer claim.
- Alternate bank-sync and account-readiness paths require the same exact user, organization, connected-account, and internal-approval scope.
- Approval evidence rejects obvious raw identity, tax, date-of-birth, bank/card, and identity-document content; only references and constrained operational summaries belong in Property Peace.
- Automatic suspension after external bank-account changes, Stripe requirement regressions, disputes, or configured velocity-limit breaches.
- Manual payout policy and no Instant Payouts for new/untrusted payees.
- Critical application logs for automated connected-payee suspension events.

## Stripe Dashboard controls (live mode)

Complete these in the Stripe Dashboard for the live platform account before enabling either kill switch:

1. **Connect onboarding**
   - Use Stripe-hosted or embedded Connect onboarding, not custom forms for identity or banking data.
   - Confirm the platform's required verification information and service agreement are configured for the countries served.
2. **Webhook endpoint**
   - Confirm signature verification uses the live endpoint secret.
   - Subscribe to at least: `account.updated`, `account.external_account.created`, `account.external_account.updated`, `account.external_account.deleted`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`, `charge.refunded`, `refund.created`, and `refund.updated`.
   - Send test events and verify 2xx delivery plus durable database state changes.
3. **Payout controls**
   - Keep new connected accounts on manual payout scheduling during the controlled launch.
   - Do not enable Instant Payouts for new or untrusted accounts.
   - Verify these values through Stripe's live account response as well as the Dashboard. The application fails closed when the live schedule is not `manual` or Stripe reports an Instant Payout method.
   - Do not change an account to a faster schedule until the introductory review period, payment holds, and risk review are complete.
4. **Radar and payment controls**
   - Enable Radar and review rules appropriate for rent-sized payments, card testing, unusual velocity, and high-risk authentication outcomes.
   - Prefer 3DS/authentication where Stripe recommends or requires it; do not suppress Stripe risk blocks.
5. **Operational alerts**
   - Route disputes, negative-balance changes, failed transfers/reversals, account requirement changes, and unusual volume to an actively monitored operations channel.
   - Assign a named responder and escalation path. Logs without an alert destination do not satisfy this gate.
6. **Platform balance**
   - Confirm the platform balance is non-negative and all incident-related reversals/refunds have terminal Stripe statuses.
   - Confirm an operating reserve and documented negative-balance response procedure exist.

## Required rollout gates

All gates are mandatory. A partial pass is not approval to enable payments.

- [ ] Database migration `AddStripeConnectedPayeeRiskControls` applied successfully in the target environment.
- [ ] Database migration `AddStripeWebhookProcessingLease` applied successfully in the target environment.
- [ ] Migration preflight reports no connected-account ID assigned to multiple users. Resolve any conflict manually; do not choose an owner automatically.
- [ ] API and frontend artifacts built from the same reviewed commit.
- [ ] Full automated API suite passes.
- [ ] Connected-payee risk and transfer tests pass.
- [ ] Disposable SQL Server verification proves migration discovery, webhook claim exclusion, destination `sp_getapplock` contention/release, and two-context rolling-limit serialization. EF InMemory tests are not sufficient for this gate.
- [ ] Live webhook endpoint and event subscriptions verified.
- [ ] Dashboard payout, Instant Payout, Radar, and alert controls verified by screenshots or a second reviewer.
- [ ] At least one test connected account completes Stripe onboarding without Property Peace receiving raw KYC/bank data.
- [ ] Internal review rejects approval without property/management-authority evidence, an active Owner/Manager organization membership, and an explicit organization scope.
- [ ] Unapproved, stale, restricted, changed-bank, over-limit, disputed, and suspended payees are all blocked from transfer in staging.
- [ ] Approved healthy payee remains blocked until the correct 7-day card or 14-day ACH hold has elapsed.
- [ ] Transfer destination matches the approved connected account.
- [ ] Manual payout behavior is confirmed; Instant Payouts are unavailable for the controlled-launch payee.
- [ ] `refund.created`, `charge.refunded`, dispute, and ACH-return tests block release and exercise cumulative, replay-safe reversal and alert handling in multiple event orders.
- [ ] Duplicate webhook deliveries prove exactly one active claim; failure and lease expiry remain retryable, while a stale owner cannot mark a reclaimed event complete.
- [ ] Alternate bank sync, existing-record return, and readiness DTO tests prove cross-user and cross-organization destinations remain unavailable.
- [ ] Admin approval rejects prohibited PII-shaped evidence/notes and clearly directs reviewers to keep raw KYC data in Stripe Dashboard.
- [ ] Runtime configuration source is audited to confirm no environment variable or secret-store override enables either switch prematurely.
- [ ] Product, engineering, operations, and the designated financial-risk owner sign off.

## Controlled enablement sequence

1. Keep `Stripe:RentPaymentsEnabled=false` and `Stripe:TransfersEnabled=false` while applying the migration and verifying Dashboard controls.
2. Enable payment collection only for a tiny internal/pilot cohort while transfers remain disabled.
3. Observe payment settlement, webhook processing, accounting allocation, disputes, and alerts through the full payment-method hold window.
4. Approve only vetted pilot payees with documented property/management authority.
5. Enable transfers only for the pilot cohort after all pre-transfer checks pass.
6. Keep manual payouts and introductory limits in place for the first 60–90 days.
7. Expand gradually; immediately disable transfers and suspend affected payees on unexplained bank/ownership changes, disputes, unusual velocity, shared suspicious identifiers, or alerting failures.

## Rollback

- Set `Stripe:TransfersEnabled=false` first to stop new transfer creation. **This also disables the automatic reconciliation worker.**
- Before disabling transfers, or immediately afterward via a controlled operator runbook, enumerate every rent payment in `TransferPending`, `TransferUnknown`, `ReversalPending`, or another ambiguous external-side-effect state. Reconcile each item directly against Stripe using its idempotency key/transfer ID, record the authoritative outcome, and escalate unresolved items. Do not assume the disabled worker will finish them.
- Set `Stripe:RentPaymentsEnabled=false` to stop new rent-payment intents.
- Suspend affected connected payees internally.
- Review open PaymentIntents, transfers, payouts, disputes, refunds, and reversals in Stripe before any re-enable decision.
- Do not delete audit evidence or raw webhook records required for incident review.
