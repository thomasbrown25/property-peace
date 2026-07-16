import axiosServices from '../utils/axios';

const BASE = '/api/lease-shield';

export const getConversations = async () => {
  const response = await axiosServices.get(`${BASE}/conversations`);
  return response.data;
};

export const getConversation = async (id) => {
  const response = await axiosServices.get(`${BASE}/conversations/${id}`);
  return response.data;
};

export const createConversation = async (data) => {
  const response = await axiosServices.post(`${BASE}/conversations`, data);
  return response.data;
};

export const updateConversation = async (id, data) => {
  const response = await axiosServices.put(`${BASE}/conversations/${id}`, data);
  return response.data;
};

export const deleteConversation = async (id) => {
  const response = await axiosServices.delete(`${BASE}/conversations/${id}`);
  return response.data;
};

export const sendMessage = async (conversationId, data) => {
  const response = await axiosServices.post(`${BASE}/conversations/${conversationId}/messages`, data);
  return response.data;
};

export const sendMessageNewConversation = async (data) => {
  const response = await axiosServices.post(`${BASE}/messages`, data);
  return response.data;
};

/** Map full state name to 2-letter code for API */
export const STATE_NAME_TO_CODE = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY'
};

/** Map 2-letter code to full state name (for display e.g. state chip) */
export const STATE_CODE_TO_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [code, name])
);
STATE_CODE_TO_NAME.DC = 'District of Columbia';
