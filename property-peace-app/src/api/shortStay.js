import axios from 'utils/axios';

const unwrap = (response) => {
  const payload = response.data;
  if (payload?.statusCode >= 400 || payload?.success === false) {
    throw { status: payload.statusCode, message: payload.message || 'Short-stay request failed.' };
  }
  return payload?.data;
};

const propertyUrl = (id) => `/api/short-stay/properties/${encodeURIComponent(id)}/timezone`;
const unitUrl = (id) => `/api/short-stay/units/${encodeURIComponent(id)}`;
const photosUrl = (id) => `${unitUrl(id)}/listing/photos`;
const airbnbUrl = (id) => `${unitUrl(id)}/airbnb-calendar`;
const guidebookUrl = (id) => `${unitUrl(id)}/guidebook-draft`;
const photoUrl = (unitId, photoId) => `${photosUrl(unitId)}/${encodeURIComponent(photoId)}`;
const collectionUrl = '/api/short-stay/collection-applications';
const noStore = { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } };

export const shortStayAPI = {
  getCollectionRequirements: async () => unwrap(await axios.get(`${collectionUrl}/requirements`, noStore)),
  getCollectionApplications: async () => unwrap(await axios.get(collectionUrl, noStore)),
  saveCollectionDraft: async (draft) => unwrap(await axios.put(`${collectionUrl}/draft`, draft, noStore)),
  submitCollection: async () => unwrap(await axios.post(`${collectionUrl}/submit`, null, noStore)),
  startCollectionIdentity: async (id) => unwrap(await axios.post(`${collectionUrl}/${encodeURIComponent(id)}/identity-session`, null, noStore)),
  refreshCollectionIdentity: async (id) => unwrap(await axios.post(`${collectionUrl}/${encodeURIComponent(id)}/identity-refresh`, null, noStore)),
  getUnits: async (propertyId) => unwrap(await axios.get(`/api/unit/${encodeURIComponent(propertyId)}`)),
  getTimeZone: async (propertyId) => unwrap(await axios.get(propertyUrl(propertyId))),
  saveTimeZone: async (propertyId, timeZoneId) => unwrap(await axios.put(propertyUrl(propertyId), { timeZoneId })),
  getListing: async (unitId) => unwrap(await axios.get(`${unitUrl(unitId)}/listing`)),
  saveListing: async (unitId, draft) => unwrap(await axios.put(`${unitUrl(unitId)}/listing`, draft)),
  getGuidebookDraft: async (unitId) => unwrap(await axios.get(guidebookUrl(unitId), noStore)),
  saveGuidebookDraft: async (unitId, draft) => unwrap(await axios.put(guidebookUrl(unitId), draft, noStore)),
  deleteGuidebookDraft: async (unitId) => unwrap(await axios.delete(guidebookUrl(unitId), noStore)),
  getPhotos: async (unitId) => unwrap(await axios.get(photosUrl(unitId), noStore)),
  uploadPhotos: async (unitId, files) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return unwrap(await axios.post(photosUrl(unitId), form, noStore));
  },
  setCoverPhoto: async (unitId, photoId) => unwrap(await axios.put(`${photoUrl(unitId, photoId)}/cover`, null, noStore)),
  deletePhoto: async (unitId, photoId) => unwrap(await axios.delete(photoUrl(unitId, photoId), noStore)),
  getAirbnbCalendar: async (unitId) => unwrap(await axios.get(airbnbUrl(unitId), noStore)),
  connectAirbnbCalendar: async (unitId, url) => unwrap(await axios.put(airbnbUrl(unitId), { url }, noStore)),
  refreshAirbnbCalendar: async (unitId) => unwrap(await axios.post(`${airbnbUrl(unitId)}/refresh`, null, noStore)),
  disconnectAirbnbCalendar: async (unitId) => unwrap(await axios.delete(airbnbUrl(unitId), noStore)),
  getCalendar: async (unitId, start, end) => unwrap(await axios.get(`${unitUrl(unitId)}/calendar`, { params: { start, end } })),
  getInventoryReport: async (unitId, start, end) => unwrap(await axios.get(`${unitUrl(unitId)}/inventory-report`, { params: { start, end }, ...noStore })),
  addBlock: async (unitId, block) => unwrap(await axios.post(`${unitUrl(unitId)}/calendar/blocks`, block)),
  removeBlock: async (unitId, blockId) => unwrap(await axios.delete(`${unitUrl(unitId)}/calendar/blocks/${encodeURIComponent(blockId)}`)),
  saveRate: async (unitId, date, rate) => unwrap(await axios.put(`${unitUrl(unitId)}/calendar/rates/${encodeURIComponent(date)}`, rate)),
  removeRate: async (unitId, date) => unwrap(await axios.delete(`${unitUrl(unitId)}/calendar/rates/${encodeURIComponent(date)}`))
};
