import { setupError } from '../../utils/shortStaySetup.js';

export function validatePhotoSelection(files, existingCount) {
  const selected = Array.from(files || []);
  if (!selected.length) throw new Error('Select at least one photo.');
  if (selected.length > 5) throw new Error('Select no more than 5 photos at a time.');
  if (existingCount + selected.length > 20) throw new Error('A listing can have no more than 20 photos.');
  for (const photo of selected) {
    if (!['image/png', 'image/jpeg'].includes(photo.type)) throw new Error('Only PNG or JPEG photos are allowed.');
    if (photo.size > 5 * 1024 * 1024) throw new Error('Each photo must be at most 5 MB.');
  }
  return selected;
}

// Only keep ephemeral links in the mounted page's memory. Each request invalidates prior links.
export function createPhotoGallery({ api, unitId, update }) {
  let active = false;
  let revision = 0;
  let photos = [];
  const invalidate = () => { active = false; revision++; photos = []; };
  const activate = () => { active = true; revision++; };
  const load = async (listingExists) => {
    if (listingExists && !active) return;
    const token = ++revision;
    photos = [];
    if (!listingExists || !active) { update({ photos: [], loading: false, error: '' }); return; }
    update({ photos: [], loading: true, error: '' });
    try {
      const result = await api.getPhotos(unitId);
      if (active && token === revision) {
        photos = Array.isArray(result) ? result : [];
        update({ photos, error: '' });
      }
    } catch (err) {
      if (active && token === revision) update({ photos: [], error: setupError(err) });
    } finally {
      if (active && token === revision) update({ loading: false });
    }
  };
  const upload = async (files) => { await api.uploadPhotos(unitId, validatePhotoSelection(files, photos.length)); if (active) await load(true); };
  const cover = async (photoId) => { await api.setCoverPhoto(unitId, photoId); if (active) await load(true); };
  const remove = async (photoId) => { await api.deletePhoto(unitId, photoId); if (active) await load(true); };
  return { activate, invalidate, load, upload, cover, remove };
}
