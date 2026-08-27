# Mobile Expense Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused native landlord expense form, optional receipt capture/upload, server-side AI category result, and the requested mobile home-screen cleanup.

**Architecture:** Put deterministic, cross-client category rules in the shared package; keep mobile validation and payload construction in a pure expense model; isolate HTTP/multipart and create-then-upload orchestration behind typed modules; render the three-step workflow in one native screen under a Home stack. The existing backend remains unchanged and continues to perform OpenAI Schedule E categorization during `POST /api/Expense`.

**Tech Stack:** React Native 0.81, Expo 54, React Navigation 6, TypeScript 5.9, Axios, Expo Image Picker, `@react-native-community/datetimepicker`, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-expense-entry-design.md`

## Global Constraints

- Mobile v1 records only one-time, paid expenses.
- Required fields are amount greater than zero, local expense date, property, and a trimmed description no longer than 200 characters; unit is optional.
- Support one optional JPEG, PNG, or WebP receipt up to 10 MB from either camera or photo library.
- Do not add recurring, future/unpaid, maintenance-linked, vendor, payment-method, loan, manual-category, expense-list, edit, multiple-receipt, or PDF-receipt behavior.
- The client must not call OpenAI directly or contain an OpenAI credential.
- Server AI categorization stays non-blocking: a returned null/`None` tax category becomes `Needs category review`.
- After expense creation succeeds, a receipt failure may retry only `/api/ExpenseReceipt/{expenseId}` and must never repeat `/api/Expense`.
- Use test-first red/green cycles for every production behavior change.
- Keep Messages in the bottom tab; remove only the duplicate home quick action.
- Use exact home copy: `Add expense` and `Record a property expense`.
- Before every commit, inspect the named-file diff, preserve concurrent edits, and use `git commit --only`; if another task has uncommitted changes in the same file, wait or coordinate instead of absorbing or reverting them.

---

### Task 1: Share the deterministic general expense category rules

**Files:**
- Create: `shared/expense-categorization.js`
- Create: `shared/expense-categorization.d.ts`
- Create: `shared/expense-categorization.test.js`
- Modify: `shared/package.json`
- Modify: `property-peace-app/src/utils/expenseCategorization.js`
- Test: `shared/expense-categorization.test.js`
- Test: `property-peace-app/src/utils/expenseCategorization.test.js`

**Interfaces:**
- Consumes: Existing web `categorizeExpense(description)` behavior and category precedence.
- Produces: `categorizeExpense(description?: string): { category: string; name: string }` exported from `@property-peace/shared/expense-categorization`.

- [ ] **Step 1: Write the failing shared-package tests**

Create `shared/expense-categorization.test.js` with the existing representative cases plus empty and truncation behavior:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { categorizeExpense } from './expense-categorization.js';

const cases = [
  ['electric bill for unit 2', 'Utilities'],
  ['monthly HOA dues', 'HOA'],
  ['gas furnace repair', 'Repairs'],
  ['routine HVAC maintenance', 'Maintenance'],
  ['water tank replacement', 'Water tank'],
  ['car rental for property inspection', 'Car Rental'],
];

for (const [description, category] of cases) {
  test(`categorizes ${description} as ${category}`, () => {
    assert.equal(categorizeExpense(description).category, category);
  });
}

test('falls back to Other and limits the generated name to 50 characters', () => {
  assert.deepEqual(categorizeExpense(''), { category: 'Other', name: '' });
  assert.equal(categorizeExpense('x'.repeat(70)).name, 'x'.repeat(50));
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run from the repository root:

```powershell
node --experimental-default-type=module --test shared/expense-categorization.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `shared/expense-categorization.js`.

- [ ] **Step 3: Move the existing rules into the shared package**

Create `shared/expense-categorization.js` by moving the complete ordered `categoryRules` array and current function implementation out of the web utility. Preserve precedence exactly; do not rewrite or expand the rules in this task.

Create `shared/expense-categorization.d.ts`:

