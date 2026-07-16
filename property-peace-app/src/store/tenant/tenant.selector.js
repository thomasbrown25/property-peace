export const selectTenant = (state) => state.tenant?.selectedTenant;
export const selectTenants = (state) => state.tenant?.tenants;
export const selectLeaseTenants = (state) => state.tenant?.leaseTenants;
export const selectTenantsLoadedAt = (state) => state.tenant?.tenantsLoadedAt;
