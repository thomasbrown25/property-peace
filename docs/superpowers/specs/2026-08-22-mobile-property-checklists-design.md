# Mobile Property Checklists Design

## Purpose

Give landlords a native, on-site mobile workflow for finding a property, starting move-in and move-out inspections, recording room-item conditions, maintaining the room structure, and attaching photos. The mobile workflow must use the same checklist records and lifecycle rules as the main web app.

## Scope

This release includes:

- A dedicated checklist property search reached directly from the dashboard's **Property checklists** action.
- Required unit selection for multi-unit properties.
- A property or unit checklist overview with paired move-in/move-out history.
- Starting new move-in or move-out inspections using the same defaults and linking behavior as the web app.
- Native checklist editing organized by room.
- Per-item condition values matching the web app: Good, Fair, Poor, and Damaged.
- Per-item notes, damage details, and completion progress.
- Adding and renaming rooms, and adding and deleting room items.
- Item-level photo capture/library selection, upload, viewing, and deletion.
- Online-first saves with visible progress, failure, rollback, and retry behavior.

This release does not include offline queues, signatures, organization report-template customization, scheduled inspection visits, whole-checklist photo galleries, move-in/move-out comparison reports, or PDF/report generation.

## Chosen Approach

Build a native three-screen workflow that uses the existing REST API and mirrors the web app's domain rules:

1. Checklist property and unit search.
2. Property/unit checklist overview and history.
3. Room-based checklist editor.

This keeps mobile interaction focused and touch-friendly while preserving a single backend source of truth. Expanding the current checklist screen into one large component would mix selection, history, lifecycle, editing, and uploads. Embedding the web app in a WebView would weaken native navigation, authentication, accessibility, and camera integration.

## Navigation

This feature exports a self-contained default `ChecklistsNavigator` component from `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`. Its route contract is the exported `ChecklistsStackParamList` in `property-peace-mobile/src/navigation/checklistsTypes.ts`, keeping this feature's stack types separate from the shared bottom-tab types.

The checklist stack has three explicit routes:

- `ChecklistPropertySearch`
- `PropertyChecklists`
- `ChecklistEditor`

The separately coordinated bottom-navigation change owns the landlord-only visible `Checklists` tab, its ordering between Properties and Maintenance, its icon, and the `MainTabParamList` entry. It mounts `ChecklistsNavigator`; this feature does not independently register or style the bottom tab.

The dashboard's **Property checklists** button navigates to the `Checklists` tab and opens `ChecklistPropertySearch`. The existing property-detail **Open checklists** action targets the `Checklists` tab and skips search by opening `PropertyChecklists` with the selected property. If that property is multi-unit, the action instead opens search with the property preselected so the landlord must choose a unit.

The selector navigates with property and optional unit identity needed for display and API queries. The overview navigates to the editor by checklist ID; the editor reloads the checklist from the server rather than trusting a potentially stale route object.

## Property and Unit Selection

The selector loads `/api/Property/list` and filters locally by property name and address using the existing property-list search behavior. Empty, loading, error, and retry states are explicit.

The property-type rule matches the web app. `multiunit`, `smallmultifamily`, `apartmentbuilding`, `multifamily`, and `other` require unit selection. Selecting one of these types loads `/api/unit/{propertyId}` and prevents continuation until a unit is chosen. Single-unit properties continue at the property level.

## Checklist Overview

The overview loads by unit when a unit is selected and by property otherwise. It separates move-in and move-out records, then groups them into condition cycles using counterpart checklist IDs first and matching lease IDs second. Unpaired records remain visible as partial cycles.

Each cycle shows its type, title, inspection/creation date, tenant or lease context when present, item progress, and completion state. Selecting an existing record opens the editor. Empty history offers a primary **Start checklist** action.

Starting a move-in without a counterpart creates both records and links them:

1. Create the move-in checklist.
2. Create its future move-out checklist with the move-in ID as counterpart.
3. Update the move-in with the move-out ID.
4. If pairing fails, delete records created during the failed operation, matching the web app's compensating behavior.

Starting a missing side of an existing cycle copies the counterpart's room and item structure, creates the new record, and links both records. New records use the current related lease and first tenant when available. Mobile starts inspections immediately with the current timestamp; scheduled visits remain a web-only feature.

The default room/item template is shared as a focused mobile feature module and matches the web app's current inspection defaults.

## Checklist Editor

The editor loads a checklist by ID and presents collapsible room sections. Room names come from `roomNames` plus item categories, de-duplicated case-insensitively. Each room displays completed-item progress.

