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

export type MainTabParamList = {
  Dashboard: undefined;
  Properties: undefined;
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
  Checklists: { propertyId: string; propertyName?: string };
};

export type TenantsStackParamList = {
  TenantsList: undefined;
  AddTenant: undefined;
};

export type MaintenanceStackParamList = {
  MaintenanceList: undefined;
  AddMaintenance: { propertyId?: string; unitId?: string; propertyName?: string } | undefined;
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
