// The generated lease agreement is a separate resource, not a TenantDocument.
// Its visibility cannot be inferred from the tenant-document IsPrivate flag.
const TYPES = { 10: 'Lease Agreement', 11: 'Lease Addendum', 12: 'Lease Renewal', 40: 'Move-In Checklist', 41: 'Move-Out Checklist', 99: 'Other' };

export function buildDocumentRows(documents = [], hasAgreement = false) {
  const rows = documents.map((document, index) => {
    const typeCode = document.documentType ?? document.DocumentType;
    const isPrivate = document.isPrivate ?? document.IsPrivate;
    return {
      key: document.id ?? document.Id ?? `document-${index}`,
      source: 'tenant-document',
      name: document.name ?? document.Name ?? document.description ?? document.Description ?? document.fileName ?? document.FileName ?? 'Document',
      type: document.documentTypeName ?? document.DocumentTypeName ?? TYPES[typeCode] ?? 'Other',
      tenantVisible: isPrivate == null ? null : isPrivate === false,
      uploadedAt: document.createdAt ?? document.CreatedAt ?? document.uploadedAt ?? document.UploadedAt ?? null,
      url: document.url ?? document.Url ?? document.blobUrl ?? document.BlobUrl ?? document.documentUrl ?? document.DocumentUrl ?? null
    };
  });
  if (hasAgreement) rows.push({ key: 'generated-agreement', source: 'agreement', name: 'Lease agreement PDF', type: 'Lease Agreement', tenantVisible: null, uploadedAt: null, url: null });
  return rows;
}

export function filterDocumentRows(rows, { search = '', type = 'all', visibility = 'all' } = {}) {
  const query = search.trim().toLowerCase();
  return rows.filter((row) =>
    (type === 'all' || row.type === type) &&
    (visibility === 'all' || (visibility === 'visible' && row.tenantVisible === true) || (visibility === 'private' && row.tenantVisible === false)) &&
    (!query || `${row.name} ${row.type}`.toLowerCase().includes(query))
  );
}

export function paginateDocumentRows(rows, page, rowsPerPage) {
  const size = Math.max(1, Number(rowsPerPage) || 10);
  const safePage = Math.min(Math.max(0, Number(page) || 0), Math.max(0, Math.ceil(rows.length / size) - 1));
  return { rows: rows.slice(safePage * size, (safePage + 1) * size), page: safePage, count: rows.length };
}
