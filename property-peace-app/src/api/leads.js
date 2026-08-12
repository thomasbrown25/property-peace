import axiosServices from 'utils/axios';
import { buildLeadQuery, normalizeInquiryResult } from 'utils/leads';

const id = (value, label = 'id') => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`A valid ${label} is required.`);
  return number;
};
const normalizeKeys = (value) => {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key[0].toLowerCase() + key.slice(1), normalizeKeys(item)]));
};
const data = (response) => normalizeKeys(response?.data ?? null);

export const getLeads = async (filters = {}) => data(await axiosServices.get(`/api/leads${buildLeadQuery(filters)}`));
export const getLead = async (leadId) => data(await axiosServices.get(`/api/leads/${id(leadId, 'lead id')}`));
export const updateLead = async (leadId, request) => data(await axiosServices.patch(`/api/leads/${id(leadId, 'lead id')}`, request));
export const getLeadNotes = async (leadId) => data(await axiosServices.get(`/api/leads/${id(leadId, 'lead id')}/notes`));
export const addLeadNote = async (leadId, body) => data(await axiosServices.post(`/api/leads/${id(leadId, 'lead id')}/notes`, { body }));
export const getLeadTasks = async (leadId) => data(await axiosServices.get(`/api/leads/${id(leadId, 'lead id')}/tasks`));
export const addLeadTask = async (leadId, request) => data(await axiosServices.post(`/api/leads/${id(leadId, 'lead id')}/tasks`, request));
export const completeLeadTask = async (leadId, taskId, concurrencyToken) => data(await axiosServices.post(`/api/leads/${id(leadId, 'lead id')}/tasks/${id(taskId, 'task id')}/complete`, { concurrencyToken }));
export const convertLeadToApplication = async (leadId) => data(await axiosServices.post(`/api/leads/${id(leadId, 'lead id')}/convert-to-application`));

export const getPreScreenCatalog = async (listingId) => data(await axiosServices.get(`/api/public/listings/${id(listingId, 'listing id')}/leads/pre-screen`, { skipAuthRedirect: true }));
export const setPreScreenConfiguration = async (listingId, request) => data(await axiosServices.put(`/api/leads/listings/${id(listingId, 'listing id')}/pre-screen`, request));
export const getPublicAvailability = async (listingId, fromUtc) => data(await axiosServices.get(`/api/public/listings/${id(listingId, 'listing id')}/leads/showing-availability${fromUtc ? `?fromUtc=${encodeURIComponent(fromUtc)}` : ''}`, { skipAuthRedirect: true }));
export const submitPublicInquiry = async (listingId, request) => normalizeInquiryResult(data(await axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/inquiries`, request, { skipAuthRedirect: true })));
export const verifyLeadContact = async (listingId, token) => data(await axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/verify`, { token }, { skipAuthRedirect: true }));
export const bookPublicShowing = async (listingId, request) => data(await axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/showings`, request, { skipAuthRedirect: true }));
export const authenticatePublicShowing = async (listingId, showingId, managementCode) => data(await axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/showings/${id(showingId, 'showing id')}/manage`, { managementCode }, { skipAuthRedirect: true }));
export const reschedulePublicShowing = async (listingId, showingId, request) => data(await axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/showings/${id(showingId, 'showing id')}/reschedule`, request, { skipAuthRedirect: true }));
export const cancelPublicShowing = async (listingId, showingId, session, concurrencyToken) => axiosServices.post(`/api/public/listings/${id(listingId, 'listing id')}/leads/showings/${id(showingId, 'showing id')}/cancel`, { session, concurrencyToken }, { skipAuthRedirect: true });

export const getShowings = async (listingId) => data(await axiosServices.get(`/api/leads/showings${listingId ? `?listingId=${id(listingId, 'listing id')}` : ''}`));
export const getStaffAvailability = async (listingId) => data(await axiosServices.get(`/api/leads/listings/${id(listingId, 'listing id')}/showing-availability`));
export const addStaffAvailability = async (listingId, request) => data(await axiosServices.post(`/api/leads/listings/${id(listingId, 'listing id')}/showing-availability`, request));
export const updateStaffAvailability = async (listingId, availabilityId, request) => data(await axiosServices.put(`/api/leads/listings/${id(listingId, 'listing id')}/showing-availability/${id(availabilityId, 'availability id')}`, request));
export const cancelShowing = async (showingId, concurrencyToken) => axiosServices.post(`/api/leads/showings/${id(showingId, 'showing id')}/cancel`, {}, { headers: { 'If-Match': concurrencyToken } });
export const rescheduleShowing = async (showingId, request) => data(await axiosServices.post(`/api/leads/showings/${id(showingId, 'showing id')}/reschedule`, request));
export const completeShowing = async (showingId, noShow, concurrencyToken) => axiosServices.post(`/api/leads/showings/${id(showingId, 'showing id')}/complete`, { noShow, concurrencyToken });
