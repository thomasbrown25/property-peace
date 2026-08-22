import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface Property {
  id?: string | number;
  name?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  [key: string]: any;
}

export interface Unit {
  id?: string | number;
  name?: string;
  lease?: any;
  activeLease?: any;
  [key: string]: any;
}

class PropertyAPI {
  private client = apiClient;

  async getProperties(): Promise<Property[]> {
    const response = await this.client.get<ApiResponse<Property[]>>('/api/Property/list');
    return response.data;
  }

  async getPropertyById(propertyId: string | number): Promise<Property> {
    const response = await this.client.get<ApiResponse<Property>>(`/api/Property/${propertyId}`);
    return response.data;
  }

  async getUnits(propertyId: string | number): Promise<Unit[]> {
    const response = await this.client.get<ApiResponse<Unit[]>>(`/api/unit/${propertyId}`);
    return response.data ?? [];
  }

  async createProperty(property: Partial<Property>): Promise<Property> {
    const formData = new FormData();
    formData.append('propertyData', JSON.stringify(property));
    formData.append('files', '' as any);
    const response = await this.client.post<ApiResponse<Property>>('/api/Property', formData);
    return response.data;
  }

  async updateProperty(propertyId: string | number, property: Partial<Property>): Promise<Property> {
    const formData = new FormData();
    formData.append('propertyData', JSON.stringify({ ...property, id: propertyId }));
    formData.append('files', '' as any);
    const response = await this.client.post<ApiResponse<Property>>('/api/Property', formData);
    return response.data;
  }

  async deleteProperty(propertyId: string | number): Promise<void> {
    await this.client.delete(`/api/Property/${propertyId}`);
  }
}

export default new PropertyAPI();
