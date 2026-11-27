import AppIcon from 'components/AppIcon';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme
} from '@mui/material';


import MainCard from 'components/MainCard';
import ChatRowActions from 'components/conversation/ChatRowActions';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatMessageTime } from 'utils/formatters';
import { addMessage, getMessages, markConversationAsRead } from 'store/message/message.action';
import { selectCurrentConversationId, selectMessageError, selectMessageLoading, selectMessages } from 'store/message/message.selector';
import ConversationQuickReplies from 'components/conversation/ConversationQuickReplies';
import { useOrganization } from 'contexts/OrganizationContext';
import { getSendAttempt } from 'utils/clientRequestId';
import { getConversationBubbleSx, parseMessageDate, sortConversationMessages } from 'utils/conversationPresentation';
import { latestConfirmedSentMessageId } from 'utils/latestSentMessage.mjs';
import { chatConversationRowButtonSx, chatMessageStatusSx, chatSendButtonSx, getChatStyles } from 'themes/chatStyles';
import { filterControlSx } from 'themes/filterControlStyles';
import TenantNewChat from './TenantNewChat';

const FALLBACK_SMS_NUMBER = import.meta.env.VITE_TWILIO_SMS_NUMBER || '+198****0067';
const MAX_MESSAGE_LENGTH = 2000;

const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#795548', '#607d8b'];

