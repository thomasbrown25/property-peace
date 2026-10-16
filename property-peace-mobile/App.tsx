import React from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppThemeProvider, useAppTheme } from './src/theme/AppTheme';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import apiClient from './src/services/apiClient';
import { logout } from './src/store/user/user.slice';

apiClient.setOnTokenExpired(() => {
  store.dispatch(logout());
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AppThemeProvider>
            <ThemedApp />
          </AppThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  const { mode } = useAppTheme();
  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><AppNavigator /></>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
