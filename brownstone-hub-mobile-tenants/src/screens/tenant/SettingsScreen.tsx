import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.user);
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  };

  const menuItems = [
    { id: 'search', title: 'Search', icon: 'search' },
    { id: 'maintenance', title: 'Maintenance Requests', icon: 'construct' },
    { id: 'utilities', title: 'Utility Providers', icon: 'flash' },
    { id: 'settings', title: 'Settings', icon: 'settings' },
    { id: 'support', title: 'Support', icon: 'headset' },
    { id: 'theme', title: 'Theme', icon: 'moon', subtitle: 'Automatic' },
    { id: 'privacy', title: 'Privacy Policy', icon: 'shield-checkmark' },
    { id: 'terms', title: 'Terms and Conditions', icon: 'document-text' },
    { id: 'whatsnew', title: "What's New", icon: 'newspaper', subtitle: 'Version 1.0.0', badge: true },
  ];

  const getInitials = () => {
    const firstName = currentUser?.FirstName || currentUser?.firstname || '';
    const lastName = currentUser?.LastName || currentUser?.lastname || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (currentUser?.Email) {
      return currentUser.Email[0].toUpperCase();
    }
    return 'T';
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingTop: Math.max(insets.top, 8) }}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {currentUser?.FirstName || currentUser?.firstname || 'Tenant'} {currentUser?.LastName || currentUser?.lastname || ''}
            </Text>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                // TODO: Handle menu item press
              }}
            >
              <Ionicons 
                name={item.icon as any} 
                size={24} 
                color="#333333" 
                style={styles.menuIcon}
              />
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemTitleRow}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  {item.badge && <View style={styles.badge} />}
                </View>
                {item.subtitle && (
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  signOutText: {
    fontSize: 14,
    color: '#1976d2',
  },
  menuSection: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  menuIcon: {
    marginRight: 16,
    width: 24,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginLeft: 8,
  },
});
