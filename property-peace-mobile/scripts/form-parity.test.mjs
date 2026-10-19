import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnnouncementCommand, announcementDraftFromDetail, validateAnnouncementDraft } from '../src/features/announcements/announcementForm.ts';
import { buildCreateExpensePayload, emptyExpenseForm, validateExpenseStep } from '../src/features/expenses/expenseModel.ts';
import { expenseEditForm, buildExpenseUpdate } from '../src/features/expenses/expenseEdit.ts';
import { buildMaintenanceWindow, validateMaintenanceRequest } from '../src/features/maintenance/maintenanceForm.ts';

const draft = { message: 'Water will be shut off tomorrow', audience: 'properties', propertyIds: [3], unitIds: [], email: true, notification: false, schedule: 'now', scheduledAt: null };
test('announcement targets and preview use the same audience; scheduled sends require future time', () => {
  assert.deepEqual(buildAnnouncementCommand(draft), { organizationIds: null, propertyIds: [3], unitIds: null, message: draft.message, sendEmail: true, sendNotification: false, scheduledAt: null });
  assert.deepEqual(validateAnnouncementDraft({ ...draft, schedule: 'later', scheduledAt: '2026-01-01T12:00:00Z' }, new Date('2026-02-01')), ['Choose a future schedule time.']);
  assert.deepEqual(validateAnnouncementDraft({ ...draft, audience: 'units', unitIds: [], email: false }, new Date()), ['Choose at least one unit.', 'Choose a delivery method.']);
});
test('announcement edit restores audience, channel and schedule without widening recipients', () => {
  const restored = announcementDraftFromDetail({ id: 9, message: 'Notice\n\nBest regards,\nJane Doe', createdByName: 'Jane Doe', propertyIds: '[3,4]', unitIds: null, organizationIds: null, sendAsEmail: true, sendAsNotification: false, scheduledAt: '2027-02-01T12:00:00Z' });
  assert.equal(restored.message, 'Notice');
  assert.equal(restored.audience, 'properties');
  assert.deepEqual(buildAnnouncementCommand(restored).propertyIds, [3, 4]);
  assert.equal(buildAnnouncementCommand(restored, 9).id, 9);
});
test('announcement edit fails closed when stored audience IDs cannot be parsed', () => {
  assert.throws(() => announcementDraftFromDetail({ message: 'Notice', propertyIds: '[bad', unitIds: null }), /audience/i);
  assert.throws(() => announcementDraftFromDetail({ message: 'Notice', propertyIds: null, unitIds: '[null]' }), /audience/i);
});
test('maintenance request checks future access window and carries instructions', () => {
  const start = new Date('2027-01-10T13:00:00Z');
  const end = new Date('2027-01-10T15:00:00Z');
  assert.equal(validateMaintenanceRequest({ propertyId: 1, unitId: 2, title: 'Leaking sink', description: 'Water under the sink', startsAt: start, endsAt: end }, new Date('2027-01-09')), null);
  assert.match(validateMaintenanceRequest({ propertyId: 1, unitId: 2, title: 'Leaking sink', description: 'Water under the sink', startsAt: end, endsAt: start }, new Date('2027-01-09')), /after/);
  assert.deepEqual(buildMaintenanceWindow(start, end, 'Call first'), [{ startsAtUtc: start.toISOString(), endsAtUtc: end.toISOString(), accessInstructions: 'Call first' }]);
});

test('expense edit prefill preserves existing financial metadata and updates only selected fields', () => {
  const existing = { id: 19, propertyId: 3, unitId: 4, name: 'Old repair', amount: 25, category: 'Repairs', expenseDate: '2026-08-22T00:00:00', vendor: 'Plumber', vendorId: 8, paymentMethod: 'Cash', receiptUrl: 'private', isRecurring: true, frequency: 2, dayOfPeriod: 5, startDate: '2026-01-01', endDate: null, isPaused: true, isTaxDeductible: true, taxCategory: 1, isLoanPayment: false, maintenanceRequestId: 9, billDate: '2026-08-01', dueDate: '2026-08-28', isPaid: false, paidDate: null, billNumber: 'B-19' };
  const form = expenseEditForm(existing);
  assert.equal(form.description, 'Old repair');
  assert.equal(form.expenseDate, '2026-08-22');
  assert.equal(form.unitId, 4);
  const payload = buildExpenseUpdate({ ...form, amount: '30.50', description: 'New repair', category: 'Utilities', unitId: null }, existing);
  assert.equal(payload.id, 19);
  assert.equal(payload.amount, 30.5);
  assert.equal(payload.name, 'New repair');
  assert.equal(payload.unitId, null);
  assert.equal(payload.category, 'Utilities');
  for (const key of ['vendorId', 'receiptUrl', 'isRecurring', 'frequency', 'dayOfPeriod', 'startDate', 'isPaused', 'isTaxDeductible', 'taxCategory', 'maintenanceRequestId', 'billDate', 'dueDate', 'isPaid', 'paidDate', 'billNumber']) assert.deepEqual(payload[key], existing[key], key);
  assert.throws(() => buildExpenseUpdate(form, { ...existing, propertyId: 0 }), /valid existing expense/);
});

test('expense form preserves supported vendor, payment method, and category overrides', () => {
  const form = { ...emptyExpenseForm(new Date(2026, 7, 22)), amount: '25.00', propertyId: 3, description: 'Sink repair', vendor: 'Plumber', paymentMethod: 'Cash', category: 'Utilities' };
  assert.deepEqual(validateExpenseStep(form, 'review'), {});
  const payload = buildCreateExpensePayload(form, 7, '2026-08-22T12:00:00Z');
  assert.equal(payload.vendor, 'Plumber'); assert.equal(payload.paymentMethod, 'Cash'); assert.equal(payload.category, 'Utilities');
  assert.equal(validateExpenseStep({ ...form, vendor: 'x'.repeat(201) }, 'review').vendor, 'Keep vendor to 200 characters or fewer.');
});
