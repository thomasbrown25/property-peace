import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import apiClient from './src/services/apiClient';
import { logout } from './src/store/user/user.slice';
import config from './src/config';

// Set up API client token expiration handler
apiClient.setOnTokenExpired(() => {
  store.dispatch(logout());
});

export default function App() {
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    // Initialize config (fetch Google Client ID from backend)
    const initConfig = async () => {
      try {
        await config.initializeGoogleClientId();
      } catch (error) {
        console.warn('Failed to initialize config:', error);
      } finally {
        setConfigReady(true);
      }
    };

    initConfig();
  }, []);

  // Show loading screen while fetching config
  if (!configReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AppNavigator />
        </Provider>
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
