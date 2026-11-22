export const RECENT_ACTIVITY_LIMIT = 5;

function unwrapResponse(body) {
  if (body?.success === false) throw new Error('Request failed');
  return body?.data ?? body;
}

export async function loadDashboardActivity(client, organizationId) {
  const body = unwrapResponse((await client.get('/api/activities', {
    headers: { 'X-Organization-Id': String(organizationId) },
    params: { page: 1, pageSize: RECENT_ACTIVITY_LIMIT }
  })).data);
  if (!Array.isArray(body?.activities)) throw new Error('Invalid activity response');
  return body.activities.slice(0, RECENT_ACTIVITY_LIMIT);
}
