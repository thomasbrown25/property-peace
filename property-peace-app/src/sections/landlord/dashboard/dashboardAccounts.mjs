export const RECENT_ACTIVITY_LIMIT = 5;

export function unwrapResponse(body) {
  if (body?.success === false) throw new Error('Request failed');
  return body?.data ?? body;
}

export async function loadDashboardAccounts(client, organizationId) {
  const config = { headers: { 'X-Organization-Id': String(organizationId) } };
  const accounts = unwrapResponse((await client.get('/api/bank-accounts', config)).data);
  if (!Array.isArray(accounts)) throw new Error('Invalid account response');
  return Promise.all(accounts.filter((account) => account.isActive && account.stripeAccountId).map(async (account) => {
    try {
      const balance = unwrapResponse((await client.get(`/api/bank-accounts/${account.id}/balance`, config)).data);
      if (!Array.isArray(balance?.balances)) throw new Error('Invalid balance response');
      return { ...account, balances: balance.balances, balanceError: false };
    } catch {
      return { ...account, balances: [], balanceError: true };
    }
  }));
}

export async function loadDashboardActivity(client, organizationId) {
  const body = unwrapResponse((await client.get('/api/activities', {
    headers: { 'X-Organization-Id': String(organizationId) },
    params: { page: 1, pageSize: RECENT_ACTIVITY_LIMIT }
  })).data);
  if (!Array.isArray(body?.activities)) throw new Error('Invalid activity response');
  return body.activities.slice(0, RECENT_ACTIVITY_LIMIT);
}

export function formatAccountMoney(value, currency) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(Number(value));
  } catch {
    return '—';
  }
}
