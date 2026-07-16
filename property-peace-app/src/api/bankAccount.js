import axios from 'utils/axios';

// Get all bank accounts for the current organization
export const getBankAccounts = async () => {
  const response = await axios.get('/api/bank-accounts');
  return response.data;
};

// Get a bank account by ID
export const getBankAccount = async (id) => {
  const response = await axios.get(`/api/bank-accounts/${id}`);
  return response.data;
};

// Create a new bank account
export const createBankAccount = async (bankAccount) => {
  const response = await axios.post('/api/bank-accounts', bankAccount);
  return response.data;
};

// Update a bank account
export const updateBankAccount = async (id, bankAccount) => {
  const response = await axios.put(`/api/bank-accounts/${id}`, bankAccount);
  return response.data;
};

// Delete a bank account (soft delete)
export const deleteBankAccount = async (id) => {
  const response = await axios.delete(`/api/bank-accounts/${id}`);
  return response.data;
};

export default {
  getBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount
};
