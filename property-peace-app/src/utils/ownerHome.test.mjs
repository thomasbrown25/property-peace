import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getOwnerNextStep, getOwnerProperties } from './ownerHome.js';

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
    { id: 'A', name: 'Oak', href: '/landlord/property/A', shortStayHref: '/landlord/property/A/unit/U/short-stay' }
  ]);
  assert.deepEqual(getOwnerProperties([{ id: 'B', streetAddress: '12 Elm', units: [{ id: 'V', rentalMode: 'LongTerm' }] }]), [
    { id: 'B', name: '12 Elm', href: '/landlord/property/B', shortStayHref: null }
  ]);
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
