import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portfolioRentalMode, loadPortfolioRentalMode } from '../src/features/properties/portfolioRentalMode.ts';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('only a fully loaded, exclusively short-term inventory suppresses new long-term surfaces', () => {
  assert.equal(portfolioRentalMode([[{ rentalMode: 'ShortTerm' }]]), 'ShortTerm');
  assert.equal(portfolioRentalMode([[{ RentalMode: 'ShortTerm' }], [{ rentalMode: 'LongTerm' }]]), 'Mixed');
  assert.equal(portfolioRentalMode([[{ rentalMode: 'ShortTerm' }], []]), 'ShortTerm');
  assert.equal(portfolioRentalMode([[], []]), 'Empty');
  assert.equal(portfolioRentalMode([[{}]]), 'LongTerm');
});

test('inventory loading uses authorized property IDs, and failure never infers short-term-only', async () => {
  const properties = [{ Id: 10 }, { id: 11 }];
  const calls = [];
  const load = id => { calls.push(id); return Promise.resolve(id === 10 ? [{ RentalMode: 'ShortTerm' }] : [{ rentalMode: 'ShortTerm' }]); };
  assert.equal(await loadPortfolioRentalMode(properties, load), 'ShortTerm');
  assert.deepEqual(calls, [10, 11]);
  assert.equal(await loadPortfolioRentalMode(properties, async () => { throw Error('unavailable'); }), null);
  assert.equal(await loadPortfolioRentalMode([{ name: 'no id' }], load), null);
});

test('drawer preserves historical leases and calendar while relabeling short-only workflow', () => {
  const dock = source('../src/navigation/QuickActionsTabBar.tsx');
  assert.match(dock, /loadPortfolioRentalMode/);
  assert.match(dock, /title: 'Calendar & lease history'/);
  assert.match(dock, /label: 'Lease history'/);
  assert.match(dock, /item\.route === 'Leases'/);
  assert.match(dock, /label: 'Leases'.*route: 'Leases'/);
  assert.match(dock, /label: 'New lease'.*screen: 'AddLease'/);
  assert.match(dock, /items\.filter\(item => item\.screen !== 'AddLease'\)/);
  assert.match(dock, /audience === 'landlord'/);
});

test('dashboard gates empty rent callout but retains nonzero historical rent and lease search', () => {
  const dashboard = source('../src/screens/landlord/DashboardScreen.tsx');
  assert.match(dashboard, /loadPortfolioRentalMode/);
  assert.match(dashboard, /scopedPortfolioMode !== 'ShortTerm' \|\|.*scopedRentMetrics/);
  assert.match(dashboard, /type === 'lease'.*LeaseDetail/);
  assert.match(dashboard, /setLoadedOrganizationId\(capturedOrganizationId\)/);
});
