import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function start(path) {
  const location = new URL(path, 'https://app.propertypeace.io');
  const state = { idx: 0, key: 'login' };
  const replacements = [];
  const scripts = [];
  const history = {
    state,
    replaceState(currentState, title, href) {
      assert.equal(currentState, state);
      replacements.push(href);
      location.href = new URL(href, location).href;
    }
  };
  const context = { location, history, URL };
  context.window = context;
  context.document = {
    createElement: () => new EventTarget(),
    head: { appendChild: (script) => scripts.push(script) }
  };
  runInNewContext(bootstrap, context);
  return { location, replacements, scripts, commands: context.dataLayer?.map((args) => Array.from(args)) };
}

test('keeps the linker in the landing URL through Google Ads initialization, then replaces the history entry', () => {
  const { location, replacements, commands } = start('/login?_gl=linker');
  assert.equal(location.search, '?_gl=linker');
  assert.deepEqual(Array.from(commands[1]), ['config', 'AW-17815665224']);
  const [command, target, field, ready] = commands[2];
  assert.deepEqual([command, target, field], ['get', 'AW-17815665224', 'gclid']);
  ready();
  assert.deepEqual(replacements, ['/login']);
});

test('preserves current sign-in parameters and the fragment if the Google script fails', () => {
  const { location, replacements, scripts } = start('/login?_gl=linker&error=email-exists&inviteToken=a%2Bb#form');
  location.searchParams.delete('error');
  scripts[0].dispatchEvent(new Event('error'));
  assert.deepEqual(replacements, ['/login?inviteToken=a%2Bb#form']);
});

test('a late Google callback leaves the new route alone', () => {
  const { location, replacements, commands } = start('/login?_gl=linker');
  location.pathname = '/register/landlord';
  commands[2][3]();
  assert.deepEqual(replacements, []);
});

test('plain login and other routes skip cleanup, and screening still skips tracking', () => {
  assert.equal(start('/login?auth=jwt').commands.length, 2);
  assert.equal(start('/register/landlord?_gl=linker').commands.length, 2);
  assert.equal(start('/screening/token?_gl=linker').scripts.length, 0);
});
