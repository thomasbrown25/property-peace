import axios from 'utils/axios';
import { agreementPath } from 'pages/landlord/extendedStayAgreement';

const unwrap = (response) => {
  const payload = response.data;
  if (payload?.success !== true) throw new Error(payload?.message || 'Agreement request failed.');
  return payload.data;
};
export const extendedStayAgreementAPI = {
  list: async (unitId) => unwrap(await axios.get(agreementPath(unitId), { headers: { 'Cache-Control': 'no-store' } })),
  create: async (unitId, draft) => unwrap(await axios.post(agreementPath(unitId), draft))
};
