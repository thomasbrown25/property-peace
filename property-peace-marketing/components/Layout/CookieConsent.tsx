"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { FiX } from "react-icons/fi";
import { LuCookie } from "react-icons/lu";

type ConsentChoice = "essential" | "all";

const STORAGE_KEY = "propertyPeaceCookieConsent";
const COOKIE_NAME = "property_peace_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeConsentCookie(choice: ConsentChoice) {
  document.cookie = `${COOKIE_NAME}=${choice}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export default function CookieConsent({ gaId, googleAdsId }: { gaId?: string; googleAdsId?: string }) {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const savedChoice = window.localStorage.getItem(STORAGE_KEY) as ConsentChoice | null;

      if (savedChoice === "essential" || savedChoice === "all") {
        setChoice(savedChoice);
        writeConsentCookie(savedChoice);
      }

      setIsReady(true);
    });
  }, []);

  const saveChoice = (nextChoice: ConsentChoice) => {
    window.localStorage.setItem(STORAGE_KEY, nextChoice);
    writeConsentCookie(nextChoice);
    setChoice(nextChoice);
  };

  const hasAcceptedAnalytics = choice === "all";
  const shouldShowBanner = isReady && choice === null;
  const primaryGoogleTagId = googleAdsId || gaId;

  return (
    <>
      {primaryGoogleTagId && hasAcceptedAnalytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleTagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ""}
              ${gaId ? `gtag('config', '${gaId}');` : ""}
            `}
          </Script>
        </>
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

          <div className="cookieConsent__icon" aria-hidden="true">
            <LuCookie />
          </div>

          <div className="cookieConsent__content">
            <h2 className="cookieConsent__title">Cookies & privacy</h2>
            <p>
              Essential cookies keep Property Peace working. Analytics only run if you accept.
              See our <Link href="/privacy">Privacy Policy</Link>.
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
              Essential only unless you choose “Accept all”
            </p>
          </div>
        </section>
      )}
    </>
  );
}
