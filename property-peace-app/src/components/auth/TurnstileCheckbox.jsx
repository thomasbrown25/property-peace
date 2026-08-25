import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Box, FormHelperText } from '@mui/material';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement('script');
    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      script.remove();
      reject(new Error('Turnstile did not initialize.'));
    };
    const handleError = () => {
      script.remove();
      reject(new Error('Could not load the security check.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = undefined;
    throw error;
  });

  return scriptPromise;
}

export default function TurnstileCheckbox({ siteKey, resetKey = 0, onToken, onError }) {
  const containerRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onError, onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let disposed = false;
    let widgetId;
    setLoadError('');
    onTokenRef.current(null);

    loadTurnstile()
      .catch(() => loadTurnstile())
      .then((turnstile) => {
        if (disposed || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'public-signup-email',
          appearance: 'always',
          theme: 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            onErrorRef.current?.();
          }
        });
      })
      .catch(() => {
        if (disposed) return;
        setLoadError('The security check could not load. Refresh the page and try again.');
        onTokenRef.current(null);
        onErrorRef.current?.();
      });

    return () => {
      disposed = true;
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey, siteKey]);

  if (!siteKey) return null;

  return (
    <Box
      role="group"
      aria-label="Human verification"
      aria-describedby={loadError ? 'turnstile-load-error' : undefined}
    >
      <Box ref={containerRef} aria-label="Verify you are human" sx={{ display: 'flex', justifyContent: 'center', minHeight: 65 }} />
      {loadError && (
        <FormHelperText id="turnstile-load-error" role="alert" aria-live="assertive" error sx={{ mt: 1 }}>
          {loadError}
        </FormHelperText>
      )}
    </Box>
  );
}

TurnstileCheckbox.propTypes = {
  siteKey: PropTypes.string.isRequired,
  resetKey: PropTypes.number,
  onToken: PropTypes.func.isRequired,
  onError: PropTypes.func
};
