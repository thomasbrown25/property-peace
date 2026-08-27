import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Listings owns the combined header and URL-addressable Listings and Applications tabs', async () => {
  const listings = await source('../pages/landlord/listings.jsx');

  assert.match(listings, /title="Listings & Applications"/);
  assert.doesNotMatch(listings, /title="Listing & Applications"/);
  assert.match(listings, /<Tab value="listings" label="Listings"/);
  assert.match(listings, /<Tab value="applications" label="Applications"/);
  assert.match(listings, /searchParams\.get\('tab'\) === 'applications'/);
  assert.match(listings, /<ApplicationsPage hideHeader \/>/);
});

test('landlord navigation exposes one combined destination without the Leasing group or retired pages', async () => {
  const [landlordMenu, adminMenu] = await Promise.all([source('../menu-items/pages.js'), source('../menu-items/admin-pages.js')]);

  assert.match(landlordMenu, /title: 'Listings & Applications'[\s\S]{0,120}url: '\/landlord\/listings'/);
  assert.doesNotMatch(landlordMenu, /id: 'leasing'|title: 'Leasing'/);
  assert.doesNotMatch(landlordMenu, /\/landlord\/(applications|screenings|lease-shield)/);
  assert.doesNotMatch(adminMenu, /\/landlord\/screenings/);
});

test('standalone landlord routes are removed while the hidden LeaseShield implementation remains', async () => {
  const routes = await source('../routes/MainRoutes.jsx');

  assert.match(routes, /path: 'landlord\/listings'/);
  assert.doesNotMatch(routes, /path: 'landlord\/(applications|screenings|lease-shield)'/);
  assert.doesNotMatch(routes, /pages\/landlord\/(applications|screenings|lease-shield)/);
  await access(new URL('../pages/landlord/lease-shield.jsx', import.meta.url));
  await assert.rejects(access(new URL('../pages/landlord/screenings.jsx', import.meta.url)));
});
