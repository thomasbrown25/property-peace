import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isLeaseDraft } from '../../../utils/leaseStatus.js';
import { filterPropertyRows } from './propertyRecords.mjs';

const source = await readFile(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
assert.match(source, /import \{ isLeaseDraft \} from 'utils\/leaseStatus'/);
const readDeclaration = source.match(/const read = .*;/)[0];
const statusDeclaration = source.match(/const leaseStatus = lease => \{[\s\S]*?\n\};/)[0];
const leaseStatus = new Function('isLeaseDraft', `${readDeclaration}\n${statusDeclaration}\nreturn leaseStatus;`)(isLeaseDraft);

test('property lease rows honor draft state even without signature status or lease dates', () => {
  for (const draft of [
    { id: 228, isDrafted: true },
    { Id: 228, IsDrafted: true },
    { status: 'Draft' },
    { Status: 'draft' },
    { leaseAgreement: { isDrafted: true } },
    { leaseAgreement: { IsDrafted: true } }
  ]) {
    assert.equal(leaseStatus(draft), 'Draft');
    assert.equal(leaseStatus({ ...draft, isActive: true, startDate: '2020-01-01', endDate: '2021-01-01' }), 'Draft');
    assert.equal(leaseStatus({ ...draft, startDate: '2099-01-01' }), 'Draft');
  }
});

test('legacy signature drafts and non-draft lifecycle labels remain supported', () => {
  for (const signatureStatus of [0, 'NotSent', 'notsent']) assert.equal(leaseStatus({ signatureStatus }), 'Draft');
  assert.equal(leaseStatus({ SignatureStatus: 0 }), 'Draft');
  assert.equal(leaseStatus({ startDate: '2020-01-01', endDate: '2099-01-01', isDrafted: false }), 'Active');
  assert.equal(leaseStatus({ startDate: '2099-01-01' }), 'Scheduled');
  assert.equal(leaseStatus({ endDate: '2020-01-01' }), 'Expired');
});

test('draft rows appear in the Draft filter, not the Active filter or green highlight', () => {
  const draft = { id: 228, isDrafted: true };
  const active = { id: 229, startDate: '2020-01-01', endDate: '2099-01-01' };
  const rows = [draft, active];
  assert.deepEqual(filterPropertyRows(rows, '', 'Draft', row => [row.id], leaseStatus), [draft]);
  assert.deepEqual(filterPropertyRows(rows, '', 'Active', row => [row.id], leaseStatus), [active]);
  assert.match(source, /getStatus=\{leaseStatus\} highlightStatus="Active"/);
  assert.match(source, /highlightStatus && getStatus\(row\) === highlightStatus/);
});
