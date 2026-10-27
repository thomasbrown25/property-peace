import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const screen = readFileSync(new URL('../src/screens/landlord/ListingsScreen.tsx', import.meta.url), 'utf8');
const statusDeclaration = screen.match(/const status = \(item: Listing\): string => \{[\s\S]*?\n\};/)?.[0];
const countExpression = screen.match(/overview: \{[^\n]*count: (items => [^,\n]+)/)?.[1];

test('listings overview counts published and active API statuses without counting drafts or expired listings', () => {
  assert.ok(statusDeclaration, 'ListingsScreen must supply its status adapter');
  assert.ok(countExpression, 'overview count must use the listing status adapter');
  const javascript = ts.transpileModule(`${statusDeclaration}\nconst count = ${countExpression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { status, count } = runInNewContext(`${javascript}\n({ status, count })`, {
    field: (item, key) => item[key] ?? item[key[0].toUpperCase() + key.slice(1)],
  });
  const listings = [
    { status: 'Published' }, { Status: 'published' }, { status: 1 },
    { status: 'Active' }, { status: 'active' },
    { status: 'Draft' }, { status: 0 }, { status: 2 }, { status: 'Unlisted' },
  ];
  assert.equal(status(listings[0]), 'Active');
  assert.equal(status(listings[1]), 'Active');
  assert.equal(count(listings), 5);
  assert.equal(count(listings.filter(item => status(item) === 'Active')), 5);
});
