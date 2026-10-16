// RentCollectionAPI.getRentCollection() already returns ServiceResponse.Data.
export function collectionPayload(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== 'object') throw new Error('Collection unavailable');
  const payload = response as Record<string, unknown>;
  if (payload.success === false || payload.Success === false ||
      (!payload.summary && !payload.Summary)) {
    throw new Error('Collection unavailable');
  }
  return payload;
}
