import { createSelector } from 'reselect';

const selectVendorReducer = (state) => state.vendor;

export const selectVendors = createSelector([selectVendorReducer], (vendor) => vendor.vendors);

export const selectSelectedVendor = createSelector([selectVendorReducer], (vendor) => vendor.selectedVendor);

export const selectVendorLoading = createSelector([selectVendorReducer], (vendor) => vendor.loading);

export const selectVendorError = createSelector([selectVendorReducer], (vendor) => vendor.error);

export const selectVendorSearchResults = createSelector([selectVendorReducer], (vendor) => vendor.searchResults);

export const selectActiveVendors = createSelector([selectVendors], (vendors) =>
  vendors.filter((vendor) => vendor.isActive)
);

export const selectVendorsByCategory = createSelector([selectVendors], (vendors) =>
  vendors.reduce((acc, vendor) => {
    const category = vendor.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(vendor);
    return acc;
  }, {})
);

