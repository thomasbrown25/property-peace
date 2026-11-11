import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { leaseTermError } from '../../utils/successorLease.mjs';
import { setupDefaults, setupId, readSetup } from './leaseSetup.mjs';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration').declaration;
const initializer = (name) => component.body.body.flatMap((node) => node.declarations || [])
  .find((node) => node.id.name === name).init;
const productionFunction = (name, context) => {
  const node = initializer(name);
  return Function(...Object.keys(context), `return (${source.slice(node.start, node.end)});`)(...Object.values(context));
};
function fixture(overrides = {}) {
  const values = { ...setupDefaults(), startDate: '2027-01-01', endDate: '2027-12-31', ...overrides };
  return productionFunction('validate', { canManage: true, property: { id: 1 }, unit: { id: 2 }, values,
    existing: null, setupId, readSetup, rentalMode: () => 'longTerm', leaseTermError, tenants: [] });
}

test('specifics can complete without rent or people, while final save still validates them', () => {
  const validate = fixture({ rentAmount: '' });
  assert.equal(validate(true), null);
  assert.equal(validate(), 'Enter a valid rent amount.');
});

test('incomplete dates, invalid terms, and invalid renewal fields cannot complete specifics', () => {
  assert.match(fixture({ startDate: '' })(true), /start date/);
  assert.match(fixture({ endDate: '' })(true), /end date/);
  assert.ok(fixture({ endDate: '2026-01-01' })(true));
  assert.match(fixture({ autoRenewLease: true, autoRenewLeaseLength: 0 })(true), /renewal term/);
  assert.match(fixture({ autoRenewLease: true, autoRenewRentIncrement: true, autoRenewRentIncrementValue: '' })(true), /renewal rent increase/);
  assert.equal(fixture({ termType: 'monthly', endDate: '' })(true), null);
});

test('Continue validates specifics and rent before marking only the current step complete', () => {
  for (const initial of [0, 1]) for (const validation of [null, 'Required fields are missing.']) {
    let active = initial;
    let completed = [false, false, false];
    let error = 'Old error';
    const proceed = productionFunction('continueStep', { active, validate: (scope) => {
      assert.equal(scope, initial === 0 ? true : 'rent');
      return validation;
    }, setError: (value) => { error = value; }, setCompletedSteps: (update) => { completed = update(completed); },
    setActive: (update) => { active = update(active); } });
    proceed();
    assert.deepEqual(completed, [0, 1, 2].map((index) => index === initial && !validation));
    assert.equal(active, validation ? initial : initial + 1);
    assert.equal(error, validation || '');
  }
});

test('rent completion validates financial requirements but does not require people yet', () => {
  assert.equal(fixture({ rentAmount: 1200 })('rent'), null);
  assert.match(fixture({ rentAmount: 1200 })(), /tenant/);
  for (const overrides of [
    { rentAmount: '' }, { rentAmount: -1 }, { rentDueDay: 32 }, { depositAmount: -1 },
    { proratedRentDue: true, proratedRentAmount: '' }, { fees: [{ name: '', amount: 10 }] },
    { leaseDeposits: [{ name: 'Deposit', amount: -1 }] }
  ]) assert.ok(fixture({ rentAmount: 1200, ...overrides })('rent'));
});

test('all three checks appear after final validation, but success modal waits for persistence', async () => {
  for (const scenario of ['invalid', 'success', 'failure']) {
    let completed = [true, true, false];
    let saved = null;
    let error = '';
    let resolveSave;
    let rejectSave;
    const pending = new Promise((resolve, reject) => { resolveSave = resolve; rejectSave = reject; });
    const inFlight = { current: false };
    const submit = productionFunction('submit', {
      inFlight, saved, embedded: false, setError: (value) => { error = value; }, validate: () => scenario === 'invalid' ? 'Select a tenant.' : null,
      setCompletedSteps: (value) => { completed = value; }, setSaving: () => {},
      setupPayload: () => ({}), values: { addTenantsLater: true }, existing: null, setupId, currentOrganization: { id: 1 },
      persistLeaseSetup: () => pending, tenants: [], checkpoint: { current: {} },
      addOrUpdateLease: () => {}, addTenantToLease: () => {}, removeTenantFromLease: () => {}, setPartial: () => {},
      setSaved: (value) => { saved = value; }, propertiesRefetch: () => {}
    });
    const submission = submit();
    assert.deepEqual(completed, scenario === 'invalid' ? [true, true, false] : [true, true, true]);
    assert.equal(saved, null);
    if (scenario === 'failure') rejectSave(new Error('Save failed'));
    else resolveSave({ id: 42 });
    await submission;
    assert.deepEqual(saved, scenario === 'success' ? { id: 42 } : null);
    assert.equal(error, scenario === 'invalid' ? 'Select a tenant.' : scenario === 'failure' ? 'Save failed' : '');
    assert.equal(inFlight.current, false);
  }
});

test('sidebar checks require completion and current validity; sidebar navigation alone does not complete steps', () => {
  assert.match(source, /completedSteps\[index\] && !validate\(index === 0 \? true : index === 1 \? 'rent' : false\)/);
  assert.match(source, /color: 'success.main'[\s\S]*?<CheckCircleOutlined aria-label=\{`\$\{section.title\} completed`\}/);
  assert.match(source, /onClick=\{continueStep\}>Continue/);
  assert.match(source, /\[completedSteps, setCompletedSteps\] = useState\(\[false, false, false\]\)/);
  assert.match(source, /onClick=\{\(\) => setActive\(index\)\}/);
  assert.match(source, /<Dialog open=\{!embedded && Boolean\(saved\)\}/);
});
