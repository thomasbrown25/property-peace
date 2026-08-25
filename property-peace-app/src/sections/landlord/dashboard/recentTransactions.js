const RECENT_TRANSACTION_LIMIT = 6;

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];

function buildPaymentItem(payment) {
  const propertyName = read(payment, 'propertyName', 'PropertyName') || '';
  const isSingleUnitProperty = read(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty') ?? false;
  const unitName = isSingleUnitProperty
    ? ''
    : read(payment, 'unitName', 'UnitName') || read(payment, 'unitNumber', 'UnitNumber') || '';
  const propertyId = read(payment, 'propertyId', 'PropertyId');

  return {
    id: `payment-${read(payment, 'id', 'Id')}`,
    kind: 'income',
    date: read(payment, 'paymentDate', 'PaymentDate'),
    title: [propertyName, unitName].filter(Boolean).join(' · ') || 'Rent payment',
    sub: 'Rent payment',
    amount: Number(read(payment, 'amount', 'Amount') || 0),
    onClick: propertyId ? `/landlord/property/${propertyId}` : '/landlord/finances?tab=activity'
  };
}

function buildExpenseItem(expense) {
  const propertyName = read(expense, 'propertyName', 'PropertyName') || '';
  const unitName = read(expense, 'unitName', 'UnitName') || '';

  return {
    id: `expense-${read(expense, 'id', 'Id')}`,
    kind: 'expense',
    date:
      read(expense, 'paidDate', 'PaidDate') ||
      read(expense, 'expenseDate', 'ExpenseDate') ||
      read(expense, 'createdAt', 'CreatedAt'),
    title:
      read(expense, 'name', 'Name') ||
      read(expense, 'description', 'Description') ||
      read(expense, 'category', 'Category') ||
      read(expense, 'categoryName', 'CategoryName') ||
      'Expense',
    sub: [propertyName, unitName].filter(Boolean).join(' · '),
    amount: Math.abs(Number(read(expense, 'amount', 'Amount') || 0)),
    onClick: '/landlord/finances?tab=expenses'
  };
}

export function buildRecentTransactions(payments = [], expenses = []) {
  const paymentItems = payments.map(buildPaymentItem);
  const expenseItems = expenses
    .filter((expense) => Boolean(read(expense, 'isPaid', 'IsPaid')))
    .map(buildExpenseItem);

  return [...paymentItems, ...expenseItems]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, RECENT_TRANSACTION_LIMIT);
}
