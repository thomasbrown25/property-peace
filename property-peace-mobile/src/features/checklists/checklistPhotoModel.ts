import type { ChecklistItem, ChecklistUploadAsset, Id } from './checklistTypes';

export interface ChecklistItemPhoto {
  key: string;
  url: string;
  blobName: string | null;
}

export type FailedChecklistUploads = Record<string, ChecklistUploadAsset>;

const idKey = (id: Id) => String(id);

export const getChecklistItemPhotos = (item: ChecklistItem): ChecklistItemPhoto[] =>
  (item.photoBlobUrls ?? []).filter(Boolean).map((url, index) => {
    const blobName = item.photoBlobNames?.[index]?.trim() || null;
    return { key: blobName ?? url, url, blobName };
  });

export const rememberFailedChecklistUpload = (
  uploads: FailedChecklistUploads,
  itemId: Id,
  asset: ChecklistUploadAsset,
): FailedChecklistUploads => ({ ...uploads, [idKey(itemId)]: asset });

export const removeFailedChecklistUpload = (
  uploads: FailedChecklistUploads,
  itemId: Id,
): FailedChecklistUploads => {
  const next = { ...uploads };
  delete next[idKey(itemId)];
  return next;
};
