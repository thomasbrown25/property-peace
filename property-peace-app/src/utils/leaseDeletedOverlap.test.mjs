import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { incumbentLease, leaseTermError } from './successorLease.mjs';

for (const casing of ['camel', 'pascal']) {
  const lease = casing === 'camel'
    ? { id: 8, isActive: true, isDeleted: true, startDate: '2027-04-01', endDate: '2028-04-01' }
    : { Id: 8, IsActive: true, IsDeleted: true, StartDate: '2027-04-01', EndDate: '2028-04-01' };
  for (const slot of ['lease', 'Lease', 'activeLease', 'ActiveLease']) {
    test(`deleted ${casing} lease in ${slot} cannot block a new term`, () => {
      const unit = { [slot]: lease, leases: [lease] };
      assert.equal(incumbentLease(unit), null);
      assert.equal(leaseTermError('2026-11-01', '2027-11-01', unit), null);
      assert.equal(leaseTermError('2026-11-01', null, unit), null);
    });
  }
  test(`deleted ${casing} scheduled lease is ignored without hiding a real booking`, () => {
    const unit = { leases: [lease] };
    assert.equal(leaseTermError('2026-11-01', '2027-11-01', unit), null);
    unit.leases.push({ id: 9, isActive: true, startDate: '2027-05-01', endDate: '2028-05-01' });
    assert.match(leaseTermError('2026-11-01', '2027-11-01', unit), /2027-05-01/);
  });
}

test('builder forces fresh property data; shared hook refreshes once per entry and organization', () => {
  const builder = readFileSync(new URL('../sections/lease-builder/LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
  assert.match(builder, /useFetchProperties\(\{ refreshOnMount: true \}\)/);
  const source = readFileSync(new URL('../hooks/useFetchProperties.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default function', 'function');
  let effect;
  let org = 10;
  let refreshes = 0;
  let refs = [];
  let refIndex = 0;
  const context = vm.createContext({
    Date, console,
    useRef: initial => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useCallback: fn => fn,
    useEffect: fn => { effect = fn; },
    useState: initial => [initial, () => {}],
    useDispatch: () => async () => { refreshes++; return { success: true }; },
    useSelector: selector => selector(),
    selectProperties: () => [], selectPropertiesLoadedAt: () => Date.now(),
    selectPropertiesOrganizationId: () => org,
    useOrganization: () => ({ currentOrganization: { id: org } }),
    useAuth: () => ({ user: { id: 1 }, isLoggedIn: true }),
    getProperties: () => ({}),
  });
  vm.runInContext(source, context);
  const render = options => {
    refIndex = 0;
    context.useFetchProperties(options);
    effect();
  };
  render({ refreshOnMount: true });
  assert.equal(refreshes, 1, 'fresh cache must not suppress builder entry refresh');
  render({ refreshOnMount: true });
  assert.equal(refreshes, 1, 'store updates must not cause a refresh loop');
  org = 20;
  render({ refreshOnMount: true });
  assert.equal(refreshes, 2, 'organization switch requires fresh data');
  refs = [];
  render();
  assert.equal(refreshes, 2, 'other consumers retain normal cache behavior');
  refs = [];
  render({ refreshOnMount: true });
  assert.equal(refreshes, 3, 'reopening builder refreshes again');
});
