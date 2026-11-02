export function orderedListingImages(images = []) {
  return [...images].sort((a, b) => Number(Boolean(b.isCoverPhoto)) - Number(Boolean(a.isCoverPhoto)) ||
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id);
}

export function withoutListingImage(images, imageId) {
  const previous = orderedListingImages(images);
  const wasCover = previous[0]?.id === imageId;
  const remaining = previous.filter((photo) => photo.id !== imageId)
    .map((photo, index) => ({ ...photo, isCoverPhoto: index === 0, displayOrder: index }));
  return { previous, remaining, wasCover };
}

export function moveListingImage(images, sourceId, targetId) {
  const from = images.findIndex((image) => image.id === sourceId);
  const to = images.findIndex((image) => image.id === targetId);
  if (from < 0 || to < 0 || from === to) return images;
  const next = [...images];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
