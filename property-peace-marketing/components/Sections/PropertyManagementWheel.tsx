'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import {
  TbCalendarDollar,
  TbChartHistogram,
  TbFiles,
  TbLayoutDashboard,
  TbReceiptDollar,
  TbTool,
  TbUsersGroup,
} from 'react-icons/tb';

const features = [
  {
    icon: TbLayoutDashboard,
    iconId: 'layout-dashboard',
    href: '/features/all-in-one-dashboard',
    title: 'Portfolio dashboard',
    description:
      'See properties, units, tenants, leases, rent status, maintenance, and key tasks from one calm view.',
  },
  {
    icon: TbCalendarDollar,
    iconId: 'calendar-dollar',
    href: '/features/rent-collection',
    title: 'Rent tracking',
    description:
      'Record rent, see what is paid or overdue, and keep reminders tied to the right lease.',
  },
  {
    icon: TbUsersGroup,
    iconId: 'users-group',
    href: '/features/lease-management',
    title: 'Tenant and lease records',
    description:
      'Keep contact details, lease dates, rent terms, notices, and occupancy history organized by unit.',
  },
  {
    icon: TbTool,
    iconId: 'tool',
    href: '/features/maintenance-tracking',
    title: 'Maintenance tracking',
    description:
      'Track tenant requests, photos, messages, status, vendors, and repair history in one workflow.',
  },
  {
    icon: TbReceiptDollar,
    iconId: 'receipt-dollar',
    href: '/rent/expense-tracking',
    title: 'Expense tracking',
    description:
      'Log income and expenses by property, attach receipts, and prepare cleaner records for tax time.',
  },
  {
    icon: TbFiles,
    iconId: 'files',
    href: '/features/document-management',
    title: 'Document storage',
    description:
      'Keep leases, receipts, photos, and property files connected to the right rental.',
  },
  {
    icon: TbChartHistogram,
    iconId: 'chart-histogram',
    href: '/features/financial-reports',
    title: 'Reports and exports',
    description:
      'Review rent status, expenses, and property performance, then export records when you need them.',
  },
];

const wheelFeatures = [
  features[4],
  features[5],
  features[6],
  features[0],
  features[3],
  features[2],
  features[1],
];

const wheelPositions = [
  { left: '66%', top: '17%' },
  { left: '86%', top: '42%' },
  { left: '79%', top: '73%' },
  { left: '50%', top: '88%' },
  { left: '21%', top: '73%' },
  { left: '14%', top: '42%' },
  { left: '34%', top: '17%' },
];

const wheelPositionLabels = [
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
  'top-left',
];

const wheelSegmentPaths = [
  'M 52.195 31.127 Q 50.000 31.000 50.000 28.800 L 50.000 3.200 Q 50.000 1.000 52.199 1.049 A 49 49 0 0 1 83.684 14.414 Q 85.248 15.962 83.665 17.490 L 65.250 35.273 Q 63.667 36.801 62.051 35.311 A 19 19 0 0 0 52.195 31.127 Z',
  'M 66.124 39.950 Q 64.855 38.154 66.575 36.782 L 86.590 20.822 Q 88.311 19.450 89.643 21.200 A 49 49 0 0 1 98.824 54.149 Q 98.589 56.336 96.407 56.052 L 71.022 52.741 Q 68.840 52.457 68.998 50.264 A 19 19 0 0 0 66.124 39.950 Z',
  'M 67.911 56.341 Q 68.523 54.229 70.668 54.718 L 95.626 60.416 Q 97.771 60.906 97.233 63.039 A 49 49 0 0 1 77.196 90.760 Q 75.339 91.939 74.202 90.056 L 60.963 68.145 Q 59.825 66.262 61.638 65.018 A 19 19 0 0 0 67.911 56.341 Z',
  'M 56.210 67.957 Q 58.243 67.119 59.197 69.101 L 70.303 92.167 Q 71.257 94.149 69.254 95.059 A 49 49 0 0 1 35.088 96.676 Q 33.008 95.960 33.771 93.896 L 42.648 69.885 Q 43.411 67.821 45.514 68.463 A 19 19 0 0 0 56.210 67.957 Z',
  'M 39.832 66.050 Q 41.755 67.118 40.800 69.100 L 29.690 92.163 Q 28.735 94.145 26.775 93.146 A 49 49 0 0 1 4.209 67.442 Q 3.473 65.369 5.562 64.679 L 29.870 56.650 Q 31.959 55.960 32.768 58.004 A 19 19 0 0 0 39.832 66.050 Z',
  'M 31.112 52.057 Q 31.476 54.226 29.331 54.715 L 4.372 60.408 Q 2.227 60.898 1.786 58.742 A 49 49 0 0 1 7.814 25.074 Q 8.975 23.205 10.817 24.408 L 32.250 38.407 Q 34.092 39.610 32.999 41.518 A 19 19 0 0 0 31.112 52.057 Z',
  'M 36.615 36.515 Q 35.147 38.151 33.427 36.780 L 13.415 20.815 Q 11.695 19.443 13.105 17.755 A 49 49 0 0 1 43.187 1.476 Q 45.372 1.219 45.579 3.409 L 47.998 28.895 Q 48.205 31.085 46.032 31.419 A 19 19 0 0 0 36.615 36.515 Z',
];