```ts
export interface ExpenseCategorySuggestion {
  category: string;
  name: string;
}

export function categorizeExpense(description?: string): ExpenseCategorySuggestion;
```

Add this subpath to `shared/package.json`:

```json
"./expense-categorization": {
  "types": "./expense-categorization.d.ts",
  "default": "./expense-categorization.js"
}
```

Replace `property-peace-app/src/utils/expenseCategorization.js` with a compatibility re-export:

```js
export { categorizeExpense } from '@property-peace/shared/expense-categorization';
```

- [ ] **Step 4: Run shared and web categorization tests and verify GREEN**

```powershell
node --experimental-default-type=module --test shared/expense-categorization.test.js property-peace-app/src/utils/expenseCategorization.test.js
```

Expected: all categorization, precedence, fallback, and truncation tests PASS.

- [ ] **Step 5: Commit the shared category boundary**

```powershell
git add -- shared/expense-categorization.js shared/expense-categorization.d.ts shared/expense-categorization.test.js shared/package.json property-peace-app/src/utils/expenseCategorization.js property-peace-app/src/utils/expenseCategorization.test.js
git commit --only -m "refactor: share expense categorization rules" -- shared/expense-categorization.js shared/expense-categorization.d.ts shared/expense-categorization.test.js shared/package.json property-peace-app/src/utils/expenseCategorization.js property-peace-app/src/utils/expenseCategorization.test.js
```

---

### Task 2: Build and test the pure mobile expense model

**Files:**
- Create: `property-peace-mobile/src/features/expenses/expenseModel.ts`
- Create: `property-peace-mobile/scripts/expense-flow.test.mjs`
- Modify: `property-peace-mobile/package.json`

**Interfaces:**
- Consumes: `categorizeExpense` from `@property-peace/shared/expense-categorization`.
- Produces: `emptyExpenseForm`, `setExpenseProperty`, `validateExpenseStep`, `normalizeSupportedImageMime`, `validateExpenseReceipt`, `buildCreateExpensePayload`, and `getTaxCategoryPresentation`.

- [ ] **Step 1: Write failing form-model tests**

Create `property-peace-mobile/scripts/expense-flow.test.mjs`. Import the desired model API inside the same guarded dynamic-import pattern used by existing mobile scripts. Define this shared valid fixture before the tests:

```js
const validForm = {
  amount: '125.50',
  expenseDate: '2026-08-20',
  propertyId: 7,
  unitId: 9,
  description: 'repair broken sink',
};
```

Then add tests for:

```js
test('requires a positive amount, valid local date, property, and description', () => {
  const form = emptyExpenseForm(new Date(2026, 7, 22, 23, 30));
  assert.equal(form.expenseDate, '2026-08-22');
  assert.deepEqual(validateExpenseStep(form, 'details'), {
    amount: 'Enter an amount greater than zero.',
    propertyId: 'Choose a property.',
  });
  assert.deepEqual(validateExpenseStep(form, 'description'), {
    description: 'Describe the expense.',
  });
});

test('changing property clears a stale unit selection', () => {
  const changed = setExpenseProperty({ ...validForm, propertyId: 1, unitId: 11 }, 2);
  assert.equal(changed.propertyId, 2);
  assert.equal(changed.unitId, null);
});

test('builds the focused paid-expense payload and lets the server choose tax category', () => {
  assert.deepEqual(buildCreateExpensePayload(validForm, 42, '2026-08-22T15:00:00.000Z'), {
    landlordId: 42,
    propertyId: 7,
    unitId: 9,
    name: 'repair broken sink',
    category: 'Repairs',
    amount: 125.5,
    expenseDate: '2026-08-20',
    isRecurring: false,
    isPaid: true,
    paidDate: '2026-08-22T15:00:00.000Z',
    billDate: '2026-08-20',
    dueDate: '2026-08-20',
  });
});

test('accepts one supported receipt at or below 10 MB', () => {
  assert.equal(validateExpenseReceipt({ uri: 'file://receipt.jpg', fileName: 'receipt.jpg', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 }), null);
  assert.equal(validateExpenseReceipt({ uri: 'file://receipt.pdf', fileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 10 }), 'Use a JPEG, PNG, or WebP image.');
  assert.equal(validateExpenseReceipt({ uri: 'file://large.png', fileName: 'large.png', mimeType: 'image/png', fileSize: 10 * 1024 * 1024 + 1 }), 'Receipt images must be 10 MB or smaller.');
});
  assert.equal(normalizeSupportedImageMime('IMAGE/JPEG', 'ignored.bin'), 'image/jpeg');
  assert.equal(normalizeSupportedImageMime(undefined, 'receipt.webp'), 'image/webp');

test('presents AI category or a review fallback', () => {
  assert.deepEqual(getTaxCategoryPresentation(1), { status: 'categorized', label: 'Repairs' });
  assert.deepEqual(getTaxCategoryPresentation(0), { status: 'needs-review', label: 'Needs category review' });
  assert.deepEqual(getTaxCategoryPresentation(null), { status: 'needs-review', label: 'Needs category review' });
});
```

