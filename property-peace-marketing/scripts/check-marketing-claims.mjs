import { readFile, readdir } from 'node:fs/promises';

const checks = [
  ['app/help-center/page.tsx', /collect rent|Core features are free|integrates with Stripe|credit cards or bank transfers|supports unlimited properties and units|available 24\/7 for urgent inquiries/i],
  ['app/rental-management-software/page.tsx', /online rent collection|collect rent online|digital lease management and signing/i],
  ['app/property-management-app/page.tsx', /online rent collection|payments are received/i],
  ['components/Marketing/FeatureHeroMock.tsx', /Use DocuSign|Envelope sent|DocuSign envelope|Track signature progress/i],
  ['app/blog/[slug]/page.tsx', /accept online payments/i],
  ['app/blog/BlogPageClient.tsx', /helps independent landlords collect rent/i],
  ['app/lease/ai-lease-creation/page.tsx', /Connection to DocuSign|Send leases for e-signature|connects lease creation with digital signing/i],
  ['lib/blog-posts.ts', /How Property Peace Helps With Digital Rent Payments|With Property Peace[\s\S]{0,500}Online rent collection workflows/i],
  ['lib/blog-posts.ts', /Property Peace includes all 10 essential features|our \[integrated payment processing\]|Property Peace's automated payment system|Start collecting rent online today|including \[online rent collection\][\s\S]{0,120}\[tenant screening tools\]/i],
  ['components/Marketing/FeatureHeroMock.tsx', /label: 'Payment link'|Link generated|Stripe payments|Card\/ACH|status: 'Webhook'|Receipt', value: '(?:Auto|Sent)'|payments update rent tracking automatically/i],
  ['lib/otto-seo.ts', /Property Peace AI|Property Peace's AI|and Percy-assisted portfolio summaries\.|AI-powered efficiency|see how AI simplifies|AI categorizes/i],

  ['app/blog/[slug]/layout.tsx', /\.match\(\/rent\|payment\/i\)|availabilityNote/i],
  ['components/Sections/Hero.tsx', /Percy Pilot lease administration/i],
  ['components/Sections/PricingPlans.tsx', /['"]Percy-powered features['"]/i],
  ['lib/blog-posts.ts', /Real-time updates across all features/i],
  ['lib/otto-seo.ts', /#1 free rental management software|24\/7 support/i],
  ['app/page.tsx', /#1 free rental management software/i],
  ['app/free-landlord-software/page.tsx', /#1 free rental management software/i],
  ['lib/blog-posts.ts', /Property Peace offers the best combination of features, affordability, and ease of use|top choice for landlords|best choice for solo landlords/i],
  ['app/help-center/page.tsx', /24\/7|30 seconds/i],
  ['app/contact-us/page.tsx', /24\/7|around the clock|respond within 24 hours/i],
  ['components/Sections/PricingPlans.tsx', /Most popular|Priority support/i],

  ['scripts/generate-sitemap.mjs', /brownstone-hub-vs-(?:buildium|doorloop|appfolio)/i],
  ['scripts/generate-sitemap.js', /brownstone-hub-vs-(?:buildium|doorloop|appfolio)/i],
];

const required = [
  ['components/Sections/PricingPlans.tsx', /Online rent payments \(approval required\)/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Free Plan for Small Portfolios'[\s\S]{0,600}Online rent payments \(approval required\)/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Premium'[\s\S]{0,900}one dedicated organization SMS number included with Premium/i],
  ['app/privacy/page.tsx', /approved organizations[\s\S]{0,300}Stripe processes payment[\s\S]{0,300}provider identifiers, status, and ledger records[\s\S]{0,180}not raw bank\/card credentials/i],
  ['lib/otto-seo.ts', /Online rent payments are included with Free[\s\S]{0,180}request access[\s\S]{0,180}secure payment setup/i],
  ['components/Sections/FeaturesSection.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['components/Marketing/FeatureHeroMock.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/small-landlord-tools/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/rental-management-software/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/rent-collection-software-for-landlords/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/landlord-software/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/features/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/blog/[slug]/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/property-management-app/page.tsx', /Online rent payments are included with Free[\s\S]{0,180}request access/i],
  ['app/comparison/turbotenant/page.tsx', /checkedOn = 'August 11, 2026'/i],
  ['app/comparison/turbotenant/page.tsx', /dateModified: '2026-08-11'/i],
  ['app/comparison/turbotenant/page.tsx', /Free[^\r\n]{0,80}\$0[^\r\n]{0,80}5 total units/i],
  ['app/comparison/turbotenant/page.tsx', /Premium[^\r\n]{0,80}\$14\.99[^\r\n]{0,80}month/i],
  ['app/comparison/turbotenant/page.tsx', /Essentials[^\r\n]{0,100}\$12\.42[^\r\n]{0,100}billed annually at \$149/i],
  ['app/comparison/turbotenant/page.tsx', /Pro[^\r\n]{0,100}\$16\.58[^\r\n]{0,100}billed annually at \$199/i],
  ['app/comparison/turbotenant/page.tsx', /Landlord subscription/i],
  ['app/comparison/turbotenant/page.tsx', /Applicant screening/i],
  ['app/comparison/turbotenant/page.tsx', /ACH rent payment/i],
  ['app/comparison/turbotenant/page.tsx', /Card rent payment/i],
  ['app/comparison/turbotenant/page.tsx', /Integrated e-signature/i],
  ['app/comparison/turbotenant/page.tsx', /SMS messaging/i],
  ['app/comparison/turbotenant/page.tsx', /Optional add-ons/i],
  ['app/comparison/turbotenant/page.tsx', /Renter costs/i],
  ['app/comparison/turbotenant/page.tsx', /Billing cadence/i],
  ['app/comparison/turbotenant/page.tsx', /Who pays/i],
  ['app/comparison/turbotenant/page.tsx', /Readiness \/ caveat/i],
  ['app/comparison/turbotenant/page.tsx', /Online rent processing[^\r\n]{0,160}suspended/i],
  ['app/comparison/turbotenant/page.tsx', /SMS messaging[\s\S]{0,700}active configured number/i],
  ['app/comparison/turbotenant/page.tsx', /https:\/\/www\.turbotenant\.com\/pricing\//i],
  ['app/lease/e-sign-docusign/page.tsx', /not currently available/i],
  ['app/listings/page.tsx', /does not currently syndicate/i],
  ['app/features/[slug]/page.tsx', /does not currently provide credit, criminal, eviction/i],
  ['components/Sections/PricingPlans.tsx', /Percy Pilot/i],

  ['lib/otto-seo.ts', /limited Percy Pilot/i],
  ['components/Sections/Hero.tsx', /Percy-assisted tools, currently in limited pilot/i],

  ['app/privacy/page.tsx', /<li><strong>DocuSign<\/strong>[\s\S]{0,300}only if and when integrated digital lease signing is operationally enabled[\s\S]{0,150}currently unavailable[\s\S]{0,100}<\/li>/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Free Plan for Small Portfolios'[\s\S]{0,250}'Up to 5 units'/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Premium'[\s\S]{0,120}monthlyPrice: 14\.99[\s\S]{0,120}annualTotal: 152\.90/i],
  ['components/Sections/PricingPlans.tsx', /one dedicated organization SMS number included with Premium[\s\S]{0,120}activation and configuration required/i],
  ['app/blog/[slug]/page.tsx', /const editorial = getArticleEditorial\(post\.slug\);[\s\S]*if \(!post \|\| !editorial\) notFound\(\)/i],
  ['app/blog/page.tsx', /getAllBlogPosts\(\)\s*\.filter\(\(post\) => getArticleEditorial\(post\.slug\)\)\s*\.map\(\(\{ slug, title, description, date, author, category \}\)/i],
  ['scripts/generate-sitemap.mjs', /const blogSlugs = \[[\s\S]*landlord-move-in-move-out-checklist[\s\S]*rental-property-cash-flow-template-landlords[\s\S]*landlord-maintenance-checklist-prevent-costly-repairs[\s\S]*\];/i],

  ['lib/blog-posts.ts', /Current records across supported property-management workflows/i],
];


const claimSurfaceFiles = [
  'components/Sections/PricingPlans.tsx',
  'lib/otto-seo.ts',
  'components/Sections/FeaturesSection.tsx',
  'components/Marketing/FeatureHeroMock.tsx',
  'app/small-landlord-tools/page.tsx',
  'app/rental-management-software/page.tsx',
  'app/rent-collection-software-for-landlords/page.tsx',
  'app/landlord-software/page.tsx',
  'app/features/page.tsx',
  'app/blog/[slug]/page.tsx',
  'app/property-management-app/page.tsx',
];
const forbiddenClaims = /autopay|instant payout|credit reporting|autonomous AI|guaranteed approval|bypass(?:ed|ing)? verification|online (?:payment|rent) processing[^.]{0,80}currently unavailable|online payments roadmap/i;
for (const file of claimSurfaceFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (forbiddenClaims.test(source)) failures.push(`${file}: stale or unsupported rent-payment claim`);
}
const failures = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out') return [];
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

for (const [file, pattern] of checks) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (pattern.test(source)) failures.push(`${file}: unsupported active claim matches ${pattern}`);
}
for (const [file, pattern] of required) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!pattern.test(source)) failures.push(`${file}: missing availability disclosure matching ${pattern}`);
}

const blogIndexClient = await readFile(new URL('../app/blog/BlogPageClient.tsx', import.meta.url), 'utf8');
if (/['"]@\/lib\/(?:blog-posts|article-editorial)['"]/.test(blogIndexClient)) {
  failures.push('app/blog/BlogPageClient.tsx: public client bundle must not import the full unpublished article corpus or editorial registry');
}

// Keep the Free card useful and concrete. Scope these checks to the Free object so a Premium
// bullet cannot accidentally satisfy the permanent-Free packaging contract.
const pricing = await readFile(new URL('../components/Sections/PricingPlans.tsx', import.meta.url), 'utf8');
const freePlan = pricing.match(/name: 'Free Plan for Small Portfolios'([\s\S]*?)\n\s*},\r?\n\s*{\r?\n\s*name: 'Premium'/)?.[1];
if (!freePlan) {
  failures.push('components/Sections/PricingPlans.tsx: unable to isolate Free pricing card');
} else {
  const freeRequirements = [
    /monthlyPrice: 0/,
    /annualTotal: 0/,
    /no credit card required/i,
    /Up to 5 units/i,
    /Hosted Property Peace listing page/i,
    /Lead management & showing scheduling/i,
    /Digital rental applications/i,
    /Tenant portal/i,
    /Maintenance request tracking/i,
    /Lease management/i,
    /Basic rent & expense tracking/i,
    /Document storage/i,
    /Start for free/i,
  ];
  for (const requirement of freeRequirements) {
    if (!requirement.test(freePlan)) {
      failures.push(`components/Sections/PricingPlans.tsx: Free card is missing contract item ${requirement}`);
    }
  }
  if (/(?:online rent collection|tenant screening|e-signature|SMS|Percy)/i.test(freePlan)) {
    failures.push('components/Sections/PricingPlans.tsx: Free card must not imply unavailable or Premium-only integrations');
  }
  if (/external listing/i.test(freePlan) && !/external listing \(coming soon\)/i.test(freePlan)) {
    failures.push('components/Sections/PricingPlans.tsx: external listing on Free must remain explicitly labeled coming soon');
  }
}

for (const file of await sourceFiles(new URL('../', import.meta.url))) {
  const source = await readFile(file, 'utf8');
  if (/Lifetime/i.test(source)) {
    failures.push(`${file.pathname}: Lifetime is an internal entitlement and must remain absent from public marketing`);
  }
  if (/no hidden renter fees/i.test(source)) {
    failures.push(`${file.pathname}: do not claim no hidden renter fees; disclose stakeholder costs instead`);
  }
  if (/no setup costs/i.test(source)) {
    failures.push(`${file.pathname}: do not claim no setup costs without explicit billing evidence`);
  }
  if (/Percy(?:-powered| AI)/i.test(source)) {
    failures.push(`${file.pathname}: Percy availability must be labeled as a Pilot`);
  }
  if (/free 30-day trial|30-day free trial|start free trial/i.test(source)) {
    failures.push(`${file.pathname}: Property Peace public CTA must say Start Free / Free up to 5 units, not a trial`);
  }
}

const resourceLibrary = await readFile(new URL('../lib/resource-library.ts', import.meta.url), 'utf8');
for (const unpublishedSlug of [
  'how-to-screen-tenants-complete-guide',
  'how-to-write-lease-agreement-landlord-guide',
  'streamline-rent-collection-property-management-software',
  'manage-multiple-rental-properties',
  'how-to-handle-maintenance-requests-like-pro',
  'property-management-software-vs-spreadsheets',
]) {
  if (resourceLibrary.includes(`slug: '${unpublishedSlug}'`)) {
    failures.push(`lib/resource-library.ts: unpublished article ${unpublishedSlug} must not be publicly discoverable`);
  }
}


const turboTenantComparison = await readFile(new URL('../app/comparison/turbotenant/page.tsx', import.meta.url), 'utf8');
if (/\$16\.48/.test(turboTenantComparison)) {
  failures.push('app/comparison/turbotenant/page.tsx: stale TurboTenant Pro price $16.48 must not return');
}

if (/No hidden fees/i.test(pricing)) {
  failures.push('components/Sections/PricingPlans.tsx: avoid an unqualified no-hidden-fees claim; state the concrete pricing boundary instead');
}

const smsClaims = [
  'app/features/page.tsx',
  'app/features/[slug]/page.tsx',
  'components/Sections/MaintenanceCommunication.tsx',
  'components/Marketing/RentCollectionHeroMock.tsx',
  'components/Marketing/FeatureHeroMock.tsx',
];
for (const file of smsClaims) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (/SMS/i.test(source) && (!/(?:one|1) (?:dedicated organization )?SMS number[^\r\n]{0,100}include|include[^\r\n]{0,100}(?:one|1) (?:dedicated organization )?(?:number|SMS number)/i.test(source) || !/activation and configuration (?:are )?required/i.test(source))) {
    failures.push(`${file}: SMS claims must disclose one included eligible-plan number and required activation/configuration`);
  }
  if (/SMS[^\r\n]{0,100}(?:paid )?add-on|(?:paid )?add-on[^\r\n]{0,100}SMS/i.test(source)) {
    failures.push(`${file}: SMS must not be described as a separate paid add-on`);
  }
}

for (const artifact of ['public/sitemap.xml', 'public/rss.xml']) {
  const content = await readFile(new URL(`../${artifact}`, import.meta.url), 'utf8');
  if (/property-management-software-vs-spreadsheets|top-10-property-management-software-2024/i.test(content)) {
    failures.push(`${artifact}: unpublished, unreviewed blog URL is still advertised`);
  }
}

if (failures.length) {
  console.error('Marketing claim regression check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Marketing claim regression check passed (${checks.length + required.length} assertions).`);
