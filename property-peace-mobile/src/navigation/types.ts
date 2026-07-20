export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Messages: undefined;
  Notifications: undefined;
  Maintenance: undefined;
  Tenants: undefined;
  Properties: undefined;
  Leases: undefined;
  Settings: undefined;
  QuickAdd: undefined;
  More: undefined;
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
  AddMaintenance: undefined;
};

export type LeasesStackParamList = {
  LeasesList: undefined;
  LeaseDetail: { leaseId: string };
  AddLease: undefined;
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  ConversationDetail: { conversationId: string };
};
