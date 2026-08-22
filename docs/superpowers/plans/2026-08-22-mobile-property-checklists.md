# Mobile Property Checklists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native, online-first landlord workflow for selecting a property/unit, starting paired move-in and move-out inspections, editing room-item conditions, maintaining rooms/items, and uploading item photos.

**Architecture:** Add a self-contained checklist stack with search, overview, and editor screens. Keep domain behavior in pure feature modules, keep HTTP/multipart behavior in `checklistAPI.ts`, and mirror the existing web app's checklist pairing and room synchronization rules without changing the backend.

**Tech Stack:** React Native 0.81, Expo 54, TypeScript 5.9, React Navigation 6, Axios, Expo Image Picker, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-property-checklists-design.md`

## Global Constraints

- Online-first only; no offline queue.
- Multi-unit, small-multifamily, apartment-building, multifamily, and other property types require a unit selection.
- Conditions must exactly match the web app: Good, NC, NP, NR, NSC, NSP, and RP, with their full labels.
- New move-in checklists create and link a future move-out checklist, including compensating deletes on partial failure.
- Room additions and renames propagate to the connected counterpart checklist.
- Photos attach to checklist items, not to the overall checklist or room.
- Do not change backend schemas or endpoints unless an actual verified contract gap is found.
- Do not register, order, or style the bottom tab in this work; the coordinated bottom-navigation task owns `MainNavigator.tsx` tab registration, icon selection, and the `MainTabParamList` entry.
- Export default `ChecklistsNavigator` from `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`.
- Export `ChecklistsStackParamList` from `property-peace-mobile/src/navigation/checklistsTypes.ts`.

---

## File Structure

- `src/features/checklists/checklistTypes.ts`: shared checklist, item, home, unit, lease, upload, and cycle types.
- `src/features/checklists/checklistHomeModel.ts`: property filtering, labels, and unit-required rules.
- `src/features/checklists/checklistModel.ts`: condition vocabulary, normalization helpers, room grouping, progress, structural edits, update serialization, and photo-asset conversion.
- `src/features/checklists/checklistWorkflow.ts`: start/pair/link/rollback orchestration behind a typed gateway.
- `src/api/checklistAPI.ts`: checklist REST and multipart transport.
- `src/api/propertyAPI.ts`: existing property reads plus property-unit lookup.
- `src/api/leaseAPI.ts`: existing lease calls plus active-property lease lookup.
- `src/navigation/checklistsTypes.ts`: isolated checklist-stack route contract.
- `src/navigation/ChecklistsNavigator.tsx`: mountable three-screen native stack.
- `src/screens/landlord/ChecklistPropertySearchScreen.tsx`: property and required-unit selection.
- `src/screens/landlord/PropertyChecklistsScreen.tsx`: cycle history and start actions.
- `src/screens/landlord/ChecklistEditorScreen.tsx`: room/item condition editing and photos.
- `scripts/checklists-model.test.mjs`: executable pure-domain tests.
- `scripts/checklists-workflow.test.mjs`: executable lifecycle orchestration tests.
- `scripts/checklists-parity.test.mjs`: source-contract tests for transport, screens, routes, and picker behavior.

---

### Task 1: Checklist Domain Model and Serialization

**Files:**
- Create: `property-peace-mobile/src/features/checklists/checklistTypes.ts`
- Create: `property-peace-mobile/src/features/checklists/checklistHomeModel.ts`
- Create: `property-peace-mobile/src/features/checklists/checklistModel.ts`
- Create: `property-peace-mobile/scripts/checklists-model.test.mjs`
- Modify: `property-peace-mobile/package.json`

**Interfaces:**
- Produces: `ChecklistCondition`, `ChecklistItem`, `Checklist`, `ChecklistHome`, `ChecklistCycle`, `ChecklistUploadAsset`.
- Produces: `CHECKLIST_CONDITIONS`, `isMultiUnitProperty(property)`, `filterChecklistProperties(properties, search)`, `normalizeChecklist(raw)`, `buildConditionCycles(checklists)`, `groupChecklistRooms(checklist)`, `getChecklistProgress(checklist)`, `withItemCondition(checklist, itemId, condition, now)`, `addChecklistRoom(checklist, name)`, `renameChecklistRoom(checklist, oldName, newName)`, `addChecklistItem(checklist, roomName, itemName)`, `removeCustomChecklistItem(checklist, itemId)`, `serializeChecklistUpdate(checklist)`, and `toChecklistUploadAsset(asset)`.

- [ ] **Step 1: Write the failing domain tests**

Add tests that establish the exact status vocabulary, multi-unit rule, cycle grouping, room behavior, completion derivation, full update serialization, and React Native upload shape:

```js
test('uses the exact web condition vocabulary', () => {
  assert.deepEqual(CHECKLIST_CONDITIONS.map(({ value }) => value),
    ['Good', 'NC', 'NP', 'NR', 'NSC', 'NSP', 'RP']);
});

