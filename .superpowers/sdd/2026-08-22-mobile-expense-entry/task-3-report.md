# Task 3 report

## Status

Complete.

## Implementation

Created a typed, pure `ExpenseAPI` with an injected HTTP client and form-data factory. `expenseAPIRuntime.ts` provides the production singleton by importing the existing `apiClient`. Submission functions require an injected API, and the retry boundary accepts only `uploadReceipt`, preserving the no-recreate invariant.

## Files

- `property-peace-mobile/src/api/expenseAPI.ts`
- `property-peace-mobile/src/api/expenseAPIRuntime.ts`
- `property-peace-mobile/src/features/expenses/expenseSubmission.ts`
- `property-peace-mobile/src/features/expenses/expenseModel.ts`
- `property-peace-mobile/scripts/expense-flow.test.mjs`

## RED / GREEN

- RED: `npm run test:expenses` — 9 pass, 6 fail with `ERR_MODULE_NOT_FOUND` for missing `expenseAPI.ts`.
- GREEN: `npm run test:expenses` — 15 passed, 0 failed.
- GREEN: `npx tsc --noEmit` — exited 0.

## Deviations

1. The original brief's default singleton in `expenseAPI.ts` was split into `expenseAPIRuntime.ts`. This preserves normal Expo extensionless imports while keeping the API class directly testable and runtime-independent; Task 4 must inject the runtime singleton.
2. Fixed the approved Task 2 strict-null narrowing in `expenseModel.ts`: `Number.isInteger` alone does not narrow nullable `propertyId` or `landlordId` under strict TypeScript.

## Concerns

No known concerns. The behavior tests use direct static module imports and focused recording/fake clients; they do not inspect source text or use lazy dynamic imports.
