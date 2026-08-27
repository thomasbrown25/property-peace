import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('leases distinguish request failure from a successful empty response', async () => {
  const screen = await read('../src/screens/landlord/LeasesScreen.tsx');

  assert.match(screen, /type LoadStatus = ['"]loading['"] \| ['"]success['"] \| ['"]error['"]/);
  assert.match(screen, /const \[loadStatus, setLoadStatus\]/);
  assert.match(screen, /setLoadStatus\(['"]success['"]\)/);
  assert.match(screen, /catch[\s\S]*setLoadStatus\(['"]error['"]\)/);
  assert.match(screen, /Couldn.t load leases/);
  assert.match(screen, />Retry</);
  assert.match(screen, /loadStatus === ['"]success['"]\s*\?[^:]*No leases found/s);
});

test('dashboard tracks each API section result independently', async () => {
  const screen = await read('../src/screens/landlord/DashboardScreen.tsx');

  assert.match(screen, /const \[propertiesStatus, setPropertiesStatus\]/);
  assert.match(screen, /const \[maintenanceStatus, setMaintenanceStatus\]/);
  assert.match(screen, /const \[notificationsStatus, setNotificationsStatus\]/);
  assert.match(screen, /results\[0\]\.status === ['"]fulfilled['"][\s\S]*setPropertiesStatus\(['"]success['"]\)[\s\S]*setPropertiesStatus\(['"]error['"]\)/);
  assert.match(screen, /results\[1\]\.status === ['"]fulfilled['"][\s\S]*setMaintenanceStatus\(['"]success['"]\)[\s\S]*setMaintenanceStatus\(['"]error['"]\)/);
  assert.match(screen, /results\[2\]\.status === ['"]fulfilled['"][\s\S]*setNotificationsStatus\(['"]success['"]\)[\s\S]*setNotificationsStatus\(['"]error['"]\)/);
  assert.doesNotMatch(screen, /const \[loadError, setLoadError\]/);
});

test('dashboard does not present unknown failed sections as truthful zero or empty states', async () => {
  const screen = await read('../src/screens/landlord/DashboardScreen.tsx');

  assert.match(screen, /attentionDataAvailable[\s\S]*Your portfolio is caught up for now/);
  assert.match(screen, /propertiesStatus === ['"]success['"][\s\S]*Properties unavailable/);
  assert.match(screen, /maintenanceStatus === ['"]success['"]\s*\? String\(portfolio\.openMaintenance\) : ['"]Unavailable['"]/);
  assert.match(screen, /notificationsStatus === ['"]error['"][\s\S]*Notifications unavailable/);
  assert.match(screen, /notificationsStatus === ['"]success['"] && notifications\.length === 0/);
  assert.match(screen, /Retry unavailable information/);
});
