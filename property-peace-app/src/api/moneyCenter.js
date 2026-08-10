import axiosServices from 'utils/axios';

const ROOT = '/api/money-center';
const unwrap = (response) => response?.data?.data ?? response?.data;
const contractParams = ({ from, to, propertyId, unitId, upcomingDays }) => ({
  from, to, ...(propertyId ? { propertyId } : {}), ...(unitId ? { unitId } : {}), upcomingDays
});

export const moneyCenterAPI = {
  overview: (params, signal) => axiosServices.get(ROOT, { params: contractParams(params), signal }).then(unwrap),
  items: (params, signal) => axiosServices.get(`${ROOT}/items`, { params: { ...contractParams(params), limit: 1000 }, signal }).then(unwrap),
  export: (params) => axiosServices.get(`${ROOT}/export`, { params: contractParams(params), responseType: 'blob' })
};

export function downloadMoneyCenterExport(response, fallbackName = 'money-center-accountant-review.csv') {
  const disposition = response?.headers?.['content-disposition'] || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let fileName = plain || fallbackName;
  if (encoded) {
    try { fileName = decodeURIComponent(encoded); }
    catch { fileName = fallbackName; }
  }
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export function moneyCenterErrorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Money Center could not be loaded.';
}
