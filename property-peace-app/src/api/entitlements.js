import axiosServices from 'utils/axios';
import { isSupportedEntitlementFeature } from 'utils/entitlements';

export async function getEntitlement(feature) {
  if (!isSupportedEntitlementFeature(feature)) {
    throw new TypeError(`Unsupported entitlement feature: ${String(feature)}`);
  }
  const response = await axiosServices.get(`/api/entitlements/${encodeURIComponent(feature)}`);
  return response.data;
}

export default { getEntitlement };
