import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../sections/landlord/dashboard/MoneySummary.jsx', import.meta.url), 'utf8');
const overviewSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');

test('money summary renders one chart and exactly three stacked summary cards', () => {
  assert.match(source, /ResponsiveContainer/);
  assert.match(source, /BarChart/);
  assert.match(source, /direction=\"column\"/);
  assert.match(source, /const metricCards = \[/);
  assert.doesNotMatch(source, /label:\s*['\"]Outstanding['\"]/);
});

test('money summary uses the requested metric labels and chart series', () => {
  assert.match(source, /label:\s*['\"]Expected Rent['\"]/);
  assert.match(source, /label:\s*['\"]Income['\"]/);
  assert.match(source, /label:\s*['\"]Expenses['\"]/);
  assert.match(source, /dataKey=\"income\"/);
  assert.match(source, /dataKey=\"expenses\"/);
});

test('all summary card headings and amounts use bold navy typography', () => {
  assert.match(source, /function MetricCard\(\{ label, value, accentColor, textColor \}\)/);
  assert.match(source, /variant=\"body2\" fontWeight=\{700\} sx=\{\{ mb: 0\.75, color: textColor \}\}/);
  assert.match(source, /variant=\"h4\" fontWeight=\{700\} sx=\{\{ color: textColor,/);
  assert.match(source, /accentColor=\{metric\.color\}[\s\S]*textColor=\{navy\}/);
});

test('money summary exposes a working period dropdown instead of a static month chip', () => {
  assert.match(source, /\bSelect\b/);
  assert.match(source, /['\"]aria-label['\"]:\s*['\"]Money summary period['\"]/);
  assert.match(source, /value=\{period\}/);
  assert.match(source, /onChange=\{\(event\) => setPeriod\(event\.target\.value\)\}/);
  assert.match(source, /<MenuItem value=\"this-month\">This month<\/MenuItem>/);
  assert.match(source, /<MenuItem value=\"all-time\">All time<\/MenuItem>/);
});

test('collection progress is exported as its own dashboard-grid card', () => {
  assert.match(source, /function CollectionProgressCard/);
  assert.match(source, /export function RentCollectionProgress/);
  assert.match(source, /height:\s*['"]100%['"]/);
  assert.match(source, /<Typography variant="h5" fontWeight=\{700\} sx=\{\{ color: navy \}\}>\s*Rent Collection Progress/);
  assert.match(source, /aria-label="Rent collection progress"/);
  assert.match(overviewSource, /gridArea:\s*['"]progress['"]/);
  assert.match(overviewSource, /<RentCollectionProgress summary=\{summary\}/);
  assert.match(overviewSource, /gridArea:\s*['"]money['"]/);
});

test('money summary uses finalized payment history for current-month income and daily chart bars', () => {
  assert.match(source, /buildCurrentMonthMoneySeries/);
  assert.match(source, /summarizeCurrentMonthRentIncome/);
  assert.match(source, /Math\.max\(monthlyMetrics\.income, paymentHistoryIncome\)/);
  assert.match(source, /dataKey="label"/);
  assert.match(source, /interval=\{isAllTime \? 0 : 3\}/);
  assert.match(source, /angle=\{isAllTime \? 0 : 90\}/);
  assert.match(source, /maxBarSize=\{isAllTime \? 38 : 7\}/);
  assert.doesNotMatch(source, /<CartesianGrid/);
});

test('money summary gives the chart more vertical space and keeps its legend tight to the chart and card bottom', () => {
  assert.match(source, /contentSX=\{\{ pt: 1\.5, pb: 0, '&:last-child': \{ pb: 0 \}, display: 'flex', flexDirection: 'column' \}\}/);
  assert.match(source, /minHeight: \{ xs: 296, sm: 316 \}/);
  assert.match(source, /<Box sx=\{\{ height: \{ xs: 190, sm: 215 \}, minHeight: 0 \}\}>/);
  assert.match(source, /justifyContent="center" sx=\{\{ mt: 0, mb: 0 \}\}/);
});
