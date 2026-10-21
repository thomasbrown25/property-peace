import axios from 'utils/axios';

const publicUrl = (unitId) => `/api/short-stay/public/units/${encodeURIComponent(unitId)}`;
const options = { skipAuthRedirect: true, withCredentials: false, headers: { 'Cache-Control': 'no-store' } };

export const getPublicStay = async (unitId, signal) =>
  (await axios.get(publicUrl(unitId), { ...options, signal })).data;

export const getPublicStayQuote = async (unitId, dates, signal) =>
  (await axios.get(`${publicUrl(unitId)}/quote`, {
    ...options,
    signal,
    params: { checkIn: dates.checkIn, checkOut: dates.checkOut, guests: Number(dates.guests) }
  })).data;
