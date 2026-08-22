import type { Id } from './checklistTypes';

const encoded = (value: Id) => encodeURIComponent(String(value));

export const checklistCollectionPath = (scope: 'property' | 'unit', id: Id) =>
  `/api/Checklist/${scope}/${encoded(id)}`;

export const checklistDetailPath = (id: Id) => `/api/Checklist/${encoded(id)}`;

export const checklistItemImagePath = (checklistId: Id, itemId: Id) =>
  `/api/Checklist/${encoded(checklistId)}/items/${encoded(itemId)}/upload-image`;

export const checklistItemImageDeletePath = (checklistId: Id, itemId: Id, blobName: string) =>
  `/api/Checklist/${encoded(checklistId)}/items/${encoded(itemId)}/images/${encodeURIComponent(blobName)}`;