test('groups linked move in and move out records into one cycle', () => {
  const cycles = buildConditionCycles([
    { id: 1, checklistType: 40, counterpartChecklistId: 2, items: [] },
    { id: 2, checklistType: 41, counterpartChecklistId: 1, items: [] },
  ]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].moveIn?.id, 1);
  assert.equal(cycles[0].moveOut?.id, 2);
});

test('condition completion and serialization retain editable fields', () => {
  const checklist = normalizeChecklist({
    Id: 8,
    CounterpartChecklistId: 9,
    RoomNames: ['Kitchen'],
    Items: [{ Id: 11, Name: 'Floors', Category: 'Kitchen', PhotoBlobNames: ['a.jpg'] }],
  });
  const changed = withItemCondition(checklist, 11, 'NC', '2026-08-22T12:00:00.000Z');
  const payload = serializeChecklistUpdate(changed);
  assert.equal(payload.CounterpartChecklistId, 9);
  assert.deepEqual(payload.RoomNames, ['Kitchen']);
  assert.equal(payload.Items[0].Condition, 'NC');
  assert.deepEqual(payload.Items[0].PhotoBlobNames, ['a.jpg']);
});
```

- [ ] **Step 2: Run the model tests and verify RED**

Run: `cd property-peace-mobile && node --experimental-strip-types --test scripts/checklists-model.test.mjs`

Expected: FAIL because the checklist feature modules and exports do not exist.

- [ ] **Step 3: Implement focused types and pure helpers**

Define the exact condition values and labels:

```ts
export const CHECKLIST_CONDITIONS = [
  { value: 'Good', label: 'Good – No issues' },
  { value: 'NC', label: 'NC – Needs Cleaning' },
  { value: 'NP', label: 'NP – Needs Painting' },
  { value: 'NR', label: 'NR – Needs Repair' },
  { value: 'NSC', label: 'NSC – Needs Spot Cleaning' },
  { value: 'NSP', label: 'NSP – Needs Spot Painting' },
  { value: 'RP', label: 'RP – Needs Replacing' },
] as const;
export type ChecklistCondition = typeof CHECKLIST_CONDITIONS[number]['value'];
```

Keep helpers immutable. Treat `sortOrder < 1000` as a default/non-deletable item, derive `isCompleted` only when every item has a condition, de-duplicate rooms case-insensitively, and reject blank/duplicate room names with typed `Error` messages.

Serialize every editable field with PascalCase keys expected by the API:

```ts
export const serializeChecklistUpdate = (checklist: Checklist) => ({
  Id: Number(checklist.id),
  Title: checklist.title,
  LeaseId: checklist.leaseId ?? null,
  CounterpartChecklistId: checklist.counterpartChecklistId ?? null,
  InspectionDate: checklist.inspectionDate ?? null,
  CompletedAt: checklist.completedAt ?? null,
  IsCompleted: checklist.isCompleted ?? false,
  GeneralNotes: checklist.generalNotes ?? '',
  ConditionNotes: checklist.conditionNotes ?? '',
  RoomNames: checklist.roomNames ?? [],
  Items: (checklist.items ?? []).map(serializeChecklistItem),
});
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run: `cd property-peace-mobile && node --experimental-strip-types --test scripts/checklists-model.test.mjs`

