import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../sections/landlord/dashboard/MoneySummary.jsx', import.meta.url), 'utf8');

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

test('collection progress is a separate full-width card above money summary', () => {
  assert.match(source, /function CollectionProgressCard/);
  assert.match(source, /gridColumn:\s*['"]1 \/ -1['"]/);
  assert.match(source, /<Typography variant="h5" fontWeight=\{700\} sx=\{\{ color: navy \}\}>\s*Rent Collection Progress/);
  assert.match(source, /aria-label="Rent collection progress"/);

  const renderedProgress = source.indexOf('<CollectionProgressCard');
  const renderedMoneySummary = source.indexOf(
    '<MainCard',
    source.indexOf('return (', source.indexOf('export default function MoneySummary'))
  );
  assert.ok(renderedProgress > -1 && renderedProgress < renderedMoneySummary);
});

test('money summary uses a narrow daily time-series chart for the current month', () => {
  assert.match(source, /function buildDailyChartData/);
  assert.match(source, /dataKey="label"/);
  assert.match(source, /interval=\{isAllTime \? 0 : 3\}/);
  assert.match(source, /angle=\{isAllTime \? 0 : 90\}/);
  assert.match(source, /maxBarSize=\{isAllTime \? 38 : 7\}/);
  assert.doesNotMatch(source, /<CartesianGrid/);
});

test('money summary gives the chart more vertical space and keeps its legend tight to the chart and card bottom', () => {
  assert.match(source, /contentSX=\{\{ pt: 1\.5, pb: 0, display: 'flex', flexDirection: 'column' \}\}/);
  assert.match(source, /<Box sx=\{\{ height: \{ xs: 190, sm: 215 \}, minHeight: 0 \}\}>/);
  assert.match(source, /justifyContent="center" sx=\{\{ mt: 0, mb: 0 \}\}/);
});
