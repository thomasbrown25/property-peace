import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isDetachedSingleUnitType } from '../../../utils/propertyType.js';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const sources = Object.fromEntries([
  ['records', './PropertyRecordsTabs.jsx'],
  ['occupancy', './PropertyOccupancyTab.jsx'],
  ['graph', '../../../components/OccupancyTimelineGraph.jsx']
].map(([name, path]) => [name, readFileSync(new URL(path, import.meta.url), 'utf8')]));
const asts = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, parse(source, { sourceType: 'module', plugins: ['jsx'] })]));
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function initializers(ast, name) {
  const found = [];
  walk(ast, node => { if (node.type === 'VariableDeclarator' && node.id.name === name) found.push(node.init); });
  return found;
}
function evaluate(source, node, context) {
  return new Function(...Object.keys(context), `return (${source.slice(node.start, node.end)});`)(...Object.values(context));
}
const read = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
test('record and occupancy columns use property type in either DTO casing, never returned unit count', () => {
  for (const [name, ast] of Object.entries(asts).filter(([name]) => name !== 'graph')) {
    const [expression] = initializers(ast, 'showUnitColumn');
    for (const [type, expected] of [['SingleFamily', false], ['single-family', false], ['SingleUnit', false], ['Townhouse', false], ['Condominium', false], ['MultiFamily', true], ['Apartment', true], [undefined, true]]) {
      for (const key of ['propertyType', 'PropertyType']) {
        for (const units of [[], [{ id: 1 }], [{ id: 1 }, { id: 2 }]]) {
          assert.equal(evaluate(sources[name], expression, { property: { [key]: type, units }, read, isDetachedSingleUnitType }), expected, `${name} ${key} ${type}`);
        }
      }
    }
  }
});
test('real record column selection hides only Unit and preserves actions and other fields', () => {
  const [expression] = initializers(asts.records, 'columns');
  const columns = ['Lease', 'Unit', 'Start', 'End', 'Status', 'Actions'].map(label => ({ label }));
  assert.deepEqual(evaluate(sources.records, expression, { allColumns: columns, showUnitColumn: false }).map(column => column.label), ['Lease', 'Start', 'End', 'Status', 'Actions']);
  assert.equal(evaluate(sources.records, expression, { allColumns: columns, showUnitColumn: true }), columns);
  assert.equal(columns.length, 6);
});
test('all four requested record tabs forward the visibility flag, including the async leasing wrapper', () => {
  const elements = [];
  walk(asts.records, node => { if (node.type === 'JSXOpeningElement') elements.push(node); });
  const attr = (node, key) => node.attributes.find(item => item.name?.name === key)?.value;
  for (const label of ['Leases', 'Tenants']) {
    const element = elements.find(node => node.name.name === 'RecordsTable' && attr(node, 'label')?.value === label);
    assert.equal(attr(element, 'showUnitColumn').expression.name, 'showUnitColumn');
  }
  for (const kind of ['listings', 'applications']) {
    const element = elements.find(node => node.name.name === 'PropertyLeasingRecords' && attr(node, 'kind')?.value === kind);
    assert.equal(attr(element, 'showUnitColumn').expression.name, 'showUnitColumn');
  }
  const wrapper = elements.find(node => node.name.name === 'RecordsTable' && attr(node, 'label')?.expression?.name === 'label');
  assert.equal(attr(wrapper, 'showUnitColumn').expression.name, 'showUnitColumn');
});
test('occupancy hides both header and body label cells while preserving month click handling', () => {
  const guardedCells = [];
  walk(asts.graph, node => {
    if (node.type === 'LogicalExpression' && node.operator === '&&' && node.left.name === 'showUnitColumn' && node.right.openingElement?.name.name === 'TableCell') guardedCells.push(node);
  });
  assert.equal(guardedCells.length, 2);
  assert.match(sources.graph, /showUnitColumn = true/);
  assert.match(sources.occupancy, /showUnitColumn=\{showUnitColumn\}/);
  assert.match(sources.graph, /onClick=\{onMonthClick \? \(\) => onMonthClick\(unit, month\) : undefined\}/);
  assert.match(sources.occupancy, /onMonthClick=\{\(unit, month\) => setSelection\(\{ unit, month \}\)\}/);
});
