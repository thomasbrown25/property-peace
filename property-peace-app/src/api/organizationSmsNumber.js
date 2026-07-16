import axios from 'utils/axios';

export const getOrganizationSmsNumberStatus = async () => {
  const response = await axios.get('/api/organization-sms-number/status');
  return response.data;
};

export const getSmsAreaCodes = async (state) => {
  const response = await axios.get('/api/organization-sms-number/area-codes', { params: { state } });
  return response.data;
};

export const searchAvailableSmsNumbers = async ({ state, areaCode }) => {
  const response = await axios.get('/api/organization-sms-number/available', { params: { state, areaCode } });
  return response.data;
};

export const purchaseOrganizationSmsNumber = async ({ phoneNumber, state, areaCode }) => {
  const response = await axios.post('/api/organization-sms-number/purchase', { phoneNumber, state, areaCode });
  return response.data;
};

export const refreshOrganizationSmsNumberPurchaseStatus = async (id) => {
  const response = await axios.get(`/api/organization-sms-number/${id}/purchase-status`);
  return response.data;
};

export const organizationSmsNumberAPI = {
  getStatus: getOrganizationSmsNumberStatus,
  getAreaCodes: getSmsAreaCodes,
  searchAvailable: searchAvailableSmsNumbers,
  purchase: purchaseOrganizationSmsNumber,
  refreshPurchaseStatus: refreshOrganizationSmsNumberPurchaseStatus
};
