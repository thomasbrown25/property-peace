import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ChecklistsStackParamList } from './checklistsTypes';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MfaVerification: {
    challenge: import('../services/mfaChallenge').MfaChallenge;
  };
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  Calendar: undefined;
  RentCollection: undefined;
  AddExpense: undefined;
};

export type MainTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList> | undefined;
  Properties: NavigatorScreenParams<PropertiesStackParamList> | undefined;
  Checklists: NavigatorScreenParams<ChecklistsStackParamList> | undefined;
  Maintenance: undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList> | undefined;
  Notifications: undefined;
  Tenants: NavigatorScreenParams<TenantsStackParamList> | undefined;
  Team: undefined;
  Vendors: NavigatorScreenParams<VendorsStackParamList> | undefined;
  Announcements: NavigatorScreenParams<AnnouncementsStackParamList> | undefined;
  Finances: undefined;
  Leases: NavigatorScreenParams<LeasesStackParamList> | undefined;
  Listings: NavigatorScreenParams<ListingsStackParamList> | undefined;
  Applications: NavigatorScreenParams<ApplicationsStackParamList> | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type SettingsCategory = 'account' | 'general' | 'profile' | 'subscription' | 'payments' | 'smsnumber' | 'notifications' | 'appearance';
export type SettingsStackParamList = {
  SettingsIndex: undefined;
  SettingsCategory: { category: SettingsCategory };
};

export type ListingsStackParamList = {
  ListingsList: undefined;
  ListingDetail: { item: import('../api/listingAPI').Listing; scope: string };
};
export type ApplicationsStackParamList = {
  ApplicationsList: undefined;
  ApplicationDetail: { item: import('../api/landlordApplicationsAPI').RentalApplication; scope: string };
};
export type AnnouncementsStackParamList = {
  AnnouncementsList: undefined;
  AnnouncementDetail: { item: import('../api/announcementAPI').Announcement };
};

export type PropertiesStackParamList = {
  PropertiesList: undefined;
  PropertyDetail: { propertyId: string };
  PropertyMaintenance: { propertyId: string; propertyName: string };
  AddMaintenanceRequest: { propertyId?: string } | undefined;
  LandlordMaintenanceDetail: { requestId: string; listItem?: import('../api/maintenanceAPI').MaintenanceRequest };
  AddProperty: undefined;

};

export type VendorsStackParamList = {
  VendorsList: undefined;
  VendorDetail: { vendorId: string };
  VendorMaintenanceDetail: { requestId: string };
};

export type TenantsStackParamList = {
  TenantsList: undefined;
  TenantDetail: { tenantId: string };
  AddTenant: undefined;
};

export type MaintenanceStackParamList = {
  MaintenanceList: undefined;
  AddMaintenanceRequest: { propertyId?: string } | undefined;
  LandlordMaintenanceDetail: { requestId: string; listItem?: import('../api/maintenanceAPI').MaintenanceRequest };
  TenantMaintenanceList: undefined;
  TenantMaintenanceIntake: undefined;
  MaintenanceEmergency: { signals: import('../features/maintenance/maintenanceModel').MaintenanceSignal[] };
  TenantMaintenanceReceipt: { request: import('../api/maintenanceAPI').MaintenanceRequest; uploadWarning?: string; failedMedia?: import('../api/maintenanceAPI').LocalMedia[] };
  TenantMaintenanceDetail: { requestId: string; listItem?: import('../api/maintenanceAPI').MaintenanceRequest };
};

export type LeasesStackParamList = {
  LeasesList: undefined;
  AddLease: undefined;
  LeaseDetail: { leaseId: string; archived: boolean };
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  ConversationDetail: { conversationId: string; selectedConversation?: import('../features/messages/messagesModel').ConversationSummary };
};
