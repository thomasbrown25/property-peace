import assert from 'node:assert/strict';
import test from 'node:test';

let model;
let loadError;
try {
  model = await import('../src/features/expenses/expenseModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return model;
};

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
