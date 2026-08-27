# Mobile Expense Entry Design

## Summary

Add a focused, native expense-entry flow to the landlord mobile app and make it available from the home screen. The flow records a one-time, paid expense, optionally uploads one receipt image, and relies on the existing backend OpenAI categorization performed during expense creation. The success state shows the returned Schedule E category or clearly marks the expense as needing category review.

The same change simplifies the home screen by removing the requested labels and redundant action:

- Remove `YOUR LANDLORD DAY`.
- Remove `PORTFOLIO SNAPSHOT`.
- Remove the portfolio card's `Open` button.
- Replace the `Open messages` quick action with `Add expense`.
- Keep the Messages bottom tab unchanged.

## Goals

- Let a landlord record a one-time property expense without leaving the mobile app.
- Keep data entry short and readable on a phone.
- Support a receipt captured with the camera or selected from the photo library.
- Use the existing server-side OpenAI categorizer and show its result after creation.
- Avoid duplicate expenses when receipt upload fails after the expense has already been saved.
- Keep the required general ledger category consistent with the main web app.

## Non-goals

The first mobile release will not support:

- Recurring expenses.
- Future expenses or unpaid bills.
- Maintenance-request linkage.
- Vendor selection, payment-method selection, or loan-payment editing.
- Manual tax-category selection or pre-save AI confirmation.
- Multiple receipts or PDF receipts.
- A mobile expense list, detail view, or edit flow.

These capabilities remain available in the main web app and can be added to mobile separately.

## User Experience

### Home screen

The greeting becomes the first text in the scrollable content after the top bar. The portfolio card keeps its property count and three statistics, but it has no eyebrow label and no navigation button. Its property count remains left-aligned above the statistics.

The fourth quick action becomes:

- Title: `Add expense`
- Subtitle: `Record a property expense`
- Icon: `receipt-outline`, following the existing quick-action visual treatment
- Action: navigate to the new `AddExpense` screen

### Navigation

Create a `DashboardStackParamList` containing `DashboardHome` and `AddExpense`. The visible Home tab renders a `DashboardNavigator` instead of rendering `DashboardScreen` directly. `DashboardHome` keeps its custom header and therefore hides the native stack header. `AddExpense` uses the shared native stack styling and a title of `Add expense`.

This keeps the Home tab selected while the form is open and provides native back navigation without adding another visible bottom tab.

### Form steps

The screen presents a compact progress indicator and three steps.

#### 1. Details

- Amount, required, greater than zero, with currency keyboard and display.
- Expense date, required, defaulting to the user's current local date and selected with `@react-native-community/datetimepicker` installed through Expo's compatible-package workflow.
- Property, required, loaded from the existing property API.
- Unit, optional, shown only after selecting a property that has units.

Changing the property clears a previously selected unit. If no properties exist, the screen explains that an expense must belong to a property and offers an `Add property` action.

#### 2. Describe and attach

- Description, required, trimmed, maximum 200 characters.
- One optional receipt image.
- `Take photo` requests camera permission and opens the camera.
- `Choose photo` requests photo-library permission and opens the library.
- A selected receipt shows a preview with a remove action.

Accepted receipt formats are JPEG, PNG, and WebP. A known file size greater than 10 MB is rejected before upload. Permission denial explains how the user can enable access, but does not block continuing without a receipt.

#### 3. Review

Show amount, date, property, optional unit, description, and optional receipt preview as read-only values. The primary action is `Save expense`. Supporting copy states that the expense will be categorized automatically.

The save action is disabled while a request is running. Back navigation between steps preserves all entered data.

### Success and partial success

After creation, show:

- Created expense name.
- Amount.
- Friendly Schedule E category returned by the API.
- `Done`, which returns to the home screen.

If the API returns no category or `None`, show `Needs category review` instead of presenting AI categorization as successful.

If expense creation succeeds but receipt upload fails, show `Expense saved; receipt not uploaded` and two actions:

- `Retry receipt`, which uploads only the existing image to the already-created expense ID.
- `Done`, which returns home without retrying.

The app must never call expense creation again from this partial-success state.

## Client Architecture

### Shared general categorization

Move the main app's deterministic `categorizeExpense` rules into the existing `@property-peace/shared` package and export them through a typed subpath. Keep the main app utility as a thin re-export so existing imports continue to work.

This categorizer supplies the API's required general `Category` value and preserves web/mobile ledger-category parity. It is separate from the server-side OpenAI Schedule E categorization.

### Mobile expense model

Add a pure `features/expenses/expenseModel.ts` module responsible for:

- The focused form-state type.
- Step-specific validation.
- Local-date formatting.
- Amount normalization.
- Receipt type and size validation.
- Building the `AddExpense` API payload.
- Mapping returned tax-category enum values to friendly labels.
- Deriving `categorized` versus `needs review` success presentation.

React Native components should not duplicate these business rules.

### Mobile API client

Add `api/expenseAPI.ts` with typed methods:

- `createExpense(payload)` posts JSON to `/api/Expense` and returns the unwrapped `LoadExpenseDto` data.
- `uploadReceipt(expenseId, receipt)` posts multipart form data to `/api/ExpenseReceipt/{expenseId}` using the field name `files`.

