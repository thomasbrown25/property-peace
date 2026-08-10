import apiClient from '../services/apiClient';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import config from '../config';
import storageService from '../services/storageService';
import { ApiResponse } from '../types';
import { MaintenanceSignal, findPendingCompletion, isClosedStatus } from '../features/maintenance/maintenanceModel';

export interface PreferredWindow { id?: number; startsAtUtc: string; endsAtUtc: string; accessInstructions?: string | null }
export interface TroubleshootingStep { id: number; resolutionCycleKey: string; stepKey: string; sequence: number; stepCode: string; instruction: string; outcome: string | number; tenantResponse?: string | null }
export interface MaintenanceCompletion { id: number; version: number; status: string | number; workOrderId: number; resolutionNotes: string; completionEvidenceReference?: string; finalCost?: number | null; tenantConfirmationDueAtUtc: string; decisionReason?: string | null }
export interface MaintenanceAttachment { id: number; maintenanceRequestId: number; purpose: string | number; resolutionCycle: number; mediaType: string | number; fileName: string; contentType: string; sizeBytes: number; createdAtUtc: string }
export interface MaintenanceEvent { id?: number; eventType?: string; title?: string; summary?: string; description?: string; status?: string; createdAt?: string; occurredAtUtc?: string; [key: string]: any }
export interface MaintenanceEstimate { id: number; version: number; status: string | number; amount: number; currency: string; scope: string; validUntilUtc?: string | null; decisionReason?: string | null }
export interface MaintenanceWorkOrder { id: number; version: number; status: string | number; estimateId?: number | null; scope: string; authorizedAmount?: number | null; dueAtUtc?: string | null; cancellationReason?: string | null }
export interface MaintenanceAppointment { id: number; version: number; status: string | number; workOrderId: number; startsAtUtc: string; endsAtUtc: string; notes?: string | null; cancellationReason?: string | null }
export interface MaintenanceAssignment { assignedToType: string | number; assignedToUserId?: number | null; vendorId?: number | null; estimateRequired: boolean; assignedAtUtc?: string | null }
export interface MaintenanceRequest {
  id?: string | number; title?: string; description?: string; status?: string | number; urgency?: string | number;
  propertyId?: string | number; unitId?: string | number; location?: string; stopTroubleshooting?: boolean;
  triagedAtUtc?: string; acknowledgeByUtc?: string; actionByUtc?: string; missingInformation?: string[];
  preferredWindows?: PreferredWindow[]; troubleshootingSteps?: TroubleshootingStep[]; completions?: MaintenanceCompletion[];
  estimates?: MaintenanceEstimate[]; workOrders?: MaintenanceWorkOrder[]; appointments?: MaintenanceAppointment[]; assignment?: MaintenanceAssignment;
  activityEvents?: MaintenanceEvent[]; activities?: MaintenanceEvent[]; attachments?: MaintenanceAttachment[];
  [key: string]: any;
}
export interface CreateMaintenanceRequest {
  propertyId: number; unitId: number; title: string; description: string; location: string;
  signals: MaintenanceSignal[]; hasPhotos: boolean; preferredWindows: PreferredWindow[];
}
export interface LocalMedia { uri: string; fileName: string; mimeType: string; fileSize?: number; type: 'image' | 'video'; idempotencyKey: string }
export interface MaintenanceAssigneeOption { id: number; label: string; detail?: string; type: 'OrganizationMember' | 'Vendor' }
export type MaintenanceAssignmentDirectorySource = 'members' | 'vendors';
export interface MaintenanceAssignmentDirectory { options: MaintenanceAssigneeOption[]; failedSources: MaintenanceAssignmentDirectorySource[] }

const unwrap = <T>(value: ApiResponse<T> | T): T => value && typeof value === 'object' && 'data' in (value as any) ? (value as ApiResponse<T>).data : value as T;
export const newIdempotencyKey = () => Crypto.randomUUID();
const mutationConfig = (idempotencyKey: string) => ({ headers: { 'Idempotency-Key': idempotencyKey } });
const safeEvidenceExtension = (contentType: string) => ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov' }[contentType.toLowerCase()] ?? '.bin');

class MaintenanceAPI {
  private client = apiClient;

