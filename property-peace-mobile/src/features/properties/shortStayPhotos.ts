// Keep photo URLs transient: only upload metadata and server-issued URLs held in component memory.
export type PhotoAsset = { uri: string; mimeType?: string | null; fileSize?: number; fileName?: string | null };
export type PhotoUpload = { uri: string; name: string; type: 'image/jpeg' | 'image/png' };
export const validatePhotoSelection = (assets: PhotoAsset[], existingCount: number): string | null => {
  if (!assets.length) return 'Select a photo to upload.';
  if (assets.length > 5) return 'Select at most 5 photos per upload.';
  if (existingCount + assets.length > 20) return 'A listing can have at most 20 photos.';
  for (const asset of assets) {
    if (!asset.uri || !['image/jpeg', 'image/png'].includes(asset.mimeType || '')) return 'Only JPEG or PNG photos are supported.';
    if (asset.fileSize == null || !Number.isFinite(asset.fileSize) || asset.fileSize <= 0) return 'Could not determine photo size. Choose another photo.';
    if (asset.fileSize > 5 * 1024 * 1024) return 'Each photo must be 5 MB or smaller.';
  }
  return null;
};
export const toPhotoUpload = (asset: PhotoAsset, index: number): PhotoUpload => ({
  uri: asset.uri,
  name: `listing-${index}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`,
  type: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
});
export const orderedPhotos = <T extends { displayOrder: number }>(photos: T[]): T[] => [...photos].sort((a, b) => a.displayOrder - b.displayOrder);