Also assert that amount strings with more than two decimal places, impossible dates such as `2026-02-30`, missing landlord IDs, and descriptions longer than 200 characters are rejected.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
Set-Location property-peace-mobile
node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/expense-flow.test.mjs
```

Expected: FAIL because `src/features/expenses/expenseModel.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Create these public types and constants in `expenseModel.ts`:

```ts
export type ExpenseStep = 'details' | 'description' | 'review';

export interface ExpenseFormState {
  amount: string;
  expenseDate: string;
  propertyId: number | null;
  unitId: number | null;
  description: string;
}

export interface LocalExpenseReceipt {
  uri: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSize?: number;
}

export interface CreateExpensePayload {
  landlordId: number;
  propertyId: number;
  unitId: number | null;
  name: string;
  category: string;
  amount: number;
  expenseDate: string;
  isRecurring: false;
  isPaid: true;
  paidDate: string;
  billDate: string;
  dueDate: string;
}

export const EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
```

Implement local-date formatting from `getFullYear()`, `getMonth() + 1`, and `getDate()` rather than `toISOString()`. Validate dates by parsing the three components and round-tripping them through `new Date(year, month - 1, day)`. Accept amounts only when they match `^\d+(\.\d{1,2})?$` and parse to a finite value greater than zero. Implement `normalizeSupportedImageMime(mimeType, fileName)` to return `image/jpeg`, `image/png`, or `image/webp` from a supported MIME type or filename extension, and return `null` otherwise.

Use `categorizeExpense(form.description).category` only for the required general category. Do not include `taxCategory` or `isTaxDeductible` in the payload.

Create an exhaustive numeric Schedule E label map for backend enum values `0` through `35`; return the review fallback for `0`, null, undefined, or an unknown value. Friendly labels must include `Mortgage interest`, `Property taxes`, `Legal fees`, `Property management`, and the remaining backend enum names with spaces.

Add this script to `property-peace-mobile/package.json`:

```json
"test:expenses": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/expense-flow.test.mjs"
```

