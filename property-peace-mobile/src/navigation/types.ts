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
  AddExpense: undefined;
};

export type MainTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList> | undefined;
  Properties: undefined;
  Checklists: NavigatorScreenParams<ChecklistsStackParamList> | undefined;
  Maintenance: undefined;
  Messages: undefined;
  Notifications: undefined;
  Tenants: undefined;
  Leases: undefined;
  Settings: undefined;
};

export type PropertiesStackParamList = {
  PropertiesList: undefined;
  PropertyDetail: { propertyId: string };
  AddProperty: undefined;

};

export type TenantsStackParamList = {
  TenantsList: undefined;
  AddTenant: undefined;
};

export type MaintenanceStackParamList = {
  MaintenanceList: undefined;
  LandlordMaintenanceDetail: { requestId: string; listItem?: import('../api/maintenanceAPI').MaintenanceRequest };
  TenantMaintenanceList: undefined;
  TenantMaintenanceIntake: undefined;
  MaintenanceEmergency: { signals: import('../features/maintenance/maintenanceModel').MaintenanceSignal[] };
  TenantMaintenanceReceipt: { request: import('../api/maintenanceAPI').MaintenanceRequest; uploadWarning?: string; failedMedia?: import('../api/maintenanceAPI').LocalMedia[] };
  TenantMaintenanceDetail: { requestId: string; listItem?: import('../api/maintenanceAPI').MaintenanceRequest };
};

export type LeasesStackParamList = {
  LeasesList: undefined;
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  ConversationDetail: { conversationId: string; selectedConversation?: import('../features/messages/messagesModel').ConversationSummary };
};
