import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_UNLOCK_KEY = 'biometricUnlockEnabled';

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

  async isEnabled(): Promise<boolean> {
    return (await SecureStore.getItemAsync(BIOMETRIC_UNLOCK_KEY)) === 'true';
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_UNLOCK_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_UNLOCK_KEY);
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
