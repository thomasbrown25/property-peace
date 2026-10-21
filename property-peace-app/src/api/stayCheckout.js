import axios from 'utils/axios';

const options = { skipAuthRedirect: true, headers: { 'Cache-Control': 'no-store' } };
const holdUrl = (code) => `/api/short-stay/holds/${encodeURIComponent(code)}`;

export const createStayHold = async (unitId, dates, idempotencyKey) =>
  (await axios.post(`/api/short-stay/units/${encodeURIComponent(unitId)}/holds`, {
    checkIn: dates.checkIn, checkOut: dates.checkOut, guests: Number(dates.guests), idempotencyKey
  }, options)).data;
export const startStayPayment = async (code) =>
  (await axios.post(`${holdUrl(code)}/start-payment`, undefined, options)).data;
export const getStayHold = async (code, signal) =>
  (await axios.get(holdUrl(code), { ...options, signal })).data;
