import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logout } from '../store/user/user.slice';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.user);

  const handleLogout = async () => {
    await dispatch(logout());
    props.navigation.closeDrawer();
  };

  const menuItems = [
    { id: 'dashboard', title: 'Dashboard', route: 'Dashboard' },
    { id: 'properties', title: 'Properties', route: 'Properties' },
    { id: 'leases', title: 'Leases', route: 'Leases' },
    { id: 'messages', title: 'Messages', route: 'Messages' },
    { id: 'settings', title: 'Settings', route: 'Settings' },
  ];

  const navigateToScreen = (route: string) => {
    // Close drawer first
    props.navigation.closeDrawer();
    // Navigate to the tab screen
    // The drawer contains "Tabs", navigate to the specific tab within it
    setTimeout(() => {
      (props.navigation as any).navigate('Tabs', { screen: route });
    }, 100);
  };

  return (
    <DrawerContentScrollView {...props} style={styles.drawer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Brownstone Hub</Text>
        {currentUser && (
          <>
            <Text style={styles.headerSubtitle}>
              {currentUser.FirstName || currentUser.firstname} {currentUser.LastName || currentUser.lastname}
            </Text>
            <Text style={styles.headerEmail}>{currentUser.Email || currentUser.email}</Text>
          </>
        )}
      </View>

      <View style={styles.menuSection}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => navigateToScreen(item.route)}
          >
            <Text style={styles.menuItemText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#1976d2',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 14,
    color: '#e3f2fd',
  },
  menuSection: {
    flex: 1,
    paddingTop: 10,
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
