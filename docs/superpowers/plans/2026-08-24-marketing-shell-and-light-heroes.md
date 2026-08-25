# Marketing Shell and Light Heroes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a taller adaptive marketing navigation that overlays the homepage photograph only while idle at the top, and convert every secondary dark hero to the approved light Property Peace visual system.

**Architecture:** Keep one shared `Navigation` component and isolate its route/interaction decision in a deterministic helper. Mark rendered hero surfaces with explicit semantic attributes so static-export contracts can verify the homepage image treatment and the light secondary-page contract without coupling tests to private React structure.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 3, Node 22 test runner, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-08-24-marketing-shell-and-light-heroes-design.md`

## Global Constraints

- Change only `property-peace-marketing`; do not modify the application or API projects.
- Preserve Poppins display typography and Inter body typography.
- Use navy `#061E35`, body copy `#405A70`, quiet copy `#637083`, canvas `#F7FAFC`, mist `#EAF3F8`, border `#DCE6ED`, and green `#22C55E → #16A34A`.
- The homepage is the only route that may begin with transparent navigation or a full-bleed darkened photograph.
- Desktop navigation height is 88 pixels; mobile navigation height is 72 pixels.
- Decorative dot and grid backgrounds remain prohibited.
- Preserve existing page copy, SEO metadata, footer behavior, and mobile drawer information architecture.
- Preserve the unrelated working-tree change in `property-peace-api/Program.cs`; never stage it.
- Follow test-first development: every production behavior change begins with a test that fails for the expected reason.

## File Structure

- Create `property-peace-marketing/lib/navigation-surface.ts` for the pure navigation-surface decision.
- Create `property-peace-marketing/scripts/navigation-surface.contract.test.mjs` for state-matrix coverage.
- Create `property-peace-marketing/scripts/navigation-render.contract.test.mjs` for exported homepage/secondary navigation and homepage-image contracts.
- Create `property-peace-marketing/scripts/light-hero.contract.test.mjs` for rendered secondary-hero coverage.
- Modify `property-peace-marketing/components/Layout/Navigation.tsx` for route, scroll, pointer, focus, dropdown, and mobile-menu behavior.
- Modify `property-peace-marketing/app/globals.css` for navigation surfaces, dropdown colors, height, transitions, and reduced motion.
- Modify `property-peace-marketing/components/Sections/Hero.tsx` for the homepage marker and lighter image overlay.
- Modify `property-peace-marketing/components/SEO/NicheLandingPage.tsx` for the six shared SEO heroes.
- Modify `property-peace-marketing/components/Marketing/FeatureLandingPage.tsx` for light-hero marking and taller-nav clearance.
- Modify `property-peace-marketing/app/features/[slug]/page.tsx` for feature-detail clearance, light markers, and the Maintenance Tracking hero.
- Modify the five standalone hero pages: About, Resources, Starter Pack, TurboTenant Comparison, and LeaseShield Blog.
- Modify `property-peace-marketing/package.json` to expose the shell contract commands.

---

### Task 1: Deterministic navigation-surface state

**Files:**
- Create: `property-peace-marketing/lib/navigation-surface.ts`
- Create: `property-peace-marketing/scripts/navigation-surface.contract.test.mjs`
- Modify: `property-peace-marketing/package.json:5-16`

**Interfaces:**
- Consumes: pathname plus five Boolean interaction flags.
- Produces: `getNavigationSurface(input): 'transparent' | 'white'` and `NavigationSurfaceInput`.

- [ ] **Step 1: Write the failing state-matrix test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { getNavigationSurface } from '../lib/navigation-surface.ts';

const idleHome = {
  pathname: '/',
  scrolled: false,
  pointerInside: false,
  focusInside: false,
  dropdownOpen: false,
  mobileMenuOpen: false,
};

test('idle homepage at the top uses the transparent surface', () => {
  assert.equal(getNavigationSurface(idleHome), 'transparent');
});