  async getCurrent(_tenant = false): Promise<MaintenanceRequest[]> { return (await this.listScoped()).filter(item => !isClosedStatus(item.status ?? item.Status)); }
  async getHistory(_tenant = false): Promise<MaintenanceRequest[]> { return (await this.listScoped()).filter(item => isClosedStatus(item.status ?? item.Status)); }
  private async listScoped(): Promise<MaintenanceRequest[]> { return unwrap(await this.client.get<ApiResponse<MaintenanceRequest[]> | MaintenanceRequest[]>('/api/maintenance-requests')) || []; }
  async getDetail(id: string | number): Promise<MaintenanceRequest> {
    const detail = await this.client.get<MaintenanceRequest>(`/api/maintenance-requests/${id}`);
    return { ...detail, activityEvents: detail.activityEvents ?? detail.activities ?? detail.ActivityEvents ?? detail.Activities ?? [], attachments: detail.attachments ?? detail.Attachments ?? [] };
  }
  async createTenantRequest(request: CreateMaintenanceRequest, idempotencyKey: string): Promise<MaintenanceRequest> { return this.client.post('/api/maintenance-requests', request, mutationConfig(idempotencyKey)); }
  async getTenantLeaseScopes(): Promise<any[]> { return unwrap(await this.client.get<ApiResponse<any[]>>('/api/Lease/tenant/my-leases')) || []; }
  async getAssignmentDirectory(): Promise<MaintenanceAssignmentDirectory> {
    const organizationId = await storageService.getCurrentOrganizationId();
    if (!organizationId) throw new Error('Choose an organization before assigning maintenance.');
    const [memberResult, vendorResult] = await Promise.allSettled([
      this.client.get<ApiResponse<any[]> | any[]>(`/api/organization/members/${organizationId}`),
      this.client.get<ApiResponse<any[]> | any[]>('/api/vendor?landlordId=0'),
    ]);
    const members = memberResult.status === 'fulfilled' ? (unwrap(memberResult.value) || []) : [];
    const vendors = vendorResult.status === 'fulfilled' ? (unwrap(vendorResult.value) || []) : [];
    return {
      options: [
        ...members.filter((member: any) => (member.isActive ?? member.IsActive) && (member.userId ?? member.UserId) && (member.canManageMaintenance ?? member.CanManageMaintenance ?? true)).map((member: any) => ({ id: Number(member.userId ?? member.UserId), label: member.userName ?? member.UserName ?? member.userEmail ?? member.UserEmail ?? 'Team member', detail: member.role ?? member.Role, type: 'OrganizationMember' as const })),
        ...vendors.filter((vendor: any) => (vendor.isActive ?? vendor.IsActive) && (vendor.isReadyForAssignment ?? vendor.IsReadyForAssignment)).map((vendor: any) => ({ id: Number(vendor.id ?? vendor.Id), label: vendor.businessName ?? vendor.BusinessName ?? vendor.name ?? vendor.Name ?? 'Vendor', detail: vendor.category ?? vendor.Category, type: 'Vendor' as const })),
      ],
      failedSources: [
        ...(memberResult.status === 'rejected' ? ['members' as const] : []),
        ...(vendorResult.status === 'rejected' ? ['vendors' as const] : []),
      ],
    };
  }
  async getAttachments(id: string | number): Promise<MaintenanceAttachment[]> { return this.client.get(`/api/maintenance-requests/${id}/attachments`); }
  async uploadAttachment(id: string | number, purpose: 'Intake' | 'Completion' | 'Reopen', media: LocalMedia): Promise<MaintenanceAttachment> {
    const form = new FormData(); form.append('purpose', purpose); form.append('file', { uri: media.uri, name: media.fileName, type: media.mimeType } as any);
    return this.client.post(`/api/maintenance-requests/${id}/attachments`, form, { ...mutationConfig(media.idempotencyKey), timeout: 120000 });
  }
  async downloadAttachment(id: string | number, attachment: MaintenanceAttachment): Promise<string> {
    const token = await storageService.getToken();
    const organizationId = await storageService.getCurrentOrganizationId();
    if (!token) throw new Error('Sign in again to view private evidence.');
    const root = config.API_URL.replace(/\/$/, '');
    const destination = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}maintenance-${Crypto.randomUUID()}${safeEvidenceExtension(attachment.contentType)}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (organizationId) headers['X-Organization-Id'] = organizationId;
    const result = await FileSystem.downloadAsync(`${root}/api/maintenance-requests/${id}/attachments/${attachment.id}/content`, destination, { headers });
    if (result.status < 200 || result.status >= 300) throw new Error('Private evidence download failed.');
    return result.uri;
  }
  async deleteDownloadedAttachment(uri: string): Promise<void> { await FileSystem.deleteAsync(uri, { idempotent: true }); }
  async acknowledge(id: string | number, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/acknowledge`, {}, mutationConfig(idempotencyKey)); }
  async troubleshoot(id: string | number, stepCode: string, cycleKey: string, safety: { isWorsening: boolean; hasNewEmergency: boolean }, idempotencyKey: string) {
    return this.client.post(`/api/maintenance-requests/${id}/percy/troubleshooting`, { resolutionCycleKey: cycleKey, stepKey: `${stepCode}-${idempotencyKey}`, stepCode, ...safety }, mutationConfig(idempotencyKey));
  }
  async recordTroubleshootingOutcome(id: string | number, stepId: number, outcome: 'Completed' | 'Skipped' | 'Failed' | 'StoppedForSafety', tenantResponse: string | undefined, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/percy/troubleshooting/${stepId}/outcome`, { outcome, tenantResponse }, mutationConfig(idempotencyKey)); }
  async assignRequest(id: string | number, command: { assignedToType: 'Self' | 'OrganizationMember' | 'Vendor'; assignedToUserId: number | null; vendorId: number | null; estimateRequired: boolean }, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/assign`, command, mutationConfig(idempotencyKey)); }
  async submitEstimate(id: string | number, command: { amount: number; currency: string; scope: string; validUntilUtc: string | null }, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/estimates`, command, mutationConfig(idempotencyKey)); }
  async approveEstimate(id: string | number, estimateId: number, expectedVersion: number, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/estimates/${estimateId}/approve`, { expectedVersion }, mutationConfig(idempotencyKey)); }
  async rejectEstimate(id: string | number, estimateId: number, expectedVersion: number, reason: string, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/estimates/${estimateId}/reject`, { expectedVersion, reason }, mutationConfig(idempotencyKey)); }
  async issueWorkOrder(id: string | number, command: { estimateId: number | null; scope: string; authorizedAmount: number | null; dueAtUtc: string | null }, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/work-orders`, command, mutationConfig(idempotencyKey)); }
  async proposeAppointment(id: string | number, command: { workOrderId: number; startsAtUtc: string; endsAtUtc: string; notes: string | null }, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/appointments`, command, mutationConfig(idempotencyKey)); }
  async confirmAppointment(id: string | number, appointmentId: number, expectedVersion: number, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/appointments/${appointmentId}/confirm`, { expectedVersion }, mutationConfig(idempotencyKey)); }
  async cancelAppointment(id: string | number, appointmentId: number, expectedVersion: number, reason: string, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/appointments/${appointmentId}/cancel`, { expectedVersion, reason }, mutationConfig(idempotencyKey)); }
  async startWork(id: string | number, workOrderId: number, expectedVersion: number, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/work-orders/${workOrderId}/start`, { expectedVersion }, mutationConfig(idempotencyKey)); }
  async cancelWorkOrder(id: string | number, workOrderId: number, expectedVersion: number, reason: string, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/work-orders/${workOrderId}/cancel`, { expectedVersion, reason }, mutationConfig(idempotencyKey)); }
  async submitCompletion(id: string | number, command: { workOrderId: number; resolutionNotes: string; completionEvidenceReference: string | null; finalCost: number | null }, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/completions`, command, mutationConfig(idempotencyKey)); }
  async staffCloseCompletion(id: string | number, completionId: number, expectedVersion: number, reason: string, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/completions/${completionId}/staff-close`, { expectedVersion, reason }, mutationConfig(idempotencyKey)); }
  async confirmCompletion(id: string | number, completion: MaintenanceCompletion, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/completions/${completion.id}/confirm`, { expectedVersion: completion.version }, mutationConfig(idempotencyKey)); }
  async reopenCompletion(id: string | number, completion: MaintenanceCompletion, reason: string, idempotencyKey: string) { return this.client.post(`/api/maintenance-requests/${id}/completions/${completion.id}/reopen`, { expectedVersion: completion.version, reason }, mutationConfig(idempotencyKey)); }
  findPendingCompletion(item?: MaintenanceRequest): MaintenanceCompletion | undefined { return findPendingCompletion<MaintenanceCompletion>(item); }
}
export default new MaintenanceAPI();
