import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../sections/landlord/dashboard/MoneySummary.jsx', import.meta.url), 'utf8');
const portfolioSource = fs.readFileSync(new URL('../sections/landlord/dashboard/Portfolio.jsx', import.meta.url), 'utf8');
const overviewSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');

test('money summary renders one chart and exactly two stacked summary cards', () => {
  assert.match(source, /ResponsiveContainer/);
  assert.match(source, /BarChart/);
  assert.match(source, /direction=\"column\"/);
  const metricCards = source.match(/const metricCards = \[([\s\S]*?)\n  \];/)?.[1];
  assert.ok(metricCards);
  assert.equal((metricCards.match(/label:\s*'/g) || []).length, 2);
  assert.doesNotMatch(metricCards, /label:\s*['\"](?:Rent Due|Outstanding)['\"]/);
});

test('money summary uses the requested metric labels, subtitle copy, icons and chart series', () => {
  assert.match(source, /label:\s*['\"]Income['\"]/);
  assert.match(source, /description:\s*isAllTime\s*\?\s*['\"]Rent collected all time['\"]\s*:\s*['\"]Rent collected this month['\"]/);
  assert.doesNotMatch(source, /description:\s*['\"]Total rent collected['\"]/);
  assert.match(source, /label:\s*['\"]Expenses['\"]/);
  assert.match(source, /description:\s*['\"]Total property expenses['\"]/);
  assert.match(source, /color: incomeColor,[\s\S]*?icon: <svg/);
  assert.match(source, /color: expenseColor,[\s\S]*?icon: <svg/);
  assert.match(source, /dataKey=\"income\"/);
  assert.match(source, /dataKey=\"expenses\"/);
});

test('summary card headings and amounts use bold, dark-mode-aware typography', () => {
  assert.match(source, /function MetricCard\(\{ label, description, value, accentColor, textColor, icon \}\)/);
  assert.match(source, /variant=\"body2\" fontWeight=\{700\} sx=\{\{ color: textColor, lineHeight:/);
  assert.match(source, /variant=\"h4\" fontWeight=\{700\} sx=\{\{ ml: 7, mt: 1, color: textColor,/);
  assert.match(source, /const summaryTextColor = theme\.palette\.mode === 'dark' \? theme\.palette\.common\.white : '#061e35'/);
  assert.match(source, /accentColor=\{metric\.color\}[\s\S]*textColor=\{summaryTextColor\}[\s\S]*icon=\{metric\.icon\}/);
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
  assert.match(source, /const textColor = theme\.palette\.mode === 'dark' \? theme\.palette\.common\.white : '#061e35'/);
  assert.match(source, /<Typography variant="h5" fontWeight=\{700\} sx=\{\{ color: textColor \}\}>\s*Rent Collection\s*<\/Typography>/);
  assert.match(source, /Collected <Box component="span" sx=\{\{ color: incomeColor, fontWeight: 700 \}\}>\{formatCurrency\(collectedRent\)\}<\/Box> of \{formatCurrency\(expectedRent\)\}/);
  assert.match(source, /collectedRent=\{income\}/);
  assert.match(source, /expectedRent=\{expectedRent\}/);
  assert.match(source, /<Stack direction="row" alignItems="center" spacing=\{1\.5\}>\s*<LinearProgress/);
  assert.match(source, /<Typography variant="body2" color="text.secondary" sx=\{\{ flexShrink: 0, minWidth: 36, textAlign: 'right' \}\}>\s*\{collectionPct\.toFixed\(0\)\}%/);
  assert.match(source, /aria-label="Rent collection progress"/);
  assert.match(overviewSource, /gridArea:\s*['"]progress['"]/);
  assert.match(overviewSource, /<RentCollectionProgress summary=\{summary\}/);
  assert.match(overviewSource, /gridArea:\s*['"]money['"]/);
});

test('portfolio headings and overview values use white typography in dark mode', () => {
  assert.match(portfolioSource, /const overviewTextColor = theme\.palette\.mode === 'dark' \? theme\.palette\.common\.white : 'text\.primary'/);
  assert.match(portfolioSource, /variant="caption" sx=\{\{ color: overviewTextColor/);
  assert.match(portfolioSource, /variant="h4" fontWeight=\{750\} sx=\{\{ color: overviewTextColor/);
  assert.match(portfolioSource, /const headerTextColor = theme\.palette\.mode === 'dark' \? theme\.palette\.common\.white : '#061e35'/);
  assert.match(portfolioSource, /variant="h5" fontWeight=\{700\} sx=\{\{ color: headerTextColor \}\}>\s*Portfolio/);
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
