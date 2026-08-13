'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type AnalyticsProperties = Record<string, string>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: AnalyticsProperties }) => void;
  }
}

const OWN_HOSTS = new Set(['propertypeace.io', 'www.propertypeace.io', 'app.propertypeace.io']);

function sendGoogleEvent(eventName: string, properties: AnalyticsProperties) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('event', eventName, properties);
}

function track(eventName: string, properties: AnalyticsProperties = {}) {
  sendGoogleEvent(eventName, properties);
  window.plausible?.(eventName, { props: properties });
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim().slice(0, 80) || 'unknown';
}

export default function MarketingAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const pageLocation = `${window.location.origin}${pathname}`;

    sendGoogleEvent('page_view', {
      page_location: pageLocation,
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const element = target.closest<HTMLElement>('a, button, [data-analytics-event]');
      if (!element) return;

      const explicitEvent = element.dataset.analyticsEvent;
      const label = cleanText(element.dataset.analyticsLabel || element.textContent);
      const location = cleanText(element.dataset.analyticsLocation || element.closest('section')?.id || 'site');
      const href = element instanceof HTMLAnchorElement ? element.href : '';

      if (explicitEvent) {
        track(explicitEvent, { label, location });
        return;
      }

      if (!href) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      const properties = {
        label,
        location,
        destination: `${url.origin}${url.pathname}`,
      };

      const normalizedPath = url.pathname.replace(/\/$/, '') || '/';

      if (url.hostname === 'app.propertypeace.io' && normalizedPath === '/register') {
        track('cta_click', properties);
      } else if (url.origin === window.location.origin && normalizedPath === '/demo') {
        track('demo_start', properties);
      } else if (url.origin === window.location.origin && normalizedPath === '/pricing') {
        track('pricing_click', properties);
      } else if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
        track('contact_click', properties);
      } else if ((url.protocol === 'http:' || url.protocol === 'https:') && !OWN_HOSTS.has(url.hostname)) {
        track('outbound_click', properties);
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  return null;
}
