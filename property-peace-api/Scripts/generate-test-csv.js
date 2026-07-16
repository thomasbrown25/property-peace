// Simple script to generate test-bank-statement.csv with dates from the past month
// Run with: node generate-test-csv.js

const fs = require('fs');
const path = require('path');

// Base date is 25 days ago (matching the SQL script)
const baseDate = new Date();
baseDate.setDate(baseDate.getDate() - 25);

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const csvLines = [
  'Date,Description,Amount,Reference,CheckNumber',
  `${formatDate(baseDate)},Rent Payment from Tenant,1500.00,PAY001,`,
  `${formatDate(new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000))},Maintenance Expense,-250.00,EXP001,`,
  `${formatDate(new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000))},Property Management Fee,-100.00,PM001,`,
  `${formatDate(new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000))},Rent Payment from Tenant,1200.00,PAY002,`,
  `${formatDate(new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000))},Bank Fee,-5.00,,`,
  `${formatDate(new Date(baseDate.getTime() + 13 * 24 * 60 * 60 * 1000))},Transfer from Savings,5000.00,TRF001,`,
  `${formatDate(new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000))},Utility Payment,-125.50,UTIL001,`
];

const csvContent = csvLines.join('\n') + '\n';
const csvPath = path.join(__dirname, 'test-bank-statement.csv');

fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log('Generated test-bank-statement.csv with dates from the past month');
console.log('Base date:', formatDate(baseDate));
