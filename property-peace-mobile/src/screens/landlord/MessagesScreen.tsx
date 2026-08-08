import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { MessagesStackParamList } from '../../navigation/types';
import ConversationAPI from '../../api/conversationAPI';
import signalRService from '../../services/signalRService';
import { ConversationFilter, ConversationSummary, filterConversations, formatConversationTime, getConversationPresentation } from '../../features/messages/messagesModel';
import { RootState } from '../../store';
import GroupConversationDialog from '../../components/messages/GroupConversationDialog';

type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;
const FILTERS: Array<{ key: ConversationFilter; label: string }> = [
  { key: 'inbox', label: 'Inbox' }, { key: 'unread', label: 'Unread' }, { key: 'archived', label: 'Archived' },
];

export default function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filter, setFilter] = useState<ConversationFilter>('inbox');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupDialogVisible, setGroupDialogVisible] = useState(false);
  const organizationId = currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId;
  const currentUserId = currentUser?.id ?? currentUser?.Id;

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setConversations((await ConversationAPI.getConversations(true)) ?? []);
      setError(null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Messages could not be loaded.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    let active = true;
    const refreshList = () => { if (active) void load(true); };
    (async () => {
      try {
        const connection = await signalRService.connect();
        if (active) {
          connection.on('ConversationListUpdated', refreshList);
          void load(true);
        }
      } catch { /* Pull-to-refresh remains available when realtime is offline. */ }
    })();
    return () => {
      active = false;
      signalRService.getConnection()?.off('ConversationListUpdated', refreshList);
    };
  }, [load]);
  useEffect(() => {
    const connection = signalRService.getConnection();
    if (!connection || !signalRService.isConnected()) return;
    for (const conversation of conversations) {
      void connection.invoke('JoinConversation', Number(conversation.id)).catch(() => undefined);
    }
  }, [conversations]);
  const visible = useMemo(() => filterConversations(conversations, filter, query), [conversations, filter, query]);
  const unread = conversations.reduce((sum, item) => sum + (item.isArchived ? 0 : Math.max(0, item.unreadCount ?? 0)), 0);

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const card = getConversationPresentation(item);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${card.title}${card.unreadCount ? `, ${card.unreadCount} unread` : ''}`}
        testID={`conversation-${item.id}`}
        style={[styles.card, card.unreadCount > 0 && styles.unreadCard]}
        onPress={() => navigation.navigate('ConversationDetail', { conversationId: String(item.id) })}
      >
        <View style={styles.avatar}><Text style={styles.avatarText}>{card.initials}</Text></View>
        <View style={styles.copy}>
          <View style={styles.row}>
            <Text style={[styles.title, card.unreadCount > 0 && styles.unreadText]} numberOfLines={1}>{card.title}</Text>
            <Text style={styles.time}>{formatConversationTime(item.lastMessageAt ?? item.updatedAt)}</Text>
          </View>
          {!!card.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text>}
          <View style={styles.row}>
            <Text style={[styles.preview, card.unreadCount > 0 && styles.unreadText]} numberOfLines={1}>{card.preview}</Text>
            {card.isPinned && <Ionicons name="pin" size={14} color="#64748b" style={styles.pin} />}
            {card.unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(99, card.unreadCount)}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.heading}>Messages</Text><Text style={styles.headerSub}>{conversations.length} conversations{unread ? ` · ${unread} unread` : ''}</Text></View>
        <TouchableOpacity testID="new-group" accessibilityLabel="Create group conversation" style={styles.newGroup} onPress={() => setGroupDialogVisible(true)}><Ionicons name="people" size={18} color="#fff" /><Text style={styles.newGroupText}>New group</Text></TouchableOpacity>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={19} color="#64748b" />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search people, properties, or messages" placeholderTextColor="#94a3b8" style={styles.searchInput} returnKeyType="search" />
        {!!query && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color="#94a3b8" /></TouchableOpacity>}
      </View>
      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const count = option.key === 'unread' ? conversations.filter((c) => !c.isArchived && (c.unreadCount ?? 0) > 0).length : undefined;
          return <TouchableOpacity key={option.key} style={[styles.filter, filter === option.key && styles.activeFilter]} onPress={() => setFilter(option.key)}>
            <Text style={[styles.filterText, filter === option.key && styles.activeFilterText]}>{option.label}{count ? ` ${count}` : ''}</Text>
          </TouchableOpacity>;
        })}
      </View>
      {loading && conversations.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.status}>Loading conversations…</Text></View> :
        error && conversations.length === 0 ? <View style={styles.center}><Ionicons name="cloud-offline-outline" size={38} color="#94a3b8" /><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> :
        <FlatList data={visible} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={[styles.list, visible.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#2563eb" />}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="chatbubbles-outline" size={42} color="#94a3b8" /><Text style={styles.emptyTitle}>{query ? 'No matching conversations' : filter === 'unread' ? 'You’re all caught up' : filter === 'archived' ? 'No archived conversations' : 'No messages yet'}</Text><Text style={styles.status}>{query ? 'Try another name, property, or keyword.' : 'New conversations will appear here.'}</Text></View>} />}
      <GroupConversationDialog visible={groupDialogVisible} organizationId={organizationId} currentUserId={currentUserId} onClose={() => setGroupDialogVisible(false)} onCreated={(id) => { setGroupDialogVisible(false); navigation.navigate('ConversationDetail', { conversationId: id }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { color: '#0f2f47', fontSize: 28, fontWeight: '900' }, headerSub: { color: '#64748b', marginTop: 3, fontSize: 13 }, newGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, newGroupText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  search: { marginHorizontal: 16, minHeight: 46, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#dbe3ec', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }, filter: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 18, backgroundColor: '#e8eef4' }, activeFilter: { backgroundColor: '#0f2f47' }, filterText: { color: '#526273', fontWeight: '700', fontSize: 13 }, activeFilterText: { color: '#fff' },
  list: { paddingHorizontal: 14, paddingBottom: 28 }, emptyList: { flexGrow: 1 }, card: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 9, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf0' }, unreadCard: { borderColor: '#bdd3fa', backgroundColor: '#f8fbff' }, avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dff7f4', marginRight: 12 }, avatarText: { color: '#087b79', fontWeight: '900', fontSize: 16 }, copy: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center' }, title: { flex: 1, color: '#1e293b', fontWeight: '700', fontSize: 16, marginRight: 8 }, unreadText: { color: '#0f172a', fontWeight: '900' }, time: { color: '#64748b', fontSize: 12 }, subtitle: { color: '#64748b', marginTop: 3, fontSize: 12 }, preview: { flex: 1, color: '#64748b', marginTop: 5, fontSize: 13 }, pin: { marginLeft: 7 }, badge: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, marginLeft: 8, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  center: { flex: 1, minHeight: 220, padding: 30, alignItems: 'center', justifyContent: 'center' }, status: { color: '#64748b', textAlign: 'center', marginTop: 9, lineHeight: 20 }, error: { color: '#b42318', textAlign: 'center', marginTop: 10 }, retry: { backgroundColor: '#2563eb', borderRadius: 12, marginTop: 16, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { color: '#fff', fontWeight: '800' }, emptyTitle: { color: '#334155', fontSize: 17, fontWeight: '800', marginTop: 12 },
});
