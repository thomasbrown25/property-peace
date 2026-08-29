import { createSelector } from '@reduxjs/toolkit';

export const selectProperties = (state) => state.property.properties;
export const selectPropertyIds = (state) => state.property.selectedPropertyIds;
export const selectProperty = (state) => state.property.selectedProperty;
export const selectPropertyLoading = (state) => state.property.loading;
export const selectPropertyError = (state) => state.property.error;
export const selectPropertyById = (state, id) => state.property.properties.find((property) => property.id === id);
export const selectPropertyByName = (state, name) => state.property.properties.find((property) => property.name === name);

export const selectOccupiedCount = (state) => state.property.occupiedCount;
export const selectVacantCount = (state) => state.property.vacantCount;
export const selectMaintenanceRequest = (state) => state.property?.selectedProperty?.selectedMaintenance;

export const selectPropertyCount = createSelector([selectProperties], (properties) => properties.length);

export const selectIsSingleUnitPortfolio = (state) => state.property.isSingleUnitPortfolio;
export const selectPropertiesLoadedAt = (state) => state.property.propertiesLoadedAt;
export const selectPropertiesOrganizationId = (state) => state.property.propertiesOrganizationId;
