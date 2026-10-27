import type { Tenant } from '../../api/tenantAPI';
import type { TenantInvite } from '../../api/tenantInviteAPI';

const field = (value: Record<string, any>, key: string) => value[key] ?? value[key[0].toUpperCase() + key.slice(1)];
const id = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

// A saved tenant contact is not a connected portal user. Invitations only connect the two.
export const inviteEmail = (tenant: Tenant): string | null => {
  if (id(field(tenant, 'userId'))) return null;
  const email = String(field(tenant, 'email') ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export const invitationStatus = (tenant: Tenant, invites: TenantInvite[], now = Date.now()): TenantInvite | null => {
  const email = inviteEmail(tenant);
  const tenantId = id(field(tenant, 'id'));
  if (!email || !tenantId) return null;
  return invites.find(invite => id(field(invite, 'tenantId')) === tenantId &&
    id(field(invite, 'id')) && !field(invite, 'isUsed') &&
    String(field(invite, 'email') ?? '').trim().toLowerCase() === email.toLowerCase() &&
    Number.isFinite(Date.parse(String(field(invite, 'expiresAt') ?? ''))) &&
    Date.parse(String(field(invite, 'expiresAt'))) > now) ?? null;
};

export const inviteError = (error: any): string => {
  const message = error?.message ?? error?.Message ?? error?.response?.data?.message ?? error?.response?.data?.Message;
  if (typeof message === 'string' && message.trim()) return message;
  const errors = error?.errors ?? error?.Errors;
  if (Array.isArray(errors) && errors.length) return errors.join(', ');
  return 'Please try again.';
};
