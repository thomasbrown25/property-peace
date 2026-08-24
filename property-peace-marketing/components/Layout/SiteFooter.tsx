'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FiInstagram, FiLinkedin, FiYoutube } from 'react-icons/fi';
import { SiTiktok, SiX } from 'react-icons/si';
import { footerNavigation } from '@/lib/footer-navigation.mjs';

const socialLinks = [
  { label: 'Follow us on X', href: 'https://x.com/Thomasbrown1125', icon: SiX },
  { label: 'Follow us on Instagram', href: 'https://www.instagram.com/propertypeace.io/', icon: FiInstagram },
  { label: 'Connect with us on LinkedIn', href: 'https://www.linkedin.com/company/property-peace', icon: FiLinkedin },
  { label: 'Subscribe on YouTube', href: 'https://www.youtube.com/@property_peace', icon: FiYoutube },
  { label: 'Follow us on TikTok', href: 'https://www.tiktok.com/@propertypeace.io', icon: SiTiktok },
];

export default function SiteFooter() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.propertypeace.io').replace(/\/$/, '');

  return (
    <footer className="relative overflow-hidden bg-[#061e35] text-white">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-6 border-b border-white/15 pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#22c55e]">A clearer place to begin</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-[-0.025em] text-white md:text-3xl" style={{ fontFamily: '"Poppins", sans-serif' }}>
              Find the rental workflow you want to make calmer.
            </h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/how-it-works" className="inline-flex min-h-11 items-center font-bold text-[#22c55e] transition-colors hover:text-green-400">
              See how it works →
            </Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center font-bold text-white transition-colors hover:text-white/80">
              Compare plans →
            </Link>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
          <div>
            <Link href="/" className="inline-block">
              <Image
                src="/images/logos/property-peace.png"
                alt="Property Peace"
                width={220}
                height={64}
                className="h-auto w-44 max-w-full"
              />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/65" style={{ fontFamily: '"Inter", sans-serif' }}>
              One calm system for landlords managing 1–50 units.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center border border-white/10 bg-white/5 text-white/80 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {footerNavigation.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-sm font-bold text-[#22c55e]">{group.title}</h3>
              <ul className="space-y-1">
                {group.links.map((link) => {
                  const className = 'inline-flex min-h-10 items-center text-sm font-semibold leading-5 text-white/80 transition-colors hover:text-white';
                  const href = link.app ? `${appUrl}${link.href}` : link.href;

                  return (
                    <li key={link.label}>
                      {link.app ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{link.label}</a>
                      ) : (
                        <Link href={href} className={className}>{link.label}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 items-center gap-4 border-t border-white/15 pt-8 text-sm text-white/55 md:grid-cols-3">
          <p className="order-2 text-center md:order-1 md:text-left">© 2026 Property Peace. All rights reserved.</p>
          <div className="order-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 md:order-2">
            <Link href="/terms" className="inline-flex min-h-10 items-center font-semibold text-[#22c55e] transition-colors hover:text-green-400">Terms of Use</Link>
            <Link href="/privacy" className="inline-flex min-h-10 items-center font-semibold text-[#22c55e] transition-colors hover:text-green-400">Privacy Policy</Link>
            <Link href="/sitemap" className="inline-flex min-h-10 items-center font-semibold text-[#22c55e] transition-colors hover:text-green-400">Sitemap</Link>
          </div>
          <p className="order-3 text-center md:text-right">Created by Brownstone Hub LLC</p>
        </div>
      </div>
    </footer>
  );
}
