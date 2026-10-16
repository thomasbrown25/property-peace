import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const preferenceKey = (userId: string) => `biometricUnlockEnabled.${userId}`;

export type BiometricAvailability = {
  available: boolean;
  label: 'Face ID' | 'Biometric unlock';
  reason?: string;
};

class BiometricService {
  async getAvailability(): Promise<BiometricAvailability> {
    if (Platform.OS === 'web') {
      return { available: false, label: 'Biometric unlock', reason: 'Biometric unlock is available in the mobile app.' };
    }

    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    const hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const label = Platform.OS === 'ios' && hasFaceId ? 'Face ID' : 'Biometric unlock';

    if (!hasHardware) return { available: false, label, reason: 'This device does not support biometric authentication.' };
    if (!isEnrolled) return { available: false, label, reason: `Set up ${label} in your device settings first.` };

    return { available: true, label };
  }

  async isEnabled(userId: string): Promise<boolean> {
    if (!userId) return false;
    return (await SecureStore.getItemAsync(preferenceKey(userId))) === 'true';
  }

  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    if (!userId) throw new Error('Account required for device unlock preference');
    if (enabled) {
      await SecureStore.setItemAsync(preferenceKey(userId), 'true');
    } else {
      await SecureStore.deleteItemAsync(preferenceKey(userId));
    }
  }

  async authenticate(promptMessage = 'Unlock Property Peace'): Promise<boolean> {
    const availability = await this.getAvailability();
    if (!availability.available) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use device passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  }
}

export default new BiometricService();