- [ ] **Step 4: Run the expense model and shared category tests and verify GREEN**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
Set-Location ..
node --experimental-default-type=module --test shared/expense-categorization.test.js property-peace-app/src/utils/expenseCategorization.test.js
```

Expected: all focused model and categorization tests PASS.

- [ ] **Step 5: Commit the mobile expense domain model**

```powershell
git add -- property-peace-mobile/src/features/expenses/expenseModel.ts property-peace-mobile/scripts/expense-flow.test.mjs property-peace-mobile/package.json
git commit --only -m "feat: add mobile expense form model" -- property-peace-mobile/src/features/expenses/expenseModel.ts property-peace-mobile/scripts/expense-flow.test.mjs property-peace-mobile/package.json
```

---

### Task 3: Add typed expense HTTP and create-then-upload orchestration

**Files:**
- Create: `property-peace-mobile/src/api/expenseAPI.ts`
- Create: `property-peace-mobile/src/features/expenses/expenseSubmission.ts`
- Modify: `property-peace-mobile/scripts/expense-flow.test.mjs`

**Interfaces:**
- Consumes: `CreateExpensePayload` and `LocalExpenseReceipt` from `expenseModel.ts`; existing `apiClient` and `ApiResponse<T>`.
- Produces: injectable `ExpenseAPI`, default API singleton, `getExpenseErrorMessage`, `submitExpense`, and `retryExpenseReceipt`.

- [ ] **Step 1: Write failing API and orchestration tests**

Extend `expense-flow.test.mjs` with these fixtures and a recording form-data object:

```js
const payload = buildCreateExpensePayload(validForm, 42, '2026-08-22T15:00:00.000Z');
const receipt = { uri: 'file://receipt.jpg', fileName: 'receipt.jpg', mimeType: 'image/jpeg', fileSize: 1000 };
const createdExpense = { id: 99, name: payload.name, amount: payload.amount, taxCategory: 1 };

class RecordingFormData {
  entries = [];
  append(name, value) { this.entries.push([name, value]); }
}
```

Then add:

```js
test('posts the focused payload to the expense endpoint', async () => {
  const calls = [];
  const client = { post: async (...args) => { calls.push(args); return { success: true, data: createdExpense }; } };
  const api = new ExpenseAPI(client, () => new RecordingFormData());
  assert.deepEqual(await api.createExpense(payload), createdExpense);
  assert.deepEqual(calls[0], ['/api/Expense', payload]);
});

test('uploads React Native receipt metadata under the files field', async () => {
  const form = new RecordingFormData();
  const calls = [];
  const api = new ExpenseAPI({ post: async (...args) => { calls.push(args); return { success: true, data: [] }; } }, () => form);
  await api.uploadReceipt(99, receipt);
  assert.equal(calls[0][0], '/api/ExpenseReceipt/99');
  assert.deepEqual(form.entries, [['files', { uri: receipt.uri, name: receipt.fileName, type: receipt.mimeType }]]);
});

test('receipt failure retains the created expense and retry never recreates it', async () => {
  let creates = 0;
  let uploads = 0;
  const api = {
    createExpense: async () => { creates += 1; return createdExpense; },
    uploadReceipt: async () => { uploads += 1; if (uploads === 1) throw new Error('offline'); },
  };
  const result = await submitExpense(payload, receipt, api);
  assert.equal(result.status, 'receipt-failed');
  assert.equal(result.expense.id, createdExpense.id);
  await retryExpenseReceipt(result.expense.id, receipt, api);
  assert.equal(creates, 1);
  assert.equal(uploads, 2);
});
```

Also test create-without-receipt, create-plus-successful-upload, and create failure propagation.

- [ ] **Step 2: Run the expense test and verify RED**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
```

Expected: FAIL because `expenseAPI.ts` and `expenseSubmission.ts` do not exist.

- [ ] **Step 3: Implement the API client and submission result state**

Define `ExpenseRecord` with at least `id`, `name`, `amount`, and nullable `taxCategory`. Make the API class dependencies injectable while retaining a default singleton:

```ts
export class ExpenseAPI {
  constructor(
    private readonly client: Pick<typeof apiClient, 'post'> = apiClient,
    private readonly createFormData: () => FormData = () => new FormData(),
  ) {}

  async createExpense(payload: CreateExpensePayload): Promise<ExpenseRecord> {
    const response = await this.client.post<ApiResponse<ExpenseRecord>>('/api/Expense', payload);
    return response.data;
  }

  async uploadReceipt(expenseId: number, receipt: LocalExpenseReceipt): Promise<void> {
    const form = this.createFormData();
    form.append('files', { uri: receipt.uri, name: receipt.fileName, type: receipt.mimeType } as any);
    await this.client.post(`/api/ExpenseReceipt/${expenseId}`, form);
  }
}

export default new ExpenseAPI();
```

