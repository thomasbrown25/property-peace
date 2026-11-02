export function combinePropertyFinances(payments = [], expenses = [], propertyId) {
  const matchesProperty = record => {
    const id = record.propertyId ?? record.PropertyId ?? record.property?.id ?? record.lease?.propertyId;
    return id == null || String(id) === String(propertyId);
  };
  return [
    ...payments.filter(matchesProperty).map(record => ({ kind: 'income', record, date: record.paymentDate || record.date })),
    ...expenses.filter(matchesProperty).map(record => ({ kind: 'expense', record, date: record.expenseDate }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
