import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const text = (node) => source.slice(node.start, node.end);
function collect(node, predicate, parents = [], matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push({ node, parents });
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => collect(child, predicate, [...parents, node], matches));
    else if (value && typeof value === 'object') collect(value, predicate, [...parents, node], matches);
  }
  return matches;
}

test('market estimate is directly below Base rent and only mounted in the rent step', () => {
  const cards = collect(ast, (node) => node.type === 'JSXElement' && node.openingElement.name.name === 'RentEstimateCard');
  assert.equal(cards.length, 1);
  const { node, parents } = cards[0];
  assert.ok(parents.some((parent) => parent.type === 'LogicalExpression' && text(parent.left) === 'active === 1'));
  assert.ok(parents.some((parent) => parent.type === 'LogicalExpression' && text(parent.left) === 'property && unit'));
  const fragment = parents.findLast((parent) => parent.type === 'JSXFragment');
  const children = fragment.children.filter((child) => child.type !== 'JSXText');
  const index = children.findIndex((child) => child.start <= node.start && child.end >= node.end);
  assert.equal(children[index - 1].openingElement.name.name, 'NumericFormat');
  assert.match(text(children[index - 1]), /label="Base rent"/);
  assert.match(text(children[index + 1]), /field\('rentDueDay'/);
});

test('estimate uses selected property/unit identity, resets when selection changes, and does not overwrite rent', () => {
  const [{ node }] = collect(ast, (node) => node.type === 'JSXOpeningElement' && node.name.name === 'RentEstimateCard');
  const props = Object.fromEntries(node.attributes.map((attribute) => [attribute.name.name, attribute.value.expression]));
  assert.equal(text(props.propertyId), 'setupId(property)');
  assert.equal(text(props.unitId), 'setupId(unit)');
  assert.equal(text(props.key), '`${setupId(property)}:${setupId(unit)}`');
  assert.equal(props.onUseAmount, undefined);
  assert.match(source, /import RentEstimateCard from 'components\/RentEstimateCard'/);
});
