import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');

function indexOfMarker(marker) {
  const index = homepage.indexOf(marker);
  assert.notEqual(index, -1, `homepage should render ${marker}`);
  return index;
}

function readMarkedSection(marker) {
  const markerIndex = indexOfMarker(marker);
  const sectionStart = homepage.lastIndexOf('<section', markerIndex);
  assert.notEqual(sectionStart, -1, `${marker} should live in a section`);

  const sectionTags = /<\/?section\b[^>]*>/gi;
  sectionTags.lastIndex = sectionStart;
  let depth = 0;

  for (let match; (match = sectionTags.exec(homepage));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return homepage.slice(sectionStart, sectionTags.lastIndex);
  }

  assert.fail(`${marker} section should close`);
}

function readBuiltCss() {
  const cssDirectory = path.join(projectRoot, 'out', '_next', 'static', 'chunks');
  return fs
    .readdirSync(cssDirectory)
    .filter((file) => file.endsWith('.css'))
    .map((file) => fs.readFileSync(path.join(cssDirectory, file), 'utf8'))
    .join('\n');
}

test('homepage places customer reviews between workflows and landlord resources', () => {
  const wheelIndex = indexOfMarker('data-homepage-feature-wheel="true"');
  const reviewsIndex = indexOfMarker('data-homepage-review-marquee="true"');
  const resourcesIndex = indexOfMarker('Useful before you ever open the app');

  assert.ok(wheelIndex < reviewsIndex, 'customer reviews should follow the workflow wheel');
  assert.ok(reviewsIndex < resourcesIndex, 'landlord resources should follow customer reviews');
});

test('review ribbon renders verified reviews with accessible gold ratings', () => {
  const reviews = readMarkedSection('data-homepage-review-marquee="true"');
  const reviewCards = reviews.match(/data-review-card="true"/g) ?? [];

  assert.match(reviews, /aria-labelledby="customer-review-marquee-heading"/);
  assert.match(reviews, /Rental management feels lighter with/);
  assert.match(reviews, /Property Peace/);
  assert.equal(reviewCards.length, 20, 'ten review excerpts should render twice for a full seamless loop');
  assert.equal((reviews.match(/aria-label="5 out of 5 stars"/g) ?? []).length, 20);
  assert.equal((reviews.match(/data-review-stars="gold"/g) ?? []).length, 20);
  assert.match(
    reviews,
    /<ul(?=[^>]*data-review-group="duplicate")(?=[^>]*aria-hidden="true")[^>]*>/,
  );

  const reviewerLocations = [
    ['David M.', 'Florida | United States'],
    ['Monica R.', 'Texas | United States'],
    ['Alexander C.', 'Ohio | United States'],
    ['Priya S.', 'Colorado | United States'],
    ['Jordan B.', 'North Carolina | United States'],
    ['Elena T.', 'Oregon | United States'],
    ['Marcus L.', 'Illinois | United States'],
    ['Mato P.', 'Arizona | United States'],
    ['Samuel T.', 'Georgia | United States'],
    ['Nina P.', 'Washington | United States'],
  ];

  for (const [reviewer, location] of reviewerLocations) {
    assert.equal(
      (reviews.match(new RegExp(reviewer.replace('.', '\\.'), 'g')) ?? []).length,
      2,
      `${reviewer} should appear once in each marquee group`,
    );
    assert.equal(
      (reviews.match(new RegExp(location.replace('|', '\\|'), 'g')) ?? []).length,
      2,
      `${location} should appear once in each marquee group`,
    );
  }
});

