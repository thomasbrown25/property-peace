import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const menuSource = await readFile(new URL('../menu-items/pages.js', import.meta.url), 'utf8');

function menuBlock(id, nextId) {
  const start = menuSource.indexOf(`id: '${id}'`);
  const end = nextId ? menuSource.indexOf(`id: '${nextId}'`, start) : menuSource.length;

  assert.notEqual(start, -1, `Expected ${id} menu entry`);
  assert.notEqual(end, -1, `Expected ${nextId} menu entry after ${id}`);
  return menuSource.slice(start, end);
}

test('Money Center is collapsible and contains the Money and Rent Collection destinations', () => {
  const moneyCenter = menuBlock('money-center', 'leads');

  assert.match(moneyCenter, /title: 'Money Center'/);
  assert.match(moneyCenter, /type: 'collapse'/);
  assert.match(moneyCenter, /id: 'money'[\s\S]*title: 'Money'[\s\S]*url: '\/landlord\/money'/);
  assert.match(moneyCenter, /id: 'rent-collection'[\s\S]*title: 'Rent Collection'[\s\S]*url: '\/landlord\/rent-collection'/);
  assert.ok(moneyCenter.indexOf("id: 'money'") < moneyCenter.indexOf("id: 'rent-collection'"));
});

test('Accounting contains Tax Center without legacy Rent Collection or Reports entries', () => {
  const accounting = menuBlock('accounting', 'operations');

  assert.doesNotMatch(accounting, /id: 'rent-collection'/);
  assert.match(accounting, /id: 'payments'/);
  assert.match(accounting, /id: 'expenses'/);
  assert.match(accounting, /id: 'ledger'/);
  assert.doesNotMatch(accounting, /id: 'reports'/);
  assert.match(accounting, /id: 'tax-center'[\s\S]*title: 'Tax Center'[\s\S]*url: '\/landlord\/accounting\/tax-center'/);
});
