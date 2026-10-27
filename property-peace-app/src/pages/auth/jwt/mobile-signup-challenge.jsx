import { useEffect, useState } from 'react';
import TurnstileCheckbox from 'components/auth/TurnstileCheckbox';

// Public, intentionally separate from AuthLayout. Tokens only cross the WebView bridge,
// never a URL, storage, network request from this page, or a console statement.
export default function MobileSignupChallenge() {
  const [error, setError] = useState('');
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  const send = (type, token) => {
    const nonce = window.__registrationChallengeNonce;
    if (!nonce || !window.ReactNativeWebView?.postMessage) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, nonce, ...(token ? { token } : {}) }));
  };

  useEffect(() => {
    if (siteKey) return undefined;
    const timer = setTimeout(() => send('turnstile-setup-error'), 500);
    return () => clearTimeout(timer);
  }, [siteKey]);

  return (
    <main style={{ minHeight: '100vh', background: '#061e35', color: '#fff', display: 'grid', placeContent: 'center', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: 20 }}>Human verification</h1>
      {!siteKey ? (
        <p role="alert">Security check is not configured. Set VITE_TURNSTILE_SITE_KEY on the web app deployment.</p>
      ) : (
        <>
          <p>Complete the security check to send your verification email.</p>
          <TurnstileCheckbox siteKey={siteKey} onToken={(token) => {
            if (token) { setError(''); send('turnstile-token', token); }
            else send('turnstile-expired');
          }} onError={() => { setError('The security check failed. Try again.'); send('turnstile-error'); }} />
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </main>
  );
}
