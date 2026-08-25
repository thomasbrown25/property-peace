# Task 8 report — combined Upcoming obligations

## Result

The unified Finances shell now renders one Upcoming tab that combines recurring schedules and one-time future expenses through `buildUpcomingEntries`. It preserves the existing record-as-paid payload, pause/resume, destructive confirmations, deletion errors, property scope, search/type filters, responsive rows, distinct empty/error/loading states, and active-tab CSV export.

The Task 8 commit uses the requested message `feat: combine upcoming finance obligations`; its hash is reported in the task handoff.

## Files

- `property-peace-app/src/sections/landlord/finances/UpcomingTab.jsx`
- `property-peace-app/src/sections/landlord/finances/UpcomingRow.jsx`
- `property-peace-app/src/pages/landlord/finances.jsx`
- `property-peace-app/src/architecture/financesPage.test.mjs`
- `property-peace-app/src/utils/upcomingTab.js`
- `property-peace-app/src/utils/upcomingTab.test.js`
- `.superpowers/sdd/2026-08-25-finances-consolidation/task-8-report.md`

No route/menu, legacy Expenses page, accepted Payments/Expenses module, expense hook/reducer/action cache architecture, global drawer, backend, dependency, or lockfile changed.

## Implementation notes

- `UpcomingTab` dispatches one `getRecurringExpensesAction` and one `getFutureExpensesAction` for the authenticated landlord whenever the relevant property scope, finance mutation version, or explicit retry version changes. Scheduled endpoints do not accept date scope, so shared period-only changes do not issue duplicate scheduled requests.
- Both Redux collections flow directly through `buildUpcomingEntries`, preserving the already-tested ascending actionable-date ordering and invalid/missing-date-last behavior. `UpcomingRow` renders invalid/missing dates as `Date not set`.
- The pure `selectUpcomingEntries` seam applies property, search, and `All`/`Recurring`/`One-time` filtering without mutating or reordering the combined list. Property identity accepts both camelCase and PascalCase source records.
- Recurring and one-time types are visible text chips. Recurring rows also show paused/active frequency text, and mobile rows retain stacked Property, timing, amount, and action labels/controls.
- The hidden `CSVLink` is built from every combined filtered row. No pagination was introduced, and export registers with `registerExport('upcoming', registrationKey, exportState)` in `useLayoutEffect`.
- Initial/scope/retry loads use a live loading state. Reducer errors expose a retry alert without presenting a false empty schedule; a successful sibling collection can remain visible below a partial error.
- Unfiltered portfolio emptiness says `No upcoming expenses are scheduled`. Search/type/property-filtered emptiness says `No upcoming expenses match these filters`.
- Record as paid retains the legacy `addExpenseAction` fields: landlord/property/unit, name/category/amount/date, vendor/payment method, recurring/deductible/maintenance flags, and paid timestamp. One-time recording deletes the future source after the expense add succeeds.
- `addExpenseAction` retains its accepted mounted keyed-list invalidation, so record-as-paid refreshes editable Expenses without a duplicate list request. The single successful `onMutation` call advances Money Center, Payments, and scheduled-source refreshes.
- Pause/resume and recurring/one-time deletion use the existing Redux actions. All successful handlers pass through one notification helper that calls `onMutation` exactly once; catch paths do not notify or filter out the row.

## TDD evidence

### Initial RED

```text
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs
```

Result before integration: 9 existing page contracts passed and the new Upcoming contract failed at the expected missing `UpcomingTab.jsx` boundary.

```text
node --experimental-default-type=module --test src/utils/upcomingTab.test.js
```

After correcting the test file's own initial syntax typo, the meaningful selector RED was `ERR_MODULE_NOT_FOUND` for `upcomingTab.js`.

### GREEN

The pure selector plus existing Finances model suite passed 15/15. After the row/tab/page integration, the architecture plus executable model target passed 25/25.

## Final verification

Full focused Finances, Money Center, drawer-refresh, payment, and accepted keyed-expense suite:

