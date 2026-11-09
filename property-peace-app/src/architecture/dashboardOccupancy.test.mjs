import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getPropertyOccupancy, isUnitOccupied } from '../utils/occupancy.mjs';
import { getOwnerProperties, getPropertyMonthRent, getPropertyOverdueRent } from '../utils/ownerHome.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const portfolioSource = source('sections/landlord/dashboard/Portfolio.jsx');
// Exercise the component's actual pure calculations without a JSX/DOM runtime.
const portfolioCalculations = portfolioSource.slice(portfolioSource.indexOf('const read ='), portfolioSource.indexOf('function formatMoney'));
const getPortfolioMetrics = new Function('getPropertyOccupancy', 'isHighPriorityMaintenanceRequest',
  `${portfolioCalculations.replace('export function', 'function')}; return getPortfolioMetrics;`)(getPropertyOccupancy, () => false);
const glanceSource = source('sections/landlord/dashboard/AtAGlance.jsx');
const getUnitStatus = new Function('isUnitOccupied', `${glanceSource.slice(glanceSource.indexOf('function getUnitStatus'), glanceSource.indexOf('const STATUS_CONFIG'))}; return getUnitStatus;`)(isUnitOccupied);
const recentSource = source('sections/landlord/dashboard/RecentlyViewedProperties.jsx');
const getRecentOccupancy = new Function('getPropertyOccupancy', `${recentSource.slice(recentSource.indexOf('function getOccupancy'), recentSource.indexOf('function PropertyImage'))}; return getOccupancy;`)(getPropertyOccupancy);
const now = new Date('2026-06-15T12:00:00Z');
const activeLease = { isActive: true, startDate: '2020-01-01', endDate: '2099-01-01' };
const units = [
  { status: 'vacant', isOccupied: false, lease: activeLease },
  { status: 'occupied', isOccupied: true, tenants: [{ id: 1 }] },
  { status: 'overdue', isOccupied: true, lease: { ...activeLease, isActive: false } },
  { status: 'occupied', lease: { ...activeLease, startDate: '2098-01-01' } },
  { status: 'occupied', lease: { ...activeLease, endDate: '2020-02-01' } },
  { status: 'overdue', lease: activeLease }
];

test('portfolio occupancy counts started active leases, not tenant membership or saved status', () => {
  const result = getPortfolioMetrics([{ units }, { isActive: false, units: [{ lease: activeLease }] }], now);
  assert.equal(result.occupiedUnits, 2);
  assert.equal(result.totalUnits, 6);
  assert.equal(result.vacantUnits, 4);
  assert.equal(result.occupancy, 33);
});

test('portfolio handles PascalCase and an empty portfolio', () => {
  const result = getPortfolioMetrics([{ Units: [{ Status: 'Vacant', Lease: { IsActive: true, StartDate: '2020-01-01' } }] }], now);
  assert.equal(result.occupiedUnits, 1);
  assert.equal(result.occupancy, 100);
  assert.equal(getPortfolioMetrics([], now).occupancy, 0);
});

test('at-a-glance treats overdue active leases as occupied and rejects stale occupied flags', () => {
  assert.deepEqual(units.map(getUnitStatus), ['occupied', 'vacant', 'vacant', 'vacant', 'vacant', 'overdue']);
  assert.equal(getUnitStatus({ status: 'draft' }), 'draft');
  assert.match(glanceSource, /occupiedUnits: occupied, vacantUnits: vacant/);
});

test('recently viewed chips use active-lease counts without property-level saved-flag fallback', () => {
  assert.deepEqual(getRecentOccupancy({ units }), { occupied: 2, vacant: 4 });
  const empty = getPropertyOccupancy({ isOccupied: true });
  assert.deepEqual(getRecentOccupancy({ isOccupied: true }), empty.totalUnits ? { occupied: empty.occupiedUnits, vacant: empty.vacantUnits } : null);
  assert.doesNotMatch(recentSource, /read\(\w+, 'isOccupied'/);
});

test('owner home activeLeaseCount and sorting use shared occupancy while retaining rent helpers', () => {
  const properties = [
    { id: 1, name: 'A stale', units: [units[1]] },
    { id: 2, name: 'B active', units: [units[0], units[5]] }
  ];
  assert.deepEqual(getOwnerProperties(properties, now).map(({ id, activeLeaseCount }) => [id, activeLeaseCount]), [[2, 2], [1, 0]]);
  assert.equal(properties[0].id, 1);
  assert.deepEqual(getPropertyMonthRent(1, [{ propertyId: 1, currentMonthExpected: 100, currentMonthCollected: 25 }]), { expected: 100, paid: 25, percent: 25 });
  assert.equal(getPropertyOverdueRent(1, [], true), null);
});

test('health summary and neighborhood map delegate occupancy to the shared property helper', () => {
  const health = source('sections/landlord/dashboard/PortfolioHealthSummary.jsx');
  const map = source('components/maps/PropertiesMultiMap.jsx');
  for (const text of [health, map]) assert.match(text, /getPropertyOccupancy.*from 'utils\/occupancy\.mjs'/);
  assert.match(health, /total \+= occupancy\.totalUnits/);
  assert.match(health, /occupied \+= occupancy\.occupiedUnits/);
  assert.match(map, /getPropertyOccupancy\(property\)/);
  assert.match(map, /\$\{occupiedUnits\} of \$\{totalUnits\} units occupied/);
});