Expected: PASS for search, multi-unit, normalization, cycles, rooms, progress, serialization, and upload assets.

- [ ] **Step 5: Add the reusable test script and commit**

Add `"test:checklists": "node --experimental-strip-types --test scripts/checklists-model.test.mjs scripts/checklists-workflow.test.mjs scripts/checklists-parity.test.mjs"` to `property-peace-mobile/package.json`. The script may reference not-yet-created files only after those files are added in later tasks; run the Task 1 test directly until then.

```bash
git add property-peace-mobile/src/features/checklists property-peace-mobile/scripts/checklists-model.test.mjs property-peace-mobile/package.json
git commit -m "feat(mobile): add checklist domain model"
```

---

### Task 2: Checklist Transport and Start Workflow

**Files:**
- Modify: `property-peace-mobile/src/api/checklistAPI.ts`
- Modify: `property-peace-mobile/src/api/propertyAPI.ts`
- Modify: `property-peace-mobile/src/api/leaseAPI.ts`
- Create: `property-peace-mobile/src/features/checklists/checklistWorkflow.ts`
- Create: `property-peace-mobile/scripts/checklists-workflow.test.mjs`
- Create: `property-peace-mobile/scripts/checklists-parity.test.mjs`

**Interfaces:**
- Consumes: Task 1 `Checklist`, `ChecklistHome`, `normalizeChecklist`, `serializeChecklistUpdate`, and `toChecklistUploadAsset`.
- Produces: `ChecklistAPI.getByUnit`, `create`, `update`, `remove`, `uploadItemImage`, `deleteItemImage`; `PropertyAPI.getUnits`; `LeaseAPI.getActiveLease`.
- Produces: `startChecklistCycle(input, gateway): Promise<{ primary: Checklist; counterpart?: Checklist }>`.

- [ ] **Step 1: Write failing workflow and transport-contract tests**

Use an in-memory gateway to prove move-in creation order and rollback:

```js
test('starting move in creates, links, and returns a paired move out', async () => {
  const calls = [];
  const gateway = fakeGateway(calls, [
    { id: 10, checklistType: 40 },
    { id: 11, checklistType: 41, counterpartChecklistId: 10 },
    { id: 10, checklistType: 40, counterpartChecklistId: 11 },
  ]);
  const result = await startChecklistCycle({ type: 40, home, now: fixedNow }, gateway);
  assert.deepEqual(calls.map(({ method }) => method), ['create', 'create', 'update']);
  assert.equal(result.primary.counterpartChecklistId, 11);
  assert.equal(result.counterpart?.counterpartChecklistId, 10);
});

test('pairing failure removes every record created by the attempt', async () => {
  const { gateway, removed } = failingLinkGateway();
  await assert.rejects(startChecklistCycle({ type: 40, home, now: fixedNow }, gateway));
  assert.deepEqual(removed.sort(), [10, 11]);
});
```

In the parity test, read `src/api/checklistAPI.ts` and assert the exact unit, create, delete, upload, and encoded image-delete routes plus multipart `file` field.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd property-peace-mobile && node --experimental-strip-types --test scripts/checklists-workflow.test.mjs scripts/checklists-parity.test.mjs`

Expected: FAIL because the gateway, methods, and routes are absent.

- [ ] **Step 3: Expand the API boundary**

Implement methods with normalized return values:

```ts
async getByUnit(unitId: Id): Promise<Checklist[]> {
  const response = await apiClient.get<ApiResponse<unknown[]>>(`/api/Checklist/unit/${unitId}`);
  return (response.data ?? []).map(normalizeChecklist);
}

