import { useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import config from '../config';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInResult {
  idToken: string | null;
  accessToken: string | null;
  error: string | null;
}

export const useGoogleSignIn = () => {
  const [loading, setLoading] = useState(false);

  const signIn = async (): Promise<GoogleSignInResult> => {
    if (!config.GOOGLE_CLIENT_ID) {
      console.error('❌ Google Client ID not configured');
      return {
        idToken: null,
        accessToken: null,
        error: 'Google Client ID not configured',
      };
    }

    console.log('🔵 Starting Google OAuth flow...');
    setLoading(true);

    try {
      // Use iOS URL scheme for iOS OAuth Client ID
      const iosScheme = 'com.googleusercontent.apps.422382677454-i3gc63pgq0n6c33v3km2cr2bpos7m8vf';
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: iosScheme,
        useProxy: false,
      } as any);
      
      const finalRedirectUri = redirectUri.startsWith('exp://') 
        ? `${iosScheme}://` 
        : redirectUri;

      const request = new AuthSession.AuthRequest({
        clientId: config.GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri: finalRedirectUri,
        usePKCE: false,
      });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };

      const result = await request.promptAsync(discovery);
      
      const hasParams = 'params' in result && result.type === 'success';
      
      if (result.type === 'success' && hasParams && (result as any).params.code) {
        try {
          const code = (result as any).params.code;
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: config.GOOGLE_CLIENT_ID,
              code,
              redirectUri: finalRedirectUri,
              extraParams: {},
            },
            discovery
          );

          const accessToken = tokenResult.accessToken;
          const idToken = tokenResult.idToken;

          if (!accessToken && !idToken) {
            return {
              idToken: null,
              accessToken: null,
              error: 'No tokens received',
            };
          }

          return {
            idToken: idToken || null,
            accessToken: accessToken || null,
            error: null,
          };
        } catch (exchangeError: any) {
          return {
            idToken: null,
            accessToken: null,
            error: `Token exchange failed: ${exchangeError?.message || 'Unknown error'}`,
          };
        }
      } else if (result.type === 'error') {
        return {
          idToken: null,
          accessToken: null,
          error: result.error?.message || result.error?.code || 'Authentication error',
        };
      } else {
        return {
          idToken: null,
          accessToken: null,
          error: 'Authentication cancelled',
        };
      }
    } catch (error: any) {
      return {
        idToken: null,
        accessToken: null,
        error: error?.message || 'Failed to sign in with Google',
      };
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading };
};