Do not set a multipart `Content-Type`; the existing `apiClient` detects `FormData`, removes its JSON content type, and lets Axios provide the boundary.

Implement orchestration as pure async functions:

```ts
export type ExpenseSubmissionResult =
export interface ExpenseSubmissionApi {
  createExpense(payload: CreateExpensePayload): Promise<ExpenseRecord>;
  uploadReceipt(expenseId: number, receipt: LocalExpenseReceipt): Promise<void>;
}

  | { status: 'saved'; expense: ExpenseRecord }
  | { status: 'receipt-failed'; expense: ExpenseRecord; receipt: LocalExpenseReceipt; message: string };

export function getExpenseErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { message?: unknown; Message?: unknown }).message
      ?? (error as { Message?: unknown }).Message;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

export async function submitExpense(
  payload: CreateExpensePayload,
  receipt: LocalExpenseReceipt | null,
  api: ExpenseSubmissionApi = expenseAPI,
): Promise<ExpenseSubmissionResult> {
  const expense = await api.createExpense(payload);
  if (!receipt) return { status: 'saved', expense };
  try {
    await api.uploadReceipt(expense.id, receipt);
    return { status: 'saved', expense };
  } catch (error) {
    return { status: 'receipt-failed', expense, receipt, message: getExpenseErrorMessage(error, 'Receipt upload failed.') };
  }
}

export async function retryExpenseReceipt(
  expenseId: number,
  receipt: LocalExpenseReceipt,
  api: Pick<ExpenseSubmissionApi, 'uploadReceipt'> = expenseAPI,
): Promise<void> {
  await api.uploadReceipt(expenseId, receipt);
}
```

The retry function must not accept a create payload or expose any way to call `createExpense`.

- [ ] **Step 4: Run the focused tests and TypeScript and verify GREEN**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
npx tsc --noEmit
```

Expected: all expense tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the HTTP and submission boundary**

```powershell
git add -- property-peace-mobile/src/api/expenseAPI.ts property-peace-mobile/src/features/expenses/expenseSubmission.ts property-peace-mobile/scripts/expense-flow.test.mjs
git commit --only -m "feat: add mobile expense submission client" -- property-peace-mobile/src/api/expenseAPI.ts property-peace-mobile/src/features/expenses/expenseSubmission.ts property-peace-mobile/scripts/expense-flow.test.mjs
```

---

### Task 4: Build the three-step native expense screen

**Files:**
- Create: `property-peace-mobile/src/screens/landlord/AddExpenseScreen.tsx`
- Modify: `property-peace-mobile/scripts/expense-flow.test.mjs`
- Modify: `property-peace-mobile/package.json`
- Modify: `property-peace-mobile/package-lock.json`
- Modify: `property-peace-mobile/app.json`

**Interfaces:**
- Consumes: Task 2 model functions, Task 3 submission functions, `PropertyAPI.getProperties()`, current user selector, Expo Image Picker, and native DateTimePicker.
- Produces: default `AddExpenseScreen` component for Task 5 navigation.

- [ ] **Step 1: Write the failing screen contract test**

Extend `expense-flow.test.mjs` to import the file reader and define the regex helper:

```js
import { readFile } from 'node:fs/promises';
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

Then assert the screen contains these integration points:

```js
test('native screen exposes the focused expense workflow', async () => {
  const source = await readFile(new URL('../src/screens/landlord/AddExpenseScreen.tsx', import.meta.url), 'utf8');
  for (const contract of [
    'DateTimePicker',
    'launchCameraAsync',
    'launchImageLibraryAsync',
    'submitExpense',
    'retryExpenseReceipt',
    'testID="expense-amount"',
    'testID="expense-description"',
    'Save expense',
    'getTaxCategoryPresentation',
    'usePreventRemove',
    'Expense saved; receipt not uploaded',
  ]) assert.match(source, new RegExp(escapeRegExp(contract)));
});
```

