const read = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
const same = (a, b) => a != null && b != null && String(a) === String(b);
const propertyLabels = { 1: 'Landlord Insurance Policy', 2: 'Utility & Maintenance', 3: 'Loan & Financial Documents', 4: 'Other Documents' };
const tenantLabels = { 1: 'Government ID', 2: 'Social Security Card', 10: 'Lease Agreement', 11: 'Lease Addendum', 12: 'Lease Renewal', 20: 'Renter Insurance', 21: 'Liability Insurance', 30: 'Rental Application', 31: 'Credit Report', 32: 'Background Check', 33: 'Income Verification', 34: 'Employment Verification', 40: 'Move-in Checklist', 41: 'Move-out Checklist', 42: 'Move-in Photos', 43: 'Move-out Photos', 50: 'Bank Statement', 51: 'Tax Return', 52: 'W-2', 53: 'Pay Stub', 60: 'Pet Agreement', 61: 'Parking Agreement', 99: 'Other' };

export const documentCategory = doc => `${doc.isPropertyFile ? 'property' : 'tenant'}:${doc.isPropertyFile ? doc.categoryId || doc.documentType : doc.documentType}`;
export const documentTypeLabel = doc => doc.isPropertyFile
  ? propertyLabels[doc.categoryId || doc.documentType] || 'Other Documents'
  : doc.documentTypeName || tenantLabels[doc.documentType] || 'Tenant Document';

// A document's explicit lease is authoritative, even if its tenant has since moved.
export function propertyDocumentContext(document, property, leases = [], tenants = []) {
  const units = read(property, 'units') || [];
  const tenant = tenants.find(item => same(read(item, 'id'), read(document, 'tenantId')));
  const leaseId = read(document, 'leaseId');
  const lease = leases.find(item => same(read(item, 'id'), leaseId));
  const unitFor = id => units.find(item => same(read(item, 'id'), id));
  if (leaseId != null) {
    const unit = unitFor(read(lease, 'unitId')) || units.find(item =>
      same(read(read(item, 'lease'), 'id'), leaseId) || (read(item, 'leases') || []).some(row => same(read(row, 'id'), leaseId)));
    return { belongs: !!lease || !!unit, unit: unit || (lease ? { id: read(lease, 'unitId'), name: read(lease, 'unitName') } : null), tenant };
  }
  const unit = unitFor(read(document, 'unitId')) || unitFor(read(tenant, 'unitId'));
  const tenantLease = leases.find(item => same(read(item, 'id'), read(tenant, 'leaseId')));
  return { belongs: !!unit || !!tenantLease || same(read(tenant, 'propertyId'), read(property, 'id')), unit: unit || unitFor(read(tenantLease, 'unitId')), tenant };
}
