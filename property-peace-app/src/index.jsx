import { createRoot } from 'react-dom/client';

// Suppress Cross-Origin-Opener-Policy warnings from Google OAuth popup
// This is a harmless browser security warning that occurs when OAuth popup checks window.closed
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  if (message.includes('Cross-Origin-Opener-Policy') && message.includes('window.closed')) {
    return; // Suppress only COOP window.closed warnings
  }
  originalError.apply(console, args);
};

// style.scss
import 'assets/style.css';

// custom fonts
import 'assets/fonts/fonts.css';

// scroll bar
import 'simplebar-react/dist/simplebar.min.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// apex-chart
import 'assets/third-party/apex-chart.css';

// google-fonts
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/700.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';

// project imports
import App from './App';
import { ConfigProvider } from 'contexts/ConfigContext';
import reportWebVitals from './reportWebVitals';

const container = document.getElementById('root');
const root = createRoot(container);

// ==============================|| MAIN - REACT DOM RENDER ||============================== //

const setMeta = (httpEquiv, name, content) => {
  const selector = httpEquiv ? `meta[http-equiv="${httpEquiv}"]` : `meta[name="${name}"]`;
  const meta = document.head.querySelector(selector) || document.createElement('meta');
  if (httpEquiv) meta.setAttribute('http-equiv', httpEquiv);
  else meta.setAttribute('name', name);
  meta.setAttribute('content', content);
  if (!meta.parentNode) document.head.prepend(meta);
};

const bootstrapApplicantCapability = async () => {
  const isApplicantScreeningRoute = /^\/screening(?:\/|$)/.test(window.location.pathname);
  if (!isApplicantScreeningRoute) return;

  // Apply document controls to both the one-time URL and the scrubbed cookie-backed
  // route, before any React provider or optional integration can initialize.
  setMeta('Referrer-Policy', null, 'no-referrer');
  setMeta('Cache-Control', null, 'no-store');
  setMeta(null, 'robots', 'noindex, nofollow');

  const match = window.location.pathname.match(/^\/screening\/([^/]+)\/?$/);
  if (!match) return;

  const token = decodeURIComponent(match[1]);
  try {
    await fetch('/api/screenings/applicant/session', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'X-Screening-Access': token }
    });
  } finally {
    // Never leave the bearer capability in history, logs, copy/paste, or referrers.
    window.history.replaceState(null, '', '/screening');
  }
};

const render = () => {
  root.render(
    <ConfigProvider>
      <App />
    </ConfigProvider>
  );
  reportWebVitals();
};

bootstrapApplicantCapability().finally(render);
