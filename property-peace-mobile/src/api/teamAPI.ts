import apiClient from '../services/apiClient';

type Envelope<T> = { data?: T; Data?: T; success?: boolean; Success?: boolean; message?: string; Message?: string };
const unwrap = <T>(body: Envelope<T> | T): T => {
  if (body && typeof body === 'object') {
    const response = body as Envelope<T>;
    if (response.success === false || response.Success === false) throw new Error(response.message || response.Message || 'The request failed.');
    if ('data' in response || 'Data' in response) return (response.data ?? response.Data) as T;
  }
  return body as T;
};

export interface TeamMember {
  id?: number;
  Id?: number;
  userId?: number;
  UserId?: number;
  userName?: string;
  UserName?: string;
  userEmail?: string;
  UserEmail?: string;
  role?: string;
  Role?: string;
  canManageMembers?: boolean;
  CanManageMembers?: boolean;
}
export interface TeamInvite {
  id?: number;
  Id?: number;
  email?: string;
  Email?: string;
  role?: string;
  Role?: string;
  isAccepted?: boolean;
  IsAccepted?: boolean;
  expiresAt?: string;
  ExpiresAt?: string;
}

const teamAPI = {
  async members(organizationId: string): Promise<TeamMember[]> {
    const result = unwrap(await apiClient.get<Envelope<TeamMember[]>>(`/api/organization/members/${organizationId}`));
    if (!Array.isArray(result)) throw new Error('The team member response was invalid.');
    return result;
  },
  async invites(organizationId: string): Promise<TeamInvite[]> {
    const result = unwrap(await apiClient.get<Envelope<TeamInvite[]>>(`/api/organization/invites/${organizationId}`));
    if (!Array.isArray(result)) throw new Error('The invitation response was invalid.');
    return result.filter((invite) => !(invite.isAccepted ?? invite.IsAccepted));
  },
  async invite(organizationId: string, email: string, role: string): Promise<void> {
    unwrap(await apiClient.post<Envelope<unknown>>('/api/organization/invites', { organizationId: Number(organizationId), email, role }));
  },
  async resend(inviteId: number): Promise<void> {
    unwrap(await apiClient.post<Envelope<unknown>>(`/api/organization/invites/${inviteId}/resend`));
  },
  async revoke(inviteId: number): Promise<void> {
    unwrap(await apiClient.delete<Envelope<unknown>>(`/api/organization/invites/${inviteId}`));
  },
  async updateRole(memberId: number, role: string): Promise<void> {
    const access = role === 'Owner' || role === 'Manager';
    unwrap(await apiClient.put<Envelope<unknown>>('/api/organization/members', {
      id: memberId, role, canManageProperties: access, canManageTenants: access,
      canManageLeases: access, canManageMaintenance: access,
      canManageBilling: role === 'Owner', canManageMembers: role === 'Owner',
    }));
  },
  async remove(organizationId: string, userId: number): Promise<void> {
    unwrap(await apiClient.delete<Envelope<unknown>>(`/api/organization/members/${organizationId}/${userId}`));
  },
};
export default teamAPI;
