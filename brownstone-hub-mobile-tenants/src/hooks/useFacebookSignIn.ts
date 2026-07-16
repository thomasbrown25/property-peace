import { useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import config from '../config';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

interface FacebookSignInResult {
  accessToken: string | null;
  error: string | null;
}

export const useFacebookSignIn = () => {
  const [loading, setLoading] = useState(false);

  const signIn = async (): Promise<FacebookSignInResult> => {
    // Note: Facebook OAuth requires app configuration
    // For now, this is a placeholder that can be configured later
    const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    
    if (!facebookAppId) {
      return {
        accessToken: null,
        error: 'Facebook sign-in is not configured',
      };
    }

    try {
      setLoading(true);
      
      const redirectUri = AuthSession.makeRedirectUri({
        useProxy: true,
      });

      const discovery = {
        authorizationEndpoint: `https://www.facebook.com/v18.0/dialog/oauth`,
        tokenEndpoint: `https://graph.facebook.com/v18.0/oauth/access_token`,
      };

      const request = new AuthSession.AuthRequest({
        clientId: facebookAppId,
        scopes: ['public_profile', 'email'],
        responseType: AuthSession.ResponseType.Token,
        redirectUri,
        usePKCE: false,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && 'params' in result) {
        const accessToken = (result.params as any).access_token;
        
        if (accessToken) {
          return {
            accessToken,
            error: null,
          };
        }
      } else if (result.type === 'error') {
        return {
          accessToken: null,
          error: result.error?.message || result.error?.code || 'Authentication error',
        };
      } else {
        return {
          accessToken: null,
          error: 'Authentication cancelled',
        };
      }

      return {
        accessToken: null,
        error: 'No access token received',
      };
    } catch (error: any) {
      return {
        accessToken: null,
        error: error?.message || 'Failed to sign in with Facebook',
      };
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading };
};