```text
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/architecture/financeDrawerRefresh.test.mjs src/architecture/financesDataFlow.test.mjs src/utils/finances.test.js src/utils/upcomingTab.test.js src/utils/paymentsTab.test.js src/utils/expensesTab.test.js src/store/expense/expenseListRequest.test.js src/utils/moneyCenter.test.js src/api/moneyCenter.contract.test.js src/utils/expenseCategorization.test.js
```

Result: exit 0; 83 passed, 0 failed, 0 skipped.

Explicit Babel parsing passed for all six Task 8 source/test files: the Finances page, UpcomingTab, UpcomingRow, Upcoming utility, Upcoming utility test, and page architecture test.

The production build transformed 17,817 modules and completed successfully. Only the existing mixed static/dynamic import and large-chunk advisories remained.

The two adjacent TransactionFilterToolbar tests were rerun and both stopped during startup because the installed dependency set does not contain `vitest`; no toolbar assertion or Task 8 code ran.

Focused ESLint was attempted for all six Task 8 source/test files and could not start because the existing AJV/ESLint dependency tree is missing `fast-deep-equal`. No dependency repair was included.

## Self-review

- Confirmed one combined filtered list owns row rendering and CSV data; there are no separate recurring/future tabs or pagination-only exports.
- Confirmed scheduled fetches occur once each in one effect keyed only by landlord, property, mutation version, and explicit retry.
- Confirmed property filtering is enforced client-side across both normalized types in addition to the scheduled API request scope.
- Confirmed valid/missing date presentation, type/status text, desktop header, stacked mobile fields, and accessible action labels.
- Confirmed successful record, pause/resume, and delete handlers notify once after every required action resolves. Failure paths keep reducer rows and do not notify.
- Confirmed record-as-paid uses accepted keyed expense invalidation and contains no `useFetchExpenses`, `getExpensesAction`, or direct expense refetch.
- Confirmed active export uses the current registration key and every filtered row, and loading/error/empty states disable export truthfully.
- Confirmed no page shell, breadcrumbs, PropertySelect, metrics, creation drawer, route/menu work, or legacy deletion moved into the tab.

## Fix Round 1 — stale requests and partial commits

The independent review's two Important findings are resolved.

- Recurring and future list thunks now stamp every start/success/failure with a monotonic request ID and a caller-supplied request scope key. Each reducer accepts only the latest matching completion, so late property, retry, and pre-mutation responses cannot replace current scheduled data or status.
- List loading/error/request state is separate from mutation loading/error. The legacy collection plus `loading`/`error` fields and selectors remain available for existing Expenses/property consumers; Upcoming uses the new list-specific selectors and renders/exports only collections settled for its landlord/property/mutation/retry key.
- Successful scheduled mutations invalidate any older in-flight list identity after applying their local result, preventing a pre-pause or pre-delete response from restoring stale rows.
- A successful one-time expense add immediately stores a Redux cleanup marker keyed by the future expense ID, then advances the page finance mutation version exactly once. The normal delete and every later reconciliation are delete-only and never create a second expense or call the finance mutation callback again. Round 2 below replaces the initial source snapshot marker with minimal persisted metadata.
- Delete failure preserves the marker and source row, shows `Expense recorded, but the scheduled item could not be removed`, and changes the row action to `Retry scheduled cleanup`. A successful delete or a current settled future list proving the source absent clears the marker.
- Round 1 kept the marker only in Redux, which covered tab unmount/remount and route navigation but not a hard reload. Round 2 below closes that limitation with landlord-namespaced browser storage and hydration gating.

### Fix RED

The initial focused run produced 9 passing existing contracts and 6 direct failures: recurring/future stale success/failure overwrites, shared list/mutation state, missing cleanup marker reconciliation, and missing UI partial-recovery/current-scope integration.

### Fix GREEN and final verification

```text
node --experimental-default-type=module --test src/store/scheduledExpenseRequest.test.js src/architecture/financesPage.test.mjs
```

Result: 17 passed, 0 failed. This includes executable recurring/future thunk tests with out-of-order settlement, direct reducer race/status/mutation invalidation tests, cleanup marker reconciliation, and the UI architecture contract.

