export function paginateTenants(tenants, requestedPage, pageSize) {
  const pageCount = Math.ceil(tenants.length / pageSize);
  const page = Math.max(0, Math.min(requestedPage, Math.max(0, pageCount - 1)));
  const startIndex = page * pageSize;
  return {
    page,
    pageCount,
    rows: tenants.slice(startIndex, startIndex + pageSize),
    start: tenants.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, tenants.length)
  };
}
