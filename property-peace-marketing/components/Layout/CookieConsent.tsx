"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { FiX } from "react-icons/fi";

type ConsentChoice = "essential" | "all";

type CookieConsentProps = {
  gaId?: string;
  googleAdsId?: string;
  clarityId?: string;
};

const STORAGE_KEY = "propertyPeaceCookieConsent";
const COOKIE_NAME = "property_peace_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeConsentCookie(choice: ConsentChoice) {
  document.cookie = `${COOKIE_NAME}=${choice}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

function updateGoogleConsent(choice: ConsentChoice) {
  window.gtag?.("consent", "update", {
    analytics_storage: choice === "all" ? "granted" : "denied",
    ad_storage: choice === "all" ? "granted" : "denied",
    ad_user_data: choice === "all" ? "granted" : "denied",
    ad_personalization: choice === "all" ? "granted" : "denied",
  });
}

export default function CookieConsent({ gaId, googleAdsId, clarityId }: CookieConsentProps) {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const savedChoice = window.localStorage.getItem(STORAGE_KEY) as ConsentChoice | null;

      if (savedChoice === "essential" || savedChoice === "all") {
        setChoice(savedChoice);
        writeConsentCookie(savedChoice);
        updateGoogleConsent(savedChoice);
      }

      setIsReady(true);
    });
  }, []);

  const saveChoice = (nextChoice: ConsentChoice) => {
    window.localStorage.setItem(STORAGE_KEY, nextChoice);
    writeConsentCookie(nextChoice);
    updateGoogleConsent(nextChoice);
    setChoice(nextChoice);
  };

  const hasAcceptedAnalytics = choice === "all";
  const shouldShowBanner = isReady && choice === null;
  const primaryGoogleTagId = googleAdsId || gaId;

  return (
    <>
      {primaryGoogleTagId && (
        <>
          <Script id="google-consent-default" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = window.gtag || gtag;
              var savedConsent = window.localStorage.getItem('${STORAGE_KEY}') === 'all';
              gtag('consent', 'default', {
                analytics_storage: savedConsent ? 'granted' : 'denied',
                ad_storage: savedConsent ? 'granted' : 'denied',
                ad_user_data: savedConsent ? 'granted' : 'denied',
                ad_personalization: savedConsent ? 'granted' : 'denied',
                wait_for_update: 500
              });
              gtag('set', 'ads_data_redaction', true);
              gtag('set', 'url_passthrough', true);
            `}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleTagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function(){dataLayer.push(arguments);};
              gtag('js', new Date());
              ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ""}
              ${gaId ? `gtag('config', '${gaId}', { send_page_view: false });` : ""}
            `}
          </Script>
        </>
      )}

      {clarityId && hasAcceptedAnalytics && (
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      )}

      {shouldShowBanner && (
        <section
          className="cookieConsent"
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
        >
          <button
            type="button"
            className="ppNoticeClose"
            aria-label="Dismiss message and keep required site storage only"
            onClick={() => saveChoice("essential")}
          >
            <FiX aria-hidden="true" />
          </button>

          <div className="cookieConsent__content">
            <h2 className="cookieConsent__title">Cookies & privacy</h2>
            <p>
              Essential storage and privacy-friendly aggregate analytics help us improve Property Peace.
              Google Analytics and session insights only get full access if you accept. See our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>

            <div className="ppNoticeActions">
              <button type="button" className="ppNoticeSecondary" onClick={() => saveChoice("essential")}>
                Essential only
              </button>
              <button type="button" className="ppNoticePrimary" onClick={() => saveChoice("all")}>
                Accept all
              </button>
            </div>

            <p className="cookieConsent__fineprint">
              Google storage remains denied unless you choose “Accept all”
            </p>
          </div>
        </section>
      )}
    </>
  );
}
