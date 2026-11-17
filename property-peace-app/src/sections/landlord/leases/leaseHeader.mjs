// Match the cover-photo precedence on the property detail page.
export function leaseHeaderPhoto(property) {
  const images = property?.images ?? property?.Images ?? [];
  const cover = images.find((image) => image.isCoverPhoto || image.IsCoverPhoto);
  return property?.mainImageUrl || property?.MainImageUrl || cover?.blobUrl || cover?.BlobUrl || images[0]?.blobUrl || images[0]?.BlobUrl || null;
}

export function needsLeaseSignatures(readiness, isDraftLease) {
  if (isDraftLease) return false;
  const steps = readiness?.steps ?? [];
  return steps.some((step) => step.key === 'agreement' && step.status === 'complete') &&
    steps.some((step) => step.key === 'signatures' && step.status === 'pending');
}