function FeatureCallout({
  feature,
  align = 'left',
  isActive,
}: {
  feature: (typeof features)[number];
  align?: 'left' | 'right';
  isActive: boolean;
}) {
  const Icon = feature.icon;

  return (
    <li
      data-feature-icon={feature.iconId}
      data-wheel-callout={feature.iconId}
      data-active={isActive}
      className={`-mx-4 rounded-xl border-t border-[#B8C8D5] px-4 py-5 transition-colors duration-200 ease-out data-[active=true]:bg-[#DCFCE7]/60 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <div className={`flex items-center gap-2.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {align === 'left' && <Icon className="h-5 w-5 flex-none text-[#15803D]" aria-hidden="true" />}
        <h3
          className="text-base font-bold leading-snug text-[#061E35]"
          style={{ fontFamily: '"Poppins", sans-serif' }}
        >
          {feature.title}
        </h3>
        {align === 'right' && <Icon className="h-5 w-5 flex-none text-[#15803D]" aria-hidden="true" />}
      </div>
      <p
        className={`mt-2 text-sm leading-6 text-[#405A70] ${align === 'right' ? 'ml-auto' : ''}`}
        style={{ fontFamily: '"Inter", sans-serif' }}
      >
        {feature.description}
      </p>
    </li>
  );
}

export default function PropertyManagementWheel() {
  const DashboardIcon = features[0].icon;
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  return (
    <section
      data-homepage-feature-wheel="true"
      aria-labelledby="property-management-wheel-heading"
      className="relative z-20 -mt-8 overflow-hidden rounded-t-[2rem] border-y border-[#DCE6ED] bg-[#F7FAF8] px-4 py-20 sm:-mt-10 sm:rounded-t-[2.5rem] sm:px-6 sm:py-24 lg:-mt-12 lg:rounded-t-[3rem] lg:px-8 lg:py-24"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[-13rem] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-green-100/60 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            One system for the whole rental
          </p>
          <h2
            id="property-management-wheel-heading"
            className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#061E35] sm:text-4xl lg:text-[3.35rem]"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.1 }}
          >
            Everyday workflows.{' '}
            <span className="text-green-600">One calm system.</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#405A70] sm:text-lg"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            The everyday work of self-managing rentals stays connected, visible, and easier to move forward.
          </p>
        </div>

        <div className="mt-14 hidden grid-cols-[minmax(0,1fr)_minmax(25rem,32rem)_minmax(0,1fr)] items-center gap-x-8 lg:grid xl:gap-x-12">
          <ol className="space-y-8" aria-label="Property Peace workflows, left side">
            {features.slice(1, 4).map((feature) => (
              <FeatureCallout
                key={feature.title}
                feature={feature}
                align="right"
                isActive={activeFeatureId === feature.iconId}
              />
            ))}
          </ol>

          <div>
            <div
              className="relative mx-auto aspect-square w-full max-w-[32rem] rounded-full border-[10px] border-white bg-white shadow-[0_22px_54px_rgba(6,30,53,0.14)]"
            >
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full overflow-visible"
                role="group"
                aria-label="Property Peace feature links"
              >
                {wheelSegmentPaths.map((path, index) => {
                  const feature = wheelFeatures[index];
                  const isActive = activeFeatureId === feature.iconId;

                  return (
                    <Link
                      key={feature.title}
                      href={feature.href}
                      prefetch={false}
                      data-wheel-link={feature.iconId}
                      aria-label={`Explore ${feature.title}`}
                      onMouseEnter={() => setActiveFeatureId(feature.iconId)}
                      onMouseLeave={() => setActiveFeatureId(null)}
                      onFocus={() => setActiveFeatureId(feature.iconId)}
                      onBlur={() => setActiveFeatureId(null)}
                      className="group/wheel-link cursor-pointer focus:outline-none"
                    >
                      <path
                        d={path}
                        data-wheel-segment="true"
                        data-wheel-feature={feature.title}
                        data-wheel-feature-id={feature.iconId}
                        data-active={isActive}
                        className="cursor-pointer fill-primary-deep transition-[fill,stroke,transform] duration-200 ease-out hover:scale-[1.025] hover:fill-[#15803D] data-[active=true]:scale-[1.025] data-[active=true]:fill-[#15803D] group-focus-visible/wheel-link:stroke-[#A7F3D0] group-focus-visible/wheel-link:stroke-[1.5] motion-reduce:transform-none"
                        style={{ transformBox: 'view-box', transformOrigin: '50px 50px' }}
                      />
                    </Link>
                  );
                })}
              </svg>
              {wheelFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = activeFeatureId === feature.iconId;

                return (
                  <span
                    key={feature.title}
                    data-wheel-feature={feature.title}
                    data-wheel-position={wheelPositionLabels[index]}
                    data-wheel-icon={feature.iconId}
                    data-active={isActive}
                    className="group/wheel-icon pointer-events-none absolute z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white drop-shadow-md xl:h-16 xl:w-16"
                    style={wheelPositions[index]}
                  >
                    <Icon className="h-9 w-9 transition-transform duration-200 ease-out group-data-[active=true]/wheel-icon:scale-[1.15] motion-reduce:transform-none xl:h-10 xl:w-10" />
                  </span>
                );
              })}

              <div className="absolute left-1/2 top-1/2 z-30 flex h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-8 border-white bg-white shadow-[0_12px_36px_rgba(6,30,53,0.2)]">
                <Image
                  src="/images/logos/logo-dark-2.png"
                  alt=""
                  width={1034}
                  height={794}
                  className="h-[78%] w-[78%] rounded-full object-contain"
                  sizes="190px"
                />
              </div>
            </div>

            <div
              data-wheel-callout={features[0].iconId}
              data-active={activeFeatureId === features[0].iconId}
              className="mx-auto mt-8 max-w-sm rounded-xl border-t border-[#B8C8D5] px-4 pb-5 pt-5 text-center transition-colors duration-200 ease-out data-[active=true]:bg-[#DCFCE7]/60"
            >
              <div className="flex items-center justify-center gap-2.5">
                <DashboardIcon className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                <h3 className="font-bold text-[#061E35]" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  {features[0].title}
                </h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#405A70]" style={{ fontFamily: '"Inter", sans-serif' }}>
                {features[0].description}
              </p>
            </div>
          </div>

          <ol className="space-y-8" start={5} aria-label="Property Peace workflows, right side">
            {features.slice(4).map((feature) => (
              <FeatureCallout
                key={feature.title}
                feature={feature}
                isActive={activeFeatureId === feature.iconId}
              />
            ))}
          </ol>
        </div>

        <div data-feature-wheel-mobile="true" className="mt-12 lg:hidden">
          <ol className="space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} data-feature-wheel-card="true" data-feature-icon={feature.iconId}>
                  <article className="rounded-2xl border border-[#C9D8E4] bg-white px-5 py-7 text-center shadow-[0_10px_30px_rgba(6,30,53,0.06)] sm:px-8">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-green-200 bg-green-50 text-[#15803D]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3
                      className="mt-4 text-lg font-bold text-[#061E35]"
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="mx-auto mt-2 max-w-xl text-[15px] leading-6 text-[#405A70]"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      {feature.description}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/features"
            className="inline-flex min-h-[54px] items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-green-700/15 transition hover:-translate-y-0.5 hover:from-green-600 hover:to-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-4 motion-reduce:transform-none"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Explore all features <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex min-h-[54px] items-center justify-center border border-[#B8C8D5] bg-white px-7 py-3.5 font-semibold text-[#061E35] transition hover:border-[#15803D] hover:text-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-offset-4"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            See how it works
          </Link>
        </div>
      </div>
    </section>
  );
}
