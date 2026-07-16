import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logout } from '../store/user/user.slice';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.84, 340);
const logo = require('../../assets/property-peace-navbar-logo.png');

interface SimpleDrawerProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

type MenuItem = {
  id: string;
  title: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', route: 'Dashboard', icon: 'speedometer-outline' },
  { id: 'properties', title: 'Properties', route: 'Properties', icon: 'home-outline' },
  { id: 'messages', title: 'Messages', route: 'Messages', icon: 'chatbubble-ellipses-outline' },
  { id: 'maintenance', title: 'Maintenance', route: 'Maintenance', icon: 'construct-outline' },
  { id: 'tenants', title: 'Tenants', route: 'Tenants', icon: 'people-outline' },
  { id: 'leases', title: 'Leases', route: 'Leases', icon: 'document-text-outline' },
  { id: 'notifications', title: 'Notifications', route: 'Notifications', icon: 'notifications-outline' },
  { id: 'settings', title: 'Settings', route: 'Settings', icon: 'settings-outline' },
];

const firstString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function SimpleDrawer({ visible, onClose, navigation }: SimpleDrawerProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppSelector((state) => state.user);
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, visible]);

  const displayName = firstString(
    `${currentUser?.FirstName || currentUser?.firstName || ''} ${currentUser?.LastName || currentUser?.lastName || ''}`,
    currentUser?.Name,
    currentUser?.name,
    'Property Peace user',
  );
  const email = firstString(currentUser?.Email, currentUser?.email, 'No email on file');
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'PP';

  const handleLogout = async () => {
    await dispatch(logout());
    onClose();
  };

  const navigateToScreen = (route: string) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(route);
    }, 100);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.drawer, { paddingTop: Math.max(insets.top, 16), transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.76}>
                <Ionicons name="close" size={22} color="#0b2438" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuSection} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => navigateToScreen(item.route)} activeOpacity={0.78}>
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon} size={20} color="#2475cf" />
                </View>
                <Text style={styles.menuItemText}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={18} color="#95a1ad" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.82}>
              <Ionicons name="log-out-outline" size={20} color="#c2413b" />
              <Text style={styles.logoutButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 30, 53, 0.42)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#fbf7f4',
    shadowColor: '#001a33',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  logoRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logo: {
    width: 150,
    height: 42,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ece6e2',
  },
  profileCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ece6e2',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b3558',
  },
  avatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#102d43',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  profileEmail: {
    color: '#697887',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  menuScroll: {
    flex: 1,
  },
  menuSection: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  menuItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#edf0f2',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef7ff',
  },
  menuItemText: {
    flex: 1,
    color: '#20394d',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ece6e2',
  },
  logoutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0d8d6',
    borderRadius: 17,
  },
  logoutButtonText: {
    color: '#c2413b',
    fontSize: 16,
    fontWeight: '900',
  },
});
