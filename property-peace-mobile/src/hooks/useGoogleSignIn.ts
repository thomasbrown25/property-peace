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
      // Create the auth request with authorization code flow
      // Use iOS URL scheme for iOS OAuth Client ID
      // The scheme format is: com.googleusercontent.apps.{CLIENT_ID_NUMBER}-{RANDOM_STRING}
      const iosScheme = 'com.googleusercontent.apps.422382677454-i3gc63pgq0n6c33v3km2cr2bpos7m8vf';
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: iosScheme,
        useProxy: false,
      } as any); // Type assertion needed
      
      // Force the redirect URI to use the iOS scheme (in case makeRedirectUri ignores it)
      const finalRedirectUri = redirectUri.startsWith('exp://') 
        ? `${iosScheme}://` 
        : redirectUri;

      console.log('🔵 Redirect URI (before fix):', redirectUri);
      console.log('🔵 Redirect URI (final):', finalRedirectUri);
      console.log('🔵 Client ID:', config.GOOGLE_CLIENT_ID?.substring(0, 20) + '...');

      const request = new AuthSession.AuthRequest({
        clientId: config.GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri: finalRedirectUri,
        usePKCE: false, // iOS OAuth Client IDs don't require PKCE
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
          console.log('🔵 Exchanging code for tokens with redirect URI:', finalRedirectUri);
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: config.GOOGLE_CLIENT_ID,
              code,
              redirectUri: finalRedirectUri,
              extraParams: {},
            },
            discovery
          );

          console.log('✅ Token exchange successful:', {
            hasAccessToken: !!tokenResult.accessToken,
            hasIdToken: !!tokenResult.idToken,
          });

          const accessToken = tokenResult.accessToken;
          const idToken = tokenResult.idToken;

          if (!accessToken && !idToken) {
            console.error('❌ No tokens received from exchange');
            return {
              idToken: null,
              accessToken: null,
              error: 'No tokens received',
            };
          }

          console.log('✅ Google sign-in successful!');
          return {
            idToken: idToken || null,
            accessToken: accessToken || null,
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
