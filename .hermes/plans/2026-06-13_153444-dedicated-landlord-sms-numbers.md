# Dedicated Landlord SMS Numbers Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement Option B: landlords can have a dedicated Property Peace SMS number, tenant portal only displays SMS reply number when the landlord/org has one, and SMS routing is scoped to that landlord/org number instead of one global number.

**Architecture:** Add organization-scoped SMS number ownership in the backend, provision numbers through Twilio when a landlord/org enables the add-on or premium entitlement, route inbound SMS by Twilio `To` number + sender phone, and expose the dedicated SMS number to tenant conversations. Start with Twilio-backed dedicated numbers; keep existing global SMS as fallback only for internal/system notifications, not tenant-visible chat reply UX.

**Tech Stack:** .NET API, EF Core, SQL Server, Twilio, React/Vite/MUI frontend, Stripe subscriptions/add-ons.

---

## Product decision

Option B makes sense:

- One shared Property Peace number is simpler but gets messy fast for routing, branding, and compliance.
- Dedicated landlord/org numbers are cleaner: tenants text “their landlord’s Property Peace number,” inbound messages can route by the destination number, and landlords can pay for the phone number as a premium add-on.
- Landlords should not create their own Twilio account. Property Peace should own the Twilio account, buy/manage numbers centrally, and assign a purchased number to an organization/landlord.

Recommended packaging:

- If the Premium plan is already **$14.99/mo**, do **not** silently include a dedicated number unless the unit economics work.
- Better default: make dedicated SMS number a Premium feature/add-on that can be included in a higher tier or charged separately.
- Twilio US local number cost is usually low, but SMS usage, A2P 10DLC, support, failed payment handling, and number lifecycle are the real cost.
- Suggested rollout:
  - Phase 1: Dedicated number as a paid add-on, e.g. `$5/mo` or `$9/mo` per org/number.
  - Phase 2: If margins are fine, include “1 dedicated SMS number” in a higher plan, not necessarily the existing $14.99 plan.

## Current behavior summary

Relevant existing files:

- API inbound SMS:
  - `property-peace-api/Controllers/WebhookController.cs`
  - `property-peace-api/Services/InboundSmsService/InboundSmsService.cs`
- API outbound SMS notifications:
  - `property-peace-api/Services/NotificationService/NotificationService.cs`
  - `property-peace-api/Services/SmsService/*`
- Conversation lookup/routing:
  - `property-peace-api/Repositories/Conversations/ConversationRepository.cs`
- Tenant messages UI:
  - `property-peace-app/src/pages/tenant/messages.jsx`

Current weaknesses:

- Tenant portal shows a static `VITE_TWILIO_SMS_NUMBER` banner.
- Inbound SMS maps sender phone to a user, then routes to the most recent conversation.
- Inbound SMS is not scoped to a landlord/org phone number.
- A tenant with multiple conversations can route to the wrong conversation.

---

## Data model

### Task 1: Add dedicated SMS number model

**Objective:** Store a phone number assigned to an organization.

**Files:**

- Create: `property-peace-api/Models/OrganizationSmsNumber.cs`
- Create: `property-peace-api/Configurations/OrganizationSmsNumberConfig.cs`
- Modify: `property-peace-api/Data/DataContext.cs`
- Create migration after implementation.

**Model fields:**

```csharp
namespace brownstone_hub_api.Models
{
    public class OrganizationSmsNumber
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;

        public string Provider { get; set; } = "Twilio";
        public string PhoneNumber { get; set; } = string.Empty; // E.164, e.g. +15551234567
        public string ProviderPhoneNumberSid { get; set; } = string.Empty;
        public string? FriendlyName { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReleasedAt { get; set; }

        public string? StripeSubscriptionItemId { get; set; }
        public string? StripePriceId { get; set; }
    }
}
```

**Config:**

- Unique index on `OrganizationId` where active, or enforce one active number per org in service.
- Unique index on `PhoneNumber`.
- Unique index on `ProviderPhoneNumberSid`.

**Validation:**

- Migration creates table.
- EF model builds.

---

## Backend services

### Task 2: Create Twilio number provisioning service

**Objective:** Let the backend search, purchase, configure, and release Twilio numbers.

**Files:**

- Create: `property-peace-api/Services/SmsNumberService/ISmsNumberService.cs`
- Create: `property-peace-api/Services/SmsNumberService/TwilioSmsNumberService.cs`
- Modify: dependency injection setup, likely `Program.cs`.

**Required methods:**

```csharp
Task<List<AvailableSmsNumberDto>> SearchAvailableNumbersAsync(string? areaCode, string? contains);
Task<OrganizationSmsNumberDto> PurchaseNumberForOrganizationAsync(long organizationId, string phoneNumber, long requestedByUserId);
Task ReleaseNumberAsync(long organizationId, long smsNumberId, long requestedByUserId);
Task<OrganizationSmsNumberDto?> GetActiveNumberForOrganizationAsync(long organizationId);
```

**Twilio setup:**