```text
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/architecture/financeDrawerRefresh.test.mjs src/architecture/financesDataFlow.test.mjs src/utils/finances.test.js src/utils/upcomingTab.test.js src/utils/paymentsTab.test.js src/utils/expensesTab.test.js src/store/expense/expenseListRequest.test.js src/store/scheduledExpenseRequest.test.js src/utils/moneyCenter.test.js src/api/moneyCenter.contract.test.js src/utils/expenseCategorization.test.js
```

Result: 90 passed, 0 failed, 0 skipped.

Explicit Babel parsing passed for all 11 owned changed JavaScript/JSX/MJS files. The production build again transformed 17,817 modules and passed; only the existing mixed-import and large-chunk advisories remained.

The fix commit uses the requested message `fix: stabilize upcoming finance mutations`; its hash is reported in the task handoff.

## Concerns

- TransactionFilterToolbar tests remain unavailable until `vitest` is restored to installed dependencies.
- Focused ESLint remains unavailable until `fast-deep-equal` is restored.
- The Finances page remains intentionally unrouted until Task 9, so authenticated browser smoke testing is deferred to route integration.
- Production build advisories are pre-existing and unrelated to Task 8.

## Fix Round 2 — persisted, property-aware cleanup recovery

The re-review's two Important findings and line-ending churn are resolved.

- Future list request metadata now carries landlord and property scope. A current property-scoped success reconciles only cleanup markers owned by that landlord and property; a current portfolio success may reconcile all of that landlord's markers. Other-property and other-landlord markers remain untouched.
- Cleanup markers persist under a versioned `localStorage` key namespaced by landlord. The serialized payload contains only `futureExpenseId`, `propertyId`, `landlordId`, and cleanup state; it contains no expense response, schedule snapshot, property text, name, vendor, or other descriptive data.
- Upcoming hydrates the authenticated landlord's markers into Redux before scheduled requests run and while rows/actions remain behind the loading gate. A restored marker therefore makes Record as paid delete-only before any `addExpenseAction` can execute.
- Redux remains the runtime source of truth. The storage module narrowly owns defensive read/write/upsert/remove behavior, tolerates malformed or unavailable storage, rejects mismatched ownership, and removes the landlord key when no markers remain.
- The marker is written immediately after the expense add commits and is removed immediately after successful scheduled deletion. A current authoritative in-scope future response that proves the source absent clears Redux, and the isolated synchronization effect clears persisted storage.
- The seven existing recurring/future action, reducer, selector, and types modules are stored with their original CRLF convention, so the final cumulative Task 8 diff contains their semantic changes without the prior line-ending-only churn.

### Fix Round 2 RED

The initial combined target produced 16 passing contracts and 4 expected failures: the missing storage module/UI integration, cross-property marker loss, missing hydration identity, and missing persisted recovery behavior.

### Fix Round 2 GREEN and final verification

```text
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/store/scheduledExpenseRequest.test.js src/store/future-expense/future-expense.cleanup-storage.test.js
```

Result: 23 passed, 0 failed. This includes property-versus-portfolio reconciliation, landlord hydration switching, hard-reload persistence, per-user isolation, malformed/unavailable storage, clear-on-reconcile, and the UI delete-only-before-add contract.

```text
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/architecture/financeDrawerRefresh.test.mjs src/architecture/financesDataFlow.test.mjs src/utils/finances.test.js src/utils/upcomingTab.test.js src/utils/paymentsTab.test.js src/utils/expensesTab.test.js src/store/expense/expenseListRequest.test.js src/store/scheduledExpenseRequest.test.js src/store/future-expense/future-expense.cleanup-storage.test.js src/utils/moneyCenter.test.js src/api/moneyCenter.contract.test.js src/utils/expenseCategorization.test.js
```

Result: 96 passed, 0 failed, 0 skipped.

Explicit Babel parsing passed for all nine Round 2 JavaScript/JSX/MJS files. The production build transformed 17,817 modules and passed; only the existing mixed-import and large-chunk advisories remained.

The Round 2 commit uses the requested message `fix: persist upcoming cleanup recovery`; its hash is reported in the task handoff.
