import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

interface AppleSignInResult {
  idToken: string | null;
  accessToken: string | null;
  error: string | null;
}

export const useAppleSignIn = () => {
  const [loading, setLoading] = useState(false);

  const signIn = async (): Promise<AppleSignInResult> => {
    if (Platform.OS !== 'ios') {
      return {
        idToken: null,
        accessToken: null,
        error: 'Apple Sign-In is only available on iOS',
      };
    }

    try {
      setLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        return {
          idToken: credential.identityToken,
          accessToken: credential.authorizationCode || null,
          error: null,
        };
      }

      return {
        idToken: null,
        accessToken: null,
        error: 'No identity token received from Apple',
      };
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        return {
          idToken: null,
          accessToken: null,
          error: 'Authentication cancelled',
        };
      }
      
      return {
        idToken: null,
        accessToken: null,
        error: error?.message || 'Failed to sign in with Apple',
      };
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading };
};
