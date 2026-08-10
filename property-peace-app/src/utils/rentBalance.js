const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const nonNegativeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const sumUnpaidFees = (record) => {
  const fees = firstDefined(record?.unpaidFees, record?.UnpaidFees, []);
  if (!Array.isArray(fees)) return 0;

  return fees.reduce(
    (sum, fee) => sum + nonNegativeNumber(firstDefined(fee?.amountDue, fee?.AmountDue, fee?.amount, fee?.Amount)),
    0
  );
};

/**
 * Produces one canonical rent-only balance from camelCase or PascalCase
 * rent-collection records. Canonical API fields always win; the remaining
 * branches exist only for older collection responses.
 */
export const normalizeRentBalance = (record) => {
  if (!record || typeof record !== 'object') {
    return { rentDue: 0, rentDueIsOverdue: false, currentMonthRentDue: 0, overdueAmount: 0 };
  }

  const canonicalRentDue = firstDefined(record.rentDue, record.RentDue);
  const canonicalOverdueAmount = firstDefined(record.overdueAmount, record.OverdueAmount);
  const explicitCurrentRent = firstDefined(record.currentMonthRentDue, record.CurrentMonthRentDue);
  const explicitPriorRent = firstDefined(record.priorPeriodOverdueRent, record.PriorPeriodOverdueRent);
  const overdueAmount = nonNegativeNumber(
    canonicalOverdueAmount !== undefined ? canonicalOverdueAmount : explicitPriorRent
  );

  let currentMonthRentDue;
  let rentDue;

  if (canonicalRentDue !== undefined) {
    rentDue = nonNegativeNumber(canonicalRentDue);
    currentMonthRentDue = explicitCurrentRent !== undefined
      ? nonNegativeNumber(explicitCurrentRent)
      : Math.max(rentDue - overdueAmount, 0);
  } else if (explicitCurrentRent !== undefined) {
    currentMonthRentDue = nonNegativeNumber(explicitCurrentRent);
    rentDue = currentMonthRentDue + overdueAmount;
  } else {
    const amountDueNow = firstDefined(record.amountDueNow, record.AmountDueNow);
    if (amountDueNow !== undefined) {
      rentDue = Math.max(nonNegativeNumber(amountDueNow) - sumUnpaidFees(record), 0);
      currentMonthRentDue = Math.max(rentDue - overdueAmount, 0);
    } else {
      currentMonthRentDue = nonNegativeNumber(firstDefined(record.rentAmount, record.RentAmount));
      rentDue = currentMonthRentDue + overdueAmount;
    }
  }

  const canonicalOverdue = firstDefined(record.rentDueIsOverdue, record.RentDueIsOverdue);
  const currentRentIsOverdue = firstDefined(record.currentMonthRentIsOverdue, record.CurrentMonthRentIsOverdue, false);
  const rentDueIsOverdue = canonicalOverdue !== undefined
    ? canonicalOverdue === true
    : rentDue > 0 && (overdueAmount > 0 || currentRentIsOverdue === true);

  return { rentDue, rentDueIsOverdue, currentMonthRentDue, overdueAmount };
};
