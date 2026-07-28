import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme
} from '@mui/material';

import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import MobileOutlined from '@ant-design/icons/MobileOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';

import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatMessageTime } from 'utils/formatters';
import { addMessage, getMessages, markConversationAsRead } from 'store/message/message.action';
import { selectMessageError, selectMessageLoading, selectMessages } from 'store/message/message.selector';

const FALLBACK_SMS_NUMBER = import.meta.env.VITE_TWILIO_SMS_NUMBER || '+198****0067';
const MAX_MESSAGE_LENGTH = 2000;
const QUICK_REPLIES = ['Thanks for the update.', 'I’ll take a look and get back to you.', 'Could you share a little more detail?'];
const AVATAR_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#c2410c', '#0369a1', '#4f46e5'];

function formatPhone(raw = '') {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function getDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function formatConversationTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now - date) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
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
  const normalizedUnit = String(unitName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const showUnit = unitName && normalizedUnit !== 'unit1' && normalizedUnit !== '1';
  return [propertyName, showUnit ? (/^unit\b/i.test(unitName) ? unitName : `Unit ${unitName}`) : null].filter(Boolean).join(' · ');
}

export default function TenantMessages() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDarkMode = theme.palette.mode === 'dark';

  const messages = useSelector(selectMessages);
  const loadingMessages = useSelector(selectMessageLoading);
  const messageError = useSelector(selectMessageError);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [sendError, setSendError] = useState('');

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [availableLandlords, setAvailableLandlords] = useState([]);
  const [loadingLandlords, setLoadingLandlords] = useState(false);
  const [startingLandlordId, setStartingLandlordId] = useState(null);
  const [landlordSearchQuery, setLandlordSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const selectedConversationId = selectedConversation?.id;
  const messageInput = selectedConversationId ? messageDrafts[String(selectedConversationId)] || '' : '';
  const userId = user?.Id || user?.id;
  const messagesDivider = isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.divider, 0.9);
  const messagesCardBorder = isDarkMode ? alpha(theme.palette.primary.main, 0.26) : alpha(theme.palette.divider, 0.92);
  const panelShadow = isDarkMode ? `0 16px 40px ${alpha('#020617', 0.3)}` : '0 18px 46px rgba(15, 23, 42, 0.07)';

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

  const selectConversation = useCallback(async (conversation) => {
    setSelectedConversation(conversation);
    setSendError('');
    dispatch(getMessages(conversation.id));
    try {
      await dispatch(markConversationAsRead(conversation.id));
      setConversations((current) => current.map((item) => (
        String(item.id) === String(conversation.id) ? { ...item, unreadCount: 0 } : item
      )));
    } catch (_) {
      // Reading the thread should still work if marking it read fails.
    }
  }, [dispatch]);

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
    if (user?.Id || user?.id) loadConversations();
  }, [loadConversations, user]);

  useEffect(() => {
    if (!loadingMessages) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [loadingMessages, messages.length, optimisticMessages.length, selectedConversationId]);

  useEffect(() => {
    if (!messages.length || !optimisticMessages.length) return;
    setOptimisticMessages((current) => current.filter((pending) => !messages.some((message) => (
      String(message.conversationId) === String(pending.conversationId)
      && String(message.senderId) === String(pending.senderId)
      && message.content === pending.content
      && Math.abs(new Date(message.createdAt).getTime() - new Date(pending.createdAt).getTime()) < 15000
    ))));
  }, [messages, optimisticMessages.length]);

  const handleSendMessage = async () => {
    const conversationId = selectedConversation?.id;
    const messageContent = messageInput.trim();
    if (!messageContent || !conversationId || sendingMessage) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
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
      const result = await dispatch(addMessage({ conversationId, content: messageContent }));
      if (!result?.success) throw new Error(result?.error || 'Message could not be sent');
      await dispatch(getMessages(conversationId));
      await refreshConversations();
    } catch (_) {
      setOptimisticMessages((current) => current.filter((message) => message.id !== tempId));
      setConversationDraft(conversationId, (current) => current || messageContent);
      setSendError('Your message was not sent. Your draft has been restored so you can try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleOpenNewMessage = async () => {
    setNewMessageOpen(true);
    setLandlordSearchQuery('');
    setLoadingLandlords(true);
    try {
      const response = await axiosServices.get('/api/Conversation/tenant/available-landlords');
      setAvailableLandlords(response.data?.success ? response.data.data || [] : []);
    } catch (_) {
      setAvailableLandlords([]);
    } finally {
      setLoadingLandlords(false);
    }
  };

  const handleStartConversation = async (landlordUserId) => {
    setStartingLandlordId(landlordUserId);
    try {
      const response = await axiosServices.post('/api/Conversation/tenant/start', { landlordUserId });
      if (response.data?.success) {
        const conversation = response.data.data;
        setNewMessageOpen(false);
        await refreshConversations();
        await selectConversation(conversation);
      }
    } catch (_) {
      setConversationError('We could not start that conversation. Please try again.');
      setNewMessageOpen(false);
    } finally {
      setStartingLandlordId(null);
    }
  };

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => [
      getLandlordName(conversation),
      conversation.propertyName,
      conversation.unitName,
      conversation.lastMessagePreview
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [conversations, searchQuery]);

  const filteredLandlords = useMemo(() => {
    const query = landlordSearchQuery.trim().toLowerCase();
    if (!query) return availableLandlords;
    return availableLandlords.filter((landlord) => [landlord.name, landlord.propertyName, landlord.email]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [availableLandlords, landlordSearchQuery]);

  const visibleMessages = useMemo(() => {
    const persisted = messages.filter((message) => (
      !message.conversationId || String(message.conversationId) === String(selectedConversationId)
    ));
    const pending = optimisticMessages.filter((message) => String(message.conversationId) === String(selectedConversationId));
    return [...persisted, ...pending].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages, optimisticMessages, selectedConversationId]);

  const unreadCount = conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0);
  const activeLandlordName = getLandlordName(selectedConversation);
  const activePropertyLine = getConversationPropertyLine(selectedConversation);
  const activeSmsNumber = selectedConversation?.landlordSmsNumber || selectedConversation?.LandlordSmsNumber || FALLBACK_SMS_NUMBER;

  const renderLandlordSnapshot = () => (
    <Stack spacing={1.5}>
      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper', border: `1px solid ${messagesCardBorder}` }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar sx={{ width: 40, height: 40, bgcolor: getAvatarColor(activeLandlordName), color: '#fff', fontWeight: 700 }}>
            {activeLandlordName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{activeLandlordName}</Typography>
            <Typography variant="caption" color="text.secondary">Your landlord contact</Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper', border: `1px solid ${messagesCardBorder}` }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
          <HomeOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Home
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600}>{activePropertyLine || 'Property details unavailable'}</Typography>
      </Box>

      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper', border: `1px solid ${messagesCardBorder}` }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
          <MobileOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Text message access
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={600}>{formatPhone(activeSmsNumber)}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
          You can reply from the tenant portal or by SMS. Both stay in this conversation.
        </Typography>
      </Box>
    </Stack>
  );

  if (loadingConversations) {
    return (
      <MainCard content={false}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 520 }}><CircularProgress /></Box>
      </MainCard>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/tenant/dashboard' }, { label: 'Messages' }]} />
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3" fontWeight={750}>Messages</Typography>
              {unreadCount > 0 && <Chip size="small" color="primary" label={`${unreadCount} unread`} sx={{ height: 24, fontWeight: 700 }} />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
              Keep conversations with your landlord organized in one place
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PlusOutlined />}
            onClick={handleOpenNewMessage}
            sx={{ textTransform: 'none', borderRadius: 2, flexShrink: 0, boxShadow: 'none', minHeight: 40, px: { xs: 1.5, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>New message</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New</Box>
          </Button>
        </Stack>
      </Box>

      <MainCard
        content={false}
        sx={{
          p: 0,
          overflow: 'hidden',
          borderRadius: 1.25,
          border: `1px solid ${messagesCardBorder}`,
          boxShadow: panelShadow,
          bgcolor: 'background.paper',
          ':hover': { boxShadow: panelShadow }
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
              display: isMobile && selectedConversation ? 'none' : 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper'
            }}
          >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: `1px solid ${messagesDivider}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" fontWeight={750}>Inbox</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {conversations.length} conversation{conversations.length === 1 ? '' : 's'}{unreadCount ? ` · ${unreadCount} unread` : ''}
                  </Typography>
                </Box>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'success.main', boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.12)}` }} />
              </Stack>
            </Box>

            <Box sx={{ p: 1.25, borderBottom: `1px solid ${messagesDivider}` }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.55 }} /></InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { height: 36, fontSize: '0.8rem', borderRadius: 1.25, bgcolor: 'background.paper' } }}
              />
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {conversationError && <Alert severity="error" sx={{ m: 1.5 }}>{conversationError}</Alert>}
              {filteredConversations.length === 0 ? (
                <Stack spacing={1.25} alignItems="center" sx={{ p: 3, textAlign: 'center' }}>
                  {searchQuery ? <SearchOutlined style={{ fontSize: 36, color: theme.palette.text.disabled }} /> : <InboxOutlined style={{ fontSize: 40, color: theme.palette.text.disabled }} />}
                  <Typography variant="subtitle2" fontWeight={700}>{searchQuery ? 'No matching conversations' : 'Your inbox is empty'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? `No results for “${searchQuery}”.` : 'Start a secure conversation with your landlord.'}
                  </Typography>
                  <Button
                    size="small"
                    variant={searchQuery ? 'text' : 'contained'}
                    startIcon={searchQuery ? undefined : <PlusOutlined />}
                    onClick={searchQuery ? () => setSearchQuery('') : handleOpenNewMessage}
                    sx={{ textTransform: 'none' }}
                  >
                    {searchQuery ? 'Clear search' : 'Start a message'}
                  </Button>
                </Stack>
              ) : (
                <List disablePadding>
                  {filteredConversations.map((conversation) => {
                    const landlordName = getLandlordName(conversation);
                    const propertyLine = getConversationPropertyLine(conversation);
                    const isSelected = String(selectedConversation?.id) === String(conversation.id);
                    const hasUnread = conversation.unreadCount > 0;
                    return (
                      <ListItem key={conversation.id} disablePadding sx={{ borderBottom: `1px solid ${messagesDivider}` }}>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => selectConversation(conversation)}
                          sx={{
                            py: 1.35,
                            px: 2,
                            alignItems: 'flex-start',
                            borderLeft: '3px solid transparent',
                            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.07), borderLeftColor: 'primary.main' },
                            '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                          }}
                        >
                          <ListItemAvatar sx={{ mt: 0.4, minWidth: 48 }}>
                            <Badge badgeContent={hasUnread ? conversation.unreadCount : 0} color="error" max={99} showZero={false}>
                              <Avatar sx={{ width: 40, height: 40, bgcolor: getAvatarColor(landlordName), color: '#fff', fontWeight: 700 }}>
                                {landlordName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Badge>
                          </ListItemAvatar>
                          <ListItemText
                            disableTypography
                            primary={
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="subtitle2" noWrap fontWeight={hasUnread ? 700 : 500}>{landlordName}</Typography>
                                <Typography variant="caption" color={hasUnread ? 'primary.main' : 'text.secondary'} fontWeight={hasUnread ? 700 : 400} sx={{ flexShrink: 0, fontSize: '0.7rem' }}>
                                  {formatConversationTime(conversation.lastMessageAt)}
                                </Typography>
                              </Stack>
                            }
                            secondary={
                              <Box>
                                {propertyLine && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.4 }}>{propertyLine}</Typography>}
                                <Typography variant="body2" color={hasUnread ? 'text.primary' : 'text.secondary'} fontWeight={hasUnread ? 600 : 400} noWrap sx={{ fontSize: '0.8rem', mt: 0.25 }}>
                                  {conversation.lastMessagePreview || 'Start the conversation'}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          </Grid>

          <Grid
            size={{ xs: 12, md: 8, lg: 6 }}
            sx={{
              display: isMobile && !selectedConversation ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {selectedConversation ? (
              <>
                <Box sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper', flexShrink: 0 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25 }} sx={{ minWidth: 0 }}>
                      {isMobile && (
                        <Tooltip title="Back to inbox">
                          <IconButton aria-label="Back to inbox" onClick={() => setSelectedConversation(null)} sx={{ ml: -0.5, flexShrink: 0 }}><ArrowLeftOutlined /></IconButton>
                        </Tooltip>
                      )}
                      <Avatar sx={{ width: 42, height: 42, bgcolor: getAvatarColor(activeLandlordName), color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                        {activeLandlordName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} noWrap>{activeLandlordName}</Typography>
                        {activePropertyLine && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{activePropertyLine}</Typography>}
                      </Box>
                    </Stack>
                    <Chip label="Landlord" size="small" variant="outlined" sx={{ height: 24, fontWeight: 600, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }} />
                  </Stack>
                </Box>

                <Box
                  ref={messagesContainerRef}
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    px: { xs: 1, sm: 2.5 },
                    py: { xs: 1.5, sm: 2.5 },
                    bgcolor: isDarkMode ? alpha(theme.palette.background.default, 0.25) : '#f7f9fc',
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.24) : 'grey.300', borderRadius: 4 }
                  }}
                >
                  {loadingMessages && visibleMessages.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
                  ) : messageError ? (
                    <Alert severity="error">{messageError}</Alert>
                  ) : visibleMessages.length === 0 ? (
                    <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ textAlign: 'center', p: 3, minHeight: 220 }}>
                      <MessageOutlined style={{ fontSize: 38, color: theme.palette.text.disabled }} />
                      <Typography variant="subtitle2" fontWeight={700}>Start the conversation</Typography>
                      <Typography variant="body2" color="text.secondary">Send a message below to begin this landlord thread.</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={0}>
                      {visibleMessages.map((message, index) => {
                        const isOwn = String(message.senderId) === String(userId);
                        const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
                        const isConsecutive = previousMessage
                          && String(previousMessage.senderId) === String(message.senderId)
                          && new Date(message.createdAt).toDateString() === new Date(previousMessage.createdAt).toDateString();
                        const showDateSeparator = !previousMessage
                          || new Date(message.createdAt).toDateString() !== new Date(previousMessage.createdAt).toDateString();
                        return (
                          <Fragment key={message.id}>
                            {showDateSeparator && (
                              <Box sx={{ display: 'flex', alignItems: 'center', my: 2, px: 1 }}>
                                <Box sx={{ flex: 1, height: 1, bgcolor: messagesDivider }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mx: 2, whiteSpace: 'nowrap', fontWeight: 500 }}>{getDateLabel(message.createdAt)}</Typography>
                                <Box sx={{ flex: 1, height: 1, bgcolor: messagesDivider }} />
                              </Box>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'flex-start', mt: isConsecutive ? 0.25 : 1.5, px: 1, opacity: message._optimistic ? 0.65 : 1 }}>
                              {!isOwn && (
                                <Box sx={{ width: 40, flexShrink: 0, mr: 1 }}>
                                  {!isConsecutive && (
                                    <Avatar sx={{ width: 40, height: 40, bgcolor: getAvatarColor(activeLandlordName), color: '#fff', fontWeight: 700 }}>
                                      {activeLandlordName.charAt(0).toUpperCase()}
                                    </Avatar>
                                  )}
                                </Box>
                              )}
                              <Box sx={{ width: 'fit-content', maxWidth: { xs: isOwn ? '86%' : 'calc(88% - 42px)', sm: isOwn ? '74%' : 'calc(76% - 50px)' }, display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                                {!isConsecutive && (
                                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                                    {!isOwn && <Typography variant="caption" fontWeight={500}>{message.senderName || activeLandlordName}</Typography>}
                                    <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7, fontSize: '0.7rem' }}>{formatMessageTime(message.createdAt)}</Typography>
                                  </Stack>
                                )}
                                <Paper
                                  elevation={0}
                                  sx={{
                                    p: 1.25,
                                    px: 1.5,
                                    width: 'fit-content',
                                    maxWidth: '100%',
                                    bgcolor: isOwn ? 'primary.main' : (isDarkMode ? alpha(theme.palette.primary.main, 0.08) : 'grey.100'),
                                    color: isOwn ? '#fff' : 'text.primary',
                                    borderRadius: 3,
                                    borderTopLeftRadius: isConsecutive ? 2 : (isOwn ? 3 : 0),
                                    borderTopRightRadius: isConsecutive ? 2 : (isOwn ? 0 : 3),
                                    border: isOwn ? 'none' : `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.16) : alpha('#000', 0.06)}`
                                  }}
                                >
                                  <Stack direction="row" spacing={0.75} alignItems="flex-end">
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: isOwn ? '#fff' : 'inherit' }}>{message.content}</Typography>
                                    {message._optimistic && <CircularProgress size={11} sx={{ color: 'rgba(255,255,255,0.82)', mb: '2px' }} />}
                                    {!message._optimistic && isOwn && <CheckCircleOutlined style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginBottom: 2 }} />}
                                  </Stack>
                                </Paper>
                              </Box>
                            </Box>
                          </Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </Stack>
                  )}
                </Box>

                <Box sx={{ px: { xs: 1.25, sm: 2 }, pt: 1.25, pb: { xs: 'max(12px, env(safe-area-inset-bottom))', sm: 1.5 }, borderTop: `1px solid ${messagesDivider}`, bgcolor: 'background.paper', flexShrink: 0 }}>
                  {sendError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSendError('')}>{sendError}</Alert>}
                  {!messageInput && (
                    <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                      {QUICK_REPLIES.map((reply) => (
                        <Chip key={reply} label={reply} variant="outlined" onClick={() => setConversationDraft(selectedConversationId, reply)} sx={{ flexShrink: 0, maxWidth: { xs: 240, sm: 'none' }, borderRadius: 2, bgcolor: 'background.paper', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                      ))}
                    </Box>
                  )}
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      borderRadius: 2.5,
                      border: `1px solid ${messagesCardBorder}`,
                      bgcolor: 'background.paper',
                      pl: 1.5,
                      pr: 0.75,
                      py: 0.6,
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
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.9375rem', py: 0.55, '& .MuiInputBase-input': { py: 0.35, lineHeight: 1.5 } } }}
                      sx={{ flex: 1, '& .MuiInputBase-root': { border: 'none' } }}
                    />
                    <Tooltip title="Send message">
                      <span>
                        <IconButton
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || sendingMessage}
                          aria-label="Send message"
                          sx={{ ml: 0.75, width: 40, height: 40, bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' } }}
                        >
                          {sendingMessage ? <CircularProgress size={19} color="inherit" /> : <SendOutlined style={{ fontSize: 18 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Paper>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.65, px: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>Enter to send · Shift + Enter for a new line</Typography>
                    <Typography variant="caption" color={messageInput.length > MAX_MESSAGE_LENGTH * 0.9 ? 'warning.main' : 'text.secondary'} sx={{ ml: 'auto' }}>{messageInput.length}/{MAX_MESSAGE_LENGTH}</Typography>
                  </Stack>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, bgcolor: isDarkMode ? 'background.paper' : '#f7f9fc' }}>
                <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', maxWidth: 360 }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><MessageOutlined style={{ fontSize: 28 }} /></Avatar>
                  <Typography variant="h5" fontWeight={700}>Your inbox</Typography>
                  <Typography variant="body2" color="text.secondary">Review your message history or start a new conversation.</Typography>
                  <Button variant="contained" startIcon={<PlusOutlined />} onClick={handleOpenNewMessage} sx={{ mt: 0.5, textTransform: 'none' }}>New message</Button>
                </Stack>
              </Box>
            )}
          </Grid>

          <Grid size={{ xs: 12, lg: 3 }} sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', borderLeft: `1px solid ${messagesDivider}`, bgcolor: alpha(theme.palette.background.default, 0.28) }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={700}>Conversation details</Typography>
              <Typography variant="caption" color="text.secondary">Landlord and property context</Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selectedConversation ? renderLandlordSnapshot() : (
                <Box sx={{ p: 2, border: `1px dashed ${messagesCardBorder}`, borderRadius: 1.5, bgcolor: 'background.paper', textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={700}>No conversation selected</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Choose a thread to see your landlord and property details.</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </MainCard>

      {selectedConversation && (
        <MainCard content={false} sx={{ mt: 2, display: { xs: 'block', lg: 'none' }, border: `1px solid ${messagesCardBorder}`, boxShadow: 'none' }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${messagesDivider}` }}>
            <Typography variant="subtitle2" fontWeight={700}>Conversation details</Typography>
            <Typography variant="caption" color="text.secondary">Landlord and property context</Typography>
          </Box>
          <Box sx={{ p: 2 }}>{renderLandlordSnapshot()}</Box>
        </MainCard>
      )}

      <Dialog open={newMessageOpen} onClose={() => !startingLandlordId && setNewMessageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><MessageOutlined /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>New message</Typography>
              <Typography variant="caption" color="text.secondary">Choose a landlord to open a secure conversation</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {loadingLandlords ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : availableLandlords.length === 0 ? (
            <Alert severity="info">We could not find a landlord connected to your tenant account yet. Ask your landlord to add you as a tenant or resend your invite.</Alert>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                placeholder="Search landlords or properties..."
                value={landlordSearchQuery}
                onChange={(event) => setLandlordSearchQuery(event.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
                sx={{ mb: 1.5 }}
              />
              {filteredLandlords.length === 0 ? (
                <Stack spacing={1} alignItems="center" sx={{ py: 4, textAlign: 'center' }}>
                  <SearchOutlined style={{ fontSize: 34, color: theme.palette.text.disabled }} />
                  <Typography variant="subtitle2" fontWeight={700}>No matching landlords</Typography>
                  <Button size="small" onClick={() => setLandlordSearchQuery('')} sx={{ textTransform: 'none' }}>Clear search</Button>
                </Stack>
              ) : (
                <Stack spacing={1}>
                  {filteredLandlords.map((landlord) => {
                    const isStarting = startingLandlordId === landlord.landlordUserId;
                    return (
                      <ListItemButton
                        key={landlord.landlordUserId}
                        onClick={() => handleStartConversation(landlord.landlordUserId)}
                        disabled={Boolean(startingLandlordId)}
                        sx={{ border: `1px solid ${messagesCardBorder}`, borderRadius: 2, px: 1.5, py: 1.25 }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: getAvatarColor(landlord.name), color: '#fff', fontWeight: 700 }}>{landlord.name?.charAt(0)?.toUpperCase() || <UserOutlined />}</Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={<Typography fontWeight={700}>{landlord.name || 'Landlord'}</Typography>} secondary={landlord.propertyName || 'Connected landlord'} />
                        {isStarting && <CircularProgress size={18} />}
                      </ListItemButton>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
