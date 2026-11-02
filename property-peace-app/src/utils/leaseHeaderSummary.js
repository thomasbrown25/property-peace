import { normalizeRentBalance } from './rentBalance.js';

/** Header rent balance follows the same collection contract as the lease ledger. */
export const getLeaseHeaderBalance = (rentRecord, leaseBalanceDue = 0, isDraftLease = false) => {
  if (isDraftLease) return { amountDue: 0, overdueAmount: 0 };

  if (!rentRecord) {
    const fallback = Number(leaseBalanceDue);
    return { amountDue: Number.isFinite(fallback) ? Math.max(0, fallback) : 0, overdueAmount: 0 };
  }

  const { rentDue, overdueAmount, rentDueIsOverdue } = normalizeRentBalance(rentRecord);
  // The collection API's overdueAmount already includes overdue current-month rent.
  return {
    amountDue: rentDue,
    overdueAmount: Math.min(rentDue, overdueAmount || (rentDueIsOverdue ? rentDue : 0))
  };
};
