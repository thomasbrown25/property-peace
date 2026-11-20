export function paginateRows(rows, requestedPage, pageSize) {
  const pageCount = Math.ceil(rows.length / pageSize);
  const page = Math.max(0, Math.min(requestedPage, Math.max(0, pageCount - 1)));
  const startIndex = page * pageSize;

  return {
    page,
    pageCount,
    rows: rows.slice(startIndex, startIndex + pageSize),
    start: rows.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, rows.length)
  };
}