async uploadItemImage(checklistId: Id, itemId: Id, asset: ChecklistUploadAsset): Promise<Checklist> {
  const form = new FormData();
  form.append('file', asset as any);
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/api/Checklist/${checklistId}/items/${itemId}/upload-image`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return normalizeChecklist(response.data);
}
```

Add `PropertyAPI.getUnits(propertyId)` using `/api/unit/${propertyId}` and `LeaseAPI.getActiveLease(propertyId)` using `/api/Lease/active/${propertyId}`.

- [ ] **Step 4: Implement the lifecycle orchestrator**

Use dependency injection so rollback behavior is tested without HTTP mocks:

```ts
export interface ChecklistGateway {
  create(payload: AddChecklistPayload): Promise<Checklist>;
  update(id: Id, checklist: Checklist | UpdateChecklistPayload): Promise<Checklist>;
  remove(id: Id): Promise<void>;
}

export async function startChecklistCycle(input: StartChecklistInput, gateway: ChecklistGateway) {
  const createdIds: Id[] = [];
  try {
    const primary = await gateway.create(buildStartPayload(input));
    createdIds.push(primary.id);

    if (input.counterpart) {
      const linkedCounterpart = await gateway.update(input.counterpart.id, {
        Id: Number(input.counterpart.id),
        CounterpartChecklistId: Number(primary.id),
      });
      return input.type === MOVE_IN
        ? { primary, counterpart: linkedCounterpart }
        : { primary: linkedCounterpart, counterpart: primary };
    }

    if (input.type !== MOVE_IN) return { primary };

    const moveOut = await gateway.create(buildStartPayload({
      ...input,
      type: MOVE_OUT,
      counterpart: primary,
      inspectionDate: null,
    }));
    createdIds.push(moveOut.id);

    const linkedMoveIn = await gateway.update(primary.id, {
      Id: Number(primary.id),
      CounterpartChecklistId: Number(moveOut.id),
    });
    return { primary: linkedMoveIn, counterpart: moveOut };
  } catch (error) {
    await Promise.allSettled(
      [...createdIds].reverse().map((id) => gateway.remove(id)),
    );
    throw error;
  }
}
```

Default items must exactly match `DEFAULT_INSPECTION_ITEMS` in the web app and use sort orders `0..N`. Counterpart-based starts copy name/category/sort order but clear condition, notes, damage, photos, check state, and timestamps.

- [ ] **Step 5: Run workflow and parity tests and verify GREEN**

Run: `cd property-peace-mobile && node --experimental-strip-types --test scripts/checklists-model.test.mjs scripts/checklists-workflow.test.mjs scripts/checklists-parity.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add property-peace-mobile/src/api property-peace-mobile/src/features/checklists property-peace-mobile/scripts/checklists-workflow.test.mjs property-peace-mobile/scripts/checklists-parity.test.mjs
git commit -m "feat(mobile): add checklist lifecycle API"
```

---

### Task 3: Mountable Checklist Navigator and Property Search

**Files:**
- Create: `property-peace-mobile/src/navigation/checklistsTypes.ts`
- Create: `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`
- Create: `property-peace-mobile/src/screens/landlord/ChecklistPropertySearchScreen.tsx`
- Modify: `property-peace-mobile/scripts/checklists-parity.test.mjs`

**Interfaces:**
- Consumes: Task 1 home model and Task 2 property/unit APIs.
- Produces: default `ChecklistsNavigator` and `ChecklistsStackParamList`.

- [ ] **Step 1: Add failing route and selector tests**

Assert the exported contract and source wiring:

```js
test('exports a self-contained three-screen checklist stack', () => {
  assert.match(navTypes, /export type ChecklistsStackParamList/);
  for (const route of ['ChecklistPropertySearch', 'PropertyChecklists', 'ChecklistEditor']) {
    assert.match(navigator, new RegExp(`name=["']${route}["']`));
  }
  assert.match(navigator, /export default function ChecklistsNavigator/);
});

