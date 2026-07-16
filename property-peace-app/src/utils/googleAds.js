export const GOOGLE_ADS_ID = 'AW-17815665224';
export const SIGN_UP_CONVERSION_SEND_TO = 'AW-17815665224/dvzsCKGIjL4cEMj0la9C';

export function trackSignUpConversion() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('event', 'conversion', {
    send_to: SIGN_UP_CONVERSION_SEND_TO
  });
}
