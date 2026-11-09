import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from '@babel/core';

// Compile the saved production source, not a reimplementation of its calculations/effects.
// A tiny Babel JSX transform keeps these tests independent of browser/native build tooling.
function compile(file, exportedName) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  return transformSync(source, {
    babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] },
    plugins: [({ types: t }) => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExpressionStatement(path) {
        if (t.isAssignmentExpression(path.node.expression) &&
          t.isMemberExpression(path.node.expression.left) &&
          path.node.expression.left.property.name === 'propTypes') path.remove();
      },
      JSXElement: { exit(path) {
        const opening = path.node.openingElement;
        const name = opening.name.name;
        const props = opening.attributes.map(attr => {
          if (t.isJSXSpreadAttribute(attr)) return t.spreadElement(attr.argument);
          const value = !attr.value ? t.booleanLiteral(true)
            : t.isJSXExpressionContainer(attr.value) ? attr.value.expression : attr.value;
          return t.objectProperty(t.stringLiteral(attr.name.name), value);
        });
        const children = path.node.children.flatMap(child => {
          if (t.isJSXText(child)) {
            const text = child.value.replace(/\s+/g, ' ').trim();
            return text ? [t.stringLiteral(text)] : [];
          }
          if (t.isJSXExpressionContainer(child)) return t.isJSXEmptyExpression(child.expression) ? [] : [child.expression];
          return [child];
        });
        path.replaceWith(t.callExpression(t.identifier('element'), [t.stringLiteral(name), t.objectExpression(props), ...children]));
      } }
    } })]
  }).code + `\nreturn ${exportedName};`;
}
const formCode = compile('./PaymentEntryForm.jsx', 'PaymentEntryForm');
const normalizeRentBalance = new Function(compile('../../utils/rentBalance.js', 'normalizeRentBalance'))();
const getCurrentRentPresentation = new Function(compile('../../utils/paymentSummaryPresentation.js', 'getCurrentRentPresentation'))();
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const element = (type, props, ...children) => ({ type, props, children: children.flat(Infinity).filter(v => v !== false && v != null) });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flatMap(nodes)];
const text = tree => typeof tree !== 'object' ? String(tree ?? '') : tree.children.map(text).join(' ');
const find = (tree, type, label) => nodes(tree).find(n => n.type === type && (!label || text(n) === label));
const lease = { id: 11, propertyId: 7, depositAmount: 500,
  unit: { name: 'SHOULD NOT SHOW UNIT', property: { name: 'SHOULD NOT SHOW PROPERTY' } } };
const record = { leaseId: 11, rentDue: 1000, currentMonthRentDue: 800, overdueAmount: 200,
  rentDueIsOverdue: true, currentMonthRentDueDate: '2026-11-01',
  unpaidFees: [{ feeId: 1, name: 'Late fee', amountDue: '25.50' }, { feeId: 2, name: 'Pet fee', amount: '14.50' }] };