test('selector requires a unit only for web-parity multi-unit types', () => {
  assert.equal(isMultiUnitProperty({ propertyType: 'MultiUnit' }), true);
  assert.equal(isMultiUnitProperty({ propertyType: 'SingleFamily' }), false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: FAIL because the navigator, route types, and selector screen are missing.

- [ ] **Step 3: Define the isolated route contract**

```ts
export type ChecklistHomeParams = {
  propertyId: string;
  propertyName: string;
  propertyType?: string;
  unitId?: string;
  unitName?: string;
};

export type ChecklistsStackParamList = {
  ChecklistPropertySearch: { preselectedPropertyId?: string } | undefined;
  PropertyChecklists: ChecklistHomeParams;
  ChecklistEditor: ChecklistHomeParams & { checklistId: string };
};
```

- [ ] **Step 4: Build the search screen and navigator**

Use `FlatList`, an accessible search input, explicit retry, selected-row styling, and an inline unit chooser. On continue:

```ts
navigation.navigate('PropertyChecklists', {
  propertyId: String(selectedProperty.id),
  propertyName: getChecklistPropertyLabel(selectedProperty),
  propertyType: selectedProperty.propertyType,
  ...(selectedUnit ? { unitId: String(selectedUnit.id), unitName: selectedUnit.name } : {}),
});
```

The navigator uses the existing mobile stack header palette and exports a default mountable component. Do not import or edit `MainNavigator.tsx` in this task.

- [ ] **Step 5: Run tests and TypeScript**

Run: `cd property-peace-mobile && npm run test:checklists`

Run: `cd property-peace-mobile && npx tsc --noEmit`

Expected: PASS. If TypeScript currently waits for the coordinated `MainTabParamList` change, limit the failure audit to that known external change and do not weaken types.

- [ ] **Step 6: Commit**

```bash
git add property-peace-mobile/src/navigation/checklistsTypes.ts property-peace-mobile/src/navigation/ChecklistsNavigator.tsx property-peace-mobile/src/screens/landlord/ChecklistPropertySearchScreen.tsx property-peace-mobile/scripts/checklists-parity.test.mjs
git commit -m "feat(mobile): add checklist property search"
```

---

### Task 4: Property Checklist Overview and Cycle Starts

**Files:**
- Create: `property-peace-mobile/src/screens/landlord/PropertyChecklistsScreen.tsx`
- Modify: `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`
- Modify: `property-peace-mobile/scripts/checklists-parity.test.mjs`

**Interfaces:**
- Consumes: `buildConditionCycles`, `getChecklistProgress`, `startChecklistCycle`, `ChecklistAPI`, and `LeaseAPI.getActiveLease`.
- Produces: overview-to-editor navigation and start/retry UI.

- [ ] **Step 1: Add failing overview contract tests**

```js
test('overview loads by unit when selected and starts through the lifecycle service', () => {
  assert.match(overview, /home\.unitId\s*\?\s*ChecklistAPI\.getByUnit/);
  assert.match(overview, /startChecklistCycle/);
  assert.match(overview, /buildConditionCycles/);
  assert.match(overview, /ChecklistEditor/);
});
```

Also assert visible loading, empty, retry, Move-in, Move-out, progress, and Start labels.

- [ ] **Step 2: Run and verify RED**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: FAIL because the overview screen is absent.

- [ ] **Step 3: Build the overview**

Load checklist history and active lease independently so lease metadata failure does not hide history. Render one card per cycle, with each existing side opening the editor and each missing side calling:

```ts
await startChecklistCycle({
  type,
  home,
  counterpart,
  lease: activeLease,
  now: new Date().toISOString(),
}, ChecklistAPI);
```

Disable only the cycle/action currently starting, reload server state after success, and show compensating-failure messages from the workflow unchanged enough to be actionable.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add property-peace-mobile/src/screens/landlord/PropertyChecklistsScreen.tsx property-peace-mobile/src/navigation/ChecklistsNavigator.tsx property-peace-mobile/scripts/checklists-parity.test.mjs
git commit -m "feat(mobile): add checklist cycle overview"
```

---

### Task 5: Room and Condition Editor

**Files:**
- Create: `property-peace-mobile/src/screens/landlord/ChecklistEditorScreen.tsx`
- Modify: `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`
- Modify: `property-peace-mobile/src/features/checklists/checklistModel.ts`
- Modify: `property-peace-mobile/scripts/checklists-model.test.mjs`
- Modify: `property-peace-mobile/scripts/checklists-parity.test.mjs`

**Interfaces:**
- Consumes: checklist domain helpers, `ChecklistAPI.getById/update`, and route `checklistId`.
- Produces: online-first condition, notes, damage, room, and item editing.

- [ ] **Step 1: Add failing editor behavior tests**

Add pure tests for counterpart rename propagation inputs, custom-item delete eligibility, and completion timestamps:

```js
test('the last item condition completes the checklist', () => {
  const result = withItemCondition(twoItemChecklist, 2, 'Good', fixedNow);
  assert.equal(result.isCompleted, true);
  assert.equal(result.completedAt, fixedNow);
});

test('default items cannot be removed but custom items can', () => {
  assert.throws(() => removeCustomChecklistItem(checklist, 1), /default item/i);
  assert.equal(removeCustomChecklistItem(checklist, 1001).items.length, 1);
});
```

Source-contract assertions must find all seven status values, explicit save controls for notes/damage, room add/rename, item add/delete, confirmation for deletion, and `ChecklistAPI.update`.

- [ ] **Step 2: Run and verify RED**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: FAIL on missing editor behaviors.

- [ ] **Step 3: Build the editor read and condition flow**

Load by checklist ID on mount/focus and group rooms through `groupChecklistRooms`. Render a `SectionList` or virtualized `FlatList` of room sections. For optimistic status changes:

```ts
const previous = checklist;
const next = withItemCondition(previous, itemId, condition, new Date().toISOString());
setChecklist(next);
try {
  setChecklist(await ChecklistAPI.update(next.id, next));
} catch (error) {
  setChecklist(previous);
  setRetryCondition({ itemId, condition });
}
```

One item save lock must not block unrelated photo or room operations.

- [ ] **Step 4: Add notes, damage, room, and item mutations**

Use explicit Save for notes/damage. For room add/rename, update the active checklist first, then update the loaded counterpart when present; if the second save fails, show that parity needs retry and reload both records instead of claiming success. Add items with sort order `max(existing, 999) + 1`. Confirm before deleting custom items.

- [ ] **Step 5: Run tests and TypeScript**

Run: `cd property-peace-mobile && npm run test:checklists`

Run: `cd property-peace-mobile && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add property-peace-mobile/src/screens/landlord/ChecklistEditorScreen.tsx property-peace-mobile/src/navigation/ChecklistsNavigator.tsx property-peace-mobile/src/features/checklists/checklistModel.ts property-peace-mobile/scripts
git commit -m "feat(mobile): add room condition editor"
```

---

### Task 6: Item Photo Capture, Upload, Retry, and Delete

**Files:**
- Modify: `property-peace-mobile/src/screens/landlord/ChecklistEditorScreen.tsx`
- Modify: `property-peace-mobile/src/features/checklists/checklistModel.ts`
- Modify: `property-peace-mobile/scripts/checklists-model.test.mjs`
- Modify: `property-peace-mobile/scripts/checklists-parity.test.mjs`

**Interfaces:**
- Consumes: `toChecklistUploadAsset`, `ChecklistAPI.uploadItemImage`, `ChecklistAPI.deleteItemImage`.
- Produces: camera/library permission flow and per-item retry state.

- [ ] **Step 1: Add failing media tests**

```js
test('normalizes a camera asset for React Native multipart upload', () => {
  assert.deepEqual(toChecklistUploadAsset({ uri: 'file:///photo', fileName: null, mimeType: null }), {
    uri: 'file:///photo', name: 'checklist-photo.jpg', type: 'image/jpeg',
  });
});
```

Source assertions must require `requestCameraPermissionsAsync`, `requestMediaLibraryPermissionsAsync`, `launchCameraAsync`, `launchImageLibraryAsync`, upload retry state, photo `<Image>`, encoded delete route, and delete confirmation.

- [ ] **Step 2: Run and verify RED**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: FAIL because media UI/retry behavior is absent.

- [ ] **Step 3: Implement camera/library selection and upload**

Present an action sheet with Camera and Photo Library. Request the matching permission immediately before opening the picker. Configure compatible images and pass the normalized asset to the API. Track pending uploads by item ID:

```ts
type FailedPhotoUpload = { itemId: string; asset: ChecklistUploadAsset; message: string };
```

On failure, keep the asset in `failedUploads` and render **Retry upload**. On success, replace checklist state with the API response and clear the failure.

- [ ] **Step 4: Render and delete existing photos**

Render item `photoBlobUrls` in a horizontal virtualized list. Pair each URL with the same-index blob name. Confirm deletion, call `deleteItemImage`, and use the returned checklist as authoritative state. Disable only the photo being deleted.

- [ ] **Step 5: Run tests and TypeScript**

Run: `cd property-peace-mobile && npm run test:checklists`

Run: `cd property-peace-mobile && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add property-peace-mobile/src/screens/landlord/ChecklistEditorScreen.tsx property-peace-mobile/src/features/checklists/checklistModel.ts property-peace-mobile/scripts
git commit -m "feat(mobile): add checklist item photos"
```

---

### Task 7: Cross-Entry Navigation and Full Verification

**Files:**
- Modify: `property-peace-mobile/src/screens/landlord/DashboardScreen.tsx`
- Modify: `property-peace-mobile/src/screens/landlord/PropertyDetailScreen.tsx`
- Modify: `property-peace-mobile/scripts/checklists-parity.test.mjs`
- Coordinate only: `property-peace-mobile/src/navigation/MainNavigator.tsx`
- Coordinate only: `property-peace-mobile/src/navigation/types.ts`

**Interfaces:**
- Consumes: the parallel task's `MainTabParamList.Checklists` entry and mounted `ChecklistsNavigator` tab.
- Produces: direct dashboard entry and property-detail deep entry without owning tab registration.

- [ ] **Step 1: Add failing entry-point tests**

```js
test('dashboard enters the dedicated checklist tab', () => {
  assert.match(dashboard, /navigate\('Checklists'/);
  assert.doesNotMatch(checklistActionBody, /navigate\('Properties'\)/);
});

test('property detail targets the checklist tab with property context', () => {
  assert.match(propertyDetail, /ChecklistPropertySearch|PropertyChecklists/);
  assert.match(propertyDetail, /preselectedPropertyId|propertyId/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd property-peace-mobile && npm run test:checklists`

Expected: FAIL because both entry points still target the Properties stack's legacy flow.

- [ ] **Step 3: Wire the dashboard and property detail**

Dashboard navigates to the `Checklists` tab. Property detail uses its parent tab navigator: single-unit properties deep-link to `PropertyChecklists`; multi-unit properties open `ChecklistPropertySearch` with `preselectedPropertyId`. Do not add or reorder the tab and do not edit its icon.

- [ ] **Step 4: Reconcile the parallel navigation change**

Confirm `MainNavigator.tsx` mounts the agreed default export:

```tsx
import ChecklistsNavigator from './ChecklistsNavigator';
// landlord branch, between Properties and Maintenance:
<Tab.Screen name="Checklists" component={ChecklistsNavigator} />
```

If the parallel task used a different import path or name, adapt only this feature's export to the agreed contract; do not revert its tab ownership changes. Remove no user or parallel-task edits.

- [ ] **Step 5: Run the focused and regression suites**

Run:

```bash
cd property-peace-mobile
npm run test:checklists
npm run test:properties
npm run test:maintenance
npm run test:messages
npm run test:registration
npm run test:startup
npm run test:ios-compliance
npx tsc --noEmit
```

Expected: every command exits 0 with no new warnings or TypeScript errors.

- [ ] **Step 6: Inspect the final diff and commit**

Run: `git diff --check` and `git status --short`. Confirm the unrelated `docs/superpowers/specs/2026-08-22-mobile-expense-entry-design.md` remains untouched if it is still present.

```bash
git add property-peace-mobile/src/screens/landlord/DashboardScreen.tsx property-peace-mobile/src/screens/landlord/PropertyDetailScreen.tsx property-peace-mobile/scripts/checklists-parity.test.mjs
git commit -m "feat(mobile): connect checklist entry points"
```
