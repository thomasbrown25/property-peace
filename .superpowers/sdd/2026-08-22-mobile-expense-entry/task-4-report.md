# Task 4 report

## Implementation

Added the native three-step expense slip screen. It loads and retries properties, filters units by the chosen property, captures the local date, accepts one camera/library image receipt, reviews the payload, and uses the runtime expense API for create/upload orchestration. A receipt-upload failure stays in the partial-success state and retries only the upload endpoint.

## Files

- `property-peace-mobile/src/screens/landlord/AddExpenseScreen.tsx`
- `property-peace-mobile/src/features/expenses/expenseReceiptModel.ts`
- `property-peace-mobile/scripts/expense-flow.test.mjs`
- `property-peace-mobile/package.json`
- `property-peace-mobile/package-lock.json`
- `property-peace-mobile/app.json`

## TDD evidence

- RED: `npm run test:expenses` failed with `ERR_MODULE_NOT_FOUND` for `expenseReceiptModel.ts`.
- RED: after the helper existed, the parsed-config test failed on the old camera permission text.
- GREEN: `npm run test:expenses` passed 20 tests, including real receipt conversion/normalization and parsed `app.json` permission assertions.
- GREEN: `npx tsc --noEmit` exited 0.

## Design critique

The single progress rail is the only visual signature and corresponds directly to the actual three-step sequence. The rest of the screen uses the existing warm canvas, navy type, blue actions, green success cue, quiet white surfaces, and 44-point controls. The review state keeps the primary decision clear: save one paid property expense; receipt capture remains optional and secondary.

## Deviations and concerns

- The installed React Navigation version exports `UNSTABLE_usePreventRemove`; the screen aliases it locally as `usePreventRemove` to preserve the requested active-request navigation guard.
- The pure receipt adapter intentionally keeps picker conversion Node-testable without importing Expo or using TSX source-regex tests. It repeats only the constrained MIME/size boundary so the screen can validate picker output before state changes under the project’s extensionless Node test setup.
- Native rendering, device permissions, and date-picker presentation still need the Task 6/manual Expo smoke test; TypeScript and behavior tests cover the available non-native boundary.

## Fix round 1: review findings

- Corrected multipart transport at both boundaries. `ExpenseAPI` passes an explicit undefined `Content-Type` request header for receipt uploads, and `ApiClient` now preserves that override when it receives `FormData` instead of allowing the instance JSON default to survive. This authorized shared-client change is load-bearing for native receipt uploads.
- Added a real Axios adapter regression: before the fix Axios transformed the receipt form to `{"files":{}}`; after the fix the adapter receives the original `FormData` with no retained JSON content type.
- Added a pure request gate and screen `useRef` integration. Save and retry acquire it synchronously before starting an async request and release it in `finally`, preventing duplicate create/upload requests before React can re-render.
- Wrapped the full camera/library permission-and-launch sequence in a safe actionable alert boundary, made Remove receipt a 44-point target, and grouped success actions in a horizontal wrapper so button flex cannot vertically expand the success screen.
- Removed the temporary whitespace attributes and mechanically normalized only the touched `app.json` and `apiClient.ts` blobs to LF, so the requested raw historical `git diff --check` is clean without policy masking.

### Fix-round verification

- RED: actual Axios adapter observed `{"files":{}}` rather than `FormData` while its JSON default was active.
- RED: `npm run test:expenses` failed with `ERR_MODULE_NOT_FOUND` for the new request gate.
- GREEN: `npm run test:expenses` passed 22 tests.
- GREEN: `npx tsc --noEmit` exited 0.
- GREEN: `git diff --check 521976ba8053d9ba78f2d92dace70144b1d2c135..HEAD` was clean.
