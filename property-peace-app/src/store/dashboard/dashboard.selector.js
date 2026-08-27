export const selectDashboardSummary = (state) => state.dashboard?.summary;
export const selectDashboardLoading = (state) => state.dashboard?.loading ?? false;
export const selectDashboardError = (state) => state.dashboard?.error ?? null;
