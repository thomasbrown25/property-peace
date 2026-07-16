import { createSelector } from '@reduxjs/toolkit';

export const selectListings = (state) => state.listing?.listings || [];
export const selectSelectedListing = (state) => state.listing?.selectedListing;
export const selectListingLoading = (state) => state.listing?.loading || false;
export const selectListingError = (state) => state.listing?.error;

export const selectListingById = (state, id) =>
  state.listing?.listings?.find((listing) => listing.id === id);

export const selectListingsByPropertyId = createSelector(
  [selectListings, (state, propertyId) => propertyId],
  (listings, propertyId) => listings.filter((listing) => listing.propertyId === propertyId)
);

export const selectListingsByUnitId = createSelector(
  [selectListings, (state, unitId) => unitId],
  (listings, unitId) => listings.filter((listing) => listing.unitId === unitId)
);

export const selectActiveListings = createSelector([selectListings], (listings) =>
  listings.filter((listing) => listing.status === 'Active')
);
