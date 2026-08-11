import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { MessagesStackParamList } from '../../navigation/types';
import ConversationAPI, { FollowUpTask, QuickReply } from '../../api/conversationAPI';
import MessageAPI from '../../api/messageAPI';
import signalRService from '../../services/signalRService';
import { RootState } from '../../store';
import * as Crypto from 'expo-crypto';
import { advanceMessagingScopeGeneration, buildMessagingScopeKey, canAccessMessages, ConversationSummary, filterTimelineForAudience, TimelineEntry, getConversationPresentation, getMessageCapabilities, getMessagesAudience, getTimelineEntryPresentation, isMessagingOperationCurrent, loadConversationCore, mergeTimelinePages, MessagingScopeGeneration, normalizeTimelinePage, selectReadThroughSequence } from '../../features/messages/messagesModel';
import GroupConversationDialog from '../../components/messages/GroupConversationDialog';

type DetailRoute = RouteProp<MessagesStackParamList, 'ConversationDetail'>;
type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'ConversationDetail'>;
const MAX_MESSAGE_LENGTH = 2000;

export default function ConversationDetailScreen() {
  const { conversationId, selectedConversation } = useRoute<DetailRoute>().params;
  const navigation = useNavigation<Navigation>();
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const listRef = useRef<FlatList<TimelineEntry>>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timelineQuery, setTimelineQuery] = useState('');
  const [timelineChannel, setTimelineChannel] = useState('');
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [followUpEntry, setFollowUpEntry] = useState<TimelineEntry | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [groupDialogVisible, setGroupDialogVisible] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const retrySend = useRef<{ content: string; clientRequestId: string } | null>(null);
  const requestSequence = useRef(0);
  const coreLoadInFlight = useRef(0);
  const currentScopeRef = useRef('');
  const scopeGenerationRef = useRef<MessagingScopeGeneration | undefined>(undefined);
  const organizationId = currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId;
  const currentUserId = currentUser?.id ?? currentUser?.Id;
  const audience = getMessagesAudience(currentUser);
  const dataScope = buildMessagingScopeKey(currentUser, audience, conversationId);
  const scopeGeneration = advanceMessagingScopeGeneration(scopeGenerationRef.current, dataScope);
  scopeGenerationRef.current = scopeGeneration;
  currentScopeRef.current = dataScope;
  const selectedConversationScope = useRef(dataScope);
  const hasMessageAccess = canAccessMessages(audience);
  const capabilities = getMessageCapabilities(audience);
  const scopeIsCurrent = loadedScope === dataScope;

  const markVisibleRead = useCallback(async (items: TimelineEntry[], requestScope: string) => {
    if (currentScopeRef.current !== requestScope) return;
    const through = selectReadThroughSequence(items);
    if (through !== null) {
      try { await ConversationAPI.markTimelineRead(conversationId, through); } catch { /* Reading must not block the thread. */ }
    }
  }, [conversationId]);

  const load = useCallback(async (refresh = false) => {
    const requestScope = dataScope;
    const operation = scopeGeneration;
    const requestId = ++requestSequence.current;
    if (!hasMessageAccess || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
    coreLoadInFlight.current += 1;
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const { conversation: conversationResult, timeline: rawPage } = await loadConversationCore({
        audience,
        selectedConversation: selectedConversationScope.current === requestScope ? selectedConversation : null,
        loadConversation: () => ConversationAPI.getConversation(conversationId),
        loadTimeline: () => timelineQuery.trim() || timelineChannel
          ? ConversationAPI.searchTimeline(conversationId, timelineQuery, timelineChannel)
          : ConversationAPI.getTimeline(conversationId),
      });
      if (requestId !== requestSequence.current || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      const page = normalizeTimelinePage(rawPage);
      if (!page) throw new Error('The conversation returned an unsupported timeline.');
      const visibleItems = filterTimelineForAudience(page.items, audience);
      setConversation(conversationResult); setEntries(visibleItems); setNextCursor(page.nextCursor); setError(null); setLoadedScope(requestScope);
      void markVisibleRead(visibleItems, requestScope);
      if (capabilities.quickReplies && organizationId) {
        ConversationAPI.getQuickReplies(organizationId).then((items) => {
          if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setQuickReplies(items.filter((item) => item.isActive));
        }).catch(() => {
          if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setQuickReplies([]);
        });
        ConversationAPI.getFollowUps(organizationId, conversationId).then((items) => {
          if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setFollowUps(items);
        }).catch(() => {
          if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setFollowUps([]);
        });
      } else {
        setQuickReplies([]); setFollowUps([]);
      }
      requestAnimationFrame(() => {
        if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) listRef.current?.scrollToEnd({ animated: false });
      });
    } catch (loadError: any) {
      if (requestId !== requestSequence.current || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      setConversation(null); setEntries([]); setNextCursor(null); setQuickReplies([]); setFollowUps([]);
      setFollowUpEntry(null); setGroupDialogVisible(false); setLoadedScope(requestScope);
      setError(loadError?.message || 'This conversation could not be loaded.');
    } finally {
      coreLoadInFlight.current = Math.max(0, coreLoadInFlight.current - 1);
      if (requestId === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) {
        setLoading(false); setRefreshing(false);
      }
    }
  }, [audience, capabilities.quickReplies, conversationId, dataScope, hasMessageAccess, markVisibleRead, organizationId, scopeGeneration, selectedConversation, timelineChannel, timelineQuery]);

  useEffect(() => {
    requestSequence.current += 1;
    setConversation(null); setEntries([]); setNextCursor(null); setQuickReplies([]); setFollowUps([]); setError(null);
    setFollowUpEntry(null); setFollowUpTitle(''); setGroupDialogVisible(false); setDraft(''); retrySend.current = null;
    setLoading(true); setRefreshing(false); setLoadingMore(false); setSending(false); setLoadedScope(null);
  }, [dataScope]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!hasMessageAccess) return undefined;
    const realtimeScope = dataScope;
    const realtimeOperation = scopeGeneration;
    let active = true;
    let subscribed = false;
    const isCurrentRealtimeScope = () => active && currentScopeRef.current === realtimeScope && !!scopeGenerationRef.current && isMessagingOperationCurrent(realtimeOperation, scopeGenerationRef.current);
    const onUpdate = (payload: any) => {
      if (isCurrentRealtimeScope() && String(payload?.conversationId ?? payload?.ConversationId) === String(conversationId)) void load(true);
    };
    const onListUpdate = () => { if (isCurrentRealtimeScope()) void load(true); };
    (async () => {
      try {
        const connection = await signalRService.connect(organizationId);
        if (!isCurrentRealtimeScope()) return;
        connection.on('MessageReceived', onUpdate);
        connection.on('ConversationListUpdated', onListUpdate);
        const subscription = signalRService.subscribeToConversation(organizationId, Number(conversationId));
        subscribed = true;
        await subscription;
        if (!isCurrentRealtimeScope() && subscribed) {
          subscribed = false;
          void signalRService.unsubscribeFromConversation(organizationId, Number(conversationId)).catch(() => undefined);
        }
      } catch { /* The REST thread remains fully usable offline from SignalR. */ }
    })();
    return () => {
      active = false;
      const connection = signalRService.getConnection();
      connection?.off('MessageReceived', onUpdate); connection?.off('ConversationListUpdated', onListUpdate);
      if (subscribed) {
        subscribed = false;
        void signalRService.unsubscribeFromConversation(organizationId, Number(conversationId)).catch(() => undefined);
      }
    };
  }, [conversationId, dataScope, hasMessageAccess, load, organizationId, scopeGeneration]);

  useLayoutEffect(() => {
    const card = scopeIsCurrent && conversation ? getConversationPresentation(conversation) : null;
    navigation.setOptions({ title: card?.title ?? 'Conversation' });
  }, [conversation, navigation, scopeIsCurrent]);

  const loadMore = async () => {
    const actionScope = dataScope;
    const operation = scopeGeneration;
    const generation = requestSequence.current;
    if (!hasMessageAccess || !scopeIsCurrent || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current) || nextCursor === null || loadingMore || loading || refreshing || coreLoadInFlight.current > 0) return;
    setLoadingMore(true);
    try {
      const page = normalizeTimelinePage(await ConversationAPI.getTimeline(conversationId, nextCursor));
      if (generation !== requestSequence.current || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      if (!page) throw new Error('Unsupported timeline page.');
      const merged = mergeTimelinePages(entries, filterTimelineForAudience(page.items, audience));
      setEntries(merged); setNextCursor(page.nextCursor); setError(null); void markVisibleRead(merged, actionScope);
    } catch (loadError: any) {
      if (generation === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setError(loadError?.message || 'More activity could not be loaded.');
    } finally {
      if (generation === requestSequence.current && scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setLoadingMore(false);
    }
  };

  const send = async () => {
    const operation = scopeGeneration;
    if (!hasMessageAccess || !scopeIsCurrent || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
    const content = draft.trim();
    if (!content || sending || content.length > MAX_MESSAGE_LENGTH) return;
    const attempt = retrySend.current?.content === content
      ? retrySend.current
      : { content, clientRequestId: Crypto.randomUUID() };
    retrySend.current = attempt;
    setSending(true); setDraft(''); setError(null);
    try {
      await MessageAPI.addMessage({ conversationId, content, clientRequestId: attempt.clientRequestId });
      if (!scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      retrySend.current = null;
      await load(true);
    } catch (sendError: any) {
      if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) {
        setDraft(content); setError(sendError?.message || 'Message could not be sent. Please try again.');
      }
    } finally {
      if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setSending(false);
    }
  };

  const createContextualFollowUp = async () => {
    const operation = scopeGeneration;
    if (!capabilities.followUps || !scopeIsCurrent || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current) || !followUpEntry?.context || !followUpTitle.trim() || !organizationId || !currentUserId) return;
    try {
      const created = await ConversationAPI.createFollowUp({
        organizationId, conversationId: Number(conversationId), timelineEntryId: followUpEntry.id,
        contextKind: followUpEntry.context.kind, contextId: followUpEntry.context.id,
        assigneeUserId: currentUserId, title: followUpTitle.trim(),
        dueAtUtc: new Date(Date.now() + 86400000).toISOString(), idempotencyKey: Crypto.randomUUID(),
      });
      if (!scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
      setFollowUps((items) => [...items, created]); setFollowUpEntry(null); setFollowUpTitle('');
    } catch (actionError: any) {
      if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setError(actionError?.message || 'Follow-up could not be created.');
    }
  };

  const completeFollowUp = async (task: FollowUpTask) => {
    const operation = scopeGeneration;
    if (!capabilities.followUps || !scopeIsCurrent || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
    try {
      const completed = await ConversationAPI.completeFollowUp(task.id, task.rowVersion);
      if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setFollowUps((items) => items.map((item) => item.id === task.id ? completed : item));
    } catch (actionError: any) {
      if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setError(actionError?.message || 'Follow-up could not be completed.');
    }
  };

  const toggleArchive = () => {
    const operation = scopeGeneration;
    const archived = !!conversation?.isArchived;
    if (!capabilities.archive || !scopeIsCurrent || !scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
    Alert.alert(archived ? 'Restore conversation?' : 'Archive conversation?',
      archived ? 'It will return to your inbox.' : 'You can find it under Archived.', [
        { text: 'Cancel', style: 'cancel' },
        { text: archived ? 'Restore' : 'Archive', onPress: async () => {
          if (!scopeGenerationRef.current || !isMessagingOperationCurrent(operation, scopeGenerationRef.current)) return;
          try {
            await ConversationAPI.archiveConversation(conversationId, !archived);
            if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) navigation.goBack();
          } catch (actionError: any) {
            if (scopeGenerationRef.current && isMessagingOperationCurrent(operation, scopeGenerationRef.current)) setError(actionError?.message || 'Conversation could not be updated.');
          }
        } },
      ]);
  };

  const renderEntry = ({ item }: { item: TimelineEntry }) => {
    const entry = getTimelineEntryPresentation(item);
    const outgoing = entry.direction === 'outbound' || (entry.direction === null && String(item.actorUserId) === String(currentUser?.Id ?? currentUser?.id));
    const messageLike = ['message', 'inboundSms', 'outboundSms', 'inboundEmail', 'outboundEmail'].includes(entry.kind);
    if (!messageLike) return <View style={[styles.activity, entry.isStaffOnly && styles.staffActivity]}><Ionicons name="information-circle-outline" size={16} color="#64748b" /><View style={styles.activityCopy}><Text style={styles.activityKind}>{entry.kindLabel}{entry.isStaffOnly ? ' · STAFF ONLY' : ''}</Text><Text style={styles.activityText}>{entry.summary}</Text>{entry.context && <><Text style={styles.context}>{entry.context.label}</Text>{capabilities.followUps && <TouchableOpacity onPress={() => setFollowUpEntry(item)}><Text style={styles.followUpLink}>Create follow-up</Text></TouchableOpacity>}</>}</View></View>;
    return <View style={[styles.bubbleWrap, outgoing ? styles.outgoingWrap : styles.incomingWrap]}>
      <View style={[styles.bubble, outgoing ? styles.outgoing : styles.incoming]}>
        {!!entry.channelLabel && <Text style={[styles.channel, outgoing && styles.outgoingMuted]}>{entry.channelLabel}</Text>}
        <Text style={[styles.message, outgoing && styles.outgoingText]}>{entry.summary}</Text>
        <View style={styles.evidence}>{entry.deliveries.map((delivery, index) => <Text key={`${item.id}-${index}`} style={[styles.delivery, outgoing && styles.outgoingMuted, delivery.tone === 'error' && styles.failed]}>{delivery.label}{delivery.detail ? ` · ${delivery.detail}` : ''}</Text>)}</View>
        <Text style={[styles.messageTime, outgoing && styles.outgoingMuted]}>{new Date(entry.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
      </View>
    </View>;
  };

  if (!hasMessageAccess) return <View style={styles.center}><Ionicons name="lock-closed-outline" size={40} color="#64748b" /><Text style={styles.error}>Messages aren’t available for this role.</Text></View>;
  if (loadedScope !== dataScope) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.muted}>Loading conversation…</Text></View>;
  if (loading && entries.length === 0) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.muted}>Loading conversation…</Text></View>;
  if (error && entries.length === 0) return <View style={styles.center}><Ionicons name="alert-circle-outline" size={40} color="#b42318" /><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>;
  const card = conversation ? getConversationPresentation(conversation) : null;

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <View style={styles.personBar}><View style={styles.personCopy}><Text style={styles.personName}>{card?.title ?? 'Conversation'}</Text>{!!card?.subtitle && <Text style={styles.personSub} numberOfLines={1}>{card.subtitle}</Text>}</View>{capabilities.manageGroup && conversation?.isGroupChat && <TouchableOpacity testID="manage-group" accessibilityLabel="Manage group members" style={styles.manageButton} onPress={() => setGroupDialogVisible(true)}><Ionicons name="people-outline" size={18} color="#2563eb" /><Text style={styles.manageText}>Members</Text></TouchableOpacity>}{capabilities.archive && <TouchableOpacity accessibilityLabel={conversation?.isArchived ? 'Restore conversation' : 'Archive conversation'} style={styles.iconButton} onPress={toggleArchive}><Ionicons name={conversation?.isArchived ? 'arrow-undo-outline' : 'archive-outline'} size={20} color="#475569" /></TouchableOpacity>}</View>
    {!!error && <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text><TouchableOpacity onPress={() => setError(null)}><Ionicons name="close" size={18} color="#b42318" /></TouchableOpacity></View>}
    <View style={styles.filters}>
      <TextInput style={styles.searchInput} placeholder="Search timeline" value={timelineQuery} onChangeText={setTimelineQuery} />
      <View style={styles.channelFilters}>{['', 'inApp', 'sms', 'email'].map((value: string) => <TouchableOpacity key={value || 'all'} style={[styles.filterChip, timelineChannel === value && styles.filterChipActive]} onPress={() => setTimelineChannel(value)}><Text style={timelineChannel === value ? styles.filterTextActive : styles.filterText}>{value || 'All'}</Text></TouchableOpacity>)}</View>
    </View>
    {capabilities.followUps && followUpEntry?.context && <View style={styles.followUpComposer}><Text style={styles.followUpHeading}>Follow up on {followUpEntry.context.label}</Text><TextInput style={styles.searchInput} placeholder="What needs follow-up?" value={followUpTitle} onChangeText={setFollowUpTitle} /><View style={styles.followUpActions}><TouchableOpacity onPress={() => setFollowUpEntry(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={!followUpTitle.trim()} onPress={() => void createContextualFollowUp()}><Text style={styles.followUpLink}>Create · due tomorrow</Text></TouchableOpacity></View></View>}
    {capabilities.followUps && followUps.some((task) => task.status === 'open') && <View style={styles.followUpList}>{followUps.filter((task) => task.status === 'open').map((task) => <View key={task.id} style={styles.followUpRow}><Text style={styles.followUpTask}>{task.title}</Text><TouchableOpacity onPress={() => void completeFollowUp(task)}><Text style={styles.followUpLink}>Complete</Text></TouchableOpacity></View>)}</View>}
    <FlatList ref={listRef} data={entries} renderItem={renderEntry} keyExtractor={(item) => String(item.id)} contentContainerStyle={[styles.timeline, entries.length === 0 && styles.emptyTimeline]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#2563eb" />}
      ListHeaderComponent={nextCursor !== null ? <TouchableOpacity style={styles.more} disabled={loadingMore} onPress={() => void loadMore()}>{loadingMore ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.moreText}>Load more activity</Text>}</TouchableOpacity> : null}
      ListEmptyComponent={<View style={styles.center}><Ionicons name="chatbubble-outline" size={38} color="#94a3b8" /><Text style={styles.emptyTitle}>No activity yet</Text><Text style={styles.muted}>Send a message to start the conversation.</Text></View>}
      onContentSizeChange={() => !loadingMore && listRef.current?.scrollToEnd({ animated: false })} />
    {capabilities.quickReplies && quickReplies.length > 0 && <FlatList horizontal data={quickReplies} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplies} renderItem={({ item }) => <TouchableOpacity style={styles.quickReply} onPress={() => setDraft(item.body)}><Text style={styles.quickReplyText}>{item.title}</Text></TouchableOpacity>} />}
    <View style={styles.composer}>
      <TextInput testID="message-composer" style={styles.input} placeholder="Type a message…" placeholderTextColor="#94a3b8" value={draft} onChangeText={setDraft} multiline maxLength={MAX_MESSAGE_LENGTH} accessibilityLabel="Message" />
      <TouchableOpacity testID="send-message" accessibilityLabel="Send message" disabled={!draft.trim() || sending} style={[styles.send, (!draft.trim() || sending) && styles.disabled]} onPress={() => void send()}>{sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}</TouchableOpacity>
    </View>
    {draft.length > MAX_MESSAGE_LENGTH - 200 && <Text style={styles.counter}>{draft.length}/{MAX_MESSAGE_LENGTH}</Text>}
    {capabilities.manageGroup && conversation?.isGroupChat && <GroupConversationDialog visible={groupDialogVisible && scopeIsCurrent} organizationId={organizationId ?? conversation.organizationId} currentUserId={currentUserId} conversation={conversation} onClose={() => { if (scopeGenerationRef.current && isMessagingOperationCurrent(scopeGeneration, scopeGenerationRef.current)) setGroupDialogVisible(false); }} onChanged={() => { if (scopeGenerationRef.current && isMessagingOperationCurrent(scopeGeneration, scopeGenerationRef.current)) void load(true); }} onLeft={() => { if (scopeGenerationRef.current && isMessagingOperationCurrent(scopeGeneration, scopeGenerationRef.current)) { setGroupDialogVisible(false); navigation.goBack(); } }} />}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, center: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 28 }, muted: { color: '#64748b', marginTop: 9, textAlign: 'center' }, error: { color: '#b42318', marginTop: 10, textAlign: 'center', lineHeight: 21 }, retry: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 16 }, retryText: { color: '#fff', fontWeight: '800' },
  personBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, personCopy: { flex: 1, minWidth: 0 }, personName: { color: '#0f2f47', fontWeight: '900', fontSize: 16 }, personSub: { color: '#64748b', fontSize: 12, marginTop: 2 }, manageButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 40, borderRadius: 20, backgroundColor: '#eff6ff' }, manageText: { color: '#2563eb', fontWeight: '800', fontSize: 11 }, iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3f2', paddingHorizontal: 14, paddingVertical: 9 }, errorBannerText: { flex: 1, color: '#b42318', fontSize: 13 }, timeline: { padding: 14, paddingBottom: 18 }, emptyTimeline: { flexGrow: 1 }, more: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#e8eefb', marginBottom: 14 }, moreText: { color: '#2456a6', fontWeight: '800', fontSize: 13 },
  bubbleWrap: { marginVertical: 5, flexDirection: 'row' }, outgoingWrap: { justifyContent: 'flex-end' }, incomingWrap: { justifyContent: 'flex-start' }, bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 }, outgoing: { backgroundColor: '#2563eb', borderBottomRightRadius: 5 }, incoming: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 5 }, message: { color: '#1e293b', fontSize: 15, lineHeight: 21 }, outgoingText: { color: '#fff' }, channel: { color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 3 }, outgoingMuted: { color: '#dbeafe' }, messageTime: { color: '#64748b', fontSize: 10, textAlign: 'right', marginTop: 4 }, evidence: { marginTop: 3 }, delivery: { color: '#64748b', fontSize: 10 }, failed: { color: '#b42318' },
  activity: { flexDirection: 'row', alignSelf: 'center', maxWidth: '92%', padding: 10, marginVertical: 7, borderRadius: 12, backgroundColor: '#edf2f7', gap: 8 }, activityCopy: { flex: 1 }, activityKind: { color: '#475569', textTransform: 'uppercase', fontSize: 10, fontWeight: '900' }, activityText: { color: '#475569', fontSize: 13, marginTop: 2 }, context: { color: '#2563eb', fontSize: 11, marginTop: 3 },
  staffActivity: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' }, filters: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' }, searchInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, color: '#0f172a' }, channelFilters: { flexDirection: 'row', gap: 6, marginTop: 7 }, filterChip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f1f5f9' }, filterChipActive: { backgroundColor: '#2563eb' }, filterText: { color: '#475569', fontSize: 12 }, filterTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' },
  followUpComposer: { padding: 10, backgroundColor: '#fff7ed', borderTopWidth: 1, borderColor: '#fed7aa' }, followUpHeading: { color: '#9a3412', fontWeight: '800', marginBottom: 6 }, followUpActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 7 }, followUpLink: { color: '#2563eb', fontWeight: '800', fontSize: 12, marginTop: 4 }, cancelText: { color: '#64748b', fontWeight: '700', fontSize: 12, marginTop: 4 }, followUpList: { backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 6 }, followUpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }, followUpTask: { flex: 1, color: '#78350f', fontSize: 12 },
  quickReplies: { paddingHorizontal: 12, paddingVertical: 7, gap: 7 }, quickReply: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }, quickReplyText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' }, input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 20, backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: 15, paddingHorizontal: 15, paddingVertical: 11 }, send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.45 }, counter: { color: '#64748b', backgroundColor: '#fff', textAlign: 'right', paddingRight: 66, paddingBottom: 5, fontSize: 10 }, emptyTitle: { color: '#334155', fontSize: 17, fontWeight: '800', marginTop: 10 },
});
