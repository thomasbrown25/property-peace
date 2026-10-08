import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'out', 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(projectRoot, 'components/Sections/CustomerReviewMarquee.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(projectRoot, 'app/globals.css'), 'utf8');

function indexOfMarker(marker) {
  const index = homepage.indexOf(marker);
  assert.notEqual(index, -1, `homepage should render ${marker}`);
  return index;
}

function readReviewSection() {
  const markerIndex = indexOfMarker('data-homepage-review-marquee="true"');
  const sectionStart = homepage.lastIndexOf('<section', markerIndex);
  assert.notEqual(sectionStart, -1);
  const sectionEnd = homepage.indexOf('</section>', markerIndex);
  assert.notEqual(sectionEnd, -1);
  return homepage.slice(sectionStart, sectionEnd + '</section>'.length);
}

test('homepage places customer reviews immediately after the hero, before workflows and resources', () => {
  const heroIndex = indexOfMarker('data-marketing-hero="home-image"');
  const reviewsIndex = indexOfMarker('data-homepage-review-marquee="true"');
  const wheelIndex = indexOfMarker('data-homepage-feature-wheel="true"');
  const resourcesIndex = indexOfMarker('Useful before you ever open the app');
  assert.ok(heroIndex < reviewsIndex && reviewsIndex < wheelIndex && wheelIndex < resourcesIndex);
  const sectionStarts = [...homepage.matchAll(/<section\b/g)].map((match) => match.index);
  assert.equal(
    sectionStarts.findLastIndex((index) => index < reviewsIndex),
    sectionStarts.findLastIndex((index) => index < heroIndex) + 1,
  );
});

test('review section has exactly the selected three portraits and unchanged quotes', () => {
  const reviews = readReviewSection();
  assert.match(reviews, /Trusted by <span[^>]*>500\+ Landlords Worldwide<\/span>/);
  assert.equal((reviews.match(/data-review-card="true"/g) ?? []).length, 3);
  const selected = [
    ['David M.', 'david-m.jpg', 'After years of managing rentals in Excel, I can finally see my day-to-day work in one place. Property Peace saves me time and makes the whole portfolio easier to manage.'],
    ['Alexander C.', 'alexander-c.jpg', 'I replaced Google Sheets, QuickBooks, and Excel with Property Peace. Everything is easier to understand now, and I am very happy I made the switch.'],
    ['Priya S.', 'priya-s.jpg', 'The support team listened to my feature requests and helped me get comfortable with the software. It genuinely feels like the people behind Property Peace care.'],
  ];
  for (const [name, image, quote] of selected) {
    assert.equal(reviews.split(`>${name}</span>`).length - 1, 1, `${name} should appear once`);
    assert.ok(reviews.includes(image), `${name} portrait should render`);
    assert.ok(reviews.includes(quote), `${name} quote should be unchanged`);
  }
  for (const excluded of ['Monica R.', 'Jordan B.', 'Elena T.', 'Marcus L.', 'Mato P.', 'Samuel T.', 'Nina P.']) {
    assert.ok(!reviews.includes(excluded), `${excluded} should not render`);
  }
});

test('reviews use a static responsive three-column layout without marquee duplication or motion', () => {
  const reviews = readReviewSection();
  assert.match(reviews, /md:grid-cols-3/);
  assert.equal((reviews.match(/<figure\b/g) ?? []).length, 3);
  assert.equal((reviews.match(/<blockquote\b/g) ?? []).length, 3);
  assert.doesNotMatch(reviews, /review-marquee-track|data-review-group|aria-hidden="true"[^>]*data-review-group/);
  assert.doesNotMatch(source, /animate|transition|marquee-track|duplicate/);
  assert.doesNotMatch(cssSource, /@keyframes review-marquee|\.review-marquee-track/);
});