Each checklist item supports:

- Good, Fair, Poor, or Damaged condition.
- Optional notes.
- Damage description when Damaged is selected.
- One or more photos.
- Deletion for non-default/custom items, following web behavior.

An item counts as complete when it has a condition. Checklist progress and `isCompleted`/`completedAt` are derived from all items. Condition edits save optimistically: the UI updates immediately, one save is allowed for that item at a time, and the prior state is restored if the request fails. Notes and damage details save explicitly to avoid excessive requests while typing.

Landlords can add a uniquely named room, rename an existing room, add items to a room, and remove custom items. Duplicate room names are rejected case-insensitively. When a connected counterpart exists, room additions and renames propagate to it so move-in and move-out structures remain comparable, matching the web app.

The API remains authoritative after structural updates: successful responses replace local checklist state. Destructive item deletion requires confirmation.

## Photos

The editor uses Expo Image Picker to offer camera capture and photo-library selection. Each selected asset is converted into the React Native multipart shape expected by Axios: `{ uri, name, type }`.

Photos upload one item at a time to `/api/Checklist/{checklistId}/items/{itemId}/upload-image`. The UI displays an upload state on the affected item, refreshes the returned checklist after success, and leaves a clear retry action after failure. Existing images use server-provided URLs. Deletion calls the existing item-image endpoint with the blob name and requires confirmation.

Camera or library permission denial shows actionable guidance and does not change checklist state. Unsupported or missing asset metadata receives safe filename and MIME-type defaults.

## Mobile API Boundary

`checklistAPI.ts` remains the single mobile checklist transport boundary. It gains methods for:

- property, unit, and ID queries;
- checklist creation, update, and deletion;
- item image upload and deletion.

Normalization accepts camelCase and PascalCase API payloads. Update serialization preserves every editable checklist and item field, including `roomNames`, counterpart linkage, condition, notes, damage fields, photo metadata, check state, timestamps, and sort order. Focused pure helpers own lifecycle payload construction, cycle grouping, room derivation, progress calculation, and structural edits so screen components do not duplicate domain logic.

No backend schema or endpoint changes are required for the agreed scope.

## Online-First Error Handling

- Initial-load failures show a retry state without presenting stale data as current.
- Property/unit selection retains the user's search and selection when a retry is safe.
- Optimistic condition updates revert to the last server-confirmed value on failure.
- Structural edits wait for the server and prevent duplicate submissions.
- Pair-creation failures run compensating deletes for newly created records.
- Photo failures preserve the local asset information long enough to retry during the current editor session.
- Refresh always reloads server state and clears transient errors that no longer apply.
- User-facing messages describe what was not saved and the available recovery action.

## Accessibility and Mobile Interaction

Touch targets are at least 44 points. Condition choices provide text labels in addition to color. Saving and upload states are announced visually and disable conflicting actions only within the affected operation. Long room/item lists use `FlatList` or sectioned list primitives rather than nesting an unbounded map inside a `ScrollView`. Keyboard-aware inputs keep add/rename/note controls accessible on smaller screens.

## Testing

The mobile project's existing Node test style will cover pure checklist behavior without requiring an emulator:

- property search and multi-unit selection rules;
- camelCase/PascalCase normalization and complete update serialization;
- move-in/move-out cycle grouping;
- default and counterpart-based start payloads;
- room derivation, uniqueness, addition, rename propagation, and item changes;
- condition-based progress and completion;
- multipart item-photo construction;
- checklist-stack export and route wiring through source-contract tests.

Tests are written before production changes and observed failing for the intended missing behavior. Verification runs the checklist tests, the existing mobile test suite, and `tsc --noEmit`. Backend tests are unnecessary unless implementation reveals a contract gap that requires an API change.

## Success Criteria

- The landlord-only visible **Checklists** bottom tab opens dedicated property search.
- Tapping **Property checklists** on the landlord dashboard opens that dedicated checklist flow rather than the general Properties list.
- A landlord can search for a property, select a required unit, and open that home's checklist history.
- A landlord can start and reopen connected move-in and move-out checklists from mobile.
- A landlord can set the same item conditions used by the web app and see accurate room/checklist progress.
- A landlord can add/rename rooms, add/delete custom items, and retain counterpart structure parity.
- A landlord can capture or select item photos, upload them, view them, retry failures, and delete them.
- All successful mobile edits are immediately visible when the same checklist is opened in the web app.
