import type { Metadata } from "next";
import type { ComponentProps } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Layout/Navigation";
import Footer from "@/components/Layout/Footer";
import StickyCTA from "@/components/Layout/StickyCTA";
import CookieConsent from "@/components/Layout/CookieConsent";
import StructuredData from "@/components/SEO/StructuredData";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const searchAtlasOttoScriptProps = {
  id: "sa-dynamic-optimization",
  src: "data:text/javascript;base64,dmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInNjcmlwdCIpO3NjcmlwdC5zZXRBdHRyaWJ1dGUoIm5vd3Byb2NrZXQiLCAiIik7c2NyaXB0LnNldEF0dHJpYnV0ZSgibml0cm8tZXhjbHVkZSIsICIiKTtzY3JpcHQuc3JjID0gImh0dHBzOi8vZGFzaGJvYXJkLnNlYXJjaGF0bGFzLmNvbS9zY3JpcHRzL2R5bmFtaWNfb3B0aW1pemF0aW9uLmpzIjtzY3JpcHQuZGF0YXNldC51dWlkID0gIjhjNDgyM2VkLWJhZTEtNGRmNi05MGE2LWU2OTYxMTE5MjIxMCI7c2NyaXB0LmlkID0gInNhLWR5bmFtaWMtb3B0aW1pemF0aW9uLWxvYWRlciI7ZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpOw==",
  type: "text/javascript",
  "data-uuid": "8c4823ed-bae1-4df6-90a6-e69611192210",
  nowprocket: "",
  "nitro-exclude": "",
  strategy: "beforeInteractive",
} as ComponentProps<typeof Script> & {
  nowprocket: string;
  "nitro-exclude": string;
};

export const metadata: Metadata = {
  title: "Landlord Software & AI Property Assistant | Property Peace",
  description: "Property Peace is landlord software and a structured system of record for rental workflows. Percy, its AI property assistant, offers read-only help for supported records through a limited pilot.",
  keywords: "property management software, landlord software, rental property management, property management app, landlord management software, rental management software, small landlord tools, property peace",
  authors: [{ name: "Property Peace" }],
  creator: "Property Peace",
  publisher: "Property Peace",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://propertypeace.io',
    siteName: 'Property Peace',
    title: 'Landlord Software & AI Property Assistant | Property Peace',
    description: 'Property Peace organizes rental records and workflows for self-managing landlords; Percy is its limited-pilot AI property assistant for supported records.',
    images: [
      {
        url: '/favicon.png',
        width: 512,
        height: 512,
        alt: 'Property Peace - Property Management Software for Landlords',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Landlord Software & AI Property Assistant | Property Peace',
    description: 'Property Peace organizes rental records and workflows for self-managing landlords; Percy is its limited-pilot AI property assistant for supported records.',
    images: ['/favicon.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/favicon.png', type: 'image/png', sizes: '180x180' },
    ],
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://propertypeace.io'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-17815665224";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StructuredData data={organizationSchema} />
        <StructuredData data={websiteSchema} />
        <Script {...searchAtlasOttoScriptProps} />
        <link
          href="https://assets.calendly.com/assets/external/widget.css"
          rel="stylesheet"
        />
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="lazyOnload"
        />
        <Navigation />
        {children}
        <Footer />
        <StickyCTA />
        <CookieConsent gaId={gaId} googleAdsId={googleAdsId} />
      </body>
    </html>
  );
}