Add a second source contract that asserts `app.json` contains `Take photos of maintenance issues or expense receipts.` for camera access and `Choose photos of maintenance issues or expense receipts.` for photo-library access in both the iOS keys and Expo Image Picker plugin.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
```

Expected: FAIL with `ENOENT` for `AddExpenseScreen.tsx`.

- [ ] **Step 3: Install the Expo-compatible native date picker**

```powershell
Set-Location property-peace-mobile
npx expo install @react-native-community/datetimepicker
```

Expected: `property-peace-mobile/package.json` and `property-peace-mobile/package-lock.json` record the Expo-compatible version. Do not hand-pick a version.

- [ ] **Step 4: Update camera and library privacy copy**

In `app.json`, change the iOS and `expo-image-picker` camera/photo permission strings so each says the user may attach maintenance evidence or expense receipts. Keep the microphone permission specific to maintenance videos because the expense flow accepts images only.

- [ ] **Step 5: Implement loading, step state, and validation**

In `AddExpenseScreen.tsx`:

```ts
const [step, setStep] = useState<ExpenseStep>('details');
const [form, setForm] = useState(() => emptyExpenseForm());
const [properties, setProperties] = useState<Property[]>([]);
const [receipt, setReceipt] = useState<LocalExpenseReceipt | null>(null);
const [submitting, setSubmitting] = useState(false);
const [result, setResult] = useState<ExpenseSubmissionResult | null>(null);
```

Load properties on mount with retry state. Normalize property and unit IDs with `Number(id ?? Id)` and labels with existing lowercase/PascalCase fallbacks. Show unit choices only for the selected property's units. The Add Property empty-state button navigates to the existing `Properties > AddProperty` route.

Use a keyboard-aware scroll layout (`KeyboardAvoidingView` plus `ScrollView`), safe-area-compatible bottom padding, labeled inputs, 44-point controls, and the dashboard palette. Render a three-step progress label (`1 of 3`, `2 of 3`, `3 of 3`) and preserve state when moving backward.

- [ ] **Step 6: Implement date and receipt selection**

Use `DateTimePicker` with `mode="date"` and convert its selected `Date` through the model's local-date formatter. For Image Picker:

```ts
const toReceipt = (asset: ImagePicker.ImagePickerAsset): LocalExpenseReceipt => {
  const fileName = asset.fileName || `expense-receipt-${Date.now()}.jpg`;
  const mimeType = normalizeSupportedImageMime(asset.mimeType, fileName);
  if (!mimeType) throw new Error('Use a JPEG, PNG, or WebP image.');
  return { uri: asset.uri, fileName, mimeType, fileSize: asset.fileSize };
};
```

Request camera or library permission immediately before the corresponding action. Configure both pickers for images only, one selection, compatible asset representation, and image quality `0.8`. Validate before storing; show validation or permission errors with `Alert.alert`. Render the image URI with `Image` and provide an accessible `Remove receipt` action.

- [ ] **Step 7: Implement review, submit, partial success, retry, and success**

Build the payload only after full review validation and a numeric current user ID:

```ts
const save = async () => {
  if (submitting) return;
  const landlordId = Number(currentUser?.id ?? currentUser?.Id);
  const validation = validateExpenseStep(form, 'review');
  if (!Number.isInteger(landlordId) || landlordId <= 0) {
    setSaveError('Your landlord account could not be identified.');
    return;
  }
  if (Object.keys(validation).length > 0) {
    setSaveError(Object.values(validation)[0]);
    return;
  }
  setSubmitting(true);
  try {
    const payload = buildCreateExpensePayload(form, landlordId, new Date().toISOString());
    setResult(await submitExpense(payload, receipt));
  } catch (error) {
    setSaveError(getExpenseErrorMessage(error, 'Expense could not be saved.'));
  } finally {
    setSubmitting(false);
  }
};
```

Call React Navigation's `usePreventRemove(submitting, handler)` and have the handler show 'Please wait' while the active request settles. The normal success state uses `getTaxCategoryPresentation(result.expense.taxCategory)`. The partial-success state keeps the expense ID and receipt from `result`, calls only `retryExpenseReceipt`, and changes to `{ status: 'saved', expense }` after retry. `Done` calls `navigation.goBack()` to return to `DashboardHome`.

- [ ] **Step 8: Run focused tests and TypeScript and verify GREEN**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
npx tsc --noEmit
```

