// The lease DTO owns rent and one-time fees/deposits. It has no non-rent recurring charge collection.
const field = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];
const list = (value) => Array.isArray(value) ? value : [];

export function leaseDetailCharges(lease) {
  const rent = field(lease, 'rentAmount', 'RentAmount');
  const startDate = field(lease, 'startDate', 'StartDate');
  const fees = list(field(lease, 'fees', 'Fees'));
  const deposits = list(field(lease, 'leaseDeposits', 'LeaseDeposits'));
  const standardDeposits = [
    ['Security deposit', field(lease, 'depositAmount', 'DepositAmount')],
    ['Pet deposit', field(lease, 'petDepositAmount', 'PetDepositAmount')]
  ].filter(([, amount]) => amount != null && Number(amount) > 0)
    .map(([name, amount]) => ({ name, amount, dueDate: startDate }));
  return {
    recurring: rent != null && Number(rent) > 0 ? [{ name: 'Rent', amount: rent, frequency: field(lease, 'rentFrequency', 'RentFrequency') || 'Monthly', dueDay: field(lease, 'rentDueDay', 'RentDueDay') }] : [],
    fees: fees.filter((fee) => field(fee, 'isLateFee', 'IsLateFee') !== true)
      .map((fee) => ({ id: field(fee, 'id', 'Id'), name: field(fee, 'name', 'Name') || 'Fee', amount: field(fee, 'amount', 'Amount'), dueDate: field(fee, 'dueDate', 'DueDate') })),
    lateFees: fees.filter((fee) => field(fee, 'isLateFee', 'IsLateFee') === true),
    deposits: [...standardDeposits, ...deposits.map((deposit) => ({ id: field(deposit, 'id', 'Id'), name: field(deposit, 'name', 'Name') || 'Deposit', amount: field(deposit, 'amount', 'Amount'), dueDate: field(deposit, 'dueDate', 'DueDate') }))]
  };
}

export function manualChargePayload({ name, amount, dueDate }) {
  const trimmed = name?.trim();
  const numeric = Number(amount);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate || '') &&
    !Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)) &&
    new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) === dueDate;
  if (!trimmed || !String(amount ?? '').trim() || !Number.isFinite(numeric) || numeric <= 0 || !validDate) {
    throw new Error('Enter a name, a positive amount, and a valid due date.');
  }
  return { name: trimmed, amount: numeric, dueDate: `${dueDate}T00:00:00` };
}

export async function addManualLeaseCharge(client, leaseId, kind, form) {
  if (!leaseId || !['fee', 'deposit'].includes(kind)) throw new Error('A lease and charge type are required.');
  const endpoint = kind === 'fee' ? 'fees' : 'deposits';
  const response = await client.post(`/api/Lease/${encodeURIComponent(leaseId)}/${endpoint}`, manualChargePayload(form));
  if (response?.data?.success === false || response?.data?.Success === false) {
    throw new Error(response.data.message || response.data.Message || 'Charge could not be saved.');
  }
  return response;
}

export async function getLeaseChargeDefinitions(client, leaseId) {
  if (!leaseId) throw new Error('A lease is required.');
  const response = await client.get(`/api/Lease/${encodeURIComponent(leaseId)}/charge-definitions`);
  const body = response?.data;
  if (body?.success === false || body?.Success === false || !(body?.data ?? body?.Data)) {
    throw new Error(body?.message || body?.Message || 'Lease charges could not be loaded.');
  }
  return body.data ?? body.Data;
}
