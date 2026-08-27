import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outRoot = path.join(projectRoot, 'out');

function readExportedPage(relativePath) {
  return fs.readFileSync(path.join(outRoot, relativePath, 'index.html'), 'utf8');
}

const sharedFeatureHeroRoutes = [
  'lease/ai-lease-creation',
  'lease/e-sign-docusign',
  'lease/online-condition-reports',
  'maintenance/in-app-messaging',
  'rent/accounting',
  'rent/custom-late-fees',
  'rent/expense-tracking',
  'rent/rent-reporting',
];

const featureDetailRoutes = fs
  .readdirSync(path.join(outRoot, 'features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__next'))
  .map((entry) => `features/${entry.name}`);

const cleanHeroRoutes = [
  'comparison/turbotenant',
  'lease-shield/blog',
  'resources',
  'resources/starter-pack',
  ...sharedFeatureHeroRoutes,
  ...featureDetailRoutes,
];

const onePixelDotPattern = /background-image:radial-gradient\(circle,\s*#[0-9a-f]+\s+1px,\s*transparent\s+1px\)/gi;
const startFreeGradient = /background:linear-gradient\(135deg, #22c55e, #16a34a\)/g;

test('marketing page heroes render without decorative one-pixel dot patterns', () => {
  for (const relativePath of cleanHeroRoutes) {
    const html = readExportedPage(relativePath);
    assert.equal(html.match(onePixelDotPattern)?.length ?? 0, 0, `${relativePath} should not render a decorative dot pattern`);
  }
});

test('standalone hero actions use the Start free green gradient', () => {
  const heroActions = [
    ['lease-shield/blog', 'Ask LeaseShield a Question'],
    ['resources', 'Browse resources'],
    ['resources/starter-pack', 'Download all five resources'],
  ];

  for (const [relativePath, actionLabel] of heroActions) {
    const html = readExportedPage(relativePath);
    const actionIndex = html.indexOf(actionLabel);
    assert.notEqual(actionIndex, -1, `${relativePath} should render its primary hero action`);
    const actionMarkup = html.slice(Math.max(0, actionIndex - 600), actionIndex + actionLabel.length);
    assert.ok(startFreeGradient.test(actionMarkup), `${relativePath} should use the Start free gradient for its primary hero action`);
    startFreeGradient.lastIndex = 0;
  }
});