Expected: expense model, API, orchestration, screen, and permission contracts PASS; TypeScript exits 0.

- [ ] **Step 9: Commit the native expense form**

```powershell
git add -- property-peace-mobile/src/screens/landlord/AddExpenseScreen.tsx property-peace-mobile/scripts/expense-flow.test.mjs property-peace-mobile/package.json property-peace-mobile/package-lock.json property-peace-mobile/app.json
git commit --only -m "feat: add native mobile expense form" -- property-peace-mobile/src/screens/landlord/AddExpenseScreen.tsx property-peace-mobile/scripts/expense-flow.test.mjs property-peace-mobile/package.json property-peace-mobile/package-lock.json property-peace-mobile/app.json
```

---

### Task 5: Wire the Home stack and simplify the dashboard

**Files:**
- Modify: `property-peace-mobile/src/navigation/types.ts`
- Modify: `property-peace-mobile/src/navigation/MainNavigator.tsx`
- Modify: `property-peace-mobile/src/screens/landlord/DashboardScreen.tsx`
- Modify: `property-peace-mobile/scripts/expense-flow.test.mjs`

**Interfaces:**
- Consumes: `AddExpenseScreen` from Task 4.
- Produces: `DashboardStackParamList`, Home-stack navigation to `AddExpense`, and the final requested dashboard presentation.

- [ ] **Step 1: Write failing navigation and dashboard source contracts**

Extend `expense-flow.test.mjs`:

```js
test('home removes redundant labels and replaces messages with Add expense', async () => {
  const source = await readFile(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /YOUR LANDLORD DAY/);
  assert.doesNotMatch(source, /PORTFOLIO SNAPSHOT/);
  assert.doesNotMatch(source, />Open</);
  assert.doesNotMatch(source, /title="Open messages"/);
  assert.match(source, /icon="receipt-outline" title="Add expense" subtitle="Record a property expense"/);
  assert.match(source, /navigate\('AddExpense'\)/);
});

test('Home tab owns DashboardHome and AddExpense stack routes', async () => {
  const [types, navigator] = await Promise.all([
    readFile(new URL('../src/navigation/types.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(types, /DashboardStackParamList/);
  assert.match(types, /DashboardHome: undefined/);
  assert.match(types, /AddExpense: undefined/);
  assert.match(navigator, /function DashboardNavigator/);
  assert.match(navigator, /name="AddExpense" component={AddExpenseScreen}/);
  assert.match(navigator, /name="Dashboard" component={DashboardNavigator}/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
```

Expected: FAIL because the old labels, Open button, and Open messages action remain and no Dashboard stack exists.

- [ ] **Step 3: Add the typed Dashboard stack**

In `types.ts` add:

```ts
export type DashboardStackParamList = {
  DashboardHome: undefined;
  AddExpense: undefined;
};
```

In `MainNavigator.tsx`, import `AddExpenseScreen`, create `DashboardStack`, and register:

```tsx
function DashboardNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={stackOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add expense' }} />
    </DashboardStack.Navigator>
  );
}
```

Change only the landlord `Dashboard` tab component from `DashboardScreen` to `DashboardNavigator`.

- [ ] **Step 4: Make the exact Dashboard cleanup**

In `DashboardScreen.tsx`:

