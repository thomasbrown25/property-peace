# Marketing Shell and Light Heroes Design

**Status:** Approved in chat on 2026-08-24

## Goal

Give Property Peace a calmer, more image-led marketing shell: the homepage navigation should visually dissolve into the existing property photograph and become a crisp white utility bar when the visitor shows intent, while every secondary marketing page should begin with a white navigation bar and a light hero surface.

The redesign applies only to `property-peace-marketing`. It must not change the application or API projects.

## Design Direction

Property Peace is for independent landlords who need a calm operational workspace, so the marketing site should feel clear, practical, and residential rather than enterprise-heavy. The homepage photograph remains the signature visual. The navigation appears to belong to that photograph at first, then resolves into a white working surface when the visitor hovers, focuses, opens a menu, or scrolls.

Secondary pages use the same visual language as a clean property record: white and pale blue-gray canvases, navy typography, restrained borders, and framed product or resource artifacts. Navy remains available as a grounding accent inside the page, but not as the default top-of-page background.

### Visual tokens

- Navy ink: `#061E35`
- Body copy: `#405A70`
- Quiet copy: `#637083`
- White: `#FFFFFF`
- Canvas: `#F7FAFC`
- Mist: `#EAF3F8`
- Border: `#DCE6ED`
- Brand green: `#22C55E` to `#16A34A`

Existing Poppins display typography and Inter body typography remain unchanged.

## Navigation Architecture

`components/Layout/Navigation.tsx` remains the single shared marketing navigation. It becomes route-aware and interaction-aware instead of relying on the current hard-coded navy surface.

### Inputs

- Current pathname
- Whether the document is scrolled more than 24 pixels
- Whether the pointer is inside the navigation
- Whether keyboard focus is inside the navigation
- Whether the desktop feature dropdown is open
- Whether the mobile drawer is open

### Surface rule

The navigation uses its white surface when any of these conditions is true:

1. The current pathname is not `/`.
2. The document is scrolled more than 24 pixels.
3. The pointer is inside the navigation.
4. Keyboard focus is inside the navigation.
5. The feature dropdown is open.
6. The mobile drawer is open.

Only the idle homepage at the top of the document uses the transparent surface.

### State presentation

| Element | Homepage, top and idle | White surface |
| --- | --- | --- |
| Navigation background | Transparent | White with a subtle bottom border and soft shadow |
| Logo | White logo | Dark logo |
| Primary links | White | Navy |
| Login | White outline and white text | Slate/navy outline and navy text |
| Start free | White fill and navy text | Brand-green gradient and white text |
| Feature dropdown | Not open | White panel with navy labels and slate descriptions |

The desktop navigation is 88 pixels high. The mobile navigation is 72 pixels high. The navigation remains fixed so it does not jump when its surface changes. All hero layouts must include deliberate clearance for those heights.

Transitions use opacity, color, border, and shadow only. They last 200–250 milliseconds and respect `prefers-reduced-motion`. Opening the desktop dropdown forces the white surface before the panel appears. Closing it at the top of the homepage returns to transparent only after both pointer and focus leave the navigation.

On route changes, open mobile or desktop navigation state is cleared. The dark mobile drawer remains an intentional navy overlay, while its trigger bar uses the same white-surface rule as desktop.

## Homepage Hero

The existing `hero-smart-home-entry.jpg` remains the homepage image; no new stock asset is introduced. The hero continues to run behind the fixed navigation. Its overlay is adjusted so the left-side copy remains accessible while more of the photograph remains visible through the center and right side.

The homepage is the only route allowed to begin with a transparent navigation bar or a full-bleed darkened photograph. Existing headline, proof, and CTA content remain unless spacing adjustments are needed for the 88-pixel navigation.

## Secondary Hero System

Every secondary route begins with the white navigation surface. Top heroes use white or a restrained white-to-canvas wash, navy headings, `#405A70` body copy, green eyebrows or status markers, and white artifact cards with `#DCE6ED` borders. Decorative dot and grid backgrounds remain prohibited.

### Standalone dark heroes to convert

- `/about`
- `/resources`
- `/resources/starter-pack`
- `/comparison/turbotenant`
- `/lease-shield/blog`

Each keeps its current information architecture. White text changes to navy or body-copy colors. Dark translucent cards become white or canvas cards with borders and restrained shadows. Green primary actions keep the established Start Free gradient.

