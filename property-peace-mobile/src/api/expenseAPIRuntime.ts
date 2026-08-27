import apiClient from '../services/apiClient';
import { ExpenseAPI } from './expenseAPI';

const expenseAPI = new ExpenseAPI(apiClient);

export { expenseAPI };
export default expenseAPI;
