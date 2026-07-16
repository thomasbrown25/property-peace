export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  EmailLogin: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Lease: undefined;
  Applications: undefined;
  Maintenance: undefined;
  Payments: undefined;
  Messages: undefined;
  Documents: undefined;
  Settings: undefined;
};

export type LeaseStackParamList = {
  LeaseDetail: { leaseId: string };
};

export type ApplicationsStackParamList = {
  ApplicationsList: undefined;
  ApplicationDetail: { applicationId: string };
};

export type MaintenanceStackParamList = {
  MaintenanceList: undefined;
  MaintenanceDetail: { maintenanceId: string };
  CreateMaintenanceStep1: undefined;
  CreateMaintenanceStep2: { description: string };
  CreateMaintenanceCreating: { description: string; images: string[] };
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  ConversationDetail: { conversationId: string };
  Search: {
    selectedBathrooms?: string;
    selectedPets?: string[];
    yearBuilt?: string;
    squareFeet?: string;
    acceptsOnlineApplications?: boolean;
  } | undefined;
  Filters: {
    selectedBathrooms?: string;
    selectedPets?: string[];
    yearBuilt?: string;
    squareFeet?: string;
    acceptsOnlineApplications?: boolean;
  } | undefined;
};
