export const selectMaintenance = (state) => state.maintenance?.selectedMaintenance;
export const selectMaintenanceRequests = (state) => state.maintenance?.maintenances;
export const selectHistoryMaintenances = (state) => state.maintenance?.historyMaintenances;
export const selectMaintenanceCategories = (state) => state.maintenance?.categories;
export const selectMaintenanceImages = (state) => state.maintenance?.selectedImages;
export const selectMaintenanceIds = (state) => state.maintenance?.maintenanceIds;
export const selectMaintenanceLoading = (state) => state.maintenance?.loading ?? false;