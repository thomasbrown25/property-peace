const read = (object, camelName, pascalName) => object?.[camelName] ?? object?.[pascalName];
const hasValue = (value) => value !== null && value !== undefined && value !== '';
const nullableNumber = (value) => (hasValue(value) ? Number(value) : null);

const toInputDate = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const normalizeRentFrequencyForForm = (value) => String(value || 'monthly').toLowerCase();
const normalizeRentFrequencyForApi = (value) => {
  if (value === 'monthly') return 'Monthly';
  if (value === 'quarterly') return 'Quarterly';
  if (value === 'yearly') return 'Yearly';
  return value;
};

const getFees = (lease) => read(lease, 'fees', 'Fees') || [];
const isLateFee = (fee) => Boolean(read(fee, 'isLateFee', 'IsLateFee'));
const isPetFee = (fee) => !isLateFee(fee) && String(read(fee, 'name', 'Name') || '').trim().toLowerCase() === 'pet fee';

const mapExistingLateFee = (fee) => ({
  Name: read(fee, 'name', 'Name') || '',
  Amount: Number(read(fee, 'amount', 'Amount') || 0),
  DueDate: read(fee, 'dueDate', 'DueDate'),
  IsLateFee: true,
  LateFeeType: read(fee, 'lateFeeType', 'LateFeeType') ?? null,
  FeeType: read(fee, 'feeType', 'FeeType') ?? null,
  PercentValue: read(fee, 'percentValue', 'PercentValue') ?? null,
  AppliedAfterDays: read(fee, 'appliedAfterDays', 'AppliedAfterDays') ?? null,
  StartingAfterDays: read(fee, 'startingAfterDays', 'StartingAfterDays') ?? null,
  LimitType: read(fee, 'limitType', 'LimitType') ?? null,
  LimitDays: read(fee, 'limitDays', 'LimitDays') ?? null,
  LimitAmount: read(fee, 'limitAmount', 'LimitAmount') ?? null,
  LimitAmountType: read(fee, 'limitAmountType', 'LimitAmountType') ?? null
});

const buildMoveInFee = (name, amount, dueDate) => ({
  Name: name,
  Amount: Number(amount),
  DueDate: dueDate,
  IsLateFee: false,
  LateFeeType: null,
  FeeType: null,
  PercentValue: null,
  AppliedAfterDays: null,
  StartingAfterDays: null,
  LimitType: null,
  LimitDays: null,
  LimitAmount: null,
  LimitAmountType: null
});

export const buildLeaseEditInitialValues = (lease) => {
  if (!lease) return {};

  const fees = getFees(lease);
  const petFee = fees.find(isPetFee);
  const proratedRentDue = Boolean(
    read(lease, 'proratedRentDue', 'ProratedRentDue') ?? read(lease, 'isProratedRent', 'IsProratedRent')
  );

  return {
    name: read(lease, 'name', 'Name') ?? '',
    propertyId: read(lease, 'propertyId', 'PropertyId') ?? '',
    unitId: read(lease, 'unitId', 'UnitId') ?? '',
    leaseStartDate: toInputDate(read(lease, 'startDate', 'StartDate')),
    leaseEndDate: toInputDate(read(lease, 'endDate', 'EndDate')),
    allPaymentsOnTime: false,
    rentFrequency: normalizeRentFrequencyForForm(read(lease, 'rentFrequency', 'RentFrequency')),
    rentDueDay: read(lease, 'rentDueDay', 'RentDueDay') ?? 1,
    leaseLength: read(lease, 'leaseLength', 'LeaseLength') ?? 12,
    rentAmount: read(lease, 'rentAmount', 'RentAmount') ?? '',
    proratedRentDue,
    prorationMethod: read(lease, 'prorationMethod', 'ProrationMethod') ?? 'calculated',
    proratedRentAmount: read(lease, 'proratedRentAmount', 'ProratedRentAmount') ?? '',
    securityDeposit: read(lease, 'depositAmount', 'DepositAmount') ?? '',
    petDeposit: read(lease, 'petDepositAmount', 'PetDepositAmount') ?? '',
    petFee: petFee ? read(petFee, 'amount', 'Amount') : '',
    otherMoveInCharges: fees
      .filter((fee) => !isLateFee(fee) && !isPetFee(fee))
      .map((fee) => ({
        name: read(fee, 'name', 'Name') || '',
        amount: read(fee, 'amount', 'Amount') ?? ''
      })),
    autoRenewLease: Boolean(read(lease, 'autoRenewLease', 'AutoRenewLease')),
    autoRenewLeaseLength:
      read(lease, 'autoRenewLeaseLength', 'AutoRenewLeaseLength') ?? read(lease, 'leaseLength', 'LeaseLength') ?? 12,
    autoRenewRentIncrement: Boolean(read(lease, 'autoRenewRentIncrement', 'AutoRenewRentIncrement')),
    autoRenewRentIncrementType: read(lease, 'autoRenewRentIncrementType', 'AutoRenewRentIncrementType') ?? 'percentage',
    autoRenewRentIncrementValue: read(lease, 'autoRenewRentIncrementValue', 'AutoRenewRentIncrementValue') ?? '',
    createChecklistOnStartDate: Boolean(read(lease, 'createChecklistOnStartDate', 'CreateChecklistOnStartDate'))
  };
};

