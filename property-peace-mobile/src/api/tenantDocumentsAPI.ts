import apiClient from '../services/apiClient';

export interface TenantDocument {
  id: number;
  leaseId?: number | null;
  fileName: string;
  description?: string | null;
  documentTypeName?: string;
  leaseInfo?: string | null;
  createdAt: string;
  blobUrl: string;
}

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain', rtf: 'application/rtf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
};

export function documentMime(name: string, provided?: string | null): string {
  return provided && provided !== 'application/octet-stream'
    ? provided : mimeByExtension[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export async function getMyTenantDocuments(): Promise<TenantDocument[]> {
  const response = await apiClient.get<{ success: boolean; data: TenantDocument[] }>('/api/TenantDocument/tenant/my-documents');
  if (!response.success || !Array.isArray(response.data)) throw new Error('Documents are unavailable right now.');
  return response.data;
}

export async function uploadMyTenantDocuments(files: Array<{ uri: string; name: string; mimeType: string }>): Promise<void> {
  const form = new FormData();
  for (const file of files) form.append('files', { uri: file.uri, name: file.name, type: file.mimeType } as any);
  const response = await apiClient.post<{ success: boolean }>('/api/TenantDocument/tenant/my-documents', form);
  if (!response.success) throw new Error('Upload failed');
}
