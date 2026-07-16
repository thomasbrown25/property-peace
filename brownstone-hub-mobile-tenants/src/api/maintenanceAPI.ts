import apiClient from '../services/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface MaintenanceRequest {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface MaintenanceCategory {
  id: number;
  value: string;
  [key: string]: any;
}

export interface CreateMaintenanceRequestData {
  propertyId: number;
  unitId?: number;
  title: string;
  description: string;
  categoryId: number;
  priority: 'low' | 'medium' | 'high';
  status?: 'open';
}

class MaintenanceAPI {
  private client = apiClient;

  async getCurrentRequests(): Promise<MaintenanceRequest[]> {
    try {
      const response = await this.client.get<ApiResponse<MaintenanceRequest[]>>('/api/maintenance-request/tenant/current');
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    } catch (error) {
      console.warn('Could not fetch maintenance requests:', error);
      return [];
    }
  }

  async getHistoryRequests(): Promise<MaintenanceRequest[]> {
    try {
      const response = await this.client.get<ApiResponse<MaintenanceRequest[]>>('/api/maintenance-request/tenant/history');
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    } catch (error) {
      console.warn('Could not fetch maintenance history:', error);
      return [];
    }
  }

  async getMaintenanceRequestById(maintenanceId: string): Promise<MaintenanceRequest | null> {
    try {
      const response = await this.client.get<ApiResponse<MaintenanceRequest>>(`/api/maintenance-request/${maintenanceId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.warn('Could not fetch maintenance request:', error);
      return null;
    }
  }

  async getMaintenanceCategories(): Promise<MaintenanceCategory[]> {
    try {
      const response = await this.client.get<ApiResponse<MaintenanceCategory[]>>('/api/maintenance-request/categories');
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    } catch (error) {
      console.warn('Could not fetch maintenance categories:', error);
      return [];
    }
  }

  async createMaintenanceRequest(
    data: CreateMaintenanceRequestData,
    images: { uri: string; type?: string; name?: string }[]
  ): Promise<MaintenanceRequest> {
    try {
      const formData = new FormData();
      
      // Add maintenance data as JSON string
      formData.append('maintenanceData', JSON.stringify(data));

      // Add image files
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          // For React Native FormData, we need to use the uri directly
          const fileUri = image.uri;
          const fileName = image.name || `image_${Date.now()}_${i}.jpg`;
          const fileType = image.type || 'image/jpeg';
          
          // React Native FormData format - must be an object with uri, type, name
          formData.append('files', {
            uri: fileUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }

      // Log FormData for debugging
      console.log('📤 Creating maintenance request with FormData:', {
        hasMaintenanceData: !!data,
        imageCount: images?.length || 0,
        formDataType: formData instanceof FormData ? 'FormData' : typeof formData,
      });

      // Don't pass any options - let apiClient handle FormData Content-Type automatically
      const response = await this.client.post<ApiResponse<MaintenanceRequest>>(
        '/api/maintenance-request',
        formData
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.message || 'Failed to create maintenance request');
    } catch (error: any) {
      console.error('Error creating maintenance request:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        response: error.response?.data,
      });
      throw error;
    }
  }

  async markAsResolved(maintenanceId: string): Promise<void> {
    try {
      // First get the current maintenance request to get all required fields
      const currentRequest = await this.getMaintenanceRequestById(maintenanceId);
      if (!currentRequest) {
        throw new Error('Maintenance request not found');
      }

      // Map priority to backend format
      const priorityMap: { [key: string]: string } = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
      };
      const backendPriority = currentRequest.priority 
        ? priorityMap[currentRequest.priority.toLowerCase()] || currentRequest.priority 
        : 'Medium';

      const updatePayload = {
        id: currentRequest.id,
        title: currentRequest.title || '',
        unitName: currentRequest.unitName || '',
        priority: backendPriority,
        status: 'Completed',
        description: currentRequest.description || '',
        categoryId: currentRequest.categoryId || 0,
        imageUrl: currentRequest.imageUrl || '',
        completedAt: new Date().toISOString(),
      };

      const response = await this.client.put<ApiResponse<MaintenanceRequest>>(
        `/api/maintenance-request/${maintenanceId}`,
        updatePayload
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to mark maintenance as resolved');
      }
    } catch (error: any) {
      console.error('Error marking maintenance as resolved:', error);
      throw error;
    }
  }
}

export default new MaintenanceAPI();
export type { MaintenanceRequest };
