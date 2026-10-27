import axios from 'utils/axios';
import { reasonCodes, validCaseReference } from 'pages/admin/short-stay-collection-review';

const base = '/api/admin/short-stay-collection-applications';
const noStore = { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } };
const unwrap = (response) => {
  const result = response.data;
  if (result?.success === false || result?.statusCode >= 400) throw new Error('Collection review unavailable. Refresh and try again.');
  return result?.data;
};
const url = (id, action) => {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('Invalid application.');
  return `${base}/${encodeURIComponent(id)}/${action}`;
};
export const adminShortStayCollectionAPI = {
  list: async () => unwrap(await axios.get(base, noStore)),
  beginReview: async (id) => unwrap(await axios.post(url(id, 'begin-review'), null, noStore)),
  approve: async (id, caseReference, propertyAuthorityConfirmed) => {
    if (!validCaseReference(caseReference)) throw new Error('Enter a case reference of 4–64 letters or numbers only.');
    if (propertyAuthorityConfirmed !== true) throw new Error('Confirm property authority before approval.');
    return unwrap(await axios.post(url(id, 'approve'), { caseReference, propertyAuthorityConfirmed: true }, noStore));
  },
  suspend: async (id, reasonCode) => {
    if (!reasonCodes.includes(reasonCode)) throw new Error('Choose a reason code.');
    return unwrap(await axios.post(url(id, 'suspend'), { reasonCode }, noStore));
  },
  reject: async (id, reasonCode) => {
    if (!reasonCodes.includes(reasonCode)) throw new Error('Choose a reason code.');
    return unwrap(await axios.post(url(id, 'reject'), { reasonCode }, noStore));
  }
};
