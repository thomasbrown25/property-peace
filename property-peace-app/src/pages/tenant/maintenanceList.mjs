const text = (value) => String(value ?? '').trim();

function locationFor(request = {}) {
  return [
    request.location,
    request.propertyName,
    request.unitName,
    request.unitNumber,
    request.buildingName,
    request.propertyAddress,
    request.address
  ].filter(Boolean).join(' ');
}

function searchTextFor(request = {}) {
  return [
    request.title,
    request.description,
    locationFor(request),
    request.category,
    request.status,
    request.priority,
    request.orderNumber,
    request.workOrderNumber,
    request.reference,
    request.referenceNumber,
    request.requestNumber
  ].map(text).join(' ').toLocaleLowerCase();
}

function dateTimestamp(request) {
  const date = getMaintenanceRequestDate(request);
  if (!date) return null;
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function newestFirst(left, right) {
  const leftDate = dateTimestamp(left);
  const rightDate = dateTimestamp(right);
  if (leftDate === null && rightDate === null) return 0;
  if (leftDate === null) return 1;
  if (rightDate === null) return -1;
  return rightDate - leftDate;
}

export function getMaintenanceRequestDate(request = {}) {
  return text(request.createdAtUtc) || text(request.createdAt) || null;
}

export function getMaintenanceRows(requests, { search = '' } = {}) {
  const query = text(search).toLocaleLowerCase();
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => !query || searchTextFor(request).includes(query))
    .sort(newestFirst);
}