test('each review card renders the portrait matched to its reviewer', () => {
  const reviews = readMarkedSection('data-homepage-review-marquee="true"');
  const portraitMappings = [
    ['David M.', 'david-m.jpg'],
    ['Monica R.', 'monica-r.jpg'],
    ['Alexander C.', 'alexander-c.jpg'],
    ['Priya S.', 'priya-s.jpg'],
    ['Jordan B.', 'jordan-b.jpg'],
    ['Elena T.', 'elena-t.jpg'],
    ['Marcus L.', 'marcus-l.jpg'],
    ['Mato P.', 'mato-p.jpg'],
    ['Samuel T.', 'samuel-t.jpg'],
    ['Nina P.', 'nina-p.jpg'],
  ];

  for (const [reviewer, filename] of portraitMappings) {
    const reviewerIndex = reviews.indexOf(`>${reviewer}</p>`);
    assert.notEqual(reviewerIndex, -1, `review section should render ${reviewer}`);

    const cardStart = reviews.lastIndexOf('<li', reviewerIndex);
    const cardEnd = reviews.indexOf('</li>', reviewerIndex);
    assert.notEqual(cardStart, -1, `${reviewer} should render inside a review card`);
    assert.notEqual(cardEnd, -1, `${reviewer} review card should close`);

    const card = reviews.slice(cardStart, cardEnd);
    assert.match(card, new RegExp(filename.replace('.', '\\.')), `${reviewer} should use ${filename}`);
  }
});

test('review update preserves the eyebrow and the original six review texts', () => {
  const reviews = readMarkedSection('data-homepage-review-marquee="true"');
  const preservedCopy = [
    'After years of managing rentals in Excel, I can finally see my day-to-day work in one place. Property Peace saves me time and makes the whole portfolio easier to manage.',
    'I manage five properties and wanted useful features without paying for a lot I would never touch. Property Peace gives me the simplicity and functionality I was looking for.',
    'I replaced Google Sheets, QuickBooks, and Excel with Property Peace. Everything is easier to understand now, and I am very happy I made the switch.',
    'The support team listened to my feature requests and helped me get comfortable with the software. It genuinely feels like the people behind Property Peace care.',
    'Property Peace is a great fit for a smaller portfolio. It is clear, affordable, and capable without feeling like enterprise software.',
    'Setup was as simple as advertised. The owner walked me through it, answered my questions, and has been professional and courteous every step of the way.',
  ];

  assert.match(reviews, />What landlords say</);
  for (const quote of preservedCopy) {
    assert.equal(
      reviews.split(quote).length - 1,
      2,
      'each original review should remain unchanged in both marquee groups',
    );
  }
});

test('review section uses a clean white field and navy cards without customer labels', () => {
  const reviews = readMarkedSection('data-homepage-review-marquee="true"');

  assert.match(
    reviews,
    /<section(?=[^>]*data-homepage-review-marquee="true")(?=[^>]*bg-white)[^>]*>/
  );
  assert.equal((reviews.match(/bg-\[\#061E35\]/g) ?? []).length, 20);
  assert.doesNotMatch(reviews, />Property Peace customer</i);
  assert.doesNotMatch(reviews, /radial-gradient|bg-\[\#EEF8F2\]/);
});
test('review ribbon moves continuously and becomes static for reduced motion', () => {
  const css = readBuiltCss();

  assert.match(css, /@keyframes review-marquee/);
  const groupRule = css.match(/\.review-marquee-group\{([^}]*)\}/)?.[1];
  assert.ok(groupRule, 'compiled CSS should include the full-width review group rule');
  assert.match(groupRule, /min-width:100vw/);
  assert.match(groupRule, /justify-content:space-around/);
  const trackRule = css.match(/\.review-marquee-track\{([^}]*)\}/)?.[1];
  assert.ok(trackRule, 'compiled CSS should include the marquee track rule');
  assert.match(trackRule, /animation:[^;]*review-marquee/);
  assert.match(trackRule, /animation:[^;]*60s/);
  assert.match(trackRule, /animation:[^;]*linear/);
  assert.match(trackRule, /animation:[^;]*infinite/);
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*?\.review-marquee-track\{[^}]*animation:none/,
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*?\.review-marquee-duplicate\{[^}]*display:none/,
  );
});
