import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import apiClient from './src/services/apiClient';
import { logout } from './src/store/user/user.slice';
import config from './src/config';

// Check if we're in Expo Go (where native modules aren't available)
// In Expo Go, executionEnvironment is 'storeClient'
// In development builds, it's 'standalone' or undefined
const isExpoGo = Constants.executionEnvironment === 'storeClient' || 
                 (Constants.appOwnership === 'expo' && !Constants.isDevice);

// Set up API client token expiration handler
apiClient.setOnTokenExpired(() => {
  store.dispatch(logout());
});

export default function App() {
  // Always call all hooks in the same order (Rules of Hooks)
  const [configReady, setConfigReady] = useState(false);
  const [StripeWrapper, setStripeWrapper] = useState<React.ComponentType<any> | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    // Initialize config (fetch Google Client ID and Stripe publishable key from backend)
    const initConfig = async () => {
      try {
        await Promise.all([
          config.initializeGoogleClientId(),
          config.initializeStripePublishableKey(),
        ]);
      } catch (error) {
        console.warn('Failed to initialize config:', error);
      } finally {
        setConfigReady(true);
      }
    };

    initConfig();
  }, []);

  // Get Stripe publishable key after config is ready
  const stripePublishableKey = configReady ? config.STRIPE_PUBLISHABLE_KEY : null;
  
  // Only use Stripe if we're not in Expo Go and have a publishable key
  const shouldUseStripe = configReady && !isExpoGo && stripePublishableKey !== null;
  
  useEffect(() => {
    if (shouldUseStripe && !StripeWrapper && !stripeLoading) {
      setStripeLoading(true);
      // Dynamically import StripeProvider to avoid loading it in Expo Go
      import('@stripe/stripe-react-native')
        .then((stripeModule) => {
          try {
            const Wrapper = ({ children, publishableKey }: any) => {
              const { StripeProvider } = stripeModule;
              return <StripeProvider publishableKey={publishableKey}>{children}</StripeProvider>;
            };
            setStripeWrapper(() => Wrapper);
            setStripeLoading(false);
          } catch (error) {
            console.warn('⚠️ Failed to create StripeProvider wrapper:', error);
            setStripeLoading(false);
          }
        })
        .catch((error) => {
          console.warn('⚠️ Failed to load Stripe React Native (this is expected in Expo Go):', error?.message || error);
          setStripeLoading(false);
        });
    }
  }, [configReady, shouldUseStripe, StripeWrapper, stripeLoading]);

  const AppContent = (
    <Provider store={store}>
      <AppNavigator />
    </Provider>
  );

  // Show loading screen while fetching config or loading Stripe
  if (!configReady || stripeLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        {shouldUseStripe && StripeWrapper ? (
          <StripeWrapper publishableKey={stripePublishableKey}>
            {AppContent}
          </StripeWrapper>
        ) : (
          AppContent
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
