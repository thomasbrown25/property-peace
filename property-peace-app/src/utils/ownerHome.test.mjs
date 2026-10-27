import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getOwnerNextStep, getOwnerProperties, getPropertyMonthRent } from './ownerHome.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');

test('next step uses actual today reminder, and never invents a booking action', () => {
  assert.deepEqual(getOwnerNextStep({ reminders: [{ title: 'Inspect water heater', type: 'maintenance' }], properties: [] }), {
    title: 'Inspect water heater', label: 'Scheduled for today', href: '/landlord/maintenances'
  });
  assert.equal(getOwnerNextStep({ reminders: [], properties: [{ id: 'p1' }] }), null);
});

test('empty, loading and failed property requests cannot claim the portfolio is empty', () => {
  assert.equal(getOwnerNextStep({ properties: [], propertiesLoading: true }), null);
  assert.equal(getOwnerNextStep({ properties: [], propertiesError: true }), null);
  assert.deepEqual(getOwnerNextStep({ properties: [] }), { title: 'Add your first property', label: 'Get started', href: '/landlord/properties/add' });
  assert.deepEqual(getOwnerProperties([{ Id: 'A', Name: 'Oak', Units: [{ Id: 'U', rentalMode: 'shortTerm' }] }]), [
    { id: 'A', name: 'Oak', address: '', imageUrl: null, original: { Id: 'A', Name: 'Oak', Units: [{ Id: 'U', rentalMode: 'shortTerm' }] }, href: '/landlord/property/A', shortStayHref: '/landlord/property/A/unit/U/short-stay' }
  ]);
  assert.deepEqual(getOwnerProperties([{ id: 'B', streetAddress: '12 Elm', units: [{ id: 'V', rentalMode: 'LongTerm' }] }]), [
    { id: 'B', name: '12 Elm', address: '12 Elm', imageUrl: null, original: { id: 'B', streetAddress: '12 Elm', units: [{ id: 'V', rentalMode: 'LongTerm' }] }, href: '/landlord/property/B', shortStayHref: null }
  ]);
});

test('property month rent uses scoped period allocations, not lifetime or other-property payments', () => {
  const records = [
    { propertyId: 1, leaseId: 10, currentMonthExpected: 1200, currentMonthCollected: 300, collectedLifetime: 5000 },
    { PropertyId: 1, LeaseId: 11, CurrentMonthExpected: 800, CurrentMonthCollected: 800 },
    { propertyId: 2, leaseId: 12, currentMonthExpected: 400, currentMonthCollected: 400 }
  ];
  assert.deepEqual(getPropertyMonthRent(1, records), { expected: 2000, paid: 1100, percent: 55 });
  assert.deepEqual(getPropertyMonthRent(2, records), { expected: 400, paid: 400, percent: 100 });
  assert.deepEqual(getPropertyMonthRent(3, records), { expected: 0, paid: 0, percent: 0 });
  assert.equal(getPropertyMonthRent(1, [], true), null);
  assert.equal(getPropertyMonthRent(1, [{ propertyId: 1, rentAmount: 1200 }]), null);
  assert.deepEqual(getPropertyMonthRent(1, [{ propertyId: 1, currentMonthExpected: 0, currentMonthCollected: 0 }]), { expected: 0, paid: 0, percent: 0 });
});

test('rent API exposes the same period allocation per lease used for the portfolio summary', () => {
  const dto = readFileSync(resolve(root, '../../property-peace-api/Dtos/RentCollection/RentRecordDto.cs'), 'utf8');
  const service = readFileSync(resolve(root, '../../property-peace-api/Services/RentCollectionService/RentCollectionService.cs'), 'utf8');
  assert.match(dto, /CurrentMonthExpected/);
  assert.match(dto, /CurrentMonthCollected/);
  assert.match(service, /CurrentMonthExpected = RentCalculator\.ExpectedForLease\(l, startOfMonth, endOfMonth\)/);
  assert.match(service, /CurrentMonthCollected = RentCalculator\.CollectedForPeriod\(l, leasePaymentList, startOfMonth, endOfMonth\)/);
});

test('today property list includes image, address, rent paid and operations columns', () => {
  const home = source('sections/landlord/dashboard/OwnerTodayHome.jsx');
  const overview = source('pages/landlord/dashboard-overview.jsx');
  assert.match(home, /property\.imageUrl/);
  assert.match(home, /property\.address/);
  assert.match(home, /Rent paid/);
  assert.match(home, /LinearProgress/);
  assert.match(home, /Operations/);
  assert.match(home, /PropertyOperations/);
  assert.match(overview, /rentRecords=\{rentRecords\}/);
});

test('today home has a single next-step action and no workspaces section', () => {
  const home = source('sections/landlord/dashboard/OwnerTodayHome.jsx');
  assert.doesNotMatch(home, /View tasks|Owner workspaces|>Workspaces<|workspaceLinks/);
  assert.match(home, /to=\{next\.href\}/);
});

test('overview puts sparse owner home first and keeps advanced cards behind a settings-controlled disclosure', () => {
  const overview = source('pages/landlord/dashboard-overview.jsx');
  const home = source('sections/landlord/dashboard/OwnerTodayHome.jsx');
  assert.match(overview, /<OwnerTodayHome[\s\S]*?<Collapse\s+in=\{operationsOpen\}/);
  assert.match(overview, /<Portfolio properties=\{properties\}/);
  assert.match(overview, /<MoneySummary/);
  assert.doesNotMatch(home, /aria-expanded=\{operationsOpen\}/);
  assert.match(source('pages/landlord/dashboard.jsx'), /calendar: CalendarPage,[\s\S]*tasks: TasksPage/);
  for (const route of ["landlord/properties'", "landlord/leases'", "landlord/maintenances'", "landlord/reports'", "landlord/property\/:propertyId\/unit\/:unitId\/short-stay'"]) {
    assert.ok(source('routes/MainRoutes.jsx').includes(route), `unrouted ${route}`);
  }
});
