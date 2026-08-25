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

## Concerns

- TransactionFilterToolbar tests remain unavailable until `vitest` is restored to installed dependencies.
- Focused ESLint remains unavailable until `fast-deep-equal` is restored.
- The Finances page remains intentionally unrouted until Task 9, so authenticated browser smoke testing is deferred to route integration.
- Production build advisories are pre-existing and unrelated to Task 8.
