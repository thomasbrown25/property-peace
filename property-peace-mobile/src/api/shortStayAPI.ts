import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';
import type { ListingForm } from '../features/properties/shortStayOwner';
import type { PhotoUpload } from '../features/properties/shortStayPhotos';
import { listingPayload, validLocalRange, parseLocalDate, ratePayload, rangeRatePayload } from '../features/properties/shortStayOwner';

export interface ShortStayTimeZone { propertyId: number; timeZoneId: string | null }
export interface ShortStayListing { unitId: number; timeZoneId: string; nightlyBasePrice: number; weekendNightlyRate: number | null; weeklyDiscountPercent: number; monthlyDiscountPercent: number; minimumNights: number; capacity: number; cleaningFee: number; checkInTime: string | null; checkOutTime: string | null; houseRules: string | null; amenities: string | null; cancellationPolicy: string | null; publicTitle: string | null; publicSummary: string | null; lodgingTaxRatePercent: number | null; taxPolicyAttestedAtUtc: string | null; taxPolicyAttestedByUserId: number | null }
export interface ShortStayBlock { id: number; startDate: string; endDate: string; reason: string | null; source: string }
export interface ShortStayNight { date: string; baseRate: number | null; overrideRate: number | null; effectiveRate: number | null; priceSource?: 'Override' | 'Weekend' | 'Base' | null }
export interface ShortStayCalendar { unitId: number; timeZoneId: string; startDate: string; endDate: string; blocks: ShortStayBlock[]; nights: ShortStayNight[] }
// Inventory/pricing coverage only; never booking, occupancy or revenue totals.
export interface ShortStayInventoryReport { unitId: number; timeZoneId: string; start: string; end: string; snapshotAtUtc: string; totalNights: number; ownerBlockedNights: number; airbnbBlockedNights: number; overlapNights: number; blockedNights: number; unblockedNights: number; pricedUnblockedNights: number; unpricedUnblockedNights: number; airbnbSyncStatus: string; airbnbSyncStaleWarning: boolean; bookingMetricsAvailable: boolean; revenueMetricsAvailable: boolean; occupancyMetricsAvailable: boolean }
export interface ShortStayPhoto { id: number; displayOrder: number; isCoverPhoto: boolean; url: string }
export interface GuidebookDraftInput { houseRules: string | null; arrivalOverview: string | null; localNotes: string | null }
export interface GuidebookDraft extends GuidebookDraftInput { unitId: number }
export interface AirbnbCalendarStatus { unitId: number; enabled: boolean; health: 'disabled' | 'never_synced' | 'retrying' | 'stale' | 'healthy'; generation: number | null; timeZoneId: string; lastAttemptAtUtc: string | null; lastSuccessAtUtc: string | null; lastSuccessLocal: string | null; consecutiveFailures: number; nextAttemptAtUtc: string | null }
const data = <T>(response: ApiResponse<T>, label: string): T => {
  if (!response?.success) throw new Error(response?.message || `Could not ${label}`);
  return response.data;
};
const propertyPath = (id: string) => `/api/short-stay/properties/${encodeURIComponent(id)}/timezone`;
const unitPath = (id: string) => `/api/short-stay/units/${encodeURIComponent(id)}`;
const shortStayAPI = {
  async getTimeZone(propertyId: string) { return data(await apiClient.get<ApiResponse<ShortStayTimeZone>>(propertyPath(propertyId)), 'load time zone'); },
  async putTimeZone(propertyId: string, timeZoneId: string) { return data(await apiClient.put<ApiResponse<ShortStayTimeZone>>(propertyPath(propertyId), { timeZoneId }), 'save time zone'); },
  async getListing(unitId: string) { return data(await apiClient.get<ApiResponse<ShortStayListing | null>>(`${unitPath(unitId)}/listing`), 'load draft'); },
  async putListing(unitId: string, form: ListingForm) {
    const payload = listingPayload(form);
    if (!payload) throw new Error('Check listing values: weekend rate is optional and must be positive with up to two decimals; weekly/monthly discounts must be 0–99.99% with up to two decimals. For lodging tax enter 0–100 with up to four decimals and affirm responsibility, or leave the rate blank and affirmation unchecked.');
    return data(await apiClient.put<ApiResponse<ShortStayListing>>(`${unitPath(unitId)}/listing`, payload), 'save draft');
  },
  async getGuidebookDraft(unitId: string) {
    return data(await apiClient.get<ApiResponse<GuidebookDraft | null>>(`${unitPath(unitId)}/guidebook-draft`, { headers: { 'Cache-Control': 'no-store' } }), 'load guidebook draft');
  },
  async putGuidebookDraft(unitId: string, input: GuidebookDraftInput) {
    return data(await apiClient.put<ApiResponse<GuidebookDraft>>(`${unitPath(unitId)}/guidebook-draft`, input), 'save guidebook draft');
  },
  async deleteGuidebookDraft(unitId: string) {
    return data(await apiClient.delete<ApiResponse<boolean>>(`${unitPath(unitId)}/guidebook-draft`), 'discard guidebook draft');
  },
  async getPhotos(unitId: string) {
    return data(await apiClient.get<ApiResponse<ShortStayPhoto[]>>(`${unitPath(unitId)}/listing/photos`, { headers: { 'Cache-Control': 'no-store' } }), 'load photos');
  },
  async uploadPhotos(unitId: string, files: PhotoUpload[]) {
    const body = new FormData();
    files.forEach(file => body.append('files', file as any));
    return data(await apiClient.post<ApiResponse<number[]>>(`${unitPath(unitId)}/listing/photos`, body), 'upload photos');
  },
  async setCover(unitId: string, photoId: number) {
    return data(await apiClient.put<ApiResponse<boolean>>(`${unitPath(unitId)}/listing/photos/${photoId}/cover`), 'set cover photo');
  },
  async deletePhoto(unitId: string, photoId: number) {
    return data(await apiClient.delete<ApiResponse<boolean>>(`${unitPath(unitId)}/listing/photos/${photoId}`), 'remove photo');
  },
  async getAirbnb(unitId: string) { return data(await apiClient.get<ApiResponse<AirbnbCalendarStatus>>(`${unitPath(unitId)}/airbnb-calendar`), 'load Airbnb status'); },
  async connectAirbnb(unitId: string, url: string) { return data(await apiClient.put<ApiResponse<AirbnbCalendarStatus>>(`${unitPath(unitId)}/airbnb-calendar`, { url }), 'connect Airbnb calendar'); },
  async refreshAirbnb(unitId: string) { return data(await apiClient.post<ApiResponse<AirbnbCalendarStatus>>(`${unitPath(unitId)}/airbnb-calendar/refresh`), 'queue Airbnb refresh'); },
  async disconnectAirbnb(unitId: string) { return data(await apiClient.delete<ApiResponse<AirbnbCalendarStatus>>(`${unitPath(unitId)}/airbnb-calendar`), 'disconnect Airbnb calendar'); },
  async getCalendar(unitId: string, start: string, end: string) {
    if (!validLocalRange(start, end)) throw new Error('Enter a valid date range (end exclusive, maximum 366 nights).');
    return data(await apiClient.get<ApiResponse<ShortStayCalendar>>(`${unitPath(unitId)}/calendar`, { params: { start, end } }), 'load calendar');
  },
  async getInventoryReport(unitId: string, start: string, end: string) {
    if (!validLocalRange(start, end) || (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 > 90) throw new Error('Inventory reports support up to 90 property-local nights.');
    return data(await apiClient.get<ApiResponse<ShortStayInventoryReport>>(`${unitPath(unitId)}/inventory-report`, { params: { start, end }, headers: { 'Cache-Control': 'no-store' } }), 'load inventory snapshot');
  },
  async addBlock(unitId: string, startDate: string, endDate: string, reason: string) {
    if (!validLocalRange(startDate, endDate) || reason.length > 500) throw new Error('Enter a valid block range (end exclusive, maximum 366 nights) and reason under 500 characters.');
    return data(await apiClient.post<ApiResponse<ShortStayBlock>>(`${unitPath(unitId)}/calendar/blocks`, { startDate, endDate, reason: reason.trim() || null }), 'add block');
  },
  async deleteBlock(unitId: string, blockId: number) { return data(await apiClient.delete<ApiResponse<boolean>>(`${unitPath(unitId)}/calendar/blocks/${blockId}`), 'remove block'); },
  async putRate(unitId: string, date: string, rate: string) {
    const payload = ratePayload(rate);
    if (!parseLocalDate(date) || !payload) throw new Error('Enter a valid YYYY-MM-DD date and positive nightly rate (up to two decimals).');
    return data(await apiClient.put<ApiResponse<{ date: string; nightlyRate: number }>>(`${unitPath(unitId)}/calendar/rates/${date}`, payload), 'save rate');
  },
  async putRateRange(unitId: string, startDate: string, endDate: string, rate: string) {
    const payload = rangeRatePayload(startDate, endDate, rate);
    if (!payload) throw new Error('Enter valid property-local dates (end exclusive, up to 366 nights) and a positive nightly rate with up to two decimals.');
    return data(await apiClient.put<ApiResponse<{ date: string; nightlyRate: number }[]>>(`${unitPath(unitId)}/calendar/rates/range`, payload), 'save range rates');
  },
  async deleteRate(unitId: string, date: string) {
    if (!parseLocalDate(date)) throw new Error('Enter a valid YYYY-MM-DD date.');
    return data(await apiClient.delete<ApiResponse<boolean>>(`${unitPath(unitId)}/calendar/rates/${date}`), 'remove rate');
  },
};
export default shortStayAPI;