When buying a number, configure inbound SMS webhook URL:

```txt
/api/webhook/twilio/inbound-sms
```

Existing webhook can remain if it reads both `From` and `To`.

**Validation:**

- Unit test service with mocked Twilio client wrapper.
- Confirm purchased number stores SID and E.164 number.

---

### Task 3: Add dedicated SMS number repository/query helpers

**Objective:** Efficiently look up an active org SMS number by organization or inbound destination number.

**Files:**

- Create: `property-peace-api/Repositories/OrganizationSmsNumbers/IOrganizationSmsNumberRepository.cs`
- Create: `property-peace-api/Repositories/OrganizationSmsNumbers/OrganizationSmsNumberRepository.cs`

**Methods:**

```csharp
Task<OrganizationSmsNumber?> GetActiveByOrganizationIdAsync(long organizationId);
Task<OrganizationSmsNumber?> GetActiveByPhoneNumberAsync(string e164PhoneNumber);
Task<OrganizationSmsNumber> AddAsync(OrganizationSmsNumber number);
Task<OrganizationSmsNumber> UpdateAsync(OrganizationSmsNumber number);
```

**Validation:**

- Last-10-digit matching can be acceptable for incoming numbers, but store E.164 and normalize inputs.

---

## SMS routing

### Task 4: Update inbound SMS routing to use the destination number

**Objective:** Route inbound tenant SMS to the right landlord/org based on Twilio `To` number.

**Files:**

- Modify: `property-peace-api/Controllers/WebhookController.cs`
- Modify: `property-peace-api/Services/InboundSmsService/InboundSmsService.cs`
- Modify: `property-peace-api/Services/InboundSmsService/IInboundSmsService.cs`

**Current problem:**

Inbound routing uses sender phone only, then picks most recent conversation.

**New routing:**

1. Read `From`, `To`, `Body` from Twilio webhook.
2. Normalize `To` and find `OrganizationSmsNumber` by `To`.
3. Get `organizationId` from that number.
4. Normalize `From` and match tenant user/notification phone.
5. Find or create the tenant-landlord conversation **inside that organization**.
6. Save message into that conversation.

**Important:**

If the `To` number is not a dedicated org number:

- Either reject with a helpful TwiML response, or
- keep old behavior behind a fallback flag.

Recommended: reject/friendly reply until dedicated number exists.

Example reply:

```txt
Property Peace could not route this message. Please use the number shown in your tenant portal.
```

**Validation:**

- Inbound SMS to landlord A’s number from tenant routes to landlord A conversation.
- Same tenant texting landlord B’s number routes to landlord B conversation.
- Inbound SMS to unknown number does not create random conversations.

---

### Task 5: Update outbound SMS notification sender to use the org’s dedicated number

**Objective:** When sending SMS for tenant/landlord messages, send from the org’s dedicated number when available.

**Files:**

- Modify: `property-peace-api/Services/NotificationService/NotificationService.cs`
- Modify: `property-peace-api/Services/SmsService/ISmsService.cs`
- Modify: Twilio implementation in `property-peace-api/Services/SmsService/*`

**Current behavior:**

SMS service likely uses configured global Twilio from number.

**New behavior:**

- Add optional `from` argument to SMS sending.
- Resolve conversation/org context for message notifications.
- If notification `OrganizationId` has active SMS number, use that number as `from`.
- If not, do not show SMS reply number in UI. For backend notifications, choose whether to send from global number or skip SMS for chat messages.

Recommended for chat messages:

- If no dedicated number, skip SMS chat notifications to avoid confusing replies to a global number.
- Keep global SMS for system alerts if needed.

---

## Conversation API / DTOs

### Task 6: Expose landlord/org dedicated SMS number to tenant messages UI

**Objective:** Tenant portal should only show “Reply by SMS” when selected conversation has a dedicated SMS number.

**Files:**

- Modify: `property-peace-api/Dtos/Conversation/LoadConversationDto.cs`
- Modify: `property-peace-api/Repositories/Conversations/ConversationRepository.cs`
- Modify: any AutoMapper profile if needed.

**Add DTO fields:**

```csharp
public string? DedicatedSmsNumber { get; set; }
public bool HasDedicatedSmsNumber => !string.IsNullOrWhiteSpace(DedicatedSmsNumber);
```

**Populate from:**

- `conversation.OrganizationId` → active `OrganizationSmsNumber`.
- If no org number, null.

**Validation:**

- Tenant conversation response includes `dedicatedSmsNumber` only when org has active number.

---

## Frontend tenant portal

### Task 7: Hide SMS banner unless dedicated number exists

**Objective:** Do not show the global `VITE_TWILIO_SMS_NUMBER` in tenant portal chat.

**Files:**

- Modify: `property-peace-app/src/pages/tenant/messages.jsx`

**Current UI:**

Static banner uses:

```js
const SMS_NUMBER = import.meta.env.VITE_TWILIO_SMS_NUMBER || '...';
```

**New UI:**

