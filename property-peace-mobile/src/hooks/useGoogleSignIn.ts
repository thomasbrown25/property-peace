import { useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
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
    const clientId = Platform.OS === 'ios' ? config.GOOGLE_IOS_CLIENT_ID : config.GOOGLE_CLIENT_ID;
    if (!clientId) {
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
      // Google native iOS OAuth uses the reversed client ID with a single-slash redirect.
      const iosScheme = `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
      const redirectUri = AuthSession.makeRedirectUri({
        native: Platform.OS === 'ios' ? `${iosScheme}:/oauth2redirect` : undefined,
        scheme: Platform.OS === 'ios' ? iosScheme : 'propertypeace',
      });

      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        usePKCE: true,
      });

      // Get the discovery document
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };

      console.log('🔵 Opening OAuth browser...');
      // Start the auth session (no proxy needed for iOS URL scheme)
      const result = await request.promptAsync(discovery);

      console.log('🔵 OAuth result type:', result.type);
      
      // Type guard to check if result has params (success type)
      const hasParams = 'params' in result && result.type === 'success';
      console.log('🔵 OAuth result params:', hasParams ? Object.keys((result as any).params) : 'no params');
      
      if (result.type === 'success' && hasParams && (result as any).params.code) {
        console.log('✅ Authorization code received, exchanging for tokens...');
        
        try {
          // Exchange authorization code for tokens
          const code = (result as any).params.code;
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId,
              code,
              redirectUri,
              extraParams: { code_verifier: request.codeVerifier! },
            },
            discovery
          );

          console.log('✅ Token exchange successful:', {
            hasAccessToken: !!tokenResult.accessToken,
            hasIdToken: !!tokenResult.idToken,
          });

          const accessToken = tokenResult.accessToken;
          const idToken = tokenResult.idToken;

          if (!idToken && (Platform.OS === 'ios' || !accessToken)) {
            console.error('❌ No usable token received from exchange');
            return {
              idToken: null,
              accessToken: null,
              error: 'No Google ID token received',
            };
          }

          console.log('✅ Google sign-in successful!');
          return {
            idToken: idToken || null,
            // Backend prefers accessToken; never send it alongside an ID token.
            accessToken: idToken ? null : accessToken || null,
            error: null,
          };
        } catch (exchangeError: any) {
          console.error('❌ Token exchange failed:', exchangeError);
          return {
            idToken: null,
            accessToken: null,
            error: `Token exchange failed: ${exchangeError?.message || 'Unknown error'}`,
          };
        }
      } else if (result.type === 'error') {
        console.error('❌ OAuth error:', result.error);
        return {
          idToken: null,
          accessToken: null,
          error: result.error?.message || result.error?.code || 'Authentication error',
        };
      } else {
        console.warn('⚠️ OAuth cancelled or dismissed');
        return {
          idToken: null,
          accessToken: null,
          error: 'Authentication cancelled',
        };
      }
    } catch (error: any) {
      console.error('❌ Google sign-in exception:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
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
