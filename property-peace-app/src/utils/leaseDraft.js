const hasValue = (value) => value !== null && value !== undefined && value !== '';

const nullableNumber = (value) => (hasValue(value) ? Number(value) : null);
const nullableDate = (value) => (hasValue(value) ? new Date(value) : null);

const normalizeRentFrequency = (value) => {
  if (!hasValue(value)) return null;
  if (value === 'monthly') return 'Monthly';
  if (value === 'quarterly') return 'Quarterly';
  if (value === 'yearly') return 'Yearly';
  return value;
};

const parseInputDate = (value) => {
  if (!hasValue(value)) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dueDateInMonth = (year, month, dueDay) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(Number(dueDay), 1), lastDay));
};

/**
 * Calculates rent from the lease start date (inclusive) through the next regular
 * rent due date (exclusive). Each day uses that calendar month's monthly rent /
 * actual days in month, so month boundaries and leap years remain accurate.
 */
export const calculateProratedRent = (startValue, dueDayValue, monthlyRentValue) => {
  const start = parseInputDate(startValue);
  const dueDay = Number(dueDayValue);
  const monthlyRent = Number(monthlyRentValue);
  if (!start || !Number.isFinite(dueDay) || !Number.isFinite(monthlyRent) || monthlyRent < 0) return null;

  let nextDue = dueDateInMonth(start.getFullYear(), start.getMonth(), dueDay);
  if (nextDue < start) nextDue = dueDateInMonth(start.getFullYear(), start.getMonth() + 1, dueDay);
  if (nextDue.getTime() === start.getTime()) return 0;

  let amount = 0;
  const cursor = new Date(start);
  while (cursor < nextDue) {
    amount += monthlyRent / new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const isLeaseReadyToCreate = (values) => {
  const rentAmount = nullableNumber(values.rentAmount);
  const rentDueDay = nullableNumber(values.rentDueDay);
  const leaseLength = nullableNumber(values.leaseLength);
  const proratedAmount = nullableNumber(values.proratedRentAmount);

  return Boolean(
    hasValue(values.propertyId) &&
    hasValue(values.leaseStartDate) &&
    hasValue(values.leaseEndDate) &&
    hasValue(values.rentFrequency) &&
    Number.isFinite(rentAmount) && rentAmount >= 0 &&
    Number.isFinite(rentDueDay) && rentDueDay >= 1 && rentDueDay <= 31 &&
    Number.isFinite(leaseLength) && leaseLength >= -1 &&
    (!values.proratedRentDue || (Number.isFinite(proratedAmount) && proratedAmount > 0))
  );
};

export const buildLeaseSubmissionPayload = (values, resolvedUnitId, isDraft) => {
  const dueDate = nullableDate(values.leaseStartDate) || new Date();
  const fee = (name, amount) => ({
    Name: name,
    Amount: Number(amount),
    DueDate: dueDate,
    IsLateFee: false
  });
  const fees = [];
  if (hasValue(values.petFee) && Number(values.petFee) >= 0) fees.push(fee('Pet Fee', values.petFee));
  (values.otherMoveInCharges || []).forEach((charge) => {
    if (charge?.name?.trim() && hasValue(charge.amount) && Number(charge.amount) >= 0) {
      fees.push(fee(charge.name.trim(), charge.amount));
    }
  });

  const prorated = Boolean(values.proratedRentDue);
  return {
    PropertyId: Number(values.propertyId) || 0,
    UnitId: Number(resolvedUnitId) || 0,
    Name: values.name?.trim() || null,
    StartDate: nullableDate(values.leaseStartDate),
    EndDate: nullableDate(values.leaseEndDate),
    RentAmount: nullableNumber(values.rentAmount),
    DepositAmount: nullableNumber(values.securityDeposit),
    PetDepositAmount: nullableNumber(values.petDeposit),
    LeaseLength: nullableNumber(values.leaseLength),
    RentFrequency: normalizeRentFrequency(values.rentFrequency),
    RentDueDay: nullableNumber(values.rentDueDay),
    ProratedRentDue: prorated,
    IsProratedRent: prorated,
    ProrationMethod: prorated ? values.prorationMethod || 'calculated' : null,
    ProratedRentAmount: prorated ? nullableNumber(values.proratedRentAmount) : null,
    Fees: fees,
    AutoRenewLease: Boolean(values.autoRenewLease),
    AutoRenewLeaseLength: values.autoRenewLease
      ? nullableNumber(values.autoRenewLeaseLength ?? values.leaseLength)
      : null,
    AutoRenewRentIncrement: values.autoRenewLease ? Boolean(values.autoRenewRentIncrement) : false,
    AutoRenewRentIncrementType: values.autoRenewLease && values.autoRenewRentIncrement
      ? values.autoRenewRentIncrementType || null
      : null,
    AutoRenewRentIncrementValue: values.autoRenewLease && values.autoRenewRentIncrement
      ? nullableNumber(values.autoRenewRentIncrementValue)
      : null,
    MarkPastPaymentsAsPaid: !isDraft && Boolean(values.allPaymentsOnTime),
    CreateChecklistOnStartDate: Boolean(values.createChecklistOnStartDate),
    IsDrafted: Boolean(isDraft),
    IsActive: !isDraft
  };
};
