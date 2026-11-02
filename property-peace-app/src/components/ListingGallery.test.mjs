import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('cover is first, gallery excludes duplicate cover and respects display order', async () => {
  const { orderedListingImages, moveListingImage } = await import('./listingGalleryOrder.mjs');
  const images = [{ id: 2, displayOrder: 2 }, { id: 1, isCoverPhoto: true, displayOrder: 9 }, { id: 3, displayOrder: 1 }];
  assert.deepEqual(orderedListingImages(images).map((i) => i.id), [1, 3, 2]);
  assert.deepEqual(moveListingImage(orderedListingImages(images), 2, 3).map((i) => i.id), [1, 2, 3]);
  assert.deepEqual(moveListingImage(orderedListingImages(images), 2, 42).map((i) => i.id), [1, 3, 2]);
});

test('editable gallery wires upload/drop, remove and reorder to persistent API', () => {
  const component = read('./ListingGallery.jsx');
  const api = read('../api/listing.js');
  const controller = read('../../../property-peace-api/Controllers/ListingImageController.cs');
  assert.match(component, /export default function ListingGallery/);
  assert.match(component, /onDrop=/);
  assert.match(component, /uploadListingImages/);
  assert.match(component, /deleteListingImage/);
  assert.match(component, /reorderListingImages/);
  assert.match(component, /onDragStart=/);
  assert.match(component, /aria-label={`Remove/);
  assert.match(api, /reorderListingImages/);
  assert.match(controller, /HttpPut\("\{listingId\}\/order"\)/);
});

test('removal updates visible photos before API, animates exit and restores on delete failure', async () => {
  const { withoutListingImage } = await import('./listingGalleryOrder.mjs');
  const input = [{ id: 3, displayOrder: 2 }, { id: 1, displayOrder: 0, isCoverPhoto: true }, { id: 2, displayOrder: 1 }];
  const coverRemoval = withoutListingImage(input, 1);
  assert.equal(coverRemoval.wasCover, true);
  assert.deepEqual(coverRemoval.remaining.map((photo) => [photo.id, photo.isCoverPhoto, photo.displayOrder]),
    [[2, true, 0], [3, false, 1]]);
  assert.deepEqual(coverRemoval.previous.map((photo) => photo.id), [1, 2, 3]);
  assert.deepEqual(input.map((photo) => photo.id), [3, 1, 2]);
  const otherRemoval = withoutListingImage(input, 2);
  assert.equal(otherRemoval.wasCover, false);
  assert.deepEqual(otherRemoval.remaining.map((photo) => photo.id), [1, 3]);
  assert.deepEqual(withoutListingImage([{ id: 1, isCoverPhoto: true }], 1).remaining, []);

  const component = read('./ListingGallery.jsx');
  assert.ok(component.indexOf('showImages(remaining)') < component.indexOf('listingApi.deleteListingImage(imageId)'));
  assert.match(component, /if \(deleted\)[\s\S]*?await refresh\(\)[\s\S]*?showImages\(remaining\)[\s\S]*?showImages\(previous\)/);
  assert.match(component, /<AnimatePresence initial=\{false\}>/);
  assert.match(component, /exit=\{reduceMotion \?/);
  assert.match(component, /useReducedMotion\(\)/);
  assert.doesNotMatch(component, /getListingById/);
});
