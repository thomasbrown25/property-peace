import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

test('rental workspace TSX parses for the iOS JavaScript bundle', () => {
  const source = readFileSync(new URL('../src/screens/landlord/RentalWorkspace.tsx', import.meta.url), 'utf8');
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }));
});