export const buildLeaseEditPayload = (values, lease) => {
  const prorated = Boolean(values.proratedRentDue);
  const dueDate = values.leaseStartDate ? new Date(values.leaseStartDate) : new Date();
  const fees = getFees(lease).filter(isLateFee).map(mapExistingLateFee);

  if (hasValue(values.petFee) && Number(values.petFee) >= 0) {
    fees.push(buildMoveInFee('Pet Fee', values.petFee, dueDate));
  }
  (values.otherMoveInCharges || []).forEach((charge) => {
    if (charge?.name?.trim() && hasValue(charge.amount) && Number(charge.amount) >= 0) {
      fees.push(buildMoveInFee(charge.name.trim(), charge.amount, dueDate));
    }
  });

  return {
    Id: Number(read(lease, 'id', 'Id')),
    Name: values.name?.trim() || null,
    PropertyId: Number(read(lease, 'propertyId', 'PropertyId')),
    UnitId: Number(read(lease, 'unitId', 'UnitId')),
    StartDate: new Date(values.leaseStartDate),
    EndDate: new Date(values.leaseEndDate),
    RentAmount: Number(values.rentAmount),
    DepositAmount: nullableNumber(values.securityDeposit),
    PetDepositAmount: nullableNumber(values.petDeposit),
    LeaseLength: Number(values.leaseLength),
    RentFrequency: normalizeRentFrequencyForApi(values.rentFrequency),
    RentDueDay: Number(values.rentDueDay),
    ProratedRentDue: prorated,
    IsProratedRent: prorated,
    ProrationMethod: prorated ? values.prorationMethod || 'calculated' : null,
    ProratedRentAmount: prorated ? nullableNumber(values.proratedRentAmount) : null,
    Fees: fees,
    AutoRenewLease: Boolean(values.autoRenewLease),
    AutoRenewLeaseLength: values.autoRenewLease ? Number(values.autoRenewLeaseLength || values.leaseLength || 12) : null,
    AutoRenewRentIncrement: values.autoRenewLease ? Boolean(values.autoRenewRentIncrement) : false,
    AutoRenewRentIncrementType:
      values.autoRenewLease && values.autoRenewRentIncrement ? values.autoRenewRentIncrementType : null,
    AutoRenewRentIncrementValue:
      values.autoRenewLease && values.autoRenewRentIncrement ? nullableNumber(values.autoRenewRentIncrementValue) : null,
    CreateChecklistOnStartDate: Boolean(values.createChecklistOnStartDate),
    MarkPastPaymentsAsPaid: Boolean(values.allPaymentsOnTime),
    ...(read(lease, 'organizationId', 'OrganizationId') != null && {
      OrganizationId: Number(read(lease, 'organizationId', 'OrganizationId'))
    })
  };
};