test('homepage intent states use the white surface', () => {
  for (const key of ['scrolled', 'pointerInside', 'focusInside', 'dropdownOpen', 'mobileMenuOpen']) {
    assert.equal(getNavigationSurface({ ...idleHome, [key]: true }), 'white', key);
  }
});

test('secondary routes always use the white surface', () => {
  assert.equal(getNavigationSurface({ ...idleHome, pathname: '/resources' }), 'white');
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `node --experimental-strip-types --test scripts/navigation-surface.contract.test.mjs`

Expected: FAIL because `lib/navigation-surface.ts` does not exist.

- [ ] **Step 3: Implement the pure state helper**

```ts
export type NavigationSurface = 'transparent' | 'white';

export interface NavigationSurfaceInput {
  pathname: string;
  scrolled: boolean;
  pointerInside: boolean;
  focusInside: boolean;
  dropdownOpen: boolean;
  mobileMenuOpen: boolean;
}

export function getNavigationSurface({
  pathname,
  scrolled,
  pointerInside,
  focusInside,
  dropdownOpen,
  mobileMenuOpen,
}: NavigationSurfaceInput): NavigationSurface {
  if (pathname !== '/') return 'white';
  return scrolled || pointerInside || focusInside || dropdownOpen || mobileMenuOpen
    ? 'white'
    : 'transparent';
}
```

Add this package script:

```json
"test:navigation-surface": "node --experimental-strip-types --test scripts/navigation-surface.contract.test.mjs"
```

- [ ] **Step 4: Run the state test and targeted lint**

Run: `npm run test:navigation-surface`

Expected: 3 tests pass.

Run: `npx eslint lib/navigation-surface.ts scripts/navigation-surface.contract.test.mjs`

Expected: exit 0 with no warnings.

- [ ] **Step 5: Commit the state unit**

```bash
git add property-peace-marketing/lib/navigation-surface.ts property-peace-marketing/scripts/navigation-surface.contract.test.mjs property-peace-marketing/package.json
git commit -m "test(marketing): define navigation surface states"
```

---

### Task 2: Adaptive shared navigation and dropdown

**Files:**
- Modify: `property-peace-marketing/components/Layout/Navigation.tsx:1-470`
- Modify: `property-peace-marketing/app/globals.css:106-173`
- Create: `property-peace-marketing/scripts/navigation-render.contract.test.mjs`
- Modify: `property-peace-marketing/package.json:5-17`

**Interfaces:**
- Consumes: `getNavigationSurface()` from Task 1 and `usePathname()` from Next.js.
- Produces: `<nav data-navigation-surface="transparent|white" data-navigation-height="88">` with adaptive logo, links, buttons, and white dropdown.

- [ ] **Step 1: Write the failing rendered navigation contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');

test('homepage initially renders transparent navigation', () => {
  const html = readPage('');
  assert.match(html, /data-navigation-surface="transparent"/);
  assert.match(html, /data-navigation-height="88"/);
});

test('secondary routes initially render white navigation', () => {
  for (const route of ['about', 'features', 'resources', 'pricing']) {
    assert.match(readPage(route), /data-navigation-surface="white"/, route);
  }
});
```

- [ ] **Step 2: Build and confirm the missing-attribute failure**

Run: `npm run build`

Run: `node --test scripts/navigation-render.contract.test.mjs`

Expected: FAIL because the current navigation has neither data attribute.

- [ ] **Step 3: Wire route, scroll, pointer, focus, and open-state inputs**

Add these imports and states to `Navigation.tsx`:

```tsx
import { usePathname } from 'next/navigation';
import { getNavigationSurface } from '@/lib/navigation-surface';

const pathname = usePathname();
const [scrolled, setScrolled] = useState(false);
const [pointerInside, setPointerInside] = useState(false);
const [focusInside, setFocusInside] = useState(false);

useEffect(() => {
  const update = () => setScrolled(window.scrollY > 24);
  update();
  window.addEventListener('scroll', update, { passive: true });
  return () => window.removeEventListener('scroll', update);
}, []);

useEffect(() => {
  setMobileMenuOpen(false);
  setMobileFeaturesOpen(false);
  setFeaturesDropdownOpen(false);
}, [pathname]);

const surface = getNavigationSurface({
  pathname,
  scrolled,
  pointerInside,
  focusInside,
  dropdownOpen: featuresDropdownOpen,
  mobileMenuOpen,
});
const whiteSurface = surface === 'white';
```

Apply these handlers and attributes to the outer `<nav>`:

```tsx
data-navigation-surface={surface}
data-navigation-height="88"
onMouseEnter={() => setPointerInside(true)}
onMouseLeave={() => setPointerInside(false)}
onFocusCapture={() => setFocusInside(true)}
onBlurCapture={(event) => {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
}}
```

Replace every `transparent` branch with `whiteSurface` logic. Use the white logo and white text when `whiteSurface` is false; use the dark logo and navy text when it is true.

- [ ] **Step 4: Apply exact navigation presentation states**

Use these exact outer classes:

```tsx
className="marketing-nav fixed inset-x-0 top-0 z-50 w-full min-w-0"
```

Use a 72-pixel mobile row and an 88-pixel desktop row:

```tsx
<div className="relative grid h-[72px] grid-cols-[76px_minmax(0,1fr)_64px] items-center nav:flex nav:h-[88px] nav:justify-between">
```

Transparent state:

```tsx
// links
'text-white hover:text-white'
// login
'border-white/70 text-white hover:bg-white/10'
// Start free
'bg-white text-[#061E35] shadow-[0_12px_30px_rgba(1,12,28,0.18)]'
```

White state:

```tsx
// links
'text-[#061E35] hover:text-[#16a34a]'
// login
'border-[#B8C8D5] text-[#061E35] hover:border-[#061E35] hover:bg-[#F7FAFC]'
// Start free style
{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }
```
Make the Start Free class and inline background conditional so the existing gradient cannot override the transparent-state white fill:

```tsx
className={`${whiteSurface
  ? 'text-white shadow-lg shadow-emerald-600/25'
  : 'text-[#061E35] shadow-[0_12px_30px_rgba(1,12,28,0.18)]'
} px-7 py-3.5 font-bold transition-all duration-200`}
style={{
  fontFamily: '"Inter", "Inter Placeholder", sans-serif',
  background: whiteSurface ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#ffffff',
}}
```

Make the desktop feature dropdown permanently light when open:

```tsx
className="marketing-nav-dropdown hidden nav:block absolute inset-x-0 top-full z-50"
```

Use `text-[#061E35]` for feature titles, `text-[#637083]` for descriptions, `text-[#16a34a]` for category labels, `border-[#DCE6ED]` for separators, and `bg-white` for the panel.

- [ ] **Step 5: Replace the old auth-navigation CSS with surface CSS**

```css
.marketing-nav {
  isolation: isolate;
  transition: background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.marketing-nav[data-navigation-surface="transparent"] {
  background: transparent;
  border-bottom: 1px solid transparent;
  box-shadow: none;
}

.marketing-nav[data-navigation-surface="white"] {
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid #dce6ed;
  box-shadow: 0 10px 30px rgba(6, 30, 53, 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.marketing-nav-dropdown {
  background: #fff;
  border-bottom: 1px solid #dce6ed;
  box-shadow: 0 22px 50px rgba(6, 30, 53, 0.12);
}

@media (prefers-reduced-motion: reduce) {
  .marketing-nav,
  .marketing-nav * {
    transition-duration: 0.01ms !important;
  }
}
```

Delete the superseded `.marketing-auth-nav` and `.marketing-auth-nav-dropdown` rules. Keep `.marketing-auth-bg` because it is outside this navigation redesign.

- [ ] **Step 6: Add the combined package command and verify green**

```json
"test:marketing-shell": "npm run build && npm run test:navigation-surface && node --test scripts/navigation-render.contract.test.mjs"
```

Run: `npm run test:marketing-shell`

Expected: production build succeeds and all navigation contracts pass.

Run: `npx eslint components/Layout/Navigation.tsx scripts/navigation-render.contract.test.mjs`

Expected: exit 0.

- [ ] **Step 7: Commit the adaptive navigation**

```bash
git add property-peace-marketing/components/Layout/Navigation.tsx property-peace-marketing/app/globals.css property-peace-marketing/scripts/navigation-render.contract.test.mjs property-peace-marketing/package.json
git commit -m "feat(marketing): add adaptive image-overlay navigation"
```

---

### Task 3: Homepage image treatment and navigation clearance

**Files:**
- Modify: `property-peace-marketing/components/Sections/Hero.tsx:7-34`
- Modify: `property-peace-marketing/scripts/navigation-render.contract.test.mjs`

**Interfaces:**
- Consumes: the fixed 72/88-pixel navigation from Task 2.
- Produces: `<section data-marketing-hero="home-image">` with the existing image visible behind the transparent navigation.

- [ ] **Step 1: Extend the rendered test before changing the hero**

```js
test('homepage image hero reaches behind the navigation', () => {
  const html = readPage('');
  assert.match(html, /data-marketing-hero="home-image"/);
  assert.match(html, /hero-smart-home-entry\.jpg/);
});
```

- [ ] **Step 2: Run the rendered test and confirm the marker failure**

Run: `node --test scripts/navigation-render.contract.test.mjs`

Expected: FAIL because the homepage hero marker is absent.

- [ ] **Step 3: Mark the hero and lighten the overlay**

Set the outer section and responsive overlay to:

```tsx
<section data-marketing-hero="home-image" className="relative overflow-hidden bg-[#061E35] lg:min-h-[780px]">
```

```tsx
<div
  className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,30,53,0.97)_0%,rgba(6,30,53,0.91)_44%,rgba(6,30,53,0.54)_72%,rgba(6,30,53,0.16)_100%)] sm:bg-[linear-gradient(90deg,rgba(6,30,53,0.95)_0%,rgba(6,30,53,0.88)_40%,rgba(6,30,53,0.44)_68%,rgba(6,30,53,0.08)_100%)] lg:bg-[linear-gradient(90deg,rgba(6,30,53,0.94)_0%,rgba(6,30,53,0.86)_36%,rgba(6,30,53,0.48)_60%,rgba(6,30,53,0.10)_80%,rgba(6,30,53,0.02)_100%)]"
  aria-hidden="true"
/>
```

Retain `pt-[7rem]` on mobile and set the desktop content wrapper to `lg:pt-[88px]` so the taller navigation never covers hero copy.

- [ ] **Step 4: Verify the hero contract and lint**

Run: `npm run test:marketing-shell`

Expected: navigation and homepage hero contracts pass.

Run: `npx eslint components/Sections/Hero.tsx`

Expected: exit 0.

- [ ] **Step 5: Commit the homepage treatment**

```bash
git add property-peace-marketing/components/Sections/Hero.tsx property-peace-marketing/scripts/navigation-render.contract.test.mjs
git commit -m "style(marketing): integrate navigation with homepage image"
```

---

### Task 4: Shared light secondary heroes

**Files:**
- Create: `property-peace-marketing/scripts/light-hero.contract.test.mjs`
- Modify: `property-peace-marketing/components/SEO/NicheLandingPage.tsx:84-122`
- Modify: `property-peace-marketing/components/Marketing/FeatureLandingPage.tsx:131-160`
- Modify: `property-peace-marketing/app/features/[slug]/page.tsx:502-538,672-898`
- Modify: `property-peace-marketing/package.json`

**Interfaces:**
- Consumes: the fixed 88-pixel navigation.
- Produces: opening hero tags with `data-marketing-hero-theme="light"` and a rendered `bg-white` or `from-white` class.

- [ ] **Step 1: Write the shared-route light-hero contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPage = (route) => fs.readFileSync(path.join(root, 'out', route, 'index.html'), 'utf8');
const lightTag = /<(?:section|div)[^>]*data-marketing-hero-theme="light"[^>]*>/i;

function assertLightHero(route) {
  const html = readPage(route);
  const tag = html.match(lightTag)?.[0];
  assert.ok(tag, `${route} should render a marked light hero`);
  assert.match(tag, /bg-white|from-white/, `${route} should render a white hero surface`);
  assert.doesNotMatch(tag, /061e35/i, `${route} should not render a navy hero surface`);
}

const nicheRoutes = [
  'free-landlord-software',
  'landlord-accounting-software',
  'property-management-software-for-small-landlords',
  'property-management-spreadsheet-alternative',
  'maintenance-request-software-for-landlords',
  'rent-collection-software-for-landlords',
];

test('shared SEO landing pages render light heroes', () => {
  nicheRoutes.forEach(assertLightHero);
});
```

- [ ] **Step 2: Build and verify the missing-marker failure**

Run: `npm run build`

Run: `node --test scripts/light-hero.contract.test.mjs`

Expected: FAIL on the first niche route because the marker is absent and its hero is navy.

- [ ] **Step 3: Convert the shared SEO hero**

Use this outer surface in `NicheLandingPage.tsx`:

```tsx
<section
  data-marketing-hero-theme="light"
  className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7FAFC] px-4 pb-20 pt-32 text-[#061E35] sm:px-6 sm:pb-24 sm:pt-36 lg:px-8"
>
```

Within that hero only, apply these exact mappings:

```text
text-white                -> text-[#061E35]
text-white/70             -> text-[#405A70]
text-emerald-200          -> text-[#16a34a]
border-white/15           -> border-[#DCE6ED]
bg-white/[0.07]           -> bg-white
border-white/25           -> border-[#DCE6ED]
bg-white/[0.12]           -> bg-white
```

The primary action keeps `from-green-500 to-green-600`. The secondary action uses navy text on white with a `#DCE6ED` border.

- [ ] **Step 4: Mark existing shared feature heroes and fix clearance**

In `FeatureLandingPage.tsx`, use:

```tsx
<section
  data-marketing-hero-theme="light"
  className="relative overflow-hidden bg-white px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-36 lg:px-8"
>
```

In `app/features/[slug]/page.tsx`, change shared light hero padding from `pt-24 sm:pt-10` to `pt-32 sm:pt-36`. Add `data-marketing-hero-theme="light"` to the five white outer hero branches, including Rent Collection. Do not mark Maintenance Tracking in this task.

Extend the test with these exact route sets:

```js
const sharedFeatureRoutes = [
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
  .readdirSync(path.join(root, 'out', 'features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__next') && entry.name !== 'maintenance-tracking')
  .map((entry) => `features/${entry.name}`);

test('shared feature pages render light heroes', () => {
  [...sharedFeatureRoutes, ...featureDetailRoutes].forEach(assertLightHero);
});
```

- [ ] **Step 5: Add the light-hero command and verify**

```json
"test:light-heroes": "npm run build && node --test scripts/light-hero.contract.test.mjs"
```

Run: `npm run test:light-heroes`

Expected: all shared SEO and shared feature routes pass.

Run: `npx eslint components/SEO/NicheLandingPage.tsx components/Marketing/FeatureLandingPage.tsx "app/features/[slug]/page.tsx" scripts/light-hero.contract.test.mjs`

Expected: exit 0.

- [ ] **Step 6: Commit shared hero changes**

```bash
git add property-peace-marketing/components/SEO/NicheLandingPage.tsx property-peace-marketing/components/Marketing/FeatureLandingPage.tsx "property-peace-marketing/app/features/[slug]/page.tsx" property-peace-marketing/scripts/light-hero.contract.test.mjs property-peace-marketing/package.json
git commit -m "style(marketing): lighten shared secondary heroes"
```

---

### Task 5: Five standalone light heroes

**Files:**
- Modify: `property-peace-marketing/app/about/page.tsx:65-101`
- Modify: `property-peace-marketing/app/resources/page.tsx:51-99`
- Modify: `property-peace-marketing/app/resources/starter-pack/page.tsx:91-120`
- Modify: `property-peace-marketing/app/comparison/turbotenant/page.tsx:155-175`
- Modify: `property-peace-marketing/app/lease-shield/blog/page.tsx:72-140`
- Modify: `property-peace-marketing/scripts/light-hero.contract.test.mjs`

**Interfaces:**
- Consumes: `assertLightHero(route)` from Task 4.
- Produces: five marked light opening heroes with existing content and actions preserved.

- [ ] **Step 1: Extend the failing contract before page changes**

```js
const standaloneRoutes = [
  'about',
  'resources',
  'resources/starter-pack',
  'comparison/turbotenant',
  'lease-shield/blog',
];

test('standalone marketing pages render light heroes', () => {
  standaloneRoutes.forEach(assertLightHero);
});
```

- [ ] **Step 2: Run the contract and confirm the first standalone failure**

Run: `node --test scripts/light-hero.contract.test.mjs`

Expected: FAIL on `/about` because its current hero is navy and unmarked.

- [ ] **Step 3: Convert About and Resources**

Use this outer class on both pages:

```tsx
data-marketing-hero-theme="light"
className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7FAFC] px-4 pb-20 pt-32 text-[#061E35] sm:px-6 md:pb-24 md:pt-36 lg:px-8"
```

In the About hero, convert the Portfolio Signal panel from translucent navy to `border border-[#DCE6ED] bg-white shadow-[0_24px_60px_rgba(6,30,53,0.10)]`, with navy labels and `#405A70` supporting text.

In the Resources hero, convert the practical-resource panel to the same white card treatment. Use `text-[#16a34a]` for its eyebrow and `border-[#DCE6ED]` for row separators. Preserve the Browse Resources green gradient action.

- [ ] **Step 4: Convert Starter Pack, Comparison, and LeaseShield Blog**

Use this outer class on all three pages:

```tsx
data-marketing-hero-theme="light"
className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7FAFC] px-4 pb-20 pt-32 text-[#061E35] sm:px-6 md:pb-24 md:pt-36 lg:px-8"
```

For the Starter Pack download panel and comparison-standard panel, use:

```tsx
className="border border-[#DCE6ED] bg-white p-6 shadow-[0_24px_60px_rgba(6,30,53,0.10)] md:p-8"
```

For LeaseShield Blog, retain its two-column scenario preview but change the top section from an inline navy gradient to the light outer class. Use navy headline text, `#405A70` body copy, a green eyebrow, and a white preview card with `#DCE6ED` borders. Keep the primary CTA green.

Within these hero blocks only, replace white copy with navy/body tokens and white-alpha borders with `#DCE6ED`. Do not alter navy sections lower on the page.

- [ ] **Step 5: Build, test, and lint all standalone pages**

Run: `npm run test:light-heroes`

Expected: shared and standalone light-hero contracts pass.

Run: `npx eslint app/about/page.tsx app/resources/page.tsx app/resources/starter-pack/page.tsx app/comparison/turbotenant/page.tsx app/lease-shield/blog/page.tsx scripts/light-hero.contract.test.mjs`

Expected: exit 0.

- [ ] **Step 6: Commit standalone hero changes**

```bash
git add property-peace-marketing/app/about/page.tsx property-peace-marketing/app/resources/page.tsx property-peace-marketing/app/resources/starter-pack/page.tsx property-peace-marketing/app/comparison/turbotenant/page.tsx property-peace-marketing/app/lease-shield/blog/page.tsx property-peace-marketing/scripts/light-hero.contract.test.mjs
git commit -m "style(marketing): lighten standalone page heroes"
```

---

### Task 6: Light Maintenance Tracking feature hero

**Files:**
- Modify: `property-peace-marketing/app/features/[slug]/page.tsx:540-581`
- Modify: `property-peace-marketing/scripts/light-hero.contract.test.mjs`

**Interfaces:**
- Consumes: the existing `feature`, CTA URLs, and `maintenance-tracking-hero.jpg`.
- Produces: a marked light two-column hero with framed photographic media.

- [ ] **Step 1: Add Maintenance Tracking to the contract before production changes**

```js
test('Maintenance Tracking renders a light framed-image hero', () => {
  const html = readPage('features/maintenance-tracking');
  assertLightHero('features/maintenance-tracking');
  assert.match(html, /maintenance-tracking-hero\.jpg/);
});
```

- [ ] **Step 2: Run the test and confirm the navy-hero failure**

Run: `node --test scripts/light-hero.contract.test.mjs`

Expected: FAIL because Maintenance Tracking is still a full-bleed navy-washed image and has no light marker.

- [ ] **Step 3: Replace the full-bleed branch with a light two-column hero**

Use this structure inside `renderMaintenanceTrackingHero`:

```tsx
<div
  data-marketing-hero-theme="light"
  className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7FAFC]"
>
  <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-32 sm:px-6 sm:pt-36 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
    <div className="text-center lg:text-left">
      <Link href="/features" className="mb-8 inline-flex items-center text-sm font-semibold text-[#637083] hover:text-[#16a34a]">
        <FiArrowLeft className="mr-2 h-4 w-4" />Back to Features
      </Link>
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#16a34a]">Maintenance tracking</p>
      <h1 className="text-[2.3rem] font-bold leading-[1.08] text-[#061E35] sm:text-5xl md:text-6xl">
        Maintenance Tracking for <span className="text-[#16a34a]">Landlords</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-[#405A70] md:text-xl lg:mx-0">{feature.shortDescription}</p>
      <div className="mx-auto mt-8 grid max-w-[22rem] grid-cols-2 gap-3 sm:flex sm:max-w-none lg:mx-0">
        <Link href="https://app.propertypeace.io/register" className="inline-flex min-h-[56px] items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 font-semibold text-white hover:from-green-600 hover:to-green-700">
          <FiZap className="h-4 w-4" />Get Started Free
        </Link>
        <Link href="/pricing" className="inline-flex min-h-[56px] items-center justify-center border border-[#DCE6ED] bg-white px-6 py-3 font-semibold text-[#061E35] hover:border-green-300 hover:text-[#16a34a]">
          View Pricing
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2 text-[13px] font-semibold text-[#061E35] lg:justify-start">
        {trustItems.map((item) => (
          <span key={item} className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#DCE6ED] bg-white px-3 py-1.5 shadow-sm">
            <FiCheck className="h-4 w-4 text-[#16a34a]" />{item}
          </span>
        ))}
      </div>
    </div>
    <div className="overflow-hidden border border-[#DCE6ED] bg-white p-3 shadow-[0_24px_60px_rgba(6,30,53,0.12)]">
      <div
        className="min-h-[360px] bg-cover bg-center sm:min-h-[430px]"
        style={{ backgroundImage: 'url(/images/landing/maintenance-tracking-hero.jpg)' }}
        role="img"
        aria-label="A landlord reviewing a maintenance visit at a rental property"
      />
    </div>
  </div>
</div>
```

Use the existing green gradient for the primary action. Use a white secondary action with navy text and a `#DCE6ED` border. Convert trust pills to white cards with navy copy and green checks.

- [ ] **Step 4: Build, test, and lint the feature branch**

Run: `npm run test:light-heroes`

Expected: every light-hero contract passes, including Maintenance Tracking.

Run: `npx eslint "app/features/[slug]/page.tsx" scripts/light-hero.contract.test.mjs`

Expected: exit 0.

- [ ] **Step 5: Commit Maintenance Tracking**

```bash
git add "property-peace-marketing/app/features/[slug]/page.tsx" property-peace-marketing/scripts/light-hero.contract.test.mjs
git commit -m "style(marketing): frame maintenance hero on light canvas"
```

---

### Task 7: Whole-site shell verification and delivery

**Files:**
- Verify: all modified marketing files
- Verify: `property-peace-marketing/scripts/footer-navigation.contract.test.mjs`
- Verify: `property-peace-marketing/scripts/visual-theme.contract.test.mjs`
- Verify: `property-peace-marketing/scripts/hero-background.contract.test.mjs`
- Verify: new shell contracts

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified static export, responsive visual evidence, clean marketing-only Git history, and synchronized `dev` delivery.

- [ ] **Step 1: Run the complete production and contract suite**

Run: `npm run test:marketing-shell`

Expected: production build and navigation contracts pass.

Run: `node --test scripts/footer-navigation.contract.test.mjs scripts/visual-theme.contract.test.mjs scripts/hero-background.contract.test.mjs scripts/navigation-render.contract.test.mjs scripts/light-hero.contract.test.mjs`

Expected: all rendered contracts pass with zero failures.

Run: `npm run test:marketing-claims`

Expected: all marketing claim assertions pass.

- [ ] **Step 2: Run targeted lint across every changed source file**

```bash
npx eslint components/Layout/Navigation.tsx components/Sections/Hero.tsx components/SEO/NicheLandingPage.tsx components/Marketing/FeatureLandingPage.tsx "app/features/[slug]/page.tsx" app/about/page.tsx app/resources/page.tsx app/resources/starter-pack/page.tsx app/comparison/turbotenant/page.tsx app/lease-shield/blog/page.tsx lib/navigation-surface.ts scripts/navigation-surface.contract.test.mjs scripts/navigation-render.contract.test.mjs scripts/light-hero.contract.test.mjs
```

Expected: exit 0 with no warnings.

- [ ] **Step 3: Perform desktop visual checks**

Run the marketing development server and inspect at 1440×900:

1. `/` at scroll position 0: transparent 88-pixel nav, white logo/links/buttons over the image.
2. `/` with pointer over nav: white nav, dark logo/links, green Start Free.
3. `/` after scrolling 48 pixels: white nav remains stable with no layout shift.
4. `/resources`, `/resources/starter-pack`, `/about`, `/comparison/turbotenant`, `/lease-shield/blog`: white nav and light hero.
5. `/free-landlord-software`: white nav and shared light SEO hero.
6. `/features/maintenance-tracking`: light copy column and framed photograph.

Expected: no dark full-width secondary hero, no dot/grid background, and no content underlap.

- [ ] **Step 4: Perform mobile visual checks**

Inspect at 390×844:

1. Homepage top bar is 72 pixels and transparent while idle.
2. Scrolling changes it to white without shifting the hero.
3. Opening the menu forces the white trigger bar and shows the existing navy drawer.
4. Converted secondary heroes stack cleanly with 44-pixel-or-larger touch targets.
5. Feature and navigation dropdown labels remain readable and keyboard/touch accessible.

- [ ] **Step 5: Restore build-generated timestamps and inspect scope**

```bash
git restore -- property-peace-marketing/public/rss.xml property-peace-marketing/public/sitemap.xml
git -c core.whitespace=cr-at-eol diff --check
git status --short
```

Expected: only intended marketing files or plan artifacts appear; `property-peace-api/Program.cs` remains modified but unstaged.


- [ ] **Step 6: Synchronize `dev` after verifying the remote has not advanced**

```bash
git fetch origin dev
git rev-list --left-right --count origin/dev...HEAD
git push origin dev
git rev-parse HEAD
git rev-parse origin/dev
```

Expected: the pre-push divergence is `0 N` where `N` is the completed local commit count, the push succeeds, and the final two SHAs match.
