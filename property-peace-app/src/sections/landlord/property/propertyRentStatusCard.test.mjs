import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { getPropertyOverdueRent } from '../../../utils/ownerHome.js';

const source = readFileSync(new URL('./PropertyRentStatusCard.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function'), { loader: 'jsx' }).code;
const surface = ({ children, title }) => React.createElement('div', { title }, children);
const Card = new Function('React', 'Box', 'Typography', 'formatCurrency', 'getPropertyOverdueRent', `${compiled}; return PropertyRentStatusCard;`)(
  React, surface, surface, value => `$${value.toFixed(2)}`, getPropertyOverdueRent
);
test('payments summary uses two compact aligned label/value rows without oversized cards', () => {
  const table = readFileSync(new URL('./PropertyFinanceTable.jsx', import.meta.url), 'utf8');
  assert.match(table, /<Stack spacing=\{0\.75\}/);
  assert.match(table, /Total received:/);
  for (const component of [table, source]) {
    assert.match(component, /gridTemplateColumns: '112px minmax\(0, 1fr\)'/);
  }
  assert.match(source, /Rent status:/);
  assert.doesNotMatch(source, /MainCard|variant="h4"|variant="caption"/);
});

const render = props => renderToStaticMarkup(React.createElement(Card, { propertyId: 7, ...props }));

test('rent overview renders property-scoped canonical overdue balances, including previous periods', () => {
  const html = render({ rentRecords: [
    { propertyId: 7, rentDue: 1500, overdueAmount: 900 },
    { PropertyId: '7', RentDue: 300, OverdueAmount: 300 },
    { propertyId: 8, rentDue: 5000, overdueAmount: 5000 }
  ] });
  assert.match(html, /\$1200\.00 overdue/);
  assert.match(html, /Total overdue rent/);
});

test('rent overview distinguishes up-to-date, empty, loading, and failed states', () => {
  assert.match(render({ rentRecords: [{ propertyId: 7, rentDue: 100, overdueAmount: 0 }] }), /Up to date/);
  assert.match(render({ rentRecords: [] }), /No rent scheduled/);
  assert.match(render({ rentRecords: [], loading: true }), /Loading rent/);
  assert.match(render({ rentRecords: [], error: 'Failed' }), /Rent data unavailable/);
  assert.match(render({}), /Loading rent/);
  assert.doesNotMatch(render({ rentRecords: [], error: true }), /Up to date/);
});