function harness(options = {}, initialRent = { rentRecords: [], loading: true }) {
  const slots = [];
  let cursor, effects, dirty, tree;
  let props = { lease, paymentData: { amount: 0, amountDisplay: '', paymentDate: new Date('2026-11-01') }, ...options };
  let rent = initialRent;
  const calls = [], requests = [];
  const depsChanged = (old, next) => !old || !next || next.some((v, i) => !Object.is(v, old[i]));
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { value: initial };
    return [slots[index].value, value => {
      const next = typeof value === 'function' ? value(slots[index].value) : value;
      if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
    }];
  };
  const useEffect = (fn, deps) => {
    const index = cursor++;
    if (depsChanged(slots[index]?.deps, deps)) { slots[index] = { deps }; effects.push(fn); }
  };
  const useMemo = (fn, deps) => {
    const index = cursor++;
    if (depsChanged(slots[index]?.deps, deps)) slots[index] = { deps, value: fn() };
    return slots[index].value;
  };
  const axiosServices = { get(url) {
    return new Promise(resolve => requests.push({ url, resolve }));
  } };
  const Form = new Function('element', 'useState', 'useEffect', 'useMemo', 'useFetchRentCollection',
    'axiosServices', 'formatCurrency', 'normalizeRentBalance', 'getCurrentRentPresentation', 'AdapterDateFns', formCode)(
    element, useState, useEffect, useMemo, () => rent, axiosServices, currency,
    normalizeRentBalance, getCurrentRentPresentation, {});
  const change = data => { calls.push(data); props.paymentData = data; dirty = true; };
  const render = () => {
    let passes = 0;
    do {
      assert.ok(++passes < 30, 'hooks must settle without an update loop');
      cursor = 0; effects = []; dirty = false;
      tree = Form({ ...props, onPaymentDataChange: change });
      effects.forEach(fn => fn());
    } while (dirty);
    return tree;
  };
  return {
    render, calls, requests,
    get tree() { return tree; }, get payment() { return props.paymentData; },
    setRent(records, loading = false) { rent = { rentRecords: records, loading }; return render(); },
    setProps(overrides) { props = { ...props, ...overrides }; return render(); },
    async deposits(data = []) {
      assert.equal(requests.length, 1);
      requests[0].resolve({ data: { success: true, data } });
      await Promise.resolve(); await Promise.resolve();
      return render();
    }
  };
}
async function loaded(options = {}, rentRecord = record, deposits = []) {
  const h = harness(options);
  h.render(); h.setRent([rentRecord]); await h.deposits(deposits);
  return h;
}

test('renders h6 Payment details, no property/unit card, and a consistent summary with one divider', async () => {
  const h = await loaded({}, record, [{ amount: 200, receivedDate: '2026-10-01' }]);
  const heading = find(h.tree, 'Typography', 'Payment details');
  assert.equal(heading?.props.variant, 'h6');
  assert.doesNotMatch(text(h.tree), /SHOULD NOT SHOW|Property\/Unit|Property & Unit|Unit details/i);
  const papers = nodes(h.tree).filter(n => n.type === 'Paper');
  assert.equal(papers.length, 1, 'no redundant property/unit card');
  const summary = papers[0];
  assert.equal(summary.props.variant, 'outlined');
  assert.equal(summary.props.sx.bgcolor, 'background.paper');
  assert.equal(summary.props.sx.borderColor, 'divider');
  assert.equal(summary.props.sx.boxShadow, 'none');
  assert.equal(nodes(summary).filter(n => n.type === 'Divider').length, 1);
  for (const [label, amount] of [['Rent', '$1,000.00'], ['Security deposit', '$300.00'], ['Late fee', '$25.50'], ['Pet fee', '$14.50']]) {
    const row = nodes(summary).find(n => n.type === 'Stack' && n.children.some(c => c.type === 'Typography' && text(c) === amount));
    assert.ok(row, `${label} row exists`);
    assert.ok(text(row).includes(label));
    assert.equal(row.props.justifyContent, 'space-between');
    const amountNode = row.children.find(c => c.type === 'Typography' && text(c) === amount);
    assert.equal(amountNode.props.variant, 'body2');
    assert.equal(amountNode.props.fontWeight, 600);
    assert.equal(amountNode.props.sx.fontVariantNumeric, 'tabular-nums');
  }
  assert.ok(text(summary).includes('Total due $1,340.00'));
  assert.equal(find(h.tree, 'TextField')?.props.helperText, 'Total due: $1,340.00');
  assert.equal(h.payment.amount, 1340, 'overdue rent is included, not counted again');
});

