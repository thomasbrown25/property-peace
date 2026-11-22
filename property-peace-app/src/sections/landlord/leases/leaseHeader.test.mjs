import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leaseHeaderPhoto, needsLeaseSignatures } from './leaseHeader.mjs';

const view = readFileSync(resolve(import.meta.dirname, 'LeaseDetailView.jsx'), 'utf8');

test('lease photo uses the property cover photo and has a safe empty fallback', () => {
  assert.equal(leaseHeaderPhoto({ images: [{ blobUrl: '/first' }, { isCoverPhoto: true, blobUrl: '/cover' }] }), '/cover');
  assert.equal(leaseHeaderPhoto({ MainImageUrl: '/main' }), '/main');
  assert.equal(leaseHeaderPhoto({ Images: [{ IsCoverPhoto: true, BlobUrl: '/pascal' }] }), '/pascal');
  assert.equal(leaseHeaderPhoto({ images: [] }), null);
});

test('signature attention only appears for an actionable incomplete agreement step', () => {
  const pending = { steps: [{ key: 'agreement', status: 'complete' }, { key: 'signatures', status: 'pending' }] };
  assert.equal(needsLeaseSignatures(pending, false), true);
  assert.equal(needsLeaseSignatures(pending, true), false);
  assert.equal(needsLeaseSignatures({ steps: [{ key: 'signatures', status: 'complete' }] }, false), false);
  assert.equal(needsLeaseSignatures({ steps: [{ key: 'signatures', status: 'pending' }] }, false), false);
  assert.equal(needsLeaseSignatures(null, false), false);
});

test('lease header has a photographic home panel, rent snapshot and contextual signature action', () => {
  assert.match(view, /leaseHeaderPhoto\(property\)/);
  assert.match(view, /component="img"[\s\S]*?src=\{headerPhoto\}/);
  assert.match(view, /leaseDetailTitle\(lease, propertyDisplay, leaseId\)/);
  assert.match(view, /Monthly rent[\s\S]*?formatCurrency\(rentAmount\)/);
  assert.match(view, /needsLeaseSignatures\(moveInReadiness, isDraftLease\)/);
  assert.match(view, /Signatures needed[\s\S]*?Open signatures[\s\S]*?onOpenSignature/);
  assert.match(view, /<ActionsDrawer\b[^>]*triggerLabel="Lease actions"/);
});
