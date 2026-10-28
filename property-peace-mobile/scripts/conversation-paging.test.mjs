import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screen = () => readFileSync(resolve(import.meta.dirname, '../src/screens/landlord/ConversationDetailScreen.tsx'), 'utf8');

test('thread opens with only the latest 15 timeline entries and fetches 15 older at a time', () => {
  const source = screen();
  assert.match(source, /ConversationAPI\.getTimeline\(conversationId, undefined, 15\)/);
  assert.match(source, /ConversationAPI\.getTimeline\(conversationId, nextCursor, 15\)/);
  assert.match(source, /mergeTimelinePages\(entries, filterTimelineForAudience\(page\.items, audience\)\)/);
});

test('older entries load on upward scroll with spinner and stable viewport rather than a tap or bottom snap', () => {
  const source = screen();
  assert.match(source, /onScrollBeginDrag=/);
  assert.match(source, /onScroll=/);
  assert.match(source, /maintainVisibleContentPosition=/);
  assert.match(source, /ListHeaderComponent=\{loadingMore \? <View[^>]*><ActivityIndicator/);
  assert.doesNotMatch(source, /Load more activity/);
  assert.doesNotMatch(source, /onContentSizeChange=\{\(\) => !loadingMore && listRef\.current\?\.scrollToEnd/);
});
