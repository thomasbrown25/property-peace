// Rent status comes from the scoped, current rent-collection record, not conversation history.
export function getMessageRentStatus(records, leaseId) {
  if (!leaseId || !Array.isArray(records)) return { label: 'Unavailable', color: 'text.secondary' };
  const record = records.find((item) => String(item?.leaseId ?? item?.LeaseId) === String(leaseId));
  if (!record) return { label: 'Unavailable', color: 'text.secondary' };

  const overdue = Number(record.overdueAmount ?? record.OverdueAmount);
  const rentDue = Number(record.rentDue ?? record.RentDue);
  const expected = Number(record.currentMonthExpected ?? record.CurrentMonthExpected);
  if (![overdue, rentDue, expected].every(Number.isFinite) || overdue < 0 || rentDue < 0 || expected < 0) {
    return { label: 'Unavailable', color: 'text.secondary' };
  }
  if (overdue > 0) return { label: 'Overdue', color: 'error.main' };
  if (rentDue > 0) return { label: 'Payment due', color: 'warning.main' };
  return expected > 0
    ? { label: 'Paid', color: 'success.main' }
    : { label: 'No rent due', color: 'text.secondary' };
}
