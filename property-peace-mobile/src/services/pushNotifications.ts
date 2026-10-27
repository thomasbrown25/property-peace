import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import apiClient from './apiClient';

const TOKEN_KEY = 'pp_expo_push_token';
const DISABLED_KEY = 'pp_push_disabled';
const endpoint = '/api/notifications/push-tokens';

// Never display message content over the lock screen, even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function currentToken(): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === 'web') return null;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('property-peace', {
      name: 'Property Peace',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function register(): Promise<void> {
  if (!Device.isDevice || AppState.currentState !== 'active') return;
  if (await SecureStore.getItemAsync(DISABLED_KEY) === 'true') return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const token = await currentToken();
  if (!token) return;
  // Always upsert on sign-in, so an account switch reassigns the device on the server.
  await apiClient.post(endpoint, { token });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function syncPushRegistration(): Promise<void> {
  await register();
}

export async function enablePushNotifications(): Promise<'enabled' | 'denied' | 'unavailable'> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unavailable';
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  await SecureStore.deleteItemAsync(DISABLED_KEY);
  await register();
  return 'enabled';
}

export async function disablePushNotifications(): Promise<void> {
  await SecureStore.setItemAsync(DISABLED_KEY, 'true');
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    await apiClient.delete(endpoint, { data: { token } });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function unregisterPushOnSignOut(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await apiClient.delete(endpoint, { data: { token } });
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function pushRegistrationStatus(): Promise<'enabled' | 'disabled' | 'unavailable'> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unavailable';
  if (await SecureStore.getItemAsync(DISABLED_KEY) === 'true') return 'disabled';
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted && !!(await SecureStore.getItemAsync(TOKEN_KEY)) ? 'enabled' : 'disabled';
}

export { Notifications };
