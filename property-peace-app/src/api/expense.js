import axiosServices from 'utils/axios';

export const getExpenses = async (filters = {}) => {
  const { propertyId, unitId, startDate, endDate, category } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (startDate) params.append('startDate', startDate);
  if (unitId) params.append('unitId', unitId);
  if (endDate) params.append('endDate', endDate);
  if (category) params.append('category', category);

  const response = await axiosServices.get(`/api/expense?${params.toString()}`);
  return response.data;
};

export const getExpenseById = async (expenseId) => {
  const response = await axiosServices.get(`/api/expense/${expenseId}`);
  return response.data;
};

export const addExpense = async (expense) => {
  const response = await axiosServices.post('/api/expense', expense);
  return response.data;
};

export const updateExpense = async (expenseId, expense) => {
  const response = await axiosServices.put(`/api/expense/${expenseId}`, expense);
  return response.data;
};

export const deleteExpense = async (expenseId) => {
  const response = await axiosServices.delete(`/api/expense/${expenseId}`);
  return response.data;
};

export const getTotalExpenses = async (filters = {}) => {
  const { propertyId, startDate, endDate } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await axiosServices.get(`/api/expense/total?${params.toString()}`);
  return response.data;
};

// Expense Receipt APIs
export const uploadExpenseReceipts = async (expenseId, files) => {
  const formData = new FormData();
  for (const file of files) {
    // Extract the actual File object (same pattern as maintenance/property uploads)
    const fileToUpload = file instanceof File ? file : (file?.file || file);
    if (fileToUpload && fileToUpload instanceof File) {
      formData.append('files', fileToUpload);
    }
  }
  const response = await axiosServices.post(`/api/expensereceipt/${expenseId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getExpenseReceipts = async (expenseId) => {
  const response = await axiosServices.get(`/api/expensereceipt/${expenseId}`);
  return response.data;
};

export const deleteExpenseReceipt = async (receiptId) => {
  const response = await axiosServices.delete(`/api/expensereceipt/${receiptId}`);
  return response.data;
};

// Expense Report APIs
export const getExpenseReport = async (filters = {}) => {
  const { propertyId, unitId, startDate, endDate, category, vendorId } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (unitId) params.append('unitId', unitId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (category) params.append('category', category);
  if (vendorId) params.append('vendorId', vendorId);

  const response = await axiosServices.get(`/api/expensereport/report?${params.toString()}`);
  return response.data;
};

export const getExpenseReportSummary = async (filters = {}) => {
  const { propertyId, unitId, startDate, endDate, category, vendorId } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (unitId) params.append('unitId', unitId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (category) params.append('category', category);
  if (vendorId) params.append('vendorId', vendorId);

  const response = await axiosServices.get(`/api/expensereport/summary?${params.toString()}`);
  return response.data;
};

export const getExpenseTrends = async (filters = {}) => {
  const { propertyId, startDate, endDate, groupBy = 'month' } = filters;
  const params = new URLSearchParams({ groupBy });
  
  if (propertyId) params.append('propertyId', propertyId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await axiosServices.get(`/api/expensereport/trends?${params.toString()}`);
  return response.data;
};

export const getExpenseReportByCategory = async (filters = {}) => {
  const { propertyId, unitId, startDate, endDate } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (unitId) params.append('unitId', unitId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await axiosServices.get(`/api/expensereport/by-category?${params.toString()}`);
  return response.data;
};

export const getPropertyProfitability = async (filters = {}) => {
  const { propertyId, startDate, endDate } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await axiosServices.get(`/api/expensereport/profitability?${params.toString()}`);
  return response.data;
};

export const getIncomeByYear = async (filters = {}) => {
  const { propertyId, year1, year2 } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (year1) params.append('year1', year1);
  if (year2) params.append('year2', year2);

  const response = await axiosServices.get(`/api/expensereport/income-by-year?${params.toString()}`);
  return response.data;
};

export const getYearOverYearComparison = async (filters = {}) => {
  const { propertyId, year1, year2 } = filters;
  const params = new URLSearchParams();
  
  if (propertyId) params.append('propertyId', propertyId);
  if (year1) params.append('year1', year1);
  if (year2) params.append('year2', year2);

  const response = await axiosServices.get(`/api/expensereport/year-over-year?${params.toString()}`);
  return response.data;
};

// Tax Report APIs
export const getTaxYearReport = async (landlordId, year) => {
  const params = new URLSearchParams({ landlordId, year: year.toString() });
  const response = await axiosServices.get(`/api/taxreport/year-report?${params.toString()}`);
  return response.data;
};

export const getTaxCategorySummary = async (landlordId, year = null) => {
  const params = new URLSearchParams({ landlordId });
  if (year) params.append('year', year.toString());
  const response = await axiosServices.get(`/api/taxreport/category-summary?${params.toString()}`);
  return response.data;
};

export const getTaxDeductibleExpenses = async (landlordId, filters = {}) => {
  const { year, startDate, endDate } = filters;
  const params = new URLSearchParams({ landlordId });
  if (year) params.append('year', year.toString());
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const response = await axiosServices.get(`/api/taxreport/deductible-expenses?${params.toString()}`);
  return response.data;
};

export const getForm1099Data = async (landlordId, year) => {
  const params = new URLSearchParams({ landlordId, year: year.toString() });
  const response = await axiosServices.get(`/api/taxreport/form1099?${params.toString()}`);
  return response.data;
};

export const getTaxReadiness = async (landlordId, year) => {
  const params = new URLSearchParams({ landlordId, year: year.toString() });
  const response = await axiosServices.get(`/api/taxreport/readiness?${params.toString()}`);
  return response.data;
};

export const exportToAccountingSoftware = async (landlordId, format, filters = {}) => {
  const { year, startDate, endDate } = filters;
  const params = new URLSearchParams({ landlordId, format });
  if (year) params.append('year', year.toString());
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const response = await axiosServices.get(`/api/taxreport/export?${params.toString()}`, {
    responseType: 'blob' // Important for file downloads
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  
  // Extract filename from Content-Disposition header or use default
  const contentDisposition = response.headers['content-disposition'];
  let filename = `export-${format}-${year || new Date().getFullYear()}.csv`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
    if (filenameMatch) filename = filenameMatch[1];
  }
  
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  
  return { success: true };
};

export const downloadScheduleEPdf = async (landlordId, year, perProperty = false) => {
  const params = new URLSearchParams({ 
    landlordId: landlordId.toString(), 
    year: year.toString(),
    perProperty: perProperty.toString()
  });

  try {
    const response = await axiosServices.get(`/api/taxreport/schedule-e-pdf?${params.toString()}`, {
      responseType: 'blob' // Important for PDF downloads
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers['content-disposition'];
    let filename = `schedule-e-${year}${perProperty ? '-per-property' : ''}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) filename = filenameMatch[1];
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      const errorText = await error.response.data.text();
      try {
        const parsedError = JSON.parse(errorText);
        error.message = parsedError?.message || parsedError?.Message || parsedError?.errors?.details || parsedError?.errors?.message || error.message;
        error.response.data = parsedError;
      } catch {
        if (errorText) error.message = errorText;
      }
    }
    throw error;
  }
};
