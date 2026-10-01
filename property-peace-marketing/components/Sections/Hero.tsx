'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import dashboardImage from '../../assets/images/landing/dashboard.png';

export default function Hero() {
  return (
    <section data-marketing-hero="home-image" className="relative overflow-hidden bg-[#061E35] lg:min-h-[max(850px,100svh)]">
      <div
        className="absolute inset-0 bg-cover bg-[position:72%_center] bg-no-repeat sm:bg-[position:68%_center] lg:bg-[position:62%_center]"
        style={{ backgroundImage: 'url(/images/landing/hero.png)' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.98)_20%,rgba(6,30,53,0.82)_58%,rgba(6,30,53,0.72)_100%)] sm:bg-[linear-gradient(to_top,#061E35_0%,rgba(6,30,53,0.98)_18%,rgba(6,30,53,0.72)_60%,rgba(6,30,53,0.62)_100%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1660px] px-5 sm:px-8 lg:px-10 xl:px-12">
        <div className="flex flex-col lg:grid lg:min-h-[max(850px,100svh)] lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:items-center lg:gap-12 xl:gap-16">
          <div className="flex min-w-0 items-center pb-8 pt-[8rem] sm:pt-32 lg:py-28">
            <motion.div
              className="w-full text-center lg:text-left"
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              <h1
                className="mx-auto mb-8 max-w-none text-[2.35rem] font-extrabold tracking-[-0.035em] text-white sm:text-[3.4rem] lg:mx-0 lg:text-[clamp(3.5rem,4.7vw,4.6rem)]"
                style={{ fontFamily: '"Host Grotesk", sans-serif', lineHeight: '1.08' }}
              >
                <span className="block whitespace-nowrap">Property Peace,</span>
                <span className="block whitespace-nowrap">a clearer way to</span>
                <span className="block whitespace-nowrap text-green-600">manage your</span>
                <span className="block whitespace-nowrap text-green-600">rentals</span>
              </h1>
              <div className="mx-auto grid w-full max-w-[24rem] grid-cols-2 gap-3 sm:gap-4 lg:mx-0 lg:max-w-[26rem]">
                <Link
                  href="/demo"
                  className="flex min-h-14 items-center justify-center rounded-full border-2 border-white bg-white px-3 py-3 text-center text-sm font-bold text-[#061E35] transition-colors hover:border-white/85 hover:bg-white/85 sm:text-base"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Book Demo
                </Link>
                <Link
                  href="https://app.propertypeace.io/register"
                  className="flex min-h-14 items-center justify-center rounded-full bg-green-600 px-3 py-3 text-center text-sm font-bold text-white shadow-[0_14px_34px_rgba(22,163,74,0.24)] transition-all hover:-translate-y-0.5 hover:bg-green-500 sm:text-base"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Get Started Free
                </Link>
              </div>
              <p
                className="mt-16 text-sm font-extrabold uppercase tracking-[-0.025em] text-white sm:mt-20 lg:mt-24"
                style={{ fontFamily: '"Host Grotesk", sans-serif' }}
              >
                Property Management Software
              </p>
            </motion.div>
          </div>
          <div className="relative mb-8 mt-3 min-w-0 sm:mb-12 lg:mb-0 lg:mt-16 lg:-translate-y-10 lg:self-center">
            <Image
              src={dashboardImage}
              alt="Property Peace dashboard showing rent progress, property portfolio, payments, and maintenance"
              width={1671}
              height={1233}
              priority
              sizes="(max-width: 1023px) 100vw, 48vw"
              className="block h-auto w-full border border-white/20 shadow-[0_22px_70px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