function formatPhone(raw = '') {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function getDateLabel(date) {
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function getAvatarColor(name = '') {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = name.charCodeAt(index) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getLandlordName(conversation) {
  return conversation?.landlordName || conversation?.LandlordName || 'Landlord';
}

function getConversationPropertyLine(conversation) {
  if (!conversation) return '';
  const propertyName = conversation.propertyName || conversation.PropertyName || '';
  const unitName = conversation.unitName || conversation.UnitName || '';
  const normalizedUnit = String(unitName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const showUnit = unitName && normalizedUnit !== 'unit1' && normalizedUnit !== '1';
  return [propertyName, showUnit ? (/^unit\b/i.test(unitName) ? unitName : `Unit ${unitName}`) : null].filter(Boolean).join(' · ');
}

export default function TenantChat() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [searchParams, setSearchParams] = useSearchParams();
  const isDarkMode = theme.palette.mode === 'dark';

  const messages = useSelector(selectMessages);
  const loadedConversationId = useSelector(selectCurrentConversationId);
  const loadingMessages = useSelector(selectMessageLoading);
  const messageError = useSelector(selectMessageError);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [rowActionError, setRowActionError] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [sendError, setSendError] = useState('');

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [availableLandlords, setAvailableLandlords] = useState([]);
  const [loadingLandlords, setLoadingLandlords] = useState(false);
  const [landlordLoadError, setLandlordLoadError] = useState('');
  const [draftLandlord, setDraftLandlord] = useState(null);
  const [newMessageDraft, setNewMessageDraft] = useState('');
  const [startingConversation, setStartingConversation] = useState(false);
  const [newConversationSentMessageId, setNewConversationSentMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const messageSearchRef = useRef(null);
  const messageSearchButtonRef = useRef(null);
  const sendAttemptRef = useRef(null);

  const selectedConversationId = selectedConversation?.id;
  const messageInput = selectedConversationId ? messageDrafts[String(selectedConversationId)] || '' : '';
  const userId = user?.Id || user?.id;
  const quickReplyOrganizationId =
    selectedConversation?.organizationId ??
    selectedConversation?.OrganizationId ??
    currentOrganization?.id ??
    currentOrganization?.Id ??
    null;
  const { messagesDivider, messagesSoftDivider, messagesCardBorder, messagesDashedBorder, messagesPanelShadow, messagesCardShadow, messageFilterSx } = getChatStyles(theme);

  const setConversationDraft = useCallback((conversationId, value) => {
    if (!conversationId) return;
    const key = String(conversationId);
    setMessageDrafts((previous) => {
      const nextValue = typeof value === 'function' ? value(previous[key] || '') : value;
      if (!nextValue) {
        const next = { ...previous };
        delete next[key];
        return next;
      }
      return { ...previous, [key]: nextValue };
    });
  }, []);

  const refreshConversations = useCallback(async () => {
    const response = await axiosServices.get('/api/Conversation/tenant/my-conversations');
    const nextConversations = response.data?.success ? response.data.data || [] : [];
    setConversations(nextConversations);
    setSelectedConversation((current) => {
      if (!current) return current;
      return nextConversations.find((conversation) => String(conversation.id) === String(current.id)) || current;
    });
    return nextConversations;
  }, []);

  const selectConversation = useCallback(
    async (conversation) => {
      setNewMessageOpen(false);
      setSelectedConversation(conversation);
      setSendError('');
      dispatch(getMessages(conversation.id));
      try {
        const result = await dispatch(markConversationAsRead(conversation.id));
        if (result?.success) {
          setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unreadCount: 0 } : item));
        }
      } catch (_) {
        // Reading the thread should still work if marking it read fails.
      }
    },
    [dispatch]
  );

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      setConversationError(null);
      await refreshConversations();
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 400) setConversations([]);
      else setConversationError(error?.response?.data?.message || 'We could not load your conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [refreshConversations]);

  useEffect(() => {
    if (userId) loadConversations();
  }, [loadConversations, userId]);

  useEffect(() => {
    const conversationId = searchParams.get('conversationId');
    if (!conversationId || startingConversation) return;
    const conversation = conversations.find((item) => String(item.id) === conversationId);
    if (!conversation) return;
    selectConversation(conversation);
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete('conversationId');
      return next;
    }, { replace: true });
  }, [conversations, searchParams, selectConversation, setSearchParams, startingConversation]);

  useEffect(() => {
    if (!loadingMessages) messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [loadingMessages, messages.length, optimisticMessages.length, reduceMotion, selectedConversationId]);

  const sendMessage = async (attempt) => {
    sendAttemptRef.current = attempt;
    const result = await dispatch(addMessage({
      conversationId: attempt.conversationId,
      content: attempt.content,
      clientRequestId: attempt.clientRequestId
    }));
    if (!result?.success) throw new Error(result?.message || 'Message could not be sent.');
    sendAttemptRef.current = null;
    return result;
  };

  const handleSendMessage = async () => {
    const conversationId = selectedConversation?.id;
    const messageContent = messageInput.trim();
    if (!messageContent || !conversationId || sendingMessage) return;
    const attempt = getSendAttempt(sendAttemptRef.current, conversationId, messageContent);

    const tempId = `temp-${attempt.clientRequestId}`;
    const optimisticMessage = {
      id: tempId,
      conversationId,
      senderId: userId,
      senderName: user?.firstName || user?.FirstName || user?.email || 'You',
      content: messageContent,
      createdAt: new Date().toISOString(),
      _optimistic: true
    };

    setSendError('');
    setOptimisticMessages((current) => [...current, optimisticMessage]);
    setConversationDraft(conversationId, '');

    try {
      setSendingMessage(true);
      await sendMessage(attempt);
      void refreshConversations().catch(() => {});
    } catch (_) {
      setConversationDraft(conversationId, (current) => current || messageContent);
      setSendError('Your message was not sent. Your draft has been restored so you can try again.');
    } finally {
      setOptimisticMessages((current) => current.filter((message) => message.id !== tempId));
      setSendingMessage(false);
    }
  };

  const handleOpenNewMessage = async () => {
    if (newMessageOpen || sendingMessage) return;
    setNewMessageOpen(true);
    setSelectedConversation(null);
    setDraftLandlord(null);
    setNewMessageDraft('');
    setSendError('');
    setLandlordLoadError('');
    setLoadingLandlords(true);
    try {
      const response = await axiosServices.get('/api/Conversation/tenant/available-landlords');
      if (!response.data?.success) throw new Error('Unable to load landlords');
      setAvailableLandlords(response.data.data || []);
    } catch (_) {
      setAvailableLandlords([]);
      setLandlordLoadError('We could not load your landlord contacts.');
    } finally {
      setLoadingLandlords(false);
    }
  };

  const handleSelectLandlord = (landlord) => {
    const existing = conversations.find((conversation) =>
      !conversation.isArchived && !conversation.isGroupChat && String(conversation.landlordId) === String(landlord.landlordUserId)
    );
    if (existing) {
      if (newMessageDraft.trim()) setConversationDraft(existing.id, newMessageDraft);
      selectConversation(existing);
    } else {
      setDraftLandlord(landlord);
      setSendError('');
    }
  };

  const handleSendNewMessage = async () => {
    const content = newMessageDraft.trim();
    if (!draftLandlord || !content || startingConversation) return;
    setStartingConversation(true);
    setSendError('');
    try {
      const response = await axiosServices.post('/api/Conversation/tenant/start', { landlordUserId: draftLandlord.landlordUserId });
      const conversation = response.data?.data;
      if (!response.data?.success || !conversation?.id) throw new Error('Unable to start conversation.');
      const sent = await sendMessage(getSendAttempt(sendAttemptRef.current, conversation.id, content));
      if (!reduceMotion) setNewConversationSentMessageId(sent.data.id);
      setNewMessageDraft('');
      selectConversation(conversation);
      void refreshConversations().catch(() => {});
    } catch (_) {
      setSendError('We could not send your message. Your draft is still here.');
    } finally {
      setStartingConversation(false);
    }
  };

  const handleMarkUnread = async (conversationId) => {
    if (!conversationId) return;
    setRowActionError('');
    try {
      await axiosServices.post(`/api/Message/conversation/${conversationId}/unread`);
      setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: Math.max(item.unreadCount || 0, 1) } : item));
    } catch (error) {
      setRowActionError(error?.message || 'We could not mark the conversation as unread.');
    }
  };

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (unreadOnly && !conversation.unreadCount) return false;
      if (!query) return true;
      return [getLandlordName(conversation), getConversationPropertyLine(conversation), conversation.lastMessagePreview].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      );
    });
  }, [conversations, searchQuery, unreadOnly]);

  const visibleMessages = useMemo(() => {
    const persisted = messages.filter(
      (message) => String(message.conversationId ?? loadedConversationId) === String(selectedConversationId)
    );
    const pending = optimisticMessages.filter((message) => String(message.conversationId) === String(selectedConversationId));
    return sortConversationMessages([...persisted, ...pending]);
  }, [loadedConversationId, messages, optimisticMessages, selectedConversationId]);
  const latestSentMessageId = latestConfirmedSentMessageId(visibleMessages, userId);

  const unreadCount = conversations.filter((conversation) => conversation.unreadCount > 0).length;
  const activeLandlordName = getLandlordName(selectedConversation);
  const activePropertyLine = getConversationPropertyLine(selectedConversation);
  const activeSmsNumber = selectedConversation?.landlordSmsNumber || selectedConversation?.LandlordSmsNumber || FALLBACK_SMS_NUMBER;
  const closeMessageSearch = () => {
    setSearchQuery('');
    setShowMessageSearch(false);
    messageSearchButtonRef.current?.focus();
  };

  const snapshotCardSx = {
    p: 1.5,
    borderRadius: 1,
    bgcolor: 'background.paper',
    border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`,
    boxShadow: isDarkMode
      ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}`
      : messagesCardShadow
  };

  const renderLandlordSnapshot = () => (
    <Stack spacing={1.5}>
      <Box sx={snapshotCardSx}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar sx={{ width: 38, height: 38, bgcolor: getAvatarColor(activeLandlordName), color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
            {activeLandlordName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {activeLandlordName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your landlord contact
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={snapshotCardSx}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
          <AppIcon name="house" size={14} style={{ color: theme.palette.text.secondary }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Home
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600}>
          {activePropertyLine || 'Property details unavailable'}
        </Typography>
      </Box>

      <Box sx={snapshotCardSx}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
          <AppIcon name="phone" size={14} style={{ color: theme.palette.text.secondary }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Text message access
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600}>
          {formatPhone(activeSmsNumber)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
          You can reply from the tenant portal or by SMS. Both stay in this conversation.
        </Typography>
      </Box>
    </Stack>
  );

  if (loadingConversations) {
    return (
      <MainCard content={false}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 520 }}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/tenant/dashboard' }, { label: 'Chat' }]} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h3" component="h1" fontWeight={750}>
            Chat
          </Typography>
          {unreadCount > 0 && (
            <Chip size="small" color="primary" label={`${unreadCount} unread`} sx={{ height: 24, fontWeight: 700 }} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
          Keep conversations with your landlord organized in one place
        </Typography>
      </Box>

      <MainCard
        content={false}
        sx={{
          p: 0,
          overflow: 'hidden',
          borderRadius: 1.25,
          border: `1px solid ${messagesCardBorder}`,
          boxShadow: messagesPanelShadow,
          bgcolor: 'background.paper',
          ':hover': { boxShadow: messagesPanelShadow }
        }}
      >
        <Grid
          container
          sx={{
            height: { xs: 'calc(100dvh - 188px)', sm: 'calc(100dvh - 220px)', md: 'calc(100vh - 300px)' },
            minHeight: { xs: 520, md: 600 },
            maxHeight: { md: 920 },
            overflow: 'hidden'
          }}
        >
          <Grid
            size={{ xs: 12, md: 4, lg: 3 }}
            sx={{
              minWidth: 0,
              borderRight: `1px solid ${messagesDivider}`,
              display: isMobile && (selectedConversation || newMessageOpen) ? 'none' : 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper'
            }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${messagesDivider}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
                <Button variant="outlined" size="small" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)} sx={messageFilterSx}>
                  Unread{unreadCount > 0 ? ` ${unreadCount}` : ''}
                </Button>
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
                  <Tooltip title="Search messages">
                    <IconButton
                      ref={messageSearchButtonRef}
                      aria-label="Search messages"
                      aria-expanded={showMessageSearch}
                      aria-controls={showMessageSearch ? 'tenant-message-search' : undefined}
                      size="small"
                      onClick={() => showMessageSearch ? messageSearchRef.current?.focus() : setShowMessageSearch(true)}
                      sx={{ color: 'text.secondary', width: 36, height: 36 }}
                    >
                      <AppIcon name="magnifier" size={18} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="New message">
                    <span>
                      <IconButton
                        aria-label="New message"
                        size="small"
                        disabled={newMessageOpen || sendingMessage}
                        onClick={handleOpenNewMessage}
                        sx={{ color: 'text.secondary', width: 36, height: 36 }}
                      >
                        <AppIcon name="edit" size={19} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>

            {showMessageSearch && <Box id="tenant-message-search" sx={{ p: 1.25, borderBottom: `1px solid ${messagesDivider}` }}>
              <TextField
                fullWidth
                size="small"
                autoFocus
                inputRef={messageSearchRef}
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') closeMessageSearch(); }}
                slotProps={{
                  htmlInput: { 'aria-label': 'Search messages' },
                  input: {
                    sx: { ...filterControlSx, height: 34, fontSize: '0.8rem', borderRadius: 1 },
                    startAdornment: <InputAdornment position="start"><AppIcon name="magnifier" size={14} style={{ opacity: 0.55 }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label="Close message search" onClick={closeMessageSearch}>
                          <AppIcon name="close" size={14} />
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
            </Box>}

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {conversationError && (
                <Alert severity="error" sx={{ m: 1.5 }}>
                  {conversationError}
                </Alert>
              )}
              {rowActionError && <Alert severity="error" sx={{ m: 1.5 }} onClose={() => setRowActionError('')}>{rowActionError}</Alert>}
              {newMessageOpen && (
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.5, py: 1, bgcolor: 'action.selected', borderLeft: 3, borderColor: 'primary.main' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: 38, height: 38 }}><AppIcon name="add" /></Avatar>
                  <Typography variant="subtitle2" fontWeight={600}>New message</Typography>
                </Stack>
              )}
              {filteredConversations.length === 0 ? (
                <Stack spacing={1.25} alignItems="center" sx={{ p: 3, textAlign: 'center' }}>
                  {searchQuery ? (
                    <AppIcon name="magnifier" size={36} style={{ color: theme.palette.text.disabled }} />
                  ) : unreadOnly ? (
                    <AppIcon name="checkCircle" size={40} style={{ color: theme.palette.success.main }} />
                  ) : (
                    <AppIcon name="document" size={40} style={{ color: theme.palette.text.disabled }} />
                  )}
                  <Typography variant="subtitle2" fontWeight={700}>
                    {searchQuery ? 'No matching conversations' : unreadOnly ? 'You’re all caught up' : 'Your inbox is empty'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? `No results for “${searchQuery}”.` : unreadOnly ? 'There are no unread conversations.' : 'Start a secure conversation with your landlord.'}
                  </Typography>
                  {(searchQuery || (!unreadOnly && !newMessageOpen)) && <Button
                    size="small"
                    variant={searchQuery ? 'text' : 'contained'}
                    startIcon={searchQuery ? undefined : <AppIcon name="add" />}
                    onClick={searchQuery ? () => setSearchQuery('') : handleOpenNewMessage}
                    disabled={!searchQuery && sendingMessage}
                    sx={{ textTransform: 'none' }}
                  >
                    {searchQuery ? 'Clear search' : 'Start a message'}
                  </Button>}
                </Stack>
              ) : (
                <List disablePadding>
                  {filteredConversations.map((conversation) => {
                    const landlordName = getLandlordName(conversation);
                    const propertyLine = getConversationPropertyLine(conversation);
                    const isSelected = String(selectedConversation?.id) === String(conversation.id);
                    const hasUnread = conversation.unreadCount > 0;
                    return (
                      <ListItem
                        key={conversation.id}
                        disablePadding
                        sx={{
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : hasUnread ? alpha(theme.palette.primary.main, 0.025) : 'transparent',
                          borderBottom: `1px solid ${messagesSoftDivider}`,
                          borderLeft: '3px solid',
                          borderLeftColor: hasUnread || isSelected ? 'primary.main' : 'transparent',
                          transition: 'background-color 0.15s ease',
                          '& .MuiListItemButton-root:hover': { bgcolor: 'transparent' },
                          '& .chat-row-actions': { opacity: 0, pointerEvents: 'none' },
                          '&:hover .chat-row-actions, &:focus-within .chat-row-actions': { opacity: 1, pointerEvents: 'auto' },
                          '@media (hover: none)': { '& .chat-row-actions': { opacity: 1, pointerEvents: 'auto' } },
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, isSelected ? 0.07 : 0.035) },
                          '&:last-of-type': { borderBottom: 0 }
                        }}
                      >
                        <ListItemButton
                          aria-current={isSelected ? 'true' : undefined}
                          aria-label={[landlordName, propertyLine, hasUnread ? `${conversation.unreadCount} unread` : ''].filter(Boolean).join(', ')}
                          title={propertyLine || undefined}
                          disabled={startingConversation}
                          onClick={() => selectConversation(conversation)}
                          sx={chatConversationRowButtonSx}
                        >
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Badge badgeContent={hasUnread ? conversation.unreadCount : 0} color="error" max={99} showZero={false}>
                              <Avatar sx={{ width: 30, height: 30, bgcolor: getAvatarColor(landlordName), color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>
                                {landlordName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Badge>
                          </ListItemAvatar>
                          <Typography variant="subtitle2" noWrap fontWeight={hasUnread ? 700 : 500} sx={{ flex: 1, minWidth: 0 }}>
                            {landlordName}
                          </Typography>
                        </ListItemButton>
                        <ChatRowActions
                          id={`tenant-chat-row-actions-${conversation.id}`}
                          name={landlordName}
                          onMarkUnread={() => handleMarkUnread(conversation.id)}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          </Grid>

          <Grid
            component={motion.div}
            key={newMessageOpen ? 'new' : (selectedConversationId ?? 'empty')}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
            size={{ xs: 12, md: 8, lg: 6 }}
            sx={{
              display: isMobile && !selectedConversation && !newMessageOpen ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {newMessageOpen ? (
              <TenantNewChat
                landlords={availableLandlords}
                loading={loadingLandlords}
                loadError={landlordLoadError}
                landlord={draftLandlord}
                onSelect={handleSelectLandlord}
                onClearLandlord={() => setDraftLandlord(null)}
                draft={newMessageDraft}
                onDraftChange={setNewMessageDraft}
                isSending={startingConversation}
                sendError={sendError}
                maxLength={MAX_MESSAGE_LENGTH}
                onSend={handleSendNewMessage}
                onClose={() => setNewMessageOpen(false)}
              />
            ) : selectedConversation ? (
              <>
                <Box
                  sx={{
                    px: { xs: 1.25, sm: 2 },
                    py: { xs: 1.25, sm: 2 },
                    borderBottom: `1px solid ${messagesDivider}`,
                    bgcolor: 'background.paper',
                    flexShrink: 0
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25 }} sx={{ minWidth: 0 }}>
                      {isMobile && (
                        <Tooltip title="Back to inbox">
                          <IconButton
                            aria-label="Back to inbox"
                            onClick={() => setSelectedConversation(null)}
                            sx={{ ml: -0.5, flexShrink: 0 }}
                          >
                            <AppIcon name="arrowRight" style={{ transform: 'rotate(180deg)' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Avatar
                        sx={{
                          width: 42,
                          height: 42,
                          bgcolor: getAvatarColor(activeLandlordName),
                          color: '#fff',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      >
                        {activeLandlordName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} noWrap>
                          {activeLandlordName}
                        </Typography>
                        {activePropertyLine && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {activePropertyLine}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pl: { xs: 1, sm: 2.5 },
                    pr: 2.5,
                    py: { xs: 1.5, sm: 2.5 },
                    bgcolor: isDarkMode ? theme.palette.background.default : theme.palette.brand.ivory,
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.24) : 'grey.300',
                      borderRadius: 4
                    }
                  }}
                >
                  {loadingMessages && visibleMessages.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : messageError && !sendError && visibleMessages.length === 0 ? (
                    <Alert severity="error">{messageError}</Alert>
                  ) : visibleMessages.length === 0 ? (
                    <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ textAlign: 'center', p: 3, minHeight: 220 }}>
                      <AppIcon name="messages" size={38} style={{ color: theme.palette.text.disabled }} />
                      <Typography variant="subtitle2" fontWeight={700}>
                        Start the conversation
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Send a message below to begin this landlord thread.
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={0}>
                      {visibleMessages.map((message, index) => {
                        const isOwn = String(message.senderId) === String(userId);
                        const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
                        const messageDate = parseMessageDate(message.createdAt);
                        const sameDay = previousMessage && messageDate.toDateString() === parseMessageDate(previousMessage.createdAt).toDateString();
                        const isConsecutive = sameDay && String(previousMessage.senderId) === String(message.senderId);
                        return (
                          <Fragment key={message.id}>
                            {!sameDay && (
                              <Box sx={{ display: 'flex', alignItems: 'center', my: 2, px: 1 }}>
                                <Box sx={{ flex: 1, height: 1, bgcolor: messagesSoftDivider }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mx: 2, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                  {getDateLabel(messageDate)}
                                </Typography>
                                <Box sx={{ flex: 1, height: 1, bgcolor: messagesSoftDivider }} />
                              </Box>
                            )}
                            <Box
                              onAnimationEnd={() => {
                                if (message.id === newConversationSentMessageId) setNewConversationSentMessageId(null);
                              }}
                              sx={{
                                display: 'flex',
                                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-start',
                                mt: isConsecutive ? 0.25 : 1.5,
                                px: 1,
                                opacity: message._optimistic ? 0.6 : 1,
                                '--outgoing-opacity': message._optimistic ? 0.6 : 1,
                                transition: 'opacity 0.2s ease',
                                animation: message._optimistic || message.id === newConversationSentMessageId
                                  ? 'outgoingMessageRise 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both'
                                  : 'none',
                                '@keyframes outgoingMessageRise': {
                                  from: { transform: 'translateY(28px)', opacity: 0 },
                                  to: { transform: 'translateY(0)', opacity: 'var(--outgoing-opacity)' }
                                },
                                '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
                              }}
                            >
                              {!isOwn && (
                                <Box sx={{ width: 40, flexShrink: 0, mr: 1 }}>
                                  {!isConsecutive && (
                                    <Avatar
                                      sx={{
                                        width: 40,
                                        height: 40,
                                        bgcolor: getAvatarColor(activeLandlordName),
                                        color: '#fff',
                                        fontWeight: 700
                                      }}
                                    >
                                      {activeLandlordName.charAt(0).toUpperCase()}
                                    </Avatar>
                                  )}
                                </Box>
                              )}
                              <Box
                                sx={{
                                  width: 'fit-content',
                                  maxWidth: { xs: isOwn ? '86%' : 'calc(88% - 42px)', sm: isOwn ? '74%' : 'calc(76% - 50px)' },
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isOwn ? 'flex-end' : 'flex-start'
                                }}
                              >
                                {!isConsecutive && (
                                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                                    {!isOwn && (
                                      <Typography variant="caption" fontWeight={500}>
                                        {message.senderName || activeLandlordName}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7, fontSize: '0.7rem' }}>
                                      {formatMessageTime(messageDate)}
                                    </Typography>
                                  </Stack>
                                )}
                                <Stack direction="row" alignItems="flex-end" sx={{ position: 'relative', maxWidth: '100%' }}>
                                  <Paper
                                    elevation={0}
                                    sx={{
                                      p: 1.25,
                                      px: 1.5,
                                      width: 'fit-content',
                                      minWidth: 0,
                                      maxWidth: '100%',
                                      ...getConversationBubbleSx({ isOwn, isConsecutive, brandedChat: true })
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: 'text.primary' }}
                                    >
                                      {message.content}
                                    </Typography>
                                  </Paper>
                                  {message._optimistic && isOwn && <CircularProgress size={12} sx={{ ...chatMessageStatusSx, color: 'primary.main' }} />}
                                  {isOwn && !message._optimistic && latestSentMessageId != null && String(message.id) === String(latestSentMessageId) && (
                                    <Box component="span" role="img" aria-label="Message sent" sx={{ ...chatMessageStatusSx, display: 'inline-flex', color: 'success.main' }}><AppIcon name="checkCircle" size={15} /></Box>
                                  )}
                                </Stack>
                              </Box>
                            </Box>
                          </Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </Stack>
                  )}
                </Box>

                <Box
                  sx={{
                    px: { xs: 1.25, sm: 2 },
                    pt: 1,
                    pb: { xs: 'max(10px, env(safe-area-inset-bottom))', sm: 1 },
                    borderTop: `1px solid ${messagesDivider}`,
                    bgcolor: 'background.paper',
                    flexShrink: 0
                  }}
                >
                  {sendError && (
                    <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSendError('')}>
                      {sendError}
                    </Alert>
                  )}
                  <ConversationQuickReplies
                    conversation={selectedConversation}
                    organizationId={quickReplyOrganizationId}
                    userId={userId}
                    hidden={Boolean(messageInput)}
                    onSelect={(reply) => setConversationDraft(selectedConversationId, reply)}
                  />
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2.5,
                      border: `1px solid ${messagesCardBorder}`,
                      bgcolor: 'background.paper',
                      boxShadow: messagesCardShadow,
                      pl: 1.5,
                      pr: 0.75,
                      py: 0.25,
                      transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      '&:focus-within': { borderColor: 'primary.main', boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}` }
                    }}
                  >
                    <TextField
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={5}
                      placeholder="Write a message…"
                      value={messageInput}
                      onChange={(event) => {
                        setSendError('');
                        setConversationDraft(selectedConversationId, event.target.value.slice(0, MAX_MESSAGE_LENGTH));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !isMobile && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendingMessage}
                      variant="standard"
                      inputProps={{ maxLength: MAX_MESSAGE_LENGTH, 'aria-label': 'Message' }}
                      InputProps={{
                        disableUnderline: true,
                        sx: { fontSize: '0.9375rem', py: 0.3, '& .MuiInputBase-input': { py: 0.2, lineHeight: 1.5 } }
                      }}
                      sx={{ flex: 1, '& .MuiInputBase-root': { border: 'none' } }}
                    />
                    <Tooltip title="Send message">
                      <span style={{ alignSelf: 'flex-end' }}>
                        <IconButton
                          onClick={handleSendMessage}
                          disableRipple
                          disabled={!messageInput.trim() || sendingMessage}
                          aria-label="Send message"
                          sx={{ ...chatSendButtonSx, ml: 0.75, width: 40, height: 40 }}
                        >
                          {sendingMessage ? <CircularProgress size={19} color="inherit" /> : <AppIcon name="send" size={20} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Paper>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.65, px: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                      Enter to send · Shift + Enter for a new line
                    </Typography>
                    <Typography
                      variant="caption"
                      color={messageInput.length > MAX_MESSAGE_LENGTH * 0.9 ? 'warning.main' : 'text.secondary'}
                      sx={{ ml: 'auto' }}
                    >
                      {messageInput.length}/{MAX_MESSAGE_LENGTH}
                    </Typography>
                  </Stack>
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 3,
                  bgcolor: isDarkMode ? 'background.paper' : '#f7f9fc'
                }}
              >
                <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', maxWidth: 360 }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                    <AppIcon name="messages" size={28} />
                  </Avatar>
                  <Typography variant="h5" fontWeight={700}>
                    Your inbox
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Review your message history or start a new conversation.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<AppIcon name="add" />}
                    onClick={handleOpenNewMessage}
                    sx={{ mt: 0.5, textTransform: 'none', minHeight: 34, px: 1.5, fontSize: '0.8rem' }}
                  >
                    New message
                  </Button>
                </Stack>
              </Box>
            )}
          </Grid>

          <Grid
            size={{ xs: 12, lg: 3 }}
            sx={{
              display: { xs: 'none', lg: 'flex' },
              flexDirection: 'column',
              borderLeft: `1px solid ${messagesDivider}`,
              bgcolor: alpha(theme.palette.background.default, 0.28)
            }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Landlord snapshot
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Landlord and property context
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selectedConversation ? (
                renderLandlordSnapshot()
              ) : (
                <Box
                  sx={{
                    p: 2,
                    border: `1px dashed ${messagesDashedBorder}`,
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    No conversation selected
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Choose a thread to see your landlord and property details.
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </MainCard>

      {selectedConversation && (
        <MainCard
          content={false}
          sx={{ mt: 2, display: { xs: 'block', lg: 'none' }, border: `1px solid ${messagesCardBorder}`, boxShadow: 'none' }}
        >
          <Box sx={{ p: 2, borderBottom: `1px solid ${messagesDivider}` }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Landlord snapshot
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Landlord and property context
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>{renderLandlordSnapshot()}</Box>
        </MainCard>
      )}

    </Box>
  );
}
