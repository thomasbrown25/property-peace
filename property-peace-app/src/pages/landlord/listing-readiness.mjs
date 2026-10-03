const read = (listing, camel, pascal) => listing?.[camel] ?? listing?.[pascal];

export const getImages = (listing) => read(listing, 'images', 'Images') || [];

export const isActiveListing = (listing) => {
  const status = read(listing, 'status', 'Status');
  return typeof status === 'string' ? ['active', 'published'].includes(status.toLowerCase()) : status === 1;
};

// These are the required details for preparing a draft, not a content freshness score.
// A published listing has already passed the pre-publication workflow.
export const getReadinessIssues = (listing) => {
  if (isActiveListing(listing)) return [];
  return [
    !String(read(listing, 'propertyAddress', 'PropertyAddress') || '').trim() && 'address',
    !(getImages(listing).length || read(listing, 'coverImageUrl', 'CoverImageUrl')) && 'photos',
    !(Number(read(listing, 'monthlyRent', 'MonthlyRent')) > 0) && 'rent',
    !String(read(listing, 'marketingDescription', 'MarketingDescription') || '').trim() && 'description'
  ].filter(Boolean);
};

export const getReadinessScore = (listing) => Math.round(((4 - getReadinessIssues(listing).length) / 4) * 100);
