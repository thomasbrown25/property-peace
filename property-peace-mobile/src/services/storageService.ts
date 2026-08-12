import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  SERVICE_TOKEN: 'serviceToken',
  USER: 'user',
  CURRENT_ORGANIZATION_ID: 'currentOrganizationId',
} as const;

class StorageService {
  async getToken(): Promise<string | null> {
    try {
      const secureToken = await SecureStore.getItemAsync(STORAGE_KEYS.SERVICE_TOKEN);
      if (secureToken) return secureToken;

      const legacyToken = await AsyncStorage.getItem(STORAGE_KEYS.SERVICE_TOKEN);
      if (legacyToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.SERVICE_TOKEN, legacyToken);
        await AsyncStorage.removeItem(STORAGE_KEYS.SERVICE_TOKEN);
      }
      return legacyToken;
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.SERVICE_TOKEN, token);
    await AsyncStorage.removeItem(STORAGE_KEYS.SERVICE_TOKEN);
  }

  async removeToken(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.SERVICE_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.SERVICE_TOKEN),
    ]);
  }

  async getUser<T = unknown>(): Promise<T | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  async setUser<T = unknown>(user: T): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  }

  async getCurrentOrganizationId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID);
    } catch {
      return null;
    }
  }

  async setCurrentOrganizationId(organizationId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID, organizationId);
  }

  async removeCurrentOrganizationId(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_ORGANIZATION_ID);
  }

  async clearAuthData(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.SERVICE_TOKEN),
      AsyncStorage.multiRemove([
        STORAGE_KEYS.SERVICE_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.CURRENT_ORGANIZATION_ID,
      ]),
    ]);
  }
}

export default new StorageService();
