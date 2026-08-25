import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('rent collection launch keeps approval and setup claims fail-closed', async () => {
  const source = await readFile(new URL('../app/features/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /COLLECT RENT ONLINE/);
  assert.match(source, /The smooth, secure way to collect rent\./);
  assert.match(source, /Set Up Rent Payments/);
  assert.match(source, /Collect Rent Securely/);
  assert.match(source, /organization request, approval, and payment setup/);
  assert.match(source, /connected payee review is separate/);
  assert.doesNotMatch(source, /SMS reminders require Premium/);
});