test('prefill waits for rent and async deposits; includes rent + unpaid deposit + numeric-string fees', async () => {
  const h = harness();
  h.render();
  assert.equal(h.calls.length, 0);
  assert.equal(h.requests[0].url, '/api/deposit/lease/11');
  h.setRent([record]);
  assert.equal(h.calls.length, 0, 'pending deposit request must block incomplete defaults');
  assert.ok(find(h.tree, 'CircularProgress'));
  await h.deposits([{ amount: 200, receivedDate: '2026-10-01' },
    { amount: 99, receivedDate: '2026-10-01', refundedDate: '2026-10-02' }, { amount: 99 }]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.payment.amount, 1340);
  assert.equal(h.payment.amountDisplay, '$1,340.00');
  h.render();
  assert.equal(h.calls.length, 1, 'stable totals do not cause repeated parent updates');
});

test('cached rent on mount still waits for the deposit request before prefill', async () => {
  const h = harness({}, { rentRecords: [record], loading: false });
  h.render();
  assert.equal(h.calls.length, 0, 'cached rent must not prefill before deposits resolve');
  await h.deposits([{ amount: 200, receivedDate: '2026-10-01' }]);
  assert.equal(h.payment.amount, 1340);
  assert.equal(h.calls.length, 1);
});

test('deposit-first arrival still waits for rent and then picks up asynchronously loaded fees', async () => {
  const h = harness(); h.render();
  await h.deposits([{ amount: 500, receivedDate: '2026-10-01' }]);
  assert.equal(h.calls.length, 0);
  h.setRent([record]);
  assert.equal(h.payment.amount, 1040);
  h.setRent([{ ...record, unpaidFees: [...record.unpaidFees, { feeId: 3, name: 'Utility', amountDue: '10' }] }]);
  assert.equal(h.payment.amount, 1050);
});

test('actual amount input edits survive blur and later async totals', async () => {
  const h = harness(); h.render();
  find(h.tree, 'TextField').props.onChange({ target: { value: '123.45' } });
  h.render();
  assert.equal(h.payment.amountEdited, true);
  find(h.tree, 'TextField').props.onBlur({ target: { value: '123.45' } });
  h.render();
  assert.equal(h.payment.amountDisplay, '$123.45');
  h.setRent([record]); await h.deposits();
  assert.equal(h.payment.amount, 123.45);
  assert.equal(h.calls.length, 2, 'only the input and blur callbacks updated payment');
});

test('suppressAutoPrefill preserves an explicit amount through all loads', async () => {
  const h = await loaded({ paymentData: { amount: 17, amountDisplay: '$17.00', suppressAutoPrefill: true } });
  assert.equal(h.calls.length, 0);
  assert.equal(h.payment.amount, 17);
});

test('zero total clears stale amount/display and settles without loops', async () => {
  const h = await loaded({ lease: { ...lease, depositAmount: 0 }, paymentData: { amount: 90, amountDisplay: '$90.00' } },
    { leaseId: 11, rentDue: 0, unpaidFees: [] });
  assert.equal(h.payment.amount, 0);
  assert.equal(h.payment.amountDisplay, '');
  assert.equal(h.calls.length, 1);
  assert.ok(text(h.tree).includes('Total due $0.00'));
});

test('PascalCase rent records/fees match lease and use canonical rent without double counting', async () => {
  const h = await loaded({}, { LeaseId: '11', RentDue: '1000', CurrentMonthRentDue: '800', OverdueAmount: '200',
    RentDueIsOverdue: true, CurrentMonthRentDueDate: '2026-11-01',
    UnpaidFees: [{ FeeId: 9, Name: 'Pascal fee', AmountDue: '25.50' }] });
  assert.equal(h.payment.amount, 1525.5);
  assert.equal(h.payment.amountDisplay, '$1,525.50');
  assert.ok(text(h.tree).includes('Pascal fee $25.50'));
});

test('matching override wins over collection; unrelated override does not prefill a wrong lease', async () => {
  const h = await loaded({ rentRecordOverride: { LeaseId: '11', RentDue: 70, UnpaidFees: [] } });
  assert.equal(h.payment.amount, 570);
  const other = await loaded({ rentRecordOverride: { LeaseId: 99, RentDue: 9000 } });
  assert.equal(other.payment.amount, 1540);
});
