// Compare business calendar dates without shifting date-only values across timezones.
const calendarDate = value => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === `${year}-${month}-${day}` ? `${year}-${month}-${day}` : null;
};

// Use the ledger's allocations: a payment received this month can cover older rent.
// No allocation, incomplete allocation, non-final attempts, and missing dates remain unknown.
export function getPaymentTiming(payment, charges) {
  if (!['completed', 'paid'].includes(String(payment.status).toLowerCase()) || !(Number(payment.amount) > 0)) return null;
  const paidOn = calendarDate(payment.paymentDate);
  if (!paidOn || !Array.isArray(charges)) return null;
  const type = payment.feeId != null ? 'Fee' : payment.depositId != null ? 'Deposit' : 'Rent';
  const allocations = charges.filter(charge => charge.type === type
    && (type !== 'Fee' || charge.chargeId === `fee:${payment.feeId}`))
    .flatMap(charge => (charge.payments || [])
      .filter(receipt => String(receipt.id) === String(payment.id)
        && String(receipt.status).toLowerCase() === String(payment.status).toLowerCase()
        && calendarDate(receipt.paymentDate) === paidOn && Number(receipt.amount) > 0)
      .map(receipt => ({ due: calendarDate(charge.dueDate), amount: Number(receipt.amount) })));
  if (allocations.some(item => item.due && paidOn > item.due)) return 'Late';
  const allocated = allocations.reduce((sum, item) => sum + item.amount, 0);
  if (allocations.length && allocations.every(item => item.due) && Math.abs(allocated - Number(payment.amount)) < 0.005) return 'On time';
  return null;
}

export async function loadPaymentTimings(payments, getCharges) {
  const leaseIds = [...new Set(payments.map(payment => payment.leaseId).filter(id => id != null).map(String))];
  const ledgers = new Map(await Promise.all(leaseIds.map(async leaseId => {
    try {
      const charges = await getCharges(leaseId);
      if (!Array.isArray(charges)) throw new Error('Invalid charges response');
      return [leaseId, charges];
    } catch {
      return [leaseId, null];
    }
  })));
  return {
    payments: payments.map(payment => ({ ...payment, paymentTiming: getPaymentTiming(payment, ledgers.get(String(payment.leaseId))) })),
    timingError: [...ledgers.values()].some(charges => charges === null)
  };
}