- Delete the `YOUR LANDLORD DAY` text node.
- Delete the `PORTFOLIO SNAPSHOT` text node.
- Delete the portfolio `Open` `TouchableOpacity` and its arrow icon.
- Keep the property-count title as the portfolio header's only child.
- Replace the `Open messages` `QuickAction` with:

```tsx
<QuickAction
  icon="receipt-outline"
  title="Add expense"
  subtitle="Record a property expense"
  color="#8a5a12"
  background="#fff7e8"
  onPress={() => navigation.navigate('AddExpense')}
/>
```

- Remove now-unused `eyebrow`, `openButton`, and `openButtonText` styles.
- Adjust the portfolio header spacing only as needed to retain the current card rhythm; do not redesign other dashboard sections.

- [ ] **Step 5: Run focused tests, TypeScript, and dashboard searches and verify GREEN**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
npx tsc --noEmit
Set-Location ..
rg -n -i "your landlord day|portfolio snapshot|title=\"Open messages\"|>Open<" property-peace-mobile/src/screens/landlord/DashboardScreen.tsx
```

Expected: focused tests PASS, TypeScript exits 0, and `rg` returns no matches.

- [ ] **Step 6: Commit Home navigation and presentation**

```powershell
git add -- property-peace-mobile/src/navigation/types.ts property-peace-mobile/src/navigation/MainNavigator.tsx property-peace-mobile/src/screens/landlord/DashboardScreen.tsx property-peace-mobile/scripts/expense-flow.test.mjs
git commit --only -m "feat: add expense action to mobile home" -- property-peace-mobile/src/navigation/types.ts property-peace-mobile/src/navigation/MainNavigator.tsx property-peace-mobile/src/screens/landlord/DashboardScreen.tsx property-peace-mobile/scripts/expense-flow.test.mjs
```

---

### Task 6: Run full verification and smoke-test the flow

**Files:**
- Modify only if verification exposes a defect in the files already listed above.

**Interfaces:**
- Consumes: Completed Tasks 1-5.
- Produces: Evidence that the focused expense flow and existing mobile suites pass together.

- [ ] **Step 1: Run all automated mobile suites**

```powershell
Set-Location property-peace-mobile
npm run test:expenses
npm run test:registration
npm run test:messages
npm run test:maintenance
npm run test:properties
npm run test:startup
npm run test:ios-compliance
npx tsc --noEmit
```

Expected: every command exits 0 with no unexpected warnings or failures.

- [ ] **Step 2: Run shared and affected main-app categorization tests**

```powershell
Set-Location ..
node --experimental-default-type=module --test shared/expense-categorization.test.js property-peace-app/src/utils/expenseCategorization.test.js
```

Expected: all shared and compatibility tests PASS.

- [ ] **Step 3: Run repository hygiene checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; status contains only intentional changes, or is clean if every task commit succeeded.

- [ ] **Step 4: Smoke-test the native workflow**

Start the Expo app through the project's normal mobile command and verify on a small phone viewport/device:

1. Home begins with the greeting and has no removed eyebrow labels or portfolio Open button.
2. Messages remains a bottom tab.
3. Add expense opens under the selected Home tab.
4. Validation blocks missing/invalid details and preserves values when moving backward.
5. Local date does not shift a day across serialization.
6. Camera and library permission copy covers expense receipts.
7. A no-receipt expense saves and shows the returned AI category or review fallback.
8. A receipt expense uploads successfully.
9. Simulated receipt upload failure leaves the created expense intact and retries only the upload.
10. Done returns to Home.

If no device or simulator is available, record that limitation explicitly and report the automated verification instead of claiming the manual smoke test passed.

- [ ] **Step 5: Route any discovered defect back through its owning task**

Task 6 should not produce code. If Steps 1-4 expose a defect, return to the task that owns that behavior, add the specific failing regression assertion there, verify RED, make the minimal fix, verify GREEN, and use that task's exact `git add` list and commit command. When verification is clean, do not create an empty commit.
