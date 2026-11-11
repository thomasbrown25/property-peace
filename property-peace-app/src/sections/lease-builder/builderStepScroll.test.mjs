import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

for (const [name, path] of [
  ['Create a lease', './LeaseSetupBuilder.jsx'],
  ['Create lease agreement', '../../pages/landlord/build-lease-agreement.jsx']
]) {
  test(`${name} resets page scroll after an active-step change`, () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    const effects = [];
    walk(ast, (node) => {
      if (node.type !== 'CallExpression' || node.callee.name !== 'useEffect') return;
      const dependencies = node.arguments[1];
      if (dependencies?.type === 'ArrayExpression' && dependencies.elements.length === 1 &&
          dependencies.elements[0]?.name === 'active') effects.push(node.arguments[0]);
    });
    assert.equal(effects.length, 1, 'scroll effect depends only on the active step, not form edits or save state');
    const calls = [];
    const effect = vm.runInNewContext(`(${source.slice(effects[0].start, effects[0].end)})`, {
      formRef: { current: null },
      window: { scrollTo: (options) => calls.push(JSON.parse(JSON.stringify(options))) }
    });
    effect();
    assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
  });
}
