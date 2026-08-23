import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const menuSource = await readFile(new URL('./pages.js', import.meta.url), 'utf8');

test('Portfolio is the first landlord destination after Dashboard', () => {
  assert.match(menuSource, /id: 'dashboard',[\s\S]*?icon: icons\.DashboardOutlined\s*},\s*{\s*id: 'portfolio'/);
});

test('Operations is the first landlord destination after Portfolio', () => {
  const topLevelIds = [...menuSource.matchAll(/^        id: '([^']+)',\r?$/gm)].map((match) => match[1]);
  const portfolioIndex = topLevelIds.indexOf('portfolio');

  assert.notEqual(portfolioIndex, -1);
  assert.equal(topLevelIds[portfolioIndex + 1], 'operations');
});
