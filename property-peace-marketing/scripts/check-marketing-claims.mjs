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
  ['components/Marketing/FeatureHeroMock.tsx', /Online payment processing[\s\S]{0,80}not currently available/i],
  ['lib/otto-seo.ts', /limited Percy Pilot/i],
  ['components/Sections/Hero.tsx', /Percy-assisted tools, currently in limited pilot/i],
  ['app/privacy/page.tsx', /<li><strong>Stripe<\/strong>[\s\S]{0,300}only if and when online rent processing is operationally enabled[\s\S]{0,150}currently unavailable[\s\S]{0,100}<\/li>/i],
  ['app/privacy/page.tsx', /<li><strong>DocuSign<\/strong>[\s\S]{0,300}only if and when integrated digital lease signing is operationally enabled[\s\S]{0,150}currently unavailable[\s\S]{0,100}<\/li>/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Free Plan for Small Portfolios'[\s\S]{0,250}'Up to 5 units'/i],
  ['components/Sections/PricingPlans.tsx', /name: 'Premium'[\s\S]{0,120}monthlyPrice: 14\.99[\s\S]{0,120}annualTotal: 152\.90/i],
  ['components/Sections/PricingPlans.tsx', /one dedicated organization SMS number included with Premium[\s\S]{0,120}activation and configuration required/i],
  ['app/blog/[slug]/page.tsx', /const editorial = getArticleEditorial\(post\.slug\);[\s\S]*if \(!post \|\| !editorial\) notFound\(\)/i],
  ['app/blog/page.tsx', /getAllBlogPosts\(\)\s*\.filter\(\(post\) => getArticleEditorial\(post\.slug\)\)\s*\.map\(\(\{ slug, title, description, date, author, category \}\)/i],
  ['scripts/generate-sitemap.mjs', /const blogSlugs = \[[\s\S]*landlord-move-in-move-out-checklist[\s\S]*rental-property-cash-flow-template-landlords[\s\S]*landlord-maintenance-checklist-prevent-costly-repairs[\s\S]*\];/i],

  ['lib/blog-posts.ts', /Current records across supported property-management workflows/i],
];

const failures = [];

// Homepage repositioning contract. These requirements intentionally lead the copy change: keep
// Percy positioned as an assistant, and make landlord review/control explicit before launch.
const homepagePositioningRequired = [
  [/AI property assistant/i, 'approved AI property assistant positioning'],
  [
    /(?:\bPercy\b[^.!?]{0,160}\b(?:you|landlords?)\b[^.!?]{0,80}\b(?:review|approv\w*|remain in control|stay in control)\b|\b(?:you|landlords?)\b[^.!?]{0,80}\b(?:review|approv\w*|control)\b[^.!?]{0,160}\bPercy(?:'s)?\b)/i,
    'clear Percy-specific sentence establishing landlord review or control',
  ],
];

function withoutComments(source) {
  return source.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
}

function hasUnnegatedMatch(source, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  for (const match of source.matchAll(matcher)) {
    // A negator must govern the matched phrase in the same short clause. This accepts truthful
    // copy such as "is not a replacement" / "isn't a replacement" without allowing contrastive
    // claims such as "is not only a replacement" or a negation in an earlier clause.
    const prefix = source.slice(Math.max(0, match.index - 120), match.index);
    const clause = prefix.slice(Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf('!'), prefix.lastIndexOf('?'), prefix.lastIndexOf(';')) + 1);
    const negators = [...clause.matchAll(/\b(?:never|cannot|(?:does|do|did|is|are|was|were|will|would|can|could|should|has|have|had)\s+not|(?:doesn|don|didn|isn|aren|wasn|weren|won|wouldn|can|couldn|shouldn|hasn|haven|hadn)['’]t)\b/gi)];
    const negator = negators.at(-1);
    if (!negator) return true;
    const gap = clause.slice(negator.index + negator[0].length);
    const words = gap.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) ?? [];
    const breaksNegation = /\b(?:only|just|merely|because|although|though|but|yet|however|unless|unable|incapable)\b|\b(?:and|or)\s+(?:it\s+)?(?:does|is|are|will|can)\b/i.test(gap);
    if (words.length > 6 || breaksNegation || /[,():{}]|=>|&&|\|\|/.test(gap)) return true;
  }
  return false;
}

function parseLocalImports(source) {
  const imports = [];
  for (const match of source.matchAll(/\bimport\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, clause, specifier] = match;
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const bindings = [];
    const defaultBinding = clause.match(/^\s*([A-Za-z_$][\w$]*)/);
    if (defaultBinding) bindings.push({ local: defaultBinding[1], imported: 'default' });
    const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespace) bindings.push({ local: namespace[1], imported: '*' });
    const named = clause.match(/\{([\s\S]*?)\}/)?.[1] ?? '';
    for (const item of named.split(',')) {
      const binding = item.trim().replace(/^type\s+/, '').match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (binding) bindings.push({ imported: binding[1], local: binding[2] ?? binding[1] });
    }
    imports.push({ specifier, bindings });
  }
  return imports;
}

function mountedImportRequests(source) {
  const requests = [];
  for (const imported of parseLocalImports(source)) {
    const names = new Set();
    for (const binding of imported.bindings) {
      if (binding.imported === '*') {
        for (const match of source.matchAll(new RegExp(`<${binding.local}\\.([A-Z][\\w$]*)\\b`, 'g'))) names.add(match[1]);
      } else if (new RegExp(`<${binding.local}\\b`).test(source)) {
        names.add(binding.imported);
      }
    }
    if (names.size) requests.push({ specifier: imported.specifier, names });
  }
  return requests;
}

async function resolveLocalImport(specifier, importer) {
  const base = specifier.startsWith('@/') ? new URL(`../${specifier.slice(2)}`, import.meta.url) : new URL(specifier, importer);
  for (const suffix of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']) {
    const candidate = new URL(`${base.href}${suffix}`);
    try {
      await readFile(candidate, 'utf8');
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
    }
  }
  return undefined;
}

function reexportRequests(source, requestedNames) {
  const requests = [];
  for (const match of source.matchAll(/\bexport\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = new Set();
    for (const item of match[1].split(',')) {
      const binding = item.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (binding && requestedNames.has(binding[2] ?? binding[1])) names.add(binding[1]);
    }
    if (names.size) requests.push({ specifier: match[2], names });
  }
  for (const match of source.matchAll(/\bexport\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    requests.push({ specifier: match[1], names: new Set(requestedNames) });
  }

  // Also support the common two-step barrel form: import Foo from './Foo'; export { Foo }.
  const locallyExported = new Set();
  for (const match of source.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)) {
    for (const item of match[1].split(',')) {
      const binding = item.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (binding && requestedNames.has(binding[2] ?? binding[1])) locallyExported.add(binding[1]);
    }
  }
  for (const imported of parseLocalImports(source)) {
    const names = new Set(imported.bindings.filter(({ local }) => locallyExported.has(local)).map(({ imported: name }) => name));
    if (names.size) requests.push({ specifier: imported.specifier, names });
  }
  return requests;
}

async function renderedComponentSources(entry) {
  const visited = new Map();
  const traversedExports = new Map();
  async function visit(file, requestedNames = new Set(['default'])) {
    const alreadyRequested = traversedExports.get(file.href) ?? new Set();
    const newNames = new Set([...requestedNames].filter((name) => !alreadyRequested.has(name)));
    if (!newNames.size) return;
    traversedExports.set(file.href, new Set([...alreadyRequested, ...newNames]));
    let source = visited.get(file.href);
    if (source === undefined) {
      source = withoutComments(await readFile(file, 'utf8'));
      visited.set(file.href, source);
    }
    const requests = [...mountedImportRequests(source), ...reexportRequests(source, newNames)];
    for (const request of requests) {
      const dependency = await resolveLocalImport(request.specifier, file);
      if (dependency) await visit(dependency, request.names);
    }
  }
  await visit(entry);
  const root = new URL('../', import.meta.url).pathname;
  return [...visited].map(([href, source]) => [new URL(href).pathname.replace(root, ''), source]);
}

// Dependency-free fixtures keep the bounded parser and negation semantics from silently regressing.
const traversalFixture = mountedImportRequests(`
  import DefaultCard from './default-card';
  import { NamedCard as RenamedCard, UnusedCard } from './cards';
  import * as Sections from './sections';
  <DefaultCard /><RenamedCard /><Sections.NamespaceCard />
`);
const traversalFixtureResult = traversalFixture.map(({ specifier, names }) => [specifier, [...names].sort()]);
const expectedTraversalFixture = [
  ['./default-card', ['default']],
  ['./cards', ['NamedCard']],
  ['./sections', ['NamespaceCard']],
];
if (JSON.stringify(traversalFixtureResult) !== JSON.stringify(expectedTraversalFixture)) {
  failures.push('internal import-traversal fixture failed for mounted default, named, or namespace imports');
}
const barrelFixture = reexportRequests(`
  export { default as DirectCard, NamedCard as RenamedCard, UnusedCard } from './direct';
  export * from './star';
  import ImportedCard from './two-step';
  export { ImportedCard, OtherCard };
`, new Set(['DirectCard', 'RenamedCard', 'StarCard', 'ImportedCard']));
const barrelFixtureResult = barrelFixture.map(({ specifier, names }) => [specifier, [...names].sort()]);
const expectedBarrelFixture = [
  ['./direct', ['NamedCard', 'default']],
  ['./star', ['DirectCard', 'ImportedCard', 'RenamedCard', 'StarCard']],
  ['./two-step', ['default']],
];
if (JSON.stringify(barrelFixtureResult) !== JSON.stringify(expectedBarrelFixture)) {
  failures.push('internal import-traversal fixture failed for direct, star, or two-step barrel re-exports');
}
const replacementClaim = /replacement for (?:a |the )?property manager/i;
for (const compliant of [
  'Percy is not a replacement for a property manager.',
  "Percy isn't a replacement for a property manager.",
  "Percy isn’t a replacement for a property manager.",
  "Percy and its tools aren't a replacement for a property manager.",
]) {
  if (hasUnnegatedMatch(compliant, replacementClaim)) failures.push(`internal negation fixture rejected compliant copy: ${compliant}`);
}
for (const prohibited of [
  'Percy is a replacement for a property manager.',
  'Percy is not only a replacement for a property manager.',
  "Percy isn't limited and is a replacement for a property manager.",
  "Percy isn't limited, so it is a replacement for a property manager.",
]) {
  if (!hasUnnegatedMatch(prohibited, replacementClaim)) failures.push(`internal negation fixture missed prohibited copy: ${prohibited}`);
}

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

// Follow only component imports actually mounted from app/page.tsx. Newly composed homepage
// sections are included automatically, while commented-out and unrelated components are excluded.
const homepageSources = await renderedComponentSources(new URL('../app/page.tsx', import.meta.url));
for (const [pattern, description] of homepagePositioningRequired) {
  if (!homepageSources.some(([, source]) => pattern.test(source))) {
    failures.push(`homepage: missing ${description} matching ${pattern}`);
  }
}

const blogIndexClient = await readFile(new URL('../app/blog/BlogPageClient.tsx', import.meta.url), 'utf8');
if (/['"]@\/lib\/(?:blog-posts|article-editorial)['"]/.test(blogIndexClient)) {
  failures.push('app/blog/BlogPageClient.tsx: public client bundle must not import the full unpublished article corpus or editorial registry');
}

// The JSON contract is shared directly with TypeScript and this dependency-free Node check.
const capabilityContract = JSON.parse(await readFile(new URL('../lib/percy-capabilities.json', import.meta.url), 'utf8'));
const expectedCapabilityStatuses = new Map(Object.entries({
  portfolioBriefings: 'pilot', propertyQuestions: 'pilot', sourceLinkedAnswers: 'pilot',
  tenantCommunicationSummaries: 'pilot', tenantCommunicationDrafts: 'planned',
  maintenanceTriage: 'pilot', maintenanceDrafts: 'planned', leaseDeadlines: 'pilot',
  leaseRenewals: 'unavailable', financialExplanations: 'unavailable', imports: 'unavailable',
  notifications: 'planned', actionApprovalAndExecution: 'planned', providerDependentActions: 'unavailable',
}));
const expectedStatuses = ['available', 'pilot', 'prepareOnly', 'planned', 'unavailable'];
if (JSON.stringify(capabilityContract.statuses) !== JSON.stringify(expectedStatuses)) {
  failures.push('lib/percy-capabilities.json: statuses must exactly match the canonical status set and order');
}
const capabilities = Array.isArray(capabilityContract.capabilities) ? capabilityContract.capabilities : [];
const ids = capabilities.map((capability) => capability?.id);
if (ids.length !== new Set(ids).size) failures.push('lib/percy-capabilities.json: capability IDs must be unique');
if (JSON.stringify([...ids].sort()) !== JSON.stringify([...expectedCapabilityStatuses.keys()].sort())) {
  failures.push('lib/percy-capabilities.json: capability IDs must exactly match the Release-A contract (no omissions or extras)');
}
const forbiddenClaims = Array.isArray(capabilityContract.forbiddenPublicClaims) ? capabilityContract.forbiddenPublicClaims : [];
if (!forbiddenClaims.length) failures.push('lib/percy-capabilities.json: forbiddenPublicClaims must be nonempty');
const compiledForbiddenClaims = [];
for (const claim of forbiddenClaims) {
  if (!claim || typeof claim.description !== 'string' || !claim.description.trim() ||
      typeof claim.pattern !== 'string' || !claim.pattern.trim()) {
    failures.push('lib/percy-capabilities.json: each forbidden public claim needs a nonempty description and pattern');
    continue;
  }
  try {
    compiledForbiddenClaims.push([new RegExp(claim.pattern, 'i'), claim.description]);
  } catch {
    failures.push(`lib/percy-capabilities.json: invalid forbidden public claim regex for ${claim.description}`);
  }
}
for (const capability of capabilities) {
  const label = `lib/percy-capabilities.json: ${String(capability?.id)}`;
  if (expectedCapabilityStatuses.get(capability?.id) !== capability?.status) {
    failures.push(`${label} must retain its expected status ${expectedCapabilityStatuses.get(capability?.id)}`);
  }
  if (typeof capability?.publicLanguage !== 'string' || !capability.publicLanguage.trim()) {
    failures.push(`${label} must define nonempty publicLanguage`);
  }
  if (!Array.isArray(capability?.prohibitedImplications) || !capability.prohibitedImplications.length ||
      capability.prohibitedImplications.some((implication) => typeof implication !== 'string' || !implication.trim()) ||
      new Set(capability.prohibitedImplications).size !== capability.prohibitedImplications.length) {
    failures.push(`${label} must define unique, nonempty prohibitedImplications`);
  }
  const language = capability?.publicLanguage ?? '';
  const qualifier = {
    pilot: /\blimited Percy Pilot\b/i,
    prepareOnly: /\b(?:review|draft|prepare|stage)\w*\b[\s\S]*\b(?:does not|cannot|won't|will not)\b[\s\S]*\b(?:send|execute|change|act)\w*\b/i,
    planned: /\b(?:planned|future|being prepared|coming soon)\b[\s\S]*(?:\b(?:not|does not|cannot|won't)\b|\b(?:today|current(?:ly)?)\b)|(?:\b(?:not|does not|cannot|won't)\b|\b(?:today|current(?:ly)?)\b)[\s\S]*\b(?:planned|future|being prepared|coming soon)\b/i,
    unavailable: /\b(?:not available|unavailable|does not|cannot|not .{0,30}capabilit(?:y|ies)|remain[s]? .{0,30}-run)\b/i,
  }[capability?.status];
  if (qualifier && !qualifier.test(language)) failures.push(`${label} publicLanguage needs a meaningful ${capability.status} qualifier`);
  for (const [pattern, description] of compiledForbiddenClaims) {
    if (hasUnnegatedMatch(language, pattern)) failures.push(`${label} publicLanguage implies forbidden claim: ${description}`);
  }
}
for (const [file, source] of homepageSources) {
  for (const [pattern, description] of compiledForbiddenClaims) {
    if (hasUnnegatedMatch(source, pattern)) failures.push(`homepage (${file}): unsupported ${description} matches ${pattern}`);
  }
  for (const capability of capabilities) {
    for (const implication of capability.prohibitedImplications ?? []) {
      const literal = new RegExp(implication.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (hasUnnegatedMatch(source, literal)) failures.push(`homepage (${file}): prohibited ${capability.id} implication: ${implication}`);
    }
  }
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

console.log('Marketing claim regression check passed.');
