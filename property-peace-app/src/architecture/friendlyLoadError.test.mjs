import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loadSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('lazy module failures use the branded customer-friendly recovery state', async () => {
  const [loadableSource, routeErrorSource, friendlyErrorSource] = await Promise.all([
    loadSource('../components/Loadable.jsx'),
    loadSource('../routes/ErrorBoundary.jsx'),
    loadSource('../components/FriendlyLoadError.jsx')
  ]);

  assert.match(loadableSource, /<FriendlyLoadError\s+onRetry=\{this\.handleRetry\}\s*\/>/);
  assert.doesNotMatch(loadableSource, /Failed to Load Module|recently updated/);

  assert.match(routeErrorSource, /<FriendlyLoadError\s+onRetry=\{reloadPage\}\s+fullPage\s*\/>/);
  assert.doesNotMatch(routeErrorSource, /Failed to Load Page|usually happens after a deployment/);

  assert.match(friendlyErrorSource, /logo\.png/);
  assert.match(friendlyErrorSource, /alt="Property Peace bird carrying an olive branch"/);
  assert.match(friendlyErrorSource, /Sorry, we ran into an issue/);
  assert.match(friendlyErrorSource, /We couldn’t load this page right now/);
  assert.match(friendlyErrorSource, /Try again/);
});
