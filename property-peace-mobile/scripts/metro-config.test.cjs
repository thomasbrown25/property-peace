const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const metroConfig = require('../metro.config');

test('Metro watches the shared package without crawling repository node_modules', () => {
  const mobileRoot = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(mobileRoot, '..');
  const sharedRoot = path.resolve(repositoryRoot, 'shared');
  const watchedFolders = (metroConfig.watchFolders || []).map((folder) => path.resolve(folder));

  assert.ok(watchedFolders.includes(sharedRoot));
  assert.ok(!watchedFolders.includes(repositoryRoot));
});
