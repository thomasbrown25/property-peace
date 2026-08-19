import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const menuSource = await readFile(new URL('./pages.js', import.meta.url), 'utf8');

test('Portfolio is the first landlord destination after Dashboard', () => {
  assert.match(menuSource, /id: 'dashboard',[\s\S]*?icon: icons\.DashboardOutlined\s*},\s*{\s*id: 'portfolio'/);
});
