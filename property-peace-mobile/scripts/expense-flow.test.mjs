import assert from 'node:assert/strict';
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as model from '../src/features/expenses/expenseModel.ts';
import { ExpenseAPI } from '../src/api/expenseAPI.ts';
import { getExpenseErrorMessage, retryExpenseReceipt, submitExpense } from '../src/features/expenses/expenseSubmission.ts';
import { createRequestGate } from '../src/features/expenses/requestGate.ts';
import { toLocalExpenseReceipt } from '../src/features/expenses/expenseReceiptModel.ts';

const required = () => model;

const validForm = {
  amount: '125.50',
  expenseDate: '2026-08-20',
  propertyId: 7,
  unitId: 9,
  description: 'repair broken sink',
};

test('requires a positive amount, valid local date, property, and description', () => {
  const { emptyExpenseForm, validateExpenseStep } = required();
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

test('rejects invalid amounts and impossible dates', () => {
  const { validateExpenseStep } = required();
  assert.deepEqual(validateExpenseStep({ ...validForm, amount: '1.234' }, 'details'), {
    amount: 'Enter an amount greater than zero.',
  });
  assert.deepEqual(validateExpenseStep({ ...validForm, expenseDate: '2026-02-30' }, 'details'), {
    expenseDate: 'Enter a valid date.',
  });
});

test('requires a positive integer property ID', () => {
  const { validateExpenseStep } = required();
  for (const propertyId of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(validateExpenseStep({ ...validForm, propertyId }, 'details'), {
      propertyId: 'Choose a property.',
    });
  }
});

test('rejects descriptions longer than 200 characters', () => {
  const { validateExpenseStep } = required();
  assert.deepEqual(validateExpenseStep({ ...validForm, description: 'x'.repeat(201) }, 'description'), {
    description: 'Keep the description to 200 characters or fewer.',
  });
});

test('changing property clears a stale unit selection', () => {
  const { setExpenseProperty } = required();
  const changed = setExpenseProperty({ ...validForm, propertyId: 1, unitId: 11 }, 2);
  assert.equal(changed.propertyId, 2);
  assert.equal(changed.unitId, null);
});

test('builds the focused paid-expense payload and lets the server choose tax category', () => {
  const { buildCreateExpensePayload } = required();
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

test('rejects a missing landlord ID when building a payload', () => {
  const { buildCreateExpensePayload } = required();
  assert.throws(
    () => buildCreateExpensePayload(validForm, null, '2026-08-22T15:00:00.000Z'),
    /landlord/i,
  );
});

test('accepts one supported receipt at or below 10 MB', () => {
  const { normalizeSupportedImageMime, validateExpenseReceipt } = required();
  assert.equal(
    validateExpenseReceipt({
      uri: 'file://receipt.jpg',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      fileSize: 10 * 1024 * 1024,
    }),
    null,
  );
  assert.equal(
    validateExpenseReceipt({
      uri: 'file://receipt.pdf',
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      fileSize: 10,
    }),
    'Use a JPEG, PNG, or WebP image.',
  );
  assert.equal(
    validateExpenseReceipt({
      uri: 'file://large.png',
      fileName: 'large.png',
      mimeType: 'image/png',
      fileSize: 10 * 1024 * 1024 + 1,
    }),
    'Receipt images must be 10 MB or smaller.',
  );
  assert.equal(normalizeSupportedImageMime('IMAGE/JPEG', 'ignored.bin'), 'image/jpeg');
  assert.equal(normalizeSupportedImageMime(undefined, 'receipt.webp'), 'image/webp');
});

test('presents AI category or a review fallback', () => {
  const { getTaxCategoryPresentation } = required();
  assert.deepEqual(getTaxCategoryPresentation(1), { status: 'categorized', label: 'Repairs' });
  assert.deepEqual(getTaxCategoryPresentation(0), { status: 'needs-review', label: 'Needs category review' });
  assert.deepEqual(getTaxCategoryPresentation(null), { status: 'needs-review', label: 'Needs category review' });
  assert.deepEqual(getTaxCategoryPresentation(undefined), { status: 'needs-review', label: 'Needs category review' });
  assert.deepEqual(getTaxCategoryPresentation(99), { status: 'needs-review', label: 'Needs category review' });
});


test('preserves API error messages and falls back when none are usable', () => {
  assert.equal(getExpenseErrorMessage({ message: ' lower-case message ' }, 'Fallback.'), 'lower-case message');
  assert.equal(getExpenseErrorMessage({ Message: ' Upper-case message ' }, 'Fallback.'), 'Upper-case message');
  assert.equal(getExpenseErrorMessage({ message: '   ' }, 'Fallback.'), 'Fallback.');
  assert.equal(getExpenseErrorMessage('offline', 'Fallback.'), 'Fallback.');
});
const { buildCreateExpensePayload } = required();
const payload = buildCreateExpensePayload(validForm, 42, '2026-08-22T15:00:00.000Z');
const receipt = { uri: 'file://receipt.jpg', fileName: 'receipt.jpg', mimeType: 'image/jpeg', fileSize: 1000 };
const createdExpense = { id: 99, name: payload.name, amount: payload.amount, taxCategory: 1 };

class RecordingFormData {
  entries = [];
  append(name, value) { this.entries.push([name, value]); }
}

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

test('creates an expense without uploading when no receipt is selected', async () => {
  let uploads = 0;
  const api = { createExpense: async () => createdExpense, uploadReceipt: async () => { uploads += 1; } };
  assert.deepEqual(await submitExpense(payload, null, api), { status: 'saved', expense: createdExpense });
  assert.equal(uploads, 0);
});

test('returns saved after creating an expense and uploading its receipt', async () => {
  const uploads = [];
  const api = { createExpense: async () => createdExpense, uploadReceipt: async (...args) => { uploads.push(args); } };
  assert.deepEqual(await submitExpense(payload, receipt, api), { status: 'saved', expense: createdExpense });
  assert.deepEqual(uploads, [[createdExpense.id, receipt]]);
});


test('converts a picker asset into one normalized local receipt', () => {
  assert.deepEqual(
    toLocalExpenseReceipt({
      uri: 'file://receipt.webp',
      fileName: 'receipt.webp',
      mimeType: undefined,
      fileSize: 1024,
    }),
    {
      uri: 'file://receipt.webp',
      fileName: 'receipt.webp',
      mimeType: 'image/webp',
      fileSize: 1024,
    },
  );
});

test('rejects invalid picker receipt assets before they reach the native screen', () => {
  assert.throws(
    () => toLocalExpenseReceipt({ uri: 'file://receipt.pdf', fileName: 'receipt.pdf', mimeType: 'application/pdf' }),
    /JPEG, PNG, or WebP/,
  );
  assert.throws(
    () => toLocalExpenseReceipt({ uri: 'file://large.jpg', fileName: 'large.jpg', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 + 1 }),
    /10 MB or smaller/,
  );
});

test('uses a JPEG filename fallback when a picker omits the asset filename', () => {
  const receipt = toLocalExpenseReceipt({ uri: 'file://camera-image', mimeType: 'image/jpeg' }, () => 12345);
  assert.deepEqual(receipt, {
    uri: 'file://camera-image',
    fileName: 'expense-receipt-12345.jpg',
    mimeType: 'image/jpeg',
    fileSize: undefined,
  });
});

test('declares focused receipt permissions in iOS and Expo image-picker config', async () => {
  const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  const iosInfo = appConfig.expo.ios.infoPlist;
  const imagePickerConfig = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker')?.[1];

  assert.equal(iosInfo.NSCameraUsageDescription, 'Take photos of maintenance issues or expense receipts.');
  assert.equal(iosInfo.NSPhotoLibraryUsageDescription, 'Choose photos of maintenance issues or expense receipts.');

  assert.equal(imagePickerConfig.cameraPermission, 'Take photos of maintenance issues or expense receipts.');
  assert.equal(imagePickerConfig.photosPermission, 'Choose photos of maintenance issues or expense receipts.');
});
test('propagates a create failure without attempting receipt upload', async () => {
  let uploads = 0;
  const api = { createExpense: async () => { throw new Error('Create unavailable'); }, uploadReceipt: async () => { uploads += 1; } };
  await assert.rejects(() => submitExpense(payload, receipt, api), /Create unavailable/);
  assert.equal(uploads, 0);
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
  assert.equal(result.message, 'offline');
  assert.equal(creates, 1);
  assert.equal(uploads, 2);
});
test('uploads a receipt without Axios retaining the JSON default content type', async () => {
  let observedConfig;
  const client = axios.create({
    headers: { 'Content-Type': 'application/json' },
    adapter: async (config) => {
      observedConfig = config;
      return { data: { success: true, data: [] }, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  const form = new FormData();
  const append = form.append.bind(form);
  form.append = (name, value) => append(name, new Blob([JSON.stringify(value)]), 'receipt.json');

  await new ExpenseAPI(client, () => form).uploadReceipt(99, receipt);

  const contentType = observedConfig.headers.getContentType();
  assert.equal(observedConfig.data, form);
  assert.notEqual(contentType, 'application/json');
});

test('request gate denies a concurrent action until the first unresolved request releases it', () => {
  const gate = createRequestGate();
  assert.equal(gate.tryAcquire(), true);
  assert.equal(gate.tryAcquire(), false);
  gate.release();
  assert.equal(gate.tryAcquire(), true);
});
