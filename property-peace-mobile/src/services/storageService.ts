import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  SERVICE_TOKEN: 'serviceToken',
  USER: 'user',
  CURRENT_ORGANIZATION_ID: 'currentOrganizationId',
} as const;

class StorageService {
  // Token operations
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.SERVICE_TOKEN);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVICE_TOKEN, token);
    } catch (error) {
      console.error('Error setting token:', error);
      throw error;
    }
  }

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SERVICE_TOKEN);
    } catch (error) {
      console.error('Error removing token:', error);
      throw error;
    }
  }

  // User operations
  async getUser<T = any>(): Promise<T | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async setUser<T = any>(user: T): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
      throw error;
    }
  }

  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
  }

  // Organization operations
  async getCurrentOrganizationId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID);
    } catch (error) {
      console.error('Error getting organization ID:', error);
      return null;
    }
  }

  async setCurrentOrganizationId(organizationId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID, organizationId);
    } catch (error) {
      console.error('Error setting organization ID:', error);
      throw error;
    }
  }

  async removeCurrentOrganizationId(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID);
    } catch (error) {
      console.error('Error removing organization ID:', error);
      throw error;
    }
  }

  // Clear all auth data
  async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SERVICE_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.CURRENT_ORGANIZATION_ID,
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  }
}

export default new StorageService();