Receipt multipart data uses the React Native file shape `{ uri, name, type }`. The shared API client continues to attach the bearer token and `X-Organization-Id` header. It must be allowed to set the multipart boundary rather than forcing the default JSON content type.

### Screen state

`AddExpenseScreen` owns transient UI state only:

- Current step.
- Form values and selected property.
- Property loading/error state.
- Selected local receipt.
- Save/upload progress.
- Created expense and receipt-upload status.

No global Redux state is needed because the flow is isolated and has no mobile expense list to refresh.

## Data Flow

1. The screen loads organization-scoped properties through `PropertyAPI.getProperties()`.
2. The landlord completes the focused form and reviews it.
3. The client validates all fields and creates a payload with:
   - Current user ID as `LandlordId`.
   - Selected property and optional unit IDs.
   - Trimmed description as `Name`.
   - Shared deterministic result as `Category`.
   - Parsed amount and selected local date.
   - `IsRecurring: false`.
   - `IsPaid: true` and the current timestamp as `PaidDate`.
   - Expense date as `BillDate` and `DueDate`.
   - No `TaxCategory`, allowing backend AI categorization.
4. `POST /api/Expense` creates the record. The existing service invokes `ExpenseCategorizationService`, persists the returned Schedule E fields, and returns the created expense.
5. If no receipt was selected, the screen immediately shows success.
6. If a receipt was selected, the client uploads it to the returned expense ID.
7. Receipt success shows normal success. Receipt failure stores the created ID and enters partial-success state so only the upload can be retried.

## Errors and Edge Cases

- Property load failure: show retry without discarding other form state.
- No properties: show the empty-state explanation and Add Property action.
- Invalid amount, date, property, unit, description, file type, or size: show inline or adjacent validation and do not submit.
- Missing current user ID: block save with an account-context error rather than sending an invalid landlord ID.
- Expense creation failure: remain on Review with all data intact and allow save retry.
- AI failure: accept the successfully created expense and label it `Needs category review`, matching the backend's non-blocking behavior.
- Receipt upload failure: retain the created expense ID and local image for upload-only retry.
- Back or close during an in-flight request: prevent navigation until the active create or upload request settles, so request completion cannot produce an unknown result.
- Repeated taps: guard with submission state so only one create request is issued.

## Security and Privacy

- Expense and receipt requests use the existing authenticated API client and current organization header.
- The client never holds or calls an OpenAI credential; categorization stays on the server.
- Receipt images are sent only to the existing Property Peace receipt endpoint.
- API authorization remains the source of truth for landlord/manager access and organization ownership.
- Error UI must not expose tokens, internal prompts, or raw server diagnostics.

## Accessibility

- Every input has a visible label and accessibility label.
- Camera, library, remove, back, retry, and save controls expose meaningful accessibility names.
- Errors are expressed in text, not color alone.
- Touch targets meet the existing minimum 44-point convention.
- The layout works with keyboard avoidance, safe-area insets, and scrollable content on small screens.

## Testing Strategy

Implementation follows test-driven development.

### Pure model tests

Add a Node test file for:

- Required-field and step validation.
- Positive decimal amount parsing.
- Local date serialization without UTC date drift.
- Property change clearing the selected unit.
- Shared general-category parity.
- Focused `AddExpense` payload construction.
- Receipt MIME type and 10 MB validation.
- Friendly tax-category mapping and the `Needs category review` fallback.

### API and flow contract tests

Cover:

- Expense creation endpoint and payload shape.
- Multipart receipt endpoint, field name, and React Native file metadata.
- Dashboard source no longer containing the two removed labels or the Open button.
- Dashboard source containing the Add expense action and no Open messages action.
- Dashboard stack registration and AddExpense navigation.
- Create success without a receipt.
- Create success followed by receipt success.
- Create success followed by receipt failure and upload-only retry.
- Create failure preserving editable state.

### Verification

- Run the focused mobile expense tests.
- Run the existing mobile test scripts.
- Run TypeScript with `tsc --noEmit`.
- Run the shared categorization tests and affected main-app tests.
- Start the Expo app for a manual smoke test of small-screen layout, native date selection, camera/library permissions, save, AI-result display, and receipt retry.

## Expected Files

- `property-peace-mobile/src/screens/landlord/DashboardScreen.tsx`
- `property-peace-mobile/src/screens/landlord/AddExpenseScreen.tsx`
- `property-peace-mobile/src/features/expenses/expenseModel.ts`
- `property-peace-mobile/src/api/expenseAPI.ts`
- `property-peace-mobile/src/navigation/MainNavigator.tsx`
- `property-peace-mobile/src/navigation/types.ts`
- `property-peace-mobile/scripts/expense-flow.test.mjs`
- `property-peace-mobile/package.json`
- `property-peace-mobile/package-lock.json`
- Shared categorization module, type declaration, and package export
- Main-app categorization re-export and existing categorization tests

No backend production change is required because expense creation, receipt upload, authorization, organization scoping, and OpenAI categorization already exist.
