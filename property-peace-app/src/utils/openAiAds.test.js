import assert from 'node:assert/strict';
import test from 'node:test';
import { trackOpenAiRegistration } from './openAiAds.js';

const productionApp = 'https://app.propertypeace.io';

function browser(cookie, origin = productionApp) {
  return { document: { cookie }, location: { origin } };
}

test('submits the original click reference with no other signup data', async () => {
  let request;
  const post = async (...args) => { request = args; };

  await trackOpenAiRegistration(post, browser('other=value; __Secure-pp-openai-ads-click=opaque%2Bclick%3D'));

  assert.equal(request[0], '/api/advertising-conversions/registration-completed');
  assert.deepEqual(request[1], { oppref: 'opaque+click=' });
  assert.equal(request[2].skipAuthRedirect, true);
  assert.equal(request[2].skipTokenRefresh, true);
  assert.equal(request[2].adapter, 'fetch');
  assert.equal(request[2].fetchOptions.keepalive, true);
});

test('skips browsers without a valid, consented click reference on the production app', async () => {
  const invalidCookies = [
    '',
    'unrelated-__Secure-pp-openai-ads-click=opaque',
    '__Secure-pp-openai-ads-click=%',
    '__Secure-pp-openai-ads-click=two%20words',
    `__Secure-pp-openai-ads-click=${'x'.repeat(2049)}`
  ];

  for (const cookie of invalidCookies) {
    let requests = 0;
    await trackOpenAiRegistration(() => { requests++; }, browser(cookie));
    assert.equal(requests, 0, cookie.slice(0, 70));
  }

  let requests = 0;
  await trackOpenAiRegistration(() => { requests++; }, browser('__Secure-pp-openai-ads-click=opaque', 'https://staging.example.com'));
  assert.equal(requests, 0);
});

test('keeps signup successful when the analytics request fails', async () => {
  let attempted = false;
  const post = async () => {
    attempted = true;
    throw new Error('Network unavailable');
  };

  await assert.doesNotReject(() => trackOpenAiRegistration(post, browser('__Secure-pp-openai-ads-click=opaque')));
  assert.equal(attempted, true);
});