### Shared SEO hero to convert

`components/SEO/NicheLandingPage.tsx` becomes a light hero for:

- `/free-landlord-software`
- `/landlord-accounting-software`
- `/property-management-software-for-small-landlords`
- `/property-management-spreadsheet-alternative`
- `/maintenance-request-software-for-landlords`
- `/rent-collection-software-for-landlords`

The shared hero retains its proof points and two-column composition. The proof panel becomes a framed white artifact instead of a dark card.

### Maintenance Tracking exception to remove

`/features/maintenance-tracking` currently uses a full-bleed photograph with a navy wash. It becomes a light two-column feature hero consistent with the e-sign reference: navy copy and actions on the left, with `maintenance-tracking-hero.jpg` displayed as a framed image on the right. This avoids a second special dark hero outside the homepage.

### Existing light heroes

The shared feature hero, generic feature-detail heroes, Features, Listings, How It Works, Contact, Pricing, legal, help, blog, demo, and other already-light routes keep their visual structure. Their top clearance is audited and adjusted where necessary so content does not collide with the taller fixed navigation.

## Intentional Navy Sections

Navy remains available below the hero where it improves hierarchy. Approved uses include:

- Focused mid-page calls to action
- Selected pricing or comparison states
- Product mockup chrome and dashboard frames
- Trust or proof bands that need visual separation
- The mobile navigation drawer
- The footer

No page should alternate navy and light backgrounds mechanically. Navy is used only when a section represents a decision, proof point, or product artifact that benefits from stronger contrast.

## Responsive Behavior

- Desktop: 88-pixel navigation, full primary links, adaptive Login and Start Free actions.
- Mobile: 72-pixel trigger bar, the same transparent-to-white homepage behavior, and the existing navy drawer after the menu opens.
- Homepage image positioning can vary by breakpoint to preserve the subject and keep copy legible.
- Secondary heroes collapse to one column without reintroducing dark backgrounds.
- Framed images and cards remain within the viewport and preserve existing touch target sizes.

## Accessibility

- Hover behavior is mirrored by `focus-within` behavior.
- Navigation colors meet WCAG AA contrast in both surface modes.
- The surface transition does not move content or change navigation height.
- The dropdown remains keyboard reachable and retains Escape/blur closing behavior.
- Motion is reduced when the operating system requests reduced motion.
- Logo swaps use one meaningful accessible image; the alternate visual remains hidden from assistive technology.

## Implementation Boundaries

Expected production changes are limited to:

- `components/Layout/Navigation.tsx`
- Navigation-related styles in `app/globals.css`
- `components/Sections/Hero.tsx`
- `components/SEO/NicheLandingPage.tsx`
- The maintenance hero branch in `app/features/[slug]/page.tsx`
- The five standalone dark hero pages listed above
- Shared or page-level spacing only where the route audit demonstrates a collision with the taller navigation

The footer, mobile drawer information architecture, page copy, SEO metadata, application project, and API project are out of scope.

## Verification Strategy

Implementation follows test-first development.

1. Add a deterministic navigation-surface state helper with automated coverage for homepage idle, hover, focus, dropdown, mobile-menu, scroll, and secondary-route states.
2. Add a rendered marketing contract that confirms the homepage initially exposes the transparent surface and representative secondary routes expose the white surface.
3. Add rendered contracts for every converted route confirming its top hero uses the light theme and no decorative dot or grid layer.
4. Run targeted ESLint on every modified TypeScript and test file.
5. Run the production static build and all existing marketing contracts and marketing-claim assertions.
6. Perform desktop and mobile visual checks for the homepage idle state, homepage hover state, homepage scrolled state, a shared SEO route, Resources, Starter Pack, and Maintenance Tracking.

## Acceptance Criteria

- The homepage navigation is transparent only at the top while idle.
- Hover, keyboard focus, dropdown, mobile-menu, or scroll turns the homepage navigation white without a layout shift.
- All secondary routes show a white navigation bar immediately.
- The desktop and mobile navigation heights are 88 and 72 pixels respectively.
- Navigation logos, links, Login, Start Free, and dropdown colors adapt with the surface.
- The homepage photograph visibly reaches behind the transparent navigation.
- No secondary route begins with a navy full-width hero or navy-washed full-bleed image.
- Existing intentional navy sections below the hero remain available.
- All automated marketing checks and the production build pass.
