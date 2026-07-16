import { addMonths } from 'utils/helper-methods';

export const propertyTypeOptions = [
  { id: 1, value: 'singleFamily', label: 'Single Family Home' },
  { id: 2, value: 'multiUnit', label: 'Multi-Unit Home' },
  { id: 3, value: 'multiFamily', label: 'Multi-Family Home' },
  { id: 4, value: 'apartment', label: 'Apartment' },
  { id: 5, value: 'condo', label: 'Condo' },
  { id: 6, value: 'townhouse', label: 'Townhouse' },
  { id: 7, value: 'duplex', label: 'Duplex' },
  { id: 8, value: 'vacationHome', label: 'Vacation/Short-Term Rental' },
];

export const maintenancePriorityOptions = [
  { id: 1, label: 'Low', value: 'low', colorKey: 'success' },
  { id: 2, label: 'Medium', value: 'medium', colorKey: 'warning' },
  { id: 3, label: 'High', value: 'high', colorKey: 'error' },
];

export const maintenanceStatusOptions = [
  { id: 1, label: 'Reported',    value: 'reported',    colorKey: 'info' },
  { id: 2, label: 'Acknowledged', value: 'acknowledged', colorKey: 'warning' },
  { id: 3, label: 'Scheduled',   value: 'scheduled',   colorKey: 'info' },
  { id: 4, label: 'In Progress', value: 'inprogress',  colorKey: 'warning' },
  { id: 5, label: 'Resolved',    value: 'resolved',    colorKey: 'success' },
];

export const leaseLengthOptions = [
  { id: 1, label: 'Month-to-month', value: -1 },
  { id: 2, label: '1 month', value: 1 },
  { id: 3, label: '2 months', value: 2 },
  { id: 4, label: '3 months', value: 3 },
  { id: 5, label: '6 months', value: 6 },
  { id: 6, label: '12 months', value: 12 },
  { id: 7, label: '18 months', value: 18 },
  { id: 8, label: '24 months', value: 24 },
  { id: 9, label: 'Custom', value: 0 },
];

export const rentDueDayOptions = [
  { id: 1, label: '1st', value: 1 },
  { id: 2, label: '2nd', value: 2 },
  { id: 3, label: '3rd', value: 3 },
  { id: 4, label: '4th', value: 4 },
  { id: 5, label: '5th', value: 5 },
  { id: 6, label: '6th', value: 6 },
  { id: 7, label: '7th', value: 7 },
  { id: 8, label: '8th', value: 8 },
  { id: 9, label: '9th', value: 9 },
  { id: 10, label: '10th', value: 10 },
  { id: 11, label: '11th', value: 11 },
  { id: 12, label: '12th', value: 12 },
  { id: 13, label: '13th', value: 13 },
  { id: 14, label: '14th', value: 14 },
  { id: 15, label: '15th', value: 15 },
  { id: 16, label: '16th', value: 16 },
  { id: 17, label: '17th', value: 17 },
  { id: 18, label: '18th', value: 18 },
  { id: 19, label: '19th', value: 19 },
  { id: 20, label: '20th', value: 20 },
  { id: 21, label: '21st', value: 21 },
  { id: 22, label: '22nd', value: 22 },
  { id: 23, label: '23rd', value: 23 },
  { id: 24, label: '24th', value: 24 },
  { id: 25, label: '25th', value: 25 },
  { id: 26, label: '26th', value: 26 },
  { id: 27, label: '27th', value: 27 },
  { id: 28, label: '28th', value: 28 },
  { id: 29, label: '29th', value: 29 },
  { id: 30, label: '30th', value: 30 },
  { id: 31, label: '31st', value: 31 },
];

export const rentFrequencyOptions = [
  { id: 1, label: 'Monthly', value: 'monthly' },
  { id: 2, label: 'Quarterly', value: 'quarterly' },
  { id: 3, label: 'Yearly', value: 'yearly' },
];

export const amenityOptions = [
  { label: 'Washer/Dryer', value: 'washerDryer' },
  { label: 'Fireplace', value: 'fireplace' },
  { label: 'Balcony/Patio', value: 'balconyPatio' },
  { label: 'Hardwood Floors', value: 'hardwoodFloors' },
  { label: 'Smart Thermostat', value: 'smartThermostat' },
  { label: 'Ceiling Fans', value: 'ceilingFans' },
  { label: 'Dishwasher', value: 'dishwasher' },
  { label: 'Central Air Conditioning', value: 'centralAir' },
  { label: 'Walk-in Closet', value: 'walkInCloset' },
  { label: 'Pet Friendly', value: 'petFriendly' },
  { label: 'High-Speed Internet', value: 'highSpeedInternet' },
  { label: 'Furnished', value: 'furnished' },
  { label: 'Garage Parking', value: 'garageParking' },
  { label: 'Storage Space', value: 'storageSpace' },
];

const today = new Date();
const startDate = today.toISOString().split('T')[0];
const endDate = addMonths(today, 12);
const rentDueDay = new Date(today.getTime() + 24 * 60 * 60 * 1000).getDate();
export const defaultLease = {
  startDate: startDate,
  endDate: endDate,
  leaseLength: 12,
  rentFrequency: 'monthly',
  rentDueDay: rentDueDay,
  customDateSelected: false,
};

export const defaultProperty = {
  propertyType: 'singleFamily',
};
