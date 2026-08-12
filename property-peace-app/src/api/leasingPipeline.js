import axiosServices from 'utils/axios';

const positiveId = (value, name) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`A valid ${name} is required.`);
  return id;
};

export async function getLeasingPipeline(resourceType, resourceId, unitId) {
  let url;
  if (resourceType === 'property') {
    const propertyId = positiveId(resourceId, 'property id');
    const selectedUnitId = positiveId(unitId, 'unit id');
    url = `/api/leasing-pipeline/properties/${propertyId}?unitId=${encodeURIComponent(selectedUnitId)}`;
  } else if (resourceType === 'listing') {
    const listingId = positiveId(resourceId, 'listing id');
    url = `/api/leasing-pipeline/listings/${listingId}`;
  } else if (resourceType === 'application') {
    const applicationId = positiveId(resourceId, 'application id');
    url = `/api/leasing-pipeline/applications/${applicationId}`;
  } else {
    throw new Error('Unsupported leasing pipeline resource.');
  }
  const response = await axiosServices.get(url);
  return response?.data ?? null;
}
