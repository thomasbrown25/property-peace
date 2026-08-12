export const validOrganizationId = (value) => Number.isSafeInteger(value) && value > 0;

export function activationResponseForOrganization(payload, capturedOrganizationId) {
  if (!validOrganizationId(capturedOrganizationId) || payload?.organizationId !== capturedOrganizationId) return null;
  return payload;
}
