# Connected-account direct charges for rent

## Charge ownership

New rent and lease-fee PaymentIntents are created on the lease payee's connected Stripe account, not on Property Peace. The request includes `Stripe-Account`, an account-local Customer, and no destination transfer, transfer group, or application fee. The immutable `StripeRentPayment.ChargeStripeAccountId` identifies the owning account. A null value means a historical platform charge; never backfill null using today's lease payee.

New accounts request Standard-equivalent controller settings:

- `controller.losses.payments = stripe`
- `controller.fees.payer = account`
- `controller.requirement_collection = stripe`
- `controller.stripe_dashboard.type = full`

Card and US bank account ACH capabilities are requested. Stripe verification, active organization authority, payout readiness and explicit security holds remain required. Stripe-managed automatic payout schedules are accepted. Stripe fees and payment losses follow the account's Stripe controller configuration; direct charges alone are not a liability guarantee.

Existing Express test accounts are not converted or deleted. Create fresh accounts using the new setup flow for this configuration. Stripe Dashboard type cannot simply be changed on an existing Account.

## Browser and saved methods

Create/update intent and setup responses include `stripeAccountId`. Rent Stripe.js instances must be initialized with `{ stripeAccount: stripeAccountId }`; missing account scope fails closed. Elements are recreated for a different lease/account/secret.

Setup: `POST /api/stripe/create-setup-intent?leaseId={id}`.

Saved methods are tenant/account-local and lease-authorized:

- `GET /api/stripe/payment-methods?leaseId={id}`
- `DELETE /api/stripe/payment-methods/{methodId}?leaseId={id}`
- `POST /api/stripe/payment-methods/{methodId}/default?leaseId={id}`

The list returns `{success:true,data:{stripeAccountId,paymentMethods:[...]}}`. Mutations reject methods owned by another connected Customer. Platform subscription Customers/payment methods are separate and unchanged. Saved-method setup does not authorize recurring automatic rent collection.

## Settlement, refunds, disputes and reporting

Direct payments settle to `Succeeded`, without Property Peace's legacy card/ACH transfer holds. Transfer, reconciliation and reversal workers exclude direct charges. Rent accounting, refund losses, returned-bank-payment losses, won-dispute recovery and reporting continue to use the original payment identity.

Provider reads use the immutable charge owner, never today's destination. Both the webhook controller inbox gate and rent handlers validate connected-account provenance. Short-stay/unknown connected money events cannot enter the rent inbox. Legacy platform charge processing remains available for historical rows.

Landlords manage their Stripe account, refunds/disputes and payout/bank settings in the full Stripe Dashboard. This change does not add a new in-app refund-creation endpoint.

## Deployment checklist

1. Apply migration `20261111044829_AddRentDirectChargeAccountProvenance` (and preceding unapplied migrations) before serving updated payment routes. It adds the immutable charge-owner column and connected Customer table/index. Do not modify existing charge ownership.
2. Configure a Stripe Connect webhook destination delivering **connected-account** events to the existing `/api/stripe/webhook` route. Check the controller's route if deploying behind a gateway prefix. Configure its signing secret as `Stripe:ConnectWebhookSecret`; retain the platform endpoint secret as `Stripe:WebhookSecret`.
3. Include `payment_intent.succeeded`, `.processing`, `.payment_failed`, `.canceled`, `charge.refunded`, `refund.created`, `refund.updated`, `charge.dispute.created`, `charge.dispute.closed`, `account.updated`, and external-account created/updated/deleted events.
4. Keep platform subscription event delivery unchanged. Keep short-stay delivery on its separate endpoint.
5. Create a fresh Standard-equivalent sandbox landlord account, finish onboarding, associate the correct operating account with a test lease, and verify connected card and ACH checkout, saved methods, refunds, disputes and account switching. Confirm Stripe records the charge on the landlord account with no platform transfer.
6. Enable `Stripe:RentPaymentsEnabled` only in the intended environment after sandbox verification. New direct charges do not require `Stripe:TransfersEnabled`; that switch remains for legacy transfers. Checked-in rollout defaults remain disabled; local environment overrides can differ.

Code verification does not replace a Stripe sandbox end-to-end test. No live account conversion, deployment or database update is performed by adding this implementation.

## Official references

- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/migrate-to-controller-properties
- https://docs.stripe.com/connect/standard-accounts
- https://docs.stripe.com/connect/account-balances
