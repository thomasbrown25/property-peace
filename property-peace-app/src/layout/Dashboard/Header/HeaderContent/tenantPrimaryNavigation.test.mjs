import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

function renderNavigation(pathname) {
  const source = new URL('./TenantPrimaryNavigation.jsx', import.meta.url);
  assert.ok(existsSync(source), 'The tenant primary navigation is missing');
  const { code } = transformSync(readFileSync(source, 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' });
  const module = { exports: {} };
  new Function('module', 'require', code)(module, createRequire(import.meta.url));
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(module.exports.default))
  );
}

test('tenant primary navigation links to the five existing tenant pages in order', () => {
  const html = renderNavigation('/tenant/dashboard');
  assert.match(html, /<nav[^>]*aria-label="Tenant primary navigation"/);
  const links = Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g), ([, href, label]) => [label, href]);
  assert.deepEqual(links, [
    ['Home', '/tenant/dashboard'],
    ['Payments', '/tenant/payments'],
    ['Leases', '/tenant/lease'],
    ['Maintenances', '/tenant/maintenance'],
    ['Documents', '/tenant/documents']
  ]);
});

test('tenant primary navigation identifies the current section on nested maintenance pages', () => {
  const html = renderNavigation('/tenant/maintenance/42');
  const currentLinks = Array.from(html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g), ([, label]) => label);
  assert.deepEqual(currentLinks, ['Maintenances']);
});
