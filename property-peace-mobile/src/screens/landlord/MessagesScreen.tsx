import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { MessagesStackParamList } from '../../navigation/types';
import ConversationAPI from '../../api/conversationAPI';
import signalRService from '../../services/signalRService';
import { advanceMessagingScopeGeneration, buildMessagingScopeKey, canAccessMessages, ConversationFilter, ConversationSummary, filterConversations, formatConversationTime, getConversationPresentation, getMessageCapabilities, getMessagesAudience, isMessagingOperationCurrent, MessagingScopeGeneration } from '../../features/messages/messagesModel';
import { RootState } from '../../store';
import NewMessageDialog from '../../components/messages/NewMessageDialog';
import { useAppTheme } from '../../theme/AppTheme';


type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;
const FILTERS: Array<{ key: ConversationFilter; label: string }> = [
  { key: 'inbox', label: 'Inbox' }, { key: 'unread', label: 'Unread' }, { key: 'archived', label: 'Archived' },
];

export default function MessagesScreen() {
  const scrollRef = useRef<FlatList>(null);
  useTabScrollReset(scrollRef);
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filter, setFilter] = useState<ConversationFilter>('inbox');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessageVisible, setNewMessageVisible] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const scopeGenerationRef = useRef<MessagingScopeGeneration | undefined>(undefined);

  const organizationId = currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId;
  const audience = getMessagesAudience(currentUser);
  const dataScope = buildMessagingScopeKey(currentUser, audience);
  const scopeGeneration = advanceMessagingScopeGeneration(scopeGenerationRef.current, dataScope);
  scopeGenerationRef.current = scopeGeneration;
  const hasMessageAccess = canAccessMessages(audience);
  const capabilities = getMessageCapabilities(audience);
  const scopeIsCurrent = loadedScope === dataScope;
  const scopedConversations = scopeIsCurrent ? conversations : [];
  const scopedError = scopeIsCurrent ? error : null;
  const scopedLoading = !scopeIsCurrent || loading;

  const load = useCallback(async (refresh = false) => {
    const operation = scopeGeneration;
    const requestId = ++requestSequence.current;
    if (!hasMessageAccess || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const nextConversations = (await ConversationAPI.getConversations(audience, capabilities.archive)) ?? [];
      if (requestId !== requestSequence.current || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      setConversations(nextConversations);
      setLoadedScope(dataScope);
      setError(null);
    } catch (loadError: any) {
      if (requestId !== requestSequence.current || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      setConversations([]);
      setLoadedScope(dataScope);
      setError(loadError?.message || 'Messages could not be loaded.');
    } finally {
      if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [audience, capabilities.archive, dataScope, hasMessageAccess, scopeGeneration]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!hasMessageAccess) return undefined;
    let active = true;
    const refreshList = () => { if (active) void load(true); };
    (async () => {
      try {
        const connection = await signalRService.connect(organizationId);
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
  }, [hasMessageAccess, load, organizationId]);
  useEffect(() => {
    if (audience === 'tenant') setFilter('inbox');
  }, [audience]);
  useEffect(() => {
    if (!hasMessageAccess) return undefined;
    const conversationIds = [...new Set(scopedConversations.map((conversation) => Number(conversation.id)).filter(Number.isFinite))];
    for (const id of conversationIds) {
      void signalRService.subscribeToConversation(organizationId, id).catch(() => undefined);
    }
    return () => {
      for (const id of conversationIds) void signalRService.unsubscribeFromConversation(organizationId, id).catch(() => undefined);
    };
  }, [dataScope, hasMessageAccess, organizationId, scopedConversations]);
  const visible = useMemo(() => filterConversations(scopedConversations, filter, query), [scopedConversations, filter, query]);
  const unread = scopedConversations.reduce((sum, item) => sum + (item.isArchived ? 0 : Math.max(0, item.unreadCount ?? 0)), 0);

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const card = getConversationPresentation(item);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${card.title}${card.unreadCount ? `, ${card.unreadCount} unread` : ''}`}
        testID={`conversation-${item.id}`}
        style={styles.conversationRow}
        onPress={() => navigation.navigate('ConversationDetail', { conversationId: String(item.id), selectedConversation: item })}
      >
        <View style={[styles.avatar, card.unreadCount > 0 && styles.unreadAvatar, dark && { backgroundColor: colors.border }]}><Text style={[styles.avatarText, dark && { color: colors.accent }]}>{card.initials}</Text></View>
        <View style={styles.copy}>
          <View style={styles.row}>
            <Text style={[styles.title, card.unreadCount > 0 && styles.unreadText, dark && { color: colors.text }]} numberOfLines={1}>{card.title}</Text>
            <Text style={[styles.time, dark && { color: colors.muted }]}>{formatConversationTime(item.lastMessageAt ?? item.updatedAt)}</Text>
          </View>
          {!!card.subtitle && <Text style={[styles.subtitle, dark && { color: colors.muted }]} numberOfLines={1}>{card.subtitle}</Text>}
          <View style={styles.row}>
            <Text style={[styles.preview, card.unreadCount > 0 && styles.unreadText, dark && { color: card.unreadCount > 0 ? colors.text : colors.muted }]} numberOfLines={1}>{card.preview}</Text>
            {capabilities.pin && card.isPinned && <Ionicons name="pin" size={14} color={dark ? colors.muted : '#64748b'} style={styles.pin} />}
            {card.unreadCount > 0 && <View style={[styles.badge, dark && { backgroundColor: colors.accent }]}><Text style={[styles.badgeText, dark && { color: colors.background }]}>{Math.min(99, card.unreadCount)}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!hasMessageAccess) return <View style={[styles.center, dark && { backgroundColor: colors.background }]}><Ionicons name="lock-closed-outline" size={40} color={dark ? colors.muted : '#64748b'} /><Text style={[styles.error, dark && { color: colors.text }]}>Messages aren’t available for this role.</Text></View>;

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View><Text style={[styles.heading, dark && { color: colors.text }]} accessibilityRole="header">Messages</Text><Text style={[styles.headerSub, dark && { color: colors.muted }]}>{scopedConversations.length} conversations{unread ? ` · ${unread} unread` : ''}</Text></View>
        {audience === 'landlord' && <TouchableOpacity testID="new-message" accessibilityLabel="New message" style={[styles.newGroup, { backgroundColor: colors.accent }]} onPress={() => setNewMessageVisible(true)}><Ionicons name="create-outline" size={18} color="#fff" /><Text style={styles.newGroupText}>New message</Text></TouchableOpacity>}
      </View>
      <View style={[styles.search, dark && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Ionicons name="search" size={19} color={dark ? colors.muted : '#64748b'} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search people, properties, or messages" placeholderTextColor={dark ? colors.muted : '#94a3b8'} style={[styles.searchInput, dark && { color: colors.text }]} returnKeyType="search" />
        {!!query && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={dark ? colors.muted : '#94a3b8'} /></TouchableOpacity>}
      </View>
      <View style={[styles.filters, dark && { borderBottomColor: colors.border }]}>
        {FILTERS.filter((option) => capabilities.archive || option.key !== 'archived').map((option) => {
          const count = option.key === 'unread' ? scopedConversations.filter((c) => !c.isArchived && (c.unreadCount ?? 0) > 0).length : undefined;
          return <TouchableOpacity key={option.key} style={[styles.filter, filter === option.key && styles.activeFilter, dark && filter === option.key && { borderBottomColor: colors.accent }]} onPress={() => setFilter(option.key)}>
            <Text style={[styles.filterText, filter === option.key && styles.activeFilterText, dark && { color: filter === option.key ? colors.text : colors.muted }]}>{option.label}{count ? ` ${count}` : ''}</Text>
          </TouchableOpacity>;
        })}
      </View>
      {scopedLoading && scopedConversations.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color={dark ? colors.accent : '#2563eb'} /><Text style={[styles.status, dark && { color: colors.muted }]}>Loading conversations…</Text></View> :
        scopedError && scopedConversations.length === 0 ? <View style={styles.center}><Ionicons name="cloud-offline-outline" size={38} color={dark ? colors.muted : '#94a3b8'} /><Text style={[styles.error, dark && { color: colors.text }]}>{scopedError}</Text><TouchableOpacity style={[styles.retry, dark && { backgroundColor: colors.accent }]} onPress={() => void load()}><Text style={[styles.retryText, dark && { color: colors.background }]}>Try again</Text></TouchableOpacity></View> :
        <FlatList ref={scrollRef} data={visible} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={[styles.list, visible.length === 0 && styles.emptyList]}
          ItemSeparatorComponent={() => <View style={[styles.divider, dark && { backgroundColor: colors.border }]} />}
          ListHeaderComponent={visible.length > 0 ? <Text style={[styles.listLabel, dark && { color: colors.muted }]}>{filter === 'archived' ? 'ARCHIVED' : filter === 'unread' ? 'UNREAD' : 'CONVERSATIONS'}</Text> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={dark ? colors.accent : '#2563eb'} />}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="chatbubbles-outline" size={42} color={dark ? colors.muted : '#94a3b8'} /><Text style={[styles.emptyTitle, dark && { color: colors.text }]}>{query ? 'No matching conversations' : filter === 'unread' ? 'You’re all caught up' : filter === 'archived' ? 'No archived conversations' : 'No messages yet'}</Text><Text style={[styles.status, dark && { color: colors.muted }]}>{query ? 'Try another name, property, or keyword.' : 'New conversations will appear here.'}</Text></View>} />}
      {audience === 'landlord' && newMessageVisible && scopeIsCurrent && <NewMessageDialog key={dataScope} onClose={() => setNewMessageVisible(false)} onOpen={(conversation) => { if (scopeGenerationRef.current && isMessagingOperationCurrent(scopeGeneration, scopeGenerationRef.current)) { setNewMessageVisible(false); navigation.navigate('ConversationDetail', { conversationId: String(conversation.id), selectedConversation: conversation }); } }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, header: { paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { color: '#0f2f47', fontSize: 28, fontWeight: '800' }, headerSub: { color: '#64748b', marginTop: 3, fontSize: 13 }, newGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, newGroupText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  search: { marginHorizontal: 20, minHeight: 46, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 24, paddingHorizontal: 20, marginTop: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, filter: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeFilter: { borderBottomColor: '#2563eb' }, filterText: { color: '#64748b', fontWeight: '600', fontSize: 13 }, activeFilterText: { color: '#0f2f47', fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 28 }, emptyList: { flexGrow: 1 }, listLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, paddingTop: 23, paddingBottom: 6 }, conversationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }, divider: { height: 1, backgroundColor: '#e8edf2', marginLeft: 60 }, avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f1f1', marginRight: 12 }, unreadAvatar: { backgroundColor: '#dbeafe' }, avatarText: { color: '#087b79', fontWeight: '800', fontSize: 16 }, copy: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center' }, title: { flex: 1, color: '#1e293b', fontWeight: '700', fontSize: 16, marginRight: 8 }, unreadText: { color: '#0f172a', fontWeight: '900' }, time: { color: '#64748b', fontSize: 12 }, subtitle: { color: '#64748b', marginTop: 3, fontSize: 12 }, preview: { flex: 1, color: '#64748b', marginTop: 5, fontSize: 13 }, pin: { marginLeft: 7 }, badge: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, marginLeft: 8, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  center: { flex: 1, minHeight: 220, padding: 30, alignItems: 'center', justifyContent: 'center' }, status: { color: '#64748b', textAlign: 'center', marginTop: 9, lineHeight: 20 }, error: { color: '#b42318', textAlign: 'center', marginTop: 10 }, retry: { backgroundColor: '#2563eb', borderRadius: 12, marginTop: 16, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { color: '#fff', fontWeight: '800' }, emptyTitle: { color: '#334155', fontSize: 17, fontWeight: '800', marginTop: 12 },
});
