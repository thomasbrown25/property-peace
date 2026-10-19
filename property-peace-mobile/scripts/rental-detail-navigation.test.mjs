import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('listing, application and announcement rows push dedicated native stack detail routes', async () => {
  const navigator = await source('navigation/MainNavigator.tsx');
  const types = await source('navigation/types.ts');
  const workspace = await source('screens/landlord/RentalWorkspace.tsx');
  const announcements = await source('screens/landlord/AnnouncementsScreen.tsx');
  for (const [section, detail] of [['Listings', 'ListingDetail'], ['Applications', 'ApplicationDetail'], ['Announcements', 'AnnouncementDetail']]) {
    assert.match(navigator, new RegExp(`<Tab.Screen name="${section}" component={${section}Navigator}`));
    assert.match(navigator, new RegExp(`name="${detail}" component={`));
    assert.match(types, new RegExp(`${detail}: \\{`));
  }
  assert.match(navigator, /animation: 'slide_from_right'/);
  assert.match(workspace, /navigation\.navigate\(detailRoute,/);
  assert.match(announcements, /navigation\.navigate\('AnnouncementDetail',/);
  assert.doesNotMatch(workspace, /<Modal visible={!!selected/);
  assert.doesNotMatch(announcements, /<Modal visible={!!selected/);
});

test('all three detail pages have circular top-left back arrows to the list', async () => {
  const navigator = await source('navigation/MainNavigator.tsx');
  const button = await source('components/PageBackButton.tsx');
  for (const route of ['ListingDetail', 'ApplicationDetail', 'AnnouncementDetail']) {
    assert.match(navigator, new RegExp(`name="${route}"[^\\n]*headerLeft: \\(\\) => <PageBackButton inHeader`));
  }
  assert.match(button, /borderRadius: 22/);
  assert.match(button, /backgroundColor: .*colors\.surface/);
});
