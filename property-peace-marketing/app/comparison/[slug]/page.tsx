import Link from "next/link";
import { notFound } from "next/navigation";
import { FiCheck, FiX, FiArrowLeft, FiArrowRight } from "react-icons/fi";

// Generate static params for all comparison pages
// This is a Server Component, so generateStaticParams is allowed
export function generateStaticParams() {
  return [
    { slug: 'brownstone-hub-vs-buildium' },
    { slug: 'brownstone-hub-vs-doorloop' },
    { slug: 'brownstone-hub-vs-appfolio' },
  ];
}

type ComparisonData = {
  competitorName: string;
  competitorSlug: string;
  title: string;
  description: string;
  metaKeywords: string;
  canonical: string;
  competitorFeatures: Array<{ name: string; brownstone: boolean; competitor: boolean }>;
  brownstoneAdvantages: Array<{ title: string; description: string }>;
  pricingComparison: {
    brownstone: { startingPrice: string; description: string; features: string[] };
    competitor: { startingPrice: string; description: string; features: string[] };
  };
  whyChooseUs: { title: string; points: string[] };
  heroDescription: string;
};

const comparisonData: Record<string, ComparisonData> = {
  'brownstone-hub-vs-buildium': {
    competitorName: 'Buildium',
    competitorSlug: 'buildium',
    title: 'Buildium Alternative for Small Landlords',
    description: 'Compare Property Peace with Buildium. Property Peace is built for small landlords with 1–50 units who want rent, maintenance, leases, expenses, reports, and Percy Pilot tools without enterprise complexity.',
    metaKeywords: 'Property Peace vs Buildium, Buildium alternative, property management software comparison, Buildium vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-buildium',
    competitorFeatures: [
      { name: 'Real-Time Updates (SignalR)', brownstone: true, competitor: false },
      { name: 'All-in-One Dashboard', brownstone: true, competitor: true },
      { name: 'Rent Ledger and Reminders', brownstone: true, competitor: true },
      { name: 'Lease Document Management', brownstone: true, competitor: true },
      { name: 'Digital Rental Applications', brownstone: true, competitor: true },
      { name: 'Maintenance Request Tracking', brownstone: true, competitor: true },
      { name: 'Tenant Portal', brownstone: true, competitor: true },
      { name: 'Financial Reporting & Analytics', brownstone: true, competitor: true },
      { name: 'Expense Tracking', brownstone: true, competitor: true },
      { name: 'Property Accounting', brownstone: true, competitor: true },
      { name: 'Multi-Channel Notifications', brownstone: true, competitor: true },
      { name: 'Cloud Document Management', brownstone: true, competitor: true },
      { name: 'Automated Workflows', brownstone: true, competitor: true },
      { name: 'Google Maps Integration', brownstone: true, competitor: false },
      { name: 'Online Payment Processing (not currently available)', brownstone: false, competitor: true },
      { name: 'Mobile Responsive Design', brownstone: true, competitor: true },
      { name: 'Free tier (up to 2 units)', brownstone: true, competitor: false },
      { name: 'No Hidden Fees', brownstone: true, competitor: false },
      { name: 'No Minimum Unit Requirements', brownstone: true, competitor: false },
      { name: 'Modern, Intuitive Interface', brownstone: true, competitor: false },
      { name: 'Real-Time Communication', brownstone: true, competitor: false },
      { name: 'Percy Pilot Features', brownstone: true, competitor: false }
    ],
    brownstoneAdvantages: [
      {
        title: 'Perfect for Solo Landlords and Growing Portfolios',
        description: 'Property Peace is free for up to 2 units. Premium is $14.99/mo with no per-unit fees — rent collection, maintenance, leases, financial reports, LeaseShield, and more. Designed for solo landlords and growing portfolios. Buildium typically has per-unit pricing with minimum requirements, making it far more expensive for smaller portfolios.'
      },
      {
        title: 'Real-Time Technology Advantage',
        description: 'Property Peace uses SignalR for instant, real-time updates across all features. Buildium requires page refreshes to see updates, making Property Peace faster and more efficient for solo landlords managing multiple tasks.'
      },
      {
        title: 'Free tier for small portfolios',
        description: 'Property Peace is free for up to 2 units — no credit card required. Premium is $14.99/mo for unlimited units and all features. Buildium typically offers limited demos or shorter trial periods with no free tier.'
      },
      {
        title: 'Modern, Intuitive Interface',
        description: 'Property Peace features a clean, modern interface designed for efficiency. Ideal for solo landlords who need powerful tools without complexity. Buildium\'s interface can feel cluttered and overwhelming, especially for new users.'
      },
      {
        title: 'Built for Solo Landlords and Growing Portfolios',
        description: 'Property Peace is designed specifically for solo landlords and growing portfolios. It scales with you from one property to many. Buildium is better suited for larger property management companies and may be overkill for solo landlords.'
      },
      {
        title: 'No Minimum Unit Requirements',
        description: 'Start with just one property and scale as you grow your portfolio. Perfect for solo landlords who are just starting out. Buildium may require minimum unit counts, making it inaccessible for solo landlords.'
      },
      {
        title: 'Faster Onboarding',
        description: 'Get up and running quickly with Property Peace\'s streamlined setup process. Solo landlords can start managing properties in minutes, not days. Buildium\'s extensive feature set can make onboarding more complex and time-consuming.'
      },
      {
        title: 'Superior Real-Time Communication',
        description: 'Instant messaging and real-time notifications keep you connected with tenants. Property Peace\'s communication tools are more responsive than Buildium\'s traditional approach, making it easier for solo landlords to stay on top of everything.'
      },
      {
        title: 'Percy Pilot Features with More Coming Soon',
        description: 'Property Peace includes Percy Pilot features to enhance your property management efficiency. We\'re actively developing new Percy capabilities that will be released soon, providing solo landlords and growing portfolios with innovative tools that Buildium doesn\'t offer.'
      }
    ],
    pricingComparison: {
      brownstone: {
        startingPrice: 'Free — up to 2 units',
        description: 'Premium from $14.99/mo · Save 15% annually',
        features: [
          'Free forever for up to 2 units',
          'Premium: $14.99/mo — unlimited units, all features included',
          'No per-unit fees',
          'Cancel anytime'
        ]
      },
      competitor: {
        startingPrice: 'Varies by portfolio size',
        description: 'Pricing varies based on units and features',
        features: [
          'May require minimum unit counts',
          'Pricing can be complex',
          'May include setup fees',
          'Designed for larger portfolios',
          'Can be expensive for small landlords'
        ]
      }
    },
    whyChooseUs: {
      title: 'Why Property Peace is the Better Choice Over Buildium',
      points: [
        'Free for up to 2 units — no credit card required',
        'Premium plan at $14.99/mo — unlimited units, LeaseShield, Percy Pilot features, priority support',
        'Save 15% with annual billing',
        'Real-time updates without page refreshing',
        'No minimum unit requirements—perfect for solo landlords and growing portfolios',
        'Modern, intuitive interface that\'s easy to learn',
        'Faster onboarding and setup process',
        'No hidden fees',
        'Percy Pilot features with new capabilities coming soon',
        'Designed specifically for solo landlords and growing portfolios'
      ]
    },
    heroDescription: 'Property Peace and Buildium are powerful property management tools. While Buildium offers strong features geared toward larger portfolios and community associations, Property Peace shines overall with its user-friendly interface, simple flat pricing, and advanced automation to help you simplify everyday property management. Whether you\'re a solo landlord just starting out or growing your portfolio, Property Peace adapts to your needs without being too large or complex.'
  },
  'brownstone-hub-vs-doorloop': {
    competitorName: 'DoorLoop',
    competitorSlug: 'doorloop',
    title: 'DoorLoop Alternative for Small Landlords',
    description: 'Compare Property Peace with DoorLoop. Property Peace is a free-start, landlord-first system for independent rental owners who want essential workflows without bloated functionality.',
    metaKeywords: 'Property Peace vs DoorLoop, DoorLoop alternative, property management software comparison, DoorLoop vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-doorloop',
    competitorFeatures: [
      { name: 'Real-Time Updates (SignalR)', brownstone: true, competitor: false },
      { name: 'All-in-One Dashboard', brownstone: true, competitor: true },
      { name: 'Rent Ledger and Reminders', brownstone: true, competitor: true },
      { name: 'Lease Document Management', brownstone: true, competitor: true },
      { name: 'Digital Rental Applications', brownstone: true, competitor: true },
      { name: 'Maintenance Request Tracking', brownstone: true, competitor: true },
      { name: 'Tenant Portal', brownstone: true, competitor: true },
      { name: 'Financial Reporting & Analytics', brownstone: true, competitor: true },
      { name: 'Expense Tracking', brownstone: true, competitor: true },
      { name: 'Property Accounting', brownstone: true, competitor: true },
      { name: 'Multi-Channel Notifications', brownstone: true, competitor: true },
      { name: 'Cloud Document Management', brownstone: true, competitor: true },
      { name: 'Automated Workflows', brownstone: true, competitor: true },
      { name: 'Google Maps Integration', brownstone: true, competitor: false },
      { name: 'Online Payment Processing (not currently available)', brownstone: false, competitor: true },
      { name: 'Mobile Responsive Design', brownstone: true, competitor: true },
      { name: 'Free tier (up to 2 units)', brownstone: true, competitor: false },
      { name: 'No Hidden Fees', brownstone: true, competitor: false },
      { name: 'No Minimum Unit Requirements', brownstone: true, competitor: false },
      { name: 'Modern, Intuitive Interface', brownstone: true, competitor: false },
      { name: 'Real-Time Communication', brownstone: true, competitor: false },
      { name: 'Percy Pilot Features', brownstone: true, competitor: false }
    ],
    brownstoneAdvantages: [
      {
        title: 'Focused on Essential Features',
        description: 'Property Peace focuses on the features that solo landlords and growing portfolios actually need, without the bloat. DoorLoop can be overwhelming with features you may never use, making it harder to navigate and learn.'
      },
      {
        title: 'Real-Time Technology',
        description: 'Property Peace uses SignalR for instant, real-time updates across all features. DoorLoop relies on traditional page refreshes, making Property Peace more responsive and efficient for landlords managing multiple tasks.'
      },
      {
        title: 'Better Value for Solo Landlords',
        description: 'Property Peace is free for up to 2 units, and Premium is $14.99/mo — a fraction of what DoorLoop costs. Perfect for solo landlords who want powerful features without enterprise pricing.'
      },
      {
        title: 'Simpler, More Intuitive Interface',
        description: 'Property Peace features a clean, modern interface designed for efficiency. Ideal for solo landlords who need powerful tools without complexity. DoorLoop\'s interface can feel cluttered with too many options.'
      },
      {
        title: 'Free tier for small portfolios',
        description: 'Property Peace is free for up to 2 units — no credit card required. Premium is $14.99/mo for unlimited units and all features. DoorLoop typically offers limited demos or shorter trial periods with no free tier.'
      },
      {
        title: 'No Minimum Unit Requirements',
        description: 'Start with just one property and scale as you grow your portfolio. Perfect for solo landlords who are just starting out. DoorLoop may have pricing tiers that don\'t make sense for very small portfolios.'
      },
      {
        title: 'Faster Setup and Onboarding',
        description: 'Get up and running quickly with Property Peace\'s streamlined setup process. Solo landlords can start managing properties in minutes, not days. DoorLoop\'s extensive feature set can make onboarding more complex.'
      },
      {
        title: 'Designed for Landlords, Not Enterprise',
        description: 'Property Peace is built specifically for solo landlords and growing portfolios. It scales with you from one property to many, without overwhelming complexity. DoorLoop tries to be everything to everyone, which can make it less focused.'
      },
      {
        title: 'Percy Pilot Features',
        description: 'Property Peace includes Percy Pilot features to enhance your property management efficiency. We\'re actively developing new Percy capabilities that will be released soon, providing landlords with innovative tools that DoorLoop doesn\'t offer.'
      }
    ],
    pricingComparison: {
      brownstone: {
        startingPrice: 'Free — up to 2 units',
        description: 'Premium from $14.99/mo · Save 15% annually',
        features: [
          'Free forever for up to 2 units',
          'Premium: $14.99/mo — unlimited units, all features included',
          'No per-unit fees',
          'Cancel anytime'
        ]
      },
      competitor: {
        startingPrice: 'Varies by portfolio size',
        description: 'Pricing varies based on units and features',
        features: [
          'May have complex pricing tiers',
          'Pricing can vary significantly',
          'May include setup fees',
          'Designed for various portfolio sizes',
          'Can be expensive for small landlords'
        ]
      }
    },
    whyChooseUs: {
      title: 'Why Property Peace is the Better Choice Over DoorLoop',
      points: [
        'Free for up to 2 units — no credit card required',
        'Premium plan at $14.99/mo — unlimited units, LeaseShield, Percy Pilot features, priority support',
        'Save 15% with annual billing',
        'Focused on essential features without unnecessary bloat',
        'Real-time updates without page refreshing',
        'No minimum unit requirements—perfect for solo landlords',
        'Simpler, more intuitive interface',
        'Faster setup and easier onboarding',
        'Percy Pilot features with new capabilities coming soon',
        'Designed specifically for solo landlords and growing portfolios'
      ]
    },
    heroDescription: 'Property Peace and DoorLoop are both property management tools, but they serve different needs. While DoorLoop offers a comprehensive feature set, Property Peace focuses on what solo landlords and growing portfolios actually need—essential features without the bloat. Whether you\'re a solo landlord just starting out or growing your portfolio, Property Peace adapts to your needs without overwhelming you with features you\'ll never use.'
  },
  'brownstone-hub-vs-appfolio': {
    competitorName: 'AppFolio',
    competitorSlug: 'appfolio',
    title: 'AppFolio Alternative for Small Landlords',
    description: 'Compare Property Peace with AppFolio. Property Peace is built for small landlords with 1–50 units who want simple pricing, clean workflows, rent tools, maintenance tracking, leases, and reports.',
    metaKeywords: 'Property Peace vs AppFolio, AppFolio alternative, property management software comparison, AppFolio vs Property Peace, affordable property management software, solo landlord property management, growing portfolio management',
    canonical: 'https://propertypeace.io/comparison/brownstone-hub-vs-appfolio',
    competitorFeatures: [
      { name: 'Real-Time Updates (SignalR)', brownstone: true, competitor: false },
      { name: 'All-in-One Dashboard', brownstone: true, competitor: true },
      { name: 'Rent Ledger and Reminders', brownstone: true, competitor: true },
      { name: 'Lease Document Management', brownstone: true, competitor: true },
      { name: 'Digital Rental Applications', brownstone: true, competitor: true },
      { name: 'Maintenance Request Tracking', brownstone: true, competitor: true },
      { name: 'Tenant Portal', brownstone: true, competitor: true },
      { name: 'Financial Reporting & Analytics', brownstone: true, competitor: true },
      { name: 'Expense Tracking', brownstone: true, competitor: true },
      { name: 'AI Assistant Pilot', brownstone: true, competitor: false },
      { name: 'Multi-Channel Notifications', brownstone: true, competitor: true },
      { name: 'Cloud Document Management', brownstone: true, competitor: true },
      { name: 'Automated Workflows', brownstone: true, competitor: true },
      { name: 'Google Maps Integration', brownstone: true, competitor: false },
      { name: 'Online Payment Processing (not currently available)', brownstone: false, competitor: true },
      { name: 'Mobile Responsive Design', brownstone: true, competitor: true },
      { name: 'Free tier (up to 2 units)', brownstone: true, competitor: false },
      { name: 'No Per-Unit Fees', brownstone: true, competitor: false },
      { name: 'No Minimum Unit Requirements', brownstone: true, competitor: false },
      { name: 'Personalized Customer Support', brownstone: true, competitor: false },
      { name: 'Real-Time Communication', brownstone: true, competitor: false }
    ],
    brownstoneAdvantages: [
      {
        title: 'Perfect for Solo Landlords and Growing Portfolios',
        description: 'Property Peace is free for up to 2 units. Premium is $14.99/mo with no per-unit fees — rent collection, financial reports, LeaseShield, Percy Pilot features, and more. AppFolio is designed for larger portfolios and can cost significantly more, often requiring minimum unit counts.'
      },
      {
        title: 'Real-Time Technology',
        description: 'Property Peace uses SignalR for instant, real-time updates across all features. AppFolio relies on traditional page refreshes, making Property Peace more responsive and efficient for solo landlords managing multiple tasks.'
      },
      {
        title: 'Free tier for small portfolios',
        description: 'Property Peace is free for up to 2 units — no credit card required. Premium is $14.99/mo for unlimited units and all features. AppFolio typically offers limited demos or requires commitments upfront, with no free option for small landlords.'
      },
      {
        title: 'Built for Solo Landlords and Growing Portfolios',
        description: 'Property Peace is specifically designed for solo landlords and growing portfolios. It scales with you from one property to many, without overwhelming complexity. AppFolio is enterprise-focused and may be overkill with features you don\'t need, plus higher costs that don\'t make sense for solo landlords.'
      },
      {
        title: 'No Minimum Unit Requirements',
        description: 'Start with just one property and scale as you grow your portfolio. Perfect for solo landlords who are just starting out. AppFolio often requires minimum unit counts, making it inaccessible for solo landlords.'
      },
      {
        title: 'More Personalized Support',
        description: 'Property Peace provides personalized customer support for all users, including solo landlords. AppFolio\'s support is often tiered, with better support reserved for larger accounts, leaving solo landlords with less attention.'
      },
      {
        title: 'Simpler, More Focused Feature Set',
        description: 'Property Peace focuses on essential property management features without overwhelming complexity. Perfect for solo landlords who need powerful tools without a steep learning curve. AppFolio\'s extensive feature set can be complex and difficult to navigate for smaller operations.'
      },
      {
        title: 'Faster Setup and Onboarding',
        description: 'Get up and running quickly with Property Peace\'s streamlined setup. Solo landlords can start managing properties in minutes, not days. AppFolio\'s comprehensive platform requires more time to configure and learn.'
      },
      {
        title: 'Percy Pilot Features with More Coming Soon',
        description: 'Property Peace includes Percy Pilot features to streamline your property management workflow. We\'re actively developing new Percy capabilities that will be released soon, ensuring solo landlords and growing portfolios stay ahead with cutting-edge technology.'
      }
    ],
    pricingComparison: {
      brownstone: {
        startingPrice: 'Free — up to 2 units',
        description: 'Premium from $14.99/mo · Save 15% annually',
        features: [
          'Free forever for up to 2 units',
          'Premium: $14.99/mo — unlimited units, all features included',
          'No per-unit fees',
          'Cancel anytime'
        ]
      },
      competitor: {
        startingPrice: 'Varies by portfolio size',
        description: 'Enterprise-focused pricing with minimum requirements',
        features: [
          'Designed for larger portfolios (50+ units)',
          'May require minimum unit counts',
          'Higher pricing for smaller portfolios',
          'Enterprise-focused features',
          'Can be expensive for small landlords'
        ]
      }
    },
    whyChooseUs: {
      title: 'Why Property Peace is the Better Choice Over AppFolio',
      points: [
        'Free for up to 2 units — no credit card required',
        'Premium plan at $14.99/mo — unlimited units, LeaseShield, Percy Pilot features, priority support',
        'Save 15% with annual billing',
        'Real-time updates without page refreshing',
        'No minimum unit requirements—perfect for solo landlords',
        'Designed specifically for solo landlords and growing portfolios',
        'Simpler, more focused feature set without overwhelming complexity',
        'Faster setup and easier onboarding',
        'More personalized customer support',
        'Percy Pilot features with new capabilities coming soon'
      ]
    },
    heroDescription: 'Property Peace and AppFolio are powerful property management tools. While AppFolio offers strong features geared toward larger portfolios and enterprise operations, Property Peace shines overall with its user-friendly interface, simple flat pricing, and advanced automation to help you simplify everyday property management. Whether you\'re a solo landlord just starting out or growing your portfolio, Property Peace adapts to your needs without being too large or complex.'
  }
};

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comparison = comparisonData[slug];

  if (!comparison) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div>
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center text-[#217eff] mb-8 hover:text-primary-main transition-colors"
            style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
          >
            <FiArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-main mb-6"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Property Peace vs. {comparison.competitorName}: Which Platform is the Smartest for Your Rentals?
            </h1>
            <p
              className="text-lg md:text-xl text-[#737373] max-w-4xl mx-auto leading-relaxed"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              {comparison.heroDescription}
            </p>
          </div>

          {/* Pricing Comparison */}
          <div className="mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main text-center mb-8"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Price Starting From
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Property Peace Pricing */}
              <div className="bg-white border-2 border-[#217eff] rounded-[20px] p-6 md:p-8 shadow-lg">
                <h3
                  className="text-2xl font-bold text-[#217eff] mb-4"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  Property Peace
                </h3>
                <div className="text-3xl md:text-4xl font-bold text-primary-main mb-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  {comparison.pricingComparison.brownstone.startingPrice}
                </div>
                <p className="text-base text-[#737373] mb-6" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {comparison.pricingComparison.brownstone.description}
                </p>
                <ul className="space-y-2 mb-6">
                  {comparison.pricingComparison.brownstone.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FiCheck className="w-5 h-5 text-[#217eff] mt-0.5 flex-shrink-0" />
                      <span className="text-base text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="https://app.propertypeace.io/register"
                  className="block w-full rounded-none bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-center font-semibold text-white transition-all duration-300 hover:from-green-600 hover:to-green-700 hover:shadow-[0_10px_24px_rgba(34,197,94,0.25)]"
                  style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
                >
                  Get started free
                </Link>
              </div>

              {/* Competitor Pricing */}
              <div className="bg-white border border-[#E5E5E5] rounded-[20px] p-6 md:p-8">
                <h3
                  className="text-2xl font-bold text-primary-main mb-4"
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                >
                  {comparison.competitorName}
                </h3>
                <div className="text-3xl md:text-4xl font-bold text-primary-main mb-4" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  {comparison.pricingComparison.competitor.startingPrice}
                </div>
                <p className="text-base text-[#737373] mb-6" style={{ fontFamily: '"Inter", sans-serif' }}>
                  {comparison.pricingComparison.competitor.description}
                </p>
                <ul className="space-y-2">
                  {comparison.pricingComparison.competitor.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-base text-[#737373]" style={{ fontFamily: '"Inter", sans-serif' }}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main text-center mb-8"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Compare the Features
            </h2>
            <div className="bg-white border border-[#E5E5E5] rounded-[20px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F5F5] border-b border-[#E5E5E5]">
                      <th className="text-left p-4 font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>Feature</th>
                      <th className="text-center p-4 font-bold text-[#217eff]" style={{ fontFamily: '"Poppins", sans-serif' }}>Property Peace</th>
                      <th className="text-center p-4 font-bold text-primary-main" style={{ fontFamily: '"Poppins", sans-serif' }}>{comparison.competitorName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.competitorFeatures.map((feature, index) => (
                      <tr key={index} className={`border-b border-[#E5E5E5] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F5]'}`}>
                        <td className="p-4 font-semibold text-primary-main" style={{ fontFamily: '"Inter", sans-serif' }}>{feature.name}</td>
                        <td className="p-4 text-center">
                          {feature.brownstone ? (
                            <FiCheck className="w-6 h-6 text-[#217eff] mx-auto" />
                          ) : (
                            <FiX className="w-6 h-6 text-[#737373] mx-auto" />
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {feature.competitor ? (
                            <FiCheck className="w-6 h-6 text-[#737373] mx-auto" />
                          ) : (
                            <FiX className="w-6 h-6 text-[#737373] mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Advantages Section */}
          <div className="mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main text-center mb-8"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              What Makes Property Peace Stand Out?
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {comparison.brownstoneAdvantages.slice(0, 4).map((advantage, index) => (
                <div key={index} className="bg-white border border-[#E5E5E5] rounded-[20px] p-6 md:p-8">
                  <div className="flex items-start gap-3 mb-4">
                    <FiCheck className="w-6 h-6 text-[#217eff] mt-0.5 flex-shrink-0" />
                    <h3
                      className="text-xl font-bold text-primary-main"
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                    >
                      {advantage.title}
                    </h3>
                  </div>
                  <p
                    className="text-base text-[#737373] leading-relaxed"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    {advantage.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Why Choose Us */}
          <div className="bg-[#F5F5F5] rounded-[20px] p-8 md:p-12 border border-[#E5E5E5] mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-primary-main text-center mb-8"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              {comparison.whyChooseUs.title}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {comparison.whyChooseUs.points.map((point, index) => (
                <div key={index} className="flex items-start gap-3">
                  <FiCheck className="w-5 h-5 text-[#217eff] mt-0.5 flex-shrink-0" />
                  <p
                    className="text-base text-[#737373] leading-relaxed"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-primary-main rounded-[20px] p-8 md:p-12 text-center text-white">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4 text-white"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Ready to Make the Switch?
            </h2>
            <p
              className="text-lg md:text-xl mb-8 max-w-2xl mx-auto text-white/90"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              Get started today. Whether you're a solo landlord or growing your portfolio, Property Peace adapts to your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://app.propertypeace.io/register"
                className="px-8 py-3 bg-white text-primary-main rounded-none font-semibold transition-all duration-300 hover:bg-white/90 flex items-center justify-center space-x-2"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                <span>Get Started</span>
                <FiArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/features"
                className="px-8 py-3 bg-transparent text-white border-2 border-white rounded-none font-semibold transition-all duration-300 hover:bg-white hover:text-primary-main flex items-center justify-center space-x-2"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                <span>View All Features</span>
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
