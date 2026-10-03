import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadinessIssues, getReadinessScore } from '../pages/landlord/listing-readiness.mjs';

const complete = {
  status: 0,
  propertyAddress: '223 Victoria Ave',
  images: [{ blobUrl: '/cover.jpg' }],
  monthlyRent: 2510,
  marketingDescription: 'Bright home close to shops',
  updatedAt: '2025-01-01T00:00:00Z'
};

test('a complete draft remains ready even when last edited long ago', () => {
  assert.deepEqual(getReadinessIssues(complete), []);
  assert.equal(getReadinessScore(complete), 100);
});

test('a draft counts only missing publication details', () => {
  const draft = { ...complete, propertyAddress: '', images: [], monthlyRent: 0, marketingDescription: '   ' };
  assert.deepEqual(getReadinessIssues(draft), ['address', 'photos', 'rent', 'description']);
  assert.equal(getReadinessScore(draft), 0);
});

test('a partial draft reports its remaining requirements and progress', () => {
  const draft = { ...complete, images: [], marketingDescription: '' };
  assert.deepEqual(getReadinessIssues(draft), ['photos', 'description']);
  assert.equal(getReadinessScore(draft), 50);
});

test('an active listing has no pending pre-publication tasks regardless of edit age', () => {
  const active = { ...complete, Status: 1, status: undefined, marketingDescription: '' };
  assert.deepEqual(getReadinessIssues(active), []);
  assert.equal(getReadinessScore(active), 100);
});

test('PascalCase API fields, cover-only images, and published status are supported', () => {
  const listing = { Status: 'Published', PropertyAddress: '12 Main', CoverImageUrl: '/cover.jpg', MonthlyRent: 1200 };
  assert.deepEqual(getReadinessIssues(listing), []);
  assert.equal(getReadinessScore(listing), 100);
});
