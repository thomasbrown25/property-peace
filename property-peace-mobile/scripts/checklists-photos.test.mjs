import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getChecklistItemPhotos,
  removeFailedChecklistUpload,
  rememberFailedChecklistUpload,
} from '../src/features/checklists/checklistPhotoModel.ts';

test('uploaded checklist photos retain the matching blob name used for deletion', () => {
  assert.deepEqual(
    getChecklistItemPhotos({
      name: 'Sink',
      photoBlobUrls: ['https://files.test/a.jpg', 'https://files.test/b.jpg'],
      photoBlobNames: ['room/a.jpg', 'room/b.jpg'],
    }),
    [
      { key: 'room/a.jpg', url: 'https://files.test/a.jpg', blobName: 'room/a.jpg' },
      { key: 'room/b.jpg', url: 'https://files.test/b.jpg', blobName: 'room/b.jpg' },
    ],
  );
});

test('photos with incomplete API metadata remain visible but cannot delete another blob', () => {
  assert.deepEqual(
    getChecklistItemPhotos({
      name: 'Window',
      photoBlobUrls: ['https://files.test/a.jpg', 'https://files.test/b.jpg'],
      photoBlobNames: ['room/a.jpg'],
    }),
    [
      { key: 'room/a.jpg', url: 'https://files.test/a.jpg', blobName: 'room/a.jpg' },
      { key: 'https://files.test/b.jpg', url: 'https://files.test/b.jpg', blobName: null },
    ],
  );
});

test('a failed picker asset is retained for retry and cleared only for its item', () => {
  const asset = { uri: 'file:///sink.jpg', name: 'sink.jpg', type: 'image/jpeg' };
  const failed = rememberFailedChecklistUpload({}, 12, asset);
  assert.deepEqual(failed, { '12': asset });
  assert.deepEqual(removeFailedChecklistUpload({ ...failed, '13': asset }, 12), { '13': asset });
});
