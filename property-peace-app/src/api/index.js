import axios from 'axios';
import {
  ApiClient,
  ApplicationAPI,
  OrganizationAPI,
  LeaseAPI,
  TenantDocumentAPI,
  ApplicationInviteAPI,
  BankAccountAPI,
  AccountAPI,
  GeneralLedgerAPI,
  FinancialStatementsAPI,
  BankReconciliationAPI,
  ChecklistAPI,
  ConversationAPI,
  ExpenseAPI,
  FileAPI,
  FileCategoryAPI,
  LeaseGenerationAPI,
  LeaseTemplateAPI,
  MessageAPI,
  OrganizationInviteAPI,
  OrganizationMemberAPI,
  PolicyPackAPI,
  PropertyPortfolioAPI,
  RecurringExpenseAPI,
  SearchAPI,
  SubscriptionAPI,
  TenantInviteAPI,
  UnitAPI,
  AIFollowUpAPI,
  AnnouncementAPI,
  AdminSubscriptionAPI,
  AdminUserAPI,
  AdminUpcomingFeaturesAPI,
  LandlordUpcomingFeaturesAPI,
  TimeEntryAPI,
  TimeBreakAPI,
  StaffMemberAPI,
  TimeTrackingSettingsAPI
} from '@property-peace/shared/api';
import store from 'store';
import { logout } from 'store/user/user.action';

// Helper function to normalize the API URL
const getApiBaseURL = () => {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  const defaultUrl = 'http://localhost:5001/';
  
  // If no env URL or empty string, use default
  if (!envUrl || envUrl.trim() === '') {
    return defaultUrl;
  }
  
  const trimmedUrl = envUrl.trim();
  
  // If URL doesn't start with http:// or https://, it's malformed
  // Check if it starts with : (like :5001) or just a port
  if (trimmedUrl.startsWith(':') || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
    return defaultUrl;
  }
  
  // For localhost, ensure we use HTTP unless explicitly HTTPS
  // This prevents SSL protocol errors when backend only serves HTTP
  if (trimmedUrl.includes('localhost') && trimmedUrl.startsWith('https://')) {
    // Only use HTTPS if explicitly set and not just the default
    // For development, prefer HTTP
  }
  
  // Ensure URL ends with /
  const finalUrl = trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`;
  return finalUrl;
};

// Create axios instance
const axiosInstance = axios.create({
  baseURL: getApiBaseURL()
});

// Create platform-specific API client
const apiClient = new ApiClient({
  baseURL: getApiBaseURL(),
  httpClient: axiosInstance,
  getToken: async () => {
    const state = store.getState();
    return state.auth?.token || localStorage.getItem('serviceToken') || localStorage.getItem('token');
  },
  getOrganizationId: async () => {
    return localStorage.getItem('currentOrganizationId') || store.getState().auth?.user?.currentOrganizationId;
  },
  onTokenExpired: () => {
    store.dispatch(logout());
    if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
  }
});

// Initialize all API modules
export const applicationAPI = new ApplicationAPI(apiClient);
export const organizationAPI = new OrganizationAPI(apiClient);
export const leaseAPI = new LeaseAPI(apiClient);
export const tenantDocumentAPI = new TenantDocumentAPI(apiClient);
export const applicationInviteAPI = new ApplicationInviteAPI(apiClient);
export const bankAccountAPI = new BankAccountAPI(apiClient);
export const accountAPI = new AccountAPI(apiClient);
export const generalLedgerAPI = new GeneralLedgerAPI(apiClient);
export const financialStatementsAPI = new FinancialStatementsAPI(apiClient);
export const bankReconciliationAPI = new BankReconciliationAPI(apiClient);
export const checklistAPI = new ChecklistAPI(apiClient);
export const conversationAPI = new ConversationAPI(apiClient);
export const expenseAPI = new ExpenseAPI(apiClient);
export const fileAPI = new FileAPI(apiClient);
export const fileCategoryAPI = new FileCategoryAPI(apiClient);
export const leaseGenerationAPI = new LeaseGenerationAPI(apiClient);
export const leaseTemplateAPI = new LeaseTemplateAPI(apiClient);
export const messageAPI = new MessageAPI(apiClient);
export const organizationInviteAPI = new OrganizationInviteAPI(apiClient);
export const organizationMemberAPI = new OrganizationMemberAPI(apiClient);
export const policyPackAPI = new PolicyPackAPI(apiClient);
export const propertyPortfolioAPI = new PropertyPortfolioAPI(apiClient);
export const recurringExpenseAPI = new RecurringExpenseAPI(apiClient);
export const searchAPI = new SearchAPI(apiClient);
export const subscriptionAPI = new SubscriptionAPI(apiClient);
export const tenantInviteAPI = new TenantInviteAPI(apiClient);
export const unitAPI = new UnitAPI(apiClient);
export const aiFollowUpAPI = new AIFollowUpAPI(apiClient);
export const announcementAPI = new AnnouncementAPI(apiClient);
export const adminSubscriptionAPI = new AdminSubscriptionAPI(apiClient);
export const adminUserAPI = new AdminUserAPI(apiClient);
export const adminUpcomingFeaturesAPI = new AdminUpcomingFeaturesAPI(apiClient);
export const landlordUpcomingFeaturesAPI = new LandlordUpcomingFeaturesAPI(apiClient);
export const timeEntryAPI = new TimeEntryAPI(apiClient);
export const timeBreakAPI = new TimeBreakAPI(apiClient);
export const staffMemberAPI = new StaffMemberAPI(apiClient);
export const timeTrackingSettingsAPI = new TimeTrackingSettingsAPI(apiClient);

// Export apiClient for direct use if needed
export { apiClient };

// Export for backward compatibility with old import patterns
export default {
  applicationAPI,
  organizationAPI,
  leaseAPI,
  tenantDocumentAPI,
  applicationInviteAPI,
  bankAccountAPI,
  accountAPI,
  generalLedgerAPI,
  financialStatementsAPI,
  bankReconciliationAPI,
  checklistAPI,
  conversationAPI,
  expenseAPI,
  fileAPI,
  fileCategoryAPI,
  leaseGenerationAPI,
  leaseTemplateAPI,
  messageAPI,
  organizationInviteAPI,
  organizationMemberAPI,
  policyPackAPI,
  propertyPortfolioAPI,
  recurringExpenseAPI,
  searchAPI,
  subscriptionAPI,
  tenantInviteAPI,
  unitAPI,
  aiFollowUpAPI,
  announcementAPI,
  adminSubscriptionAPI,
  adminUserAPI,
  adminUpcomingFeaturesAPI,
  landlordUpcomingFeaturesAPI,
  timeEntryAPI,
  timeBreakAPI,
  staffMemberAPI,
  timeTrackingSettingsAPI
};
