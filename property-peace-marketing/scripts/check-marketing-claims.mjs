import { readFile, readdir } from 'node:fs/promises';

const checks = [
  ['app/help-center/page.tsx', /collect rent|Core features are free|integrates with Stripe|credit cards or bank transfers/i],
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
  ['app/comparison/[slug]/page.tsx', /name: 'Percy Pilot Features', brownstone: true, competitor: true/i],
  ['app/blog/[slug]/layout.tsx', /\.match\(\/rent\|payment\/i\)|availabilityNote/i],
  ['components/Sections/Hero.tsx', /Percy Pilot lease administration/i],
  ['components/Sections/PricingPlans.tsx', /['"]Percy-powered features['"]/i],
];

const required = [
  ['app/lease/e-sign-docusign/page.tsx', /not currently available/i],
  ['app/listings/page.tsx', /does not currently syndicate/i],
  ['app/features/[slug]/page.tsx', /does not currently provide credit, criminal, eviction/i],
  ['components/Sections/PricingPlans.tsx', /Percy Pilot/i],
  ['components/Marketing/FeatureHeroMock.tsx', /Online payment processing[\s\S]{0,80}not currently available/i],
  ['lib/otto-seo.ts', /limited Percy Pilot/i],
  ['components/Sections/Hero.tsx', /Percy-assisted tools, currently in limited pilot/i],
  ['app/privacy/page.tsx', /<li><strong>Stripe<\/strong>[\s\S]{0,300}only if and when online rent processing is operationally enabled[\s\S]{0,150}currently unavailable[\s\S]{0,100}<\/li>/i],
  ['app/privacy/page.tsx', /<li><strong>DocuSign<\/strong>[\s\S]{0,300}only if and when integrated digital lease signing is operationally enabled[\s\S]{0,150}currently unavailable[\s\S]{0,100}<\/li>/i],
];

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

for (const file of await sourceFiles(new URL('../', import.meta.url))) {
  const source = await readFile(file, 'utf8');
  if (/Percy(?:-powered| AI)/i.test(source)) {
    failures.push(`${file.pathname}: Percy availability must be labeled as a Pilot`);
  }
}

if (failures.length) {
  console.error('Marketing claim regression check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Marketing claim regression check passed (${checks.length + required.length} assertions).`);
