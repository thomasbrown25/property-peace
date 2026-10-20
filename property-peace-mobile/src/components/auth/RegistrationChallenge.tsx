import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { challengeRequired, challengeUrl, isAllowedChallengeNavigation, parseChallengeMessage } from '../../features/auth/registrationChallenge';

type Props = {
  onToken: (token: string | null) => void;
  onError: (message: string) => void;
  generation: number;
};

export const registrationChallengeEnabled = challengeRequired(__DEV__, process.env.EXPO_PUBLIC_TURNSTILE_DISABLED);

export default function RegistrationChallenge({ onToken, onError, generation }: Props) {
  const [nonce] = useState(randomUUID);
  const page = useMemo(() => {
    try { return challengeUrl(process.env.EXPO_PUBLIC_APP_URL || 'https://app.propertypeace.io'); }
    catch { return null; }
  }, []);
  const [currentPage, setCurrentPage] = useState(true);
  if (!registrationChallengeEnabled) return null;
  if (!page) return <Text accessibilityRole="alert">Invalid EXPO_PUBLIC_APP_URL. Set the web app HTTPS hostname.</Text>;

  const reject = () => {
    setCurrentPage(false);
    onToken(null);
    onError('Security check could not load. Check EXPO_PUBLIC_APP_URL and try again.');
  };
  return (
    <View style={{ height: 165, width: '100%', marginBottom: 12 }}>
      <WebView
        key={generation}
        source={{ uri: page }}
        originWhitelist={[new URL(page).origin, 'https://challenges.cloudflare.com']}
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        injectedJavaScriptBeforeContentLoaded={`window.__registrationChallengeNonce=${JSON.stringify(nonce)};true;`}
        injectedJavaScript={`window.__registrationChallengeNonce=${JSON.stringify(nonce)};true;`}
        onShouldStartLoadWithRequest={(request) => {
          // Turnstile owns cross-origin subframes; only restrict top-level navigation.
          if (request.isTopFrame === false) return true;
          const allowed = isAllowedChallengeNavigation(page, request.url);
          if (!allowed) reject();
          return allowed;
        }}
        onNavigationStateChange={(nav) => {
          if (!isAllowedChallengeNavigation(page, nav.url) || nav.url !== page) {
            setCurrentPage(false);
            reject();
          }
        }}
        onMessage={(event: WebViewMessageEvent) => {
          if (!currentPage) return;
          const message = parseChallengeMessage(event.nativeEvent.data, event.nativeEvent.url, page, nonce);
          if (message?.type === 'token') onToken(message.token);
          else if (message?.type === 'expired') onToken(null);
          else if (message?.type === 'setup-error') {
            onToken(null);
            onError('Security check is not configured on the web app. Set VITE_TURNSTILE_SITE_KEY.');
          } else if (message?.type === 'error') {
            onToken(null);
            onError('Security check failed. Try again.');
          }
        }}
        onError={reject}
        onHttpError={reject}
        style={{ backgroundColor: '#061e35' }}
      />
    </View>
  );
}
