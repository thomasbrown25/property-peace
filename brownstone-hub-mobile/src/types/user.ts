export interface User {
  Id: string;
  Email: string;
  FirstName?: string;
  LastName?: string;
  Roles?: string[];
  jwtToken?: string;
  hasSeenTutorial?: boolean;
  currentOrganizationId?: string;
  [key: string]: any;
}

export interface UserSettings {
  darkMode: boolean;
  sidebarMini: boolean;
  activeColor: string;
  propertyLayout: string;
}

export interface NotificationSettings {
  [key: string]: any;
}

export interface UserState {
  currentUser: User | null;
  settings: UserSettings;
  notificationSettings: NotificationSettings | null;
  isAuthenticated: boolean | null;
  loading: boolean;
  token: string | null;
  error: any;
}
