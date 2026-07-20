import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

// project imports
import router from 'routes';
import ThemeCustomization from 'themes';

import Locales from 'components/Locales';
import RTLLayout from 'components/RTLLayout';
import ScrollTop from 'components/ScrollTop';
import Snackbar from 'components/@extended/Snackbar';
import Notistack from 'components/third-party/Notistack';
import TokenExpirationChecker from 'components/TokenExpirationChecker';
import SignalRConnection from 'components/SignalRConnection';
import MaintenanceGate from 'components/MaintenanceGate';
import store from 'store';
import { Provider } from 'react-redux';

// auth-provider
import { JWTProvider as AuthProvider } from 'contexts/JWTContext';
import { OrganizationProvider } from 'contexts/OrganizationContext';

import { DrawerProvider } from 'contexts/DrawerContext';
import { ModalProvider } from 'contexts/ModalContext';
import { AICopilotProvider } from 'contexts/AICopilotContext';
import { LeaseProvider } from 'contexts/LeaseContext';
import { DashboardLoadingProvider } from 'contexts/DashboardLoadingContext';
import { TriggerSummaryProvider } from 'contexts/TriggerSummaryContext';
// import { FirebaseProvider as AuthProvider } from 'contexts/FirebaseContext';
// import { Auth0Provider as AuthProvider } from 'contexts/Auth0Context';
// import { AWSCognitoProvider as AuthProvider } from 'contexts/AWSCognitoContext';
// import { SupabseProvider as AuthProvider } from 'contexts/SupabaseContext';

// ==============================|| APP - THEME, ROUTER, LOCAL ||============================== //

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const AppContent = (
    <AuthProvider>
      <OrganizationProvider>
        <Provider store={store}>
          <TokenExpirationChecker />
          <ModalProvider>
            <DrawerProvider>
              <AICopilotProvider>
                <LeaseProvider>
                  <TriggerSummaryProvider>
                    <DashboardLoadingProvider>
                      <Notistack>
                      <SignalRConnection />
                      <MaintenanceGate>
                        <RouterProvider router={router} />
                      </MaintenanceGate>
                      <Snackbar />
                      </Notistack>
                    </DashboardLoadingProvider>
                  </TriggerSummaryProvider>
                </LeaseProvider>
              </AICopilotProvider>
            </DrawerProvider>
          </ModalProvider>
        </Provider>
      </OrganizationProvider>
    </AuthProvider>
  );

  return (
    <>
      <ThemeCustomization>
        <RTLLayout>
          <Locales>
            <ScrollTop>
              {googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                  {AppContent}
                </GoogleOAuthProvider>
              ) : (
                AppContent
              )}
            </ScrollTop>
          </Locales>
        </RTLLayout>
      </ThemeCustomization>
    </>
  );
}
