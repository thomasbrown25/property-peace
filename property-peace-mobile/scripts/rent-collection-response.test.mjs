import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { collectionPayload } from '../src/features/rentCollection/collectionPayload.ts';

test('accepts the collection payload returned by RentCollectionAPI without another data envelope', () => {
  const payload = { summary: { expectedThisMonth: 1200, collectedThisMonth: 600 }, rentRecords: [{ leaseId: 42 }] };
  assert.equal(collectionPayload(payload), payload);
});

test('rejects absent or unsuccessful collection responses instead of showing zero rent', () => {
  assert.throws(() => collectionPayload(null));
  assert.throws(() => collectionPayload({ success: false, summary: {} }));
  assert.throws(() => collectionPayload({ unexpected: 1 }));
});

test('rent collection screen consumes the validated API payload', async () => {
  const source = await readFile(new URL('../src/screens/landlord/RentCollectionScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /parseCollection\(collectionPayload\(response\)\)/);
});
