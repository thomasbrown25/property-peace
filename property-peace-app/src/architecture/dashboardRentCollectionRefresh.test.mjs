import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('dashboard rent metrics refresh after a successful global finance mutation', async () => {
  const dashboardOverview = await source('pages/landlord/dashboard-overview.jsx');

  assert.match(dashboardOverview, /const \{ refetch: refetchAllPayments \} = useFetchAllPayments\(\);/);
  assert.match(
    dashboardOverview,
    /dispatch\(getRentCollection\(null, false\)\);[\s\S]*dispatch\(getRentCollection\(null, true\)\);[\s\S]*refetchAllPayments\(\);/
  );
  assert.match(dashboardOverview, /\[userId, dispatch, drawer\.financeMutationVersion, refetchAllPayments\]/);
});