Use selected conversation field:

```jsx
const smsNumber = selectedConversation?.dedicatedSmsNumber;
```

Render banner only when present:

```jsx
{smsNumber && (
  <Stack ...>
    <MobileOutlined ... />
    <Typography ...>
      Reply by SMS to <Box component="span">{formatPhone(smsNumber)}</Box>
    </Typography>
  </Stack>
)}
```

**Validation:**

- No dedicated number: no SMS banner.
- Dedicated number: banner shows landlord/org number.

---

## Landlord billing + setup UI

### Task 8: Add landlord SMS number settings page/section

**Objective:** Let landlords see whether they have a dedicated number and start purchase flow.

**Files:**

- Modify or create setting section under `property-peace-app/src/sections/landlord/settings/*`
- Possibly add tab/section in `property-peace-app/src/pages/landlord/settings.jsx`

**UI states:**

1. No number:
   - “Get a dedicated Property Peace SMS number.”
   - Explain monthly price and tenant messaging benefits.
   - Button: “Choose a number” or “Activate SMS number.”
2. Number active:
   - Show number.
   - Show status active.
   - Show usage note.
   - Button: “Manage billing” or “Release number” behind confirmation.
3. Stripe payment required:
   - Show checkout/upgrade button.

---

### Task 9: Add Stripe billing path for SMS number add-on

**Objective:** Charge landlord/org before or during number provisioning.

**Files:**

- Existing subscription service files under `property-peace-api/Services/SubscriptionService/*`
- Existing Stripe controller/endpoints.

**Recommended billing design:**

- Create Stripe Price: `sms_dedicated_number_monthly`.
- Attach as subscription item to organization subscription.
- Provision number after Stripe confirms payment/subscription item active.

**Flow:**

1. User clicks “Activate dedicated SMS number.”
2. Backend creates Stripe checkout/session or subscription item.
3. Stripe webhook confirms payment/subscription update.
4. Backend purchases Twilio number and assigns it to org.
5. Frontend refreshes settings and messages.

**Avoid:** buying number before payment succeeds unless you’re okay eating failed-payment cost.

---

## Admin / operations

### Task 10: Add admin visibility and safeguards

**Objective:** Prevent orphaned numbers and give support visibility.

**Files:**

- Add admin API or extend existing admin screens later.

**Needed data:**

- Organization name
- Dedicated number
- Twilio SID
- Stripe subscription item id
- Active/released status
- Created/released dates

**Operations:**

- Release number when subscription cancelled.
- Disable SMS banner when number inactive.
- Keep audit logs for number purchase/release.

---

## Tests / validation

### Backend test cases

- Tenant with lease can message landlord as before.
- Tenant without lease but with `OrganizationId` can message org owner/landlord.
- Tenant messages endpoint returns no SMS number when org has none.
- Tenant messages endpoint returns dedicated SMS number when org has one.
- Inbound SMS to org A number routes to org A conversation.
- Inbound SMS to org B number routes to org B conversation.
- Same tenant texting two different dedicated numbers routes correctly.
- Unknown `To` number returns friendly non-routing response.
- Unknown `From` number returns friendly “we could not identify you” response.

### Frontend validation

- Tenant messages page hides SMS banner when `dedicatedSmsNumber` is null.
- Tenant messages page shows banner when `dedicatedSmsNumber` exists.
- Landlord settings shows correct activation state.

---

## Risks / tradeoffs

- **A2P 10DLC:** US SMS for businesses may require brand/campaign registration. Dedicated numbers do not remove compliance requirements.
- **Cost:** Per-number monthly cost is low, but usage/support/compliance adds overhead.
- **Routing:** Destination number based routing is much better than “most recent conversation,” but you still need tenant phone identity to be reliable.
- **Phone source of truth:** Current inbound lookup uses notification settings phone. Long-term, unify or sync `User.PhoneNumber`, tenant phone, and notification phone.
- **Cancellation:** Need lifecycle policy for releasing numbers when users cancel add-on/premium.
- **Existing global number:** Decide whether to keep it for internal notifications only or disable chat SMS fallback entirely.

---

## Open questions before implementation

1. Should dedicated SMS number be:
   - add-on only,
   - included in Premium,
   - or included in a higher plan?
2. What monthly price should the add-on use?
3. Should landlords choose area code, or should system auto-provision any local number?
4. Should inbound SMS from unknown tenant numbers create support flow, or just reply with an error?
5. Should releasing a number be immediate or at billing period end?

---

## Recommendation

Implement dedicated SMS as a paid add-on first, not bundled into the existing $14.99 Premium plan immediately.

Tenant portal should only show “Reply by SMS” when:

- selected conversation belongs to an organization, and
- that organization has an active `OrganizationSmsNumber`.

Inbound SMS should route by:

```txt
Twilio To number -> OrganizationSmsNumber -> OrganizationId -> tenant phone -> conversation
```

This is the clean foundation for landlord-owned Property Peace numbers without forcing every landlord to manage their own Twilio account.
