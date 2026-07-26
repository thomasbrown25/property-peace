const isAnswered = (value) => value !== null && value !== undefined &&
  (typeof value !== 'string' || value.trim().length > 0);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day ? parsed : null;
};
const isFiniteNumberInRange = (value, minimum, maximum = Number.POSITIVE_INFINITY) => {
  if (!isAnswered(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum;
};

export const computeLeasePreflightChecks = (lease) => {
  if (!lease) return [];

  const startDate = parseDateOnly(lease.startDate);
  const endDate = parseDateOnly(lease.endDate);

  return [
    {
      section: 'Lease Specifics',
      checks: [
        { label: 'Start date', ok: startDate !== null },
        { label: 'End date', ok: endDate !== null && startDate !== null && endDate > startDate },
        { label: 'Rent due day', ok: isFiniteNumberInRange(lease.rentDueDay, 1, 31) && Number.isInteger(Number(lease.rentDueDay)) }
      ]
    },
    {
      section: 'Rent, Deposit & Fees',
      checks: [
        { label: 'Monthly rent', ok: isFiniteNumberInRange(lease.rentAmount, Number.MIN_VALUE) },
        { label: 'Security deposit', ok: isFiniteNumberInRange(lease.depositAmount, 0) }
      ]
    },
    {
      section: 'People on the Lease',
      checks: [
        { label: 'Tenant(s) added', ok: lease.tenants?.length > 0 || lease.addTenantsLater === true },
        { label: 'Landlord info', ok: lease.leaseLandlords?.length > 0 || isNonEmptyString(lease.landlordName) }
      ]
    },
    {
      section: 'Pets, Smoking & Other',
      checks: [
        { label: 'Pet policy set', ok: isAnswered(lease.petsAllowed) },
        { label: 'Smoking policy set', ok: isAnswered(lease.smokingAllowed) }
      ]
    },
    {
      section: 'Utilities, Maintenance & Keys',
      checks: [
        { label: 'Utility responsibilities', ok: lease.utilityServiceResponsibilities?.length > 0 },
        { label: 'Maintenance responsibilities', ok: lease.maintenanceResponsibilities?.length > 0 }
      ]
    },
    {
      section: 'Provisions & Attachments',
      checks: [{ label: 'Lead paint answered', ok: isAnswered(lease.builtBefore1978) }]
    }
  ];
};

export const areAllLeasePreflightChecksComplete = (checks) =>
  checks.length > 0 && checks.every((section) => section.checks.every((check) => check.ok));
