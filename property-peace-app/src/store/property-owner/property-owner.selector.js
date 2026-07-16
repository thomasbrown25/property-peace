import { createSelector } from 'reselect';

const selectPropertyOwnerReducer = (state) => state.propertyOwner;

export const selectPropertyOwners = createSelector(
  [selectPropertyOwnerReducer],
  (propertyOwner) => propertyOwner.owners
);

export const selectSelectedPropertyOwner = createSelector(
  [selectPropertyOwnerReducer],
  (propertyOwner) => propertyOwner.selectedOwner
);

export const selectPropertyOwnerLoading = createSelector(
  [selectPropertyOwnerReducer],
  (propertyOwner) => propertyOwner.loading
);

export const selectPropertyOwnerError = createSelector(
  [selectPropertyOwnerReducer],
  (propertyOwner) => propertyOwner.error
);

export const selectActivePropertyOwners = createSelector([selectPropertyOwners], (owners) =>
  owners.filter((owner) => owner.isActive)
);
