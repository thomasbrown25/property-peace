import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Material-UI
import {
  Box,
  Grid,
  Stack,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';

// Icons
import SendOutlined from '@ant-design/icons/SendOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import MobileOutlined from '@ant-design/icons/MobileOutlined';
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';

const FALLBACK_SMS_NUMBER = import.meta.env.VITE_TWILIO_SMS_NUMBER || '+198****0067';

function formatPhone(raw) {
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
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

// Project imports
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatMessageTime } from 'utils/formatters';
import { getMessages, addMessage, markConversationAsRead } from 'store/message/message.action';
import { selectMessages, selectMessageLoading, selectMessageError } from 'store/message/message.selector';

// ==============================|| TENANT - MESSAGES ||============================== //

export default function TenantMessages() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redux message state
  const messages = useSelector(selectMessages);
  const loadingMessages = useSelector(selectMessageLoading);
  const messageError = useSelector(selectMessageError);

  // Local state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingMessages, setPendingMessages] = useState(new Map());
  const [sentMessageIds, setSentMessageIds] = useState(new Set());

  // New message dialog
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [availableLandlords, setAvailableLandlords] = useState([]);
  const [loadingLandlords, setLoadingLandlords] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Load all conversations for this tenant
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      setConversationError(null);
      const res = await axiosServices.get('/api/Conversation/tenant/my-conversations');
      if (res.data?.success) {
        const convs = res.data.data || [];
        setConversations(convs);
        // Auto-select first if none selected
        if (!selectedConversation && convs.length > 0) {
          selectConversation(convs[0]);
        }
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 400) {
        setConversations([]);
      } else {
        setConversationError(err?.response?.data?.message || 'Failed to load conversations');
      }
    } finally {
      setLoadingConversations(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectConversation = useCallback(async (conv) => {
    setSelectedConversation(conv);
    setMessageInput('');
    dispatch(getMessages(conv.id));
    try {
      await dispatch(markConversationAsRead(conv.id));
    } catch (_) {}
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }, [dispatch]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;

    const messageContent = messageInput.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const userId = user?.Id || user?.id;
    const userName = user?.firstName || user?.FirstName || user?.email || 'You';

    const optimisticMessage = {
      id: tempId,
      conversationId: selectedConversation.id,
      senderId: userId,
      senderName: userName,
      content: messageContent,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      isSending: true
    };

    setPendingMessages(prev => new Map(prev).set(tempId, optimisticMessage));
    setMessageInput('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      setSendingMessage(true);
      const result = await dispatch(addMessage({ conversationId: selectedConversation.id, content: messageContent }));
      if (result.success) {
        dispatch(getMessages(selectedConversation.id));
        // Refresh conversation list to update preview
        const res = await axiosServices.get('/api/Conversation/tenant/my-conversations');
        if (res.data?.success) setConversations(res.data.data || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setPendingMessages(prev => { const m = new Map(prev); m.delete(tempId); return m; });
        setMessageInput(messageContent);
      }
    } catch {
      setPendingMessages(prev => { const m = new Map(prev); m.delete(tempId); return m; });
      setMessageInput(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleOpenNewMessage = async () => {
    setNewMessageOpen(true);
    setLoadingLandlords(true);
    try {
      const res = await axiosServices.get('/api/Conversation/tenant/available-landlords');
      if (res.data?.success) setAvailableLandlords(res.data.data || []);
    } catch {
      setAvailableLandlords([]);
    } finally {
      setLoadingLandlords(false);
    }
  };

  const handleStartConversation = async (landlordUserId) => {
    setStartingConversation(true);
    try {
      const res = await axiosServices.post('/api/Conversation/tenant/start', { landlordUserId });
      if (res.data?.success) {
        const conv = res.data.data;
        setNewMessageOpen(false);
        // Refresh list and select the new/existing conversation
        const listRes = await axiosServices.get('/api/Conversation/tenant/my-conversations');
        if (listRes.data?.success) setConversations(listRes.data.data || []);
        selectConversation(conv);
      }
    } catch {
      // ignore
    } finally {
      setStartingConversation(false);
    }
  };

  useEffect(() => {
    if (user?.Id || user?.id) loadConversations();
  }, [loadConversations, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages.length]);

  // Clean up pending messages when real ones arrive
  useEffect(() => {
    if (messages.length > 0 && pendingMessages.size > 0) {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      setPendingMessages(prev => {
        const newMap = new Map(prev);
        let changed = false;
        for (const [tempId, pending] of newMap.entries()) {
          const match = messages.find(m =>
            m.content === pending.content &&
            m.senderId === pending.senderId &&
            new Date(m.createdAt).getTime() > tenSecondsAgo
          );
          if (match) {
            newMap.delete(tempId);
            changed = true;
            if (match.id) {
              setSentMessageIds(prev => {
                if (prev.has(match.id)) return prev;
                const s = new Set(prev);
                s.add(match.id);
                setTimeout(() => setSentMessageIds(p => { const u = new Set(p); u.delete(match.id); return u; }), 3000);
                return s;
              });
            }
          }
        }
        return changed ? newMap : prev;
      });
    }
  }, [messages, pendingMessages.size]);

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.landlordName?.toLowerCase().includes(q) ||
      c.propertyName?.toLowerCase().includes(q) ||
      c.lastMessagePreview?.toLowerCase().includes(q)
    );
  });

  const userId = user?.Id || user?.id;

  if (loadingConversations) {
    return (
      <MainCard>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  return (
    <Box>
      {/* Page header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={{ xs: 1.5, sm: 2 }}
        sx={{
          mb: 2,
          p: { xs: 2, sm: 0 },
          borderRadius: { xs: 3, sm: 0 },
          border: { xs: '1px solid', sm: 'none' },
          borderColor: { xs: alpha(theme.palette.primary.main, 0.14), sm: 'transparent' },
          bgcolor: {
            xs: theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.primary.main, 0.035),
            sm: 'transparent'
          },
          backgroundImage: {
            xs: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.09)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 62%)`,
            sm: 'none'
          },
          boxShadow: { xs: `0 12px 30px ${alpha(theme.palette.primary.main, 0.08)}`, sm: 'none' }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 2 }} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: { xs: 46, sm: 56 },
              height: { xs: 46, sm: 56 },
              borderRadius: { xs: 2.5, sm: 2 },
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: { xs: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.12)}`, sm: 'none' }
            }}
          >
            <MessageOutlined style={{ fontSize: isMobile ? 24 : 28 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
              Messages
            </Typography>
            <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary">
              Communicate with your landlord
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<PlusOutlined />}
          onClick={handleOpenNewMessage}
          sx={{
            textTransform: 'none',
            borderRadius: '20px',
            flexShrink: 0,
            alignSelf: { xs: 'stretch', sm: 'center' },
            boxShadow: { xs: `0 10px 22px ${alpha(theme.palette.primary.main, 0.2)}`, sm: 'none' }
          }}
        >
          New Message
        </Button>
      </Stack>

      <MainCard sx={{ p: 0 }}>
        <Grid container sx={{ height: 'calc(100vh - 340px)', minHeight: 560, overflow: 'hidden' }}>

          {/* ── Sidebar ── */}
          <Grid
            size={{ xs: 12, md: 4 }}
            sx={{
              borderRight: 1,
              borderColor: 'divider',
              height: '100%',
              overflow: 'hidden',
              display: isMobile && selectedConversation ? 'none' : 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Search */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined style={{ fontSize: 18 }} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            {/* Conversation list */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {conversationError && (
                <Alert severity="error" sx={{ m: 2 }}>{conversationError}</Alert>
              )}
              {filteredConversations.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <MessageOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: 8 }} />
                  <Typography variant="body2" color="text.secondary">
                    {conversations.length === 0
                      ? 'No conversations yet. Click "New Message" to start one.'
                      : 'No conversations match your search.'}
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {filteredConversations.map((conv, idx) => {
                    const isSelected = selectedConversation?.id === conv.id;
                    const avatarLetter = conv.landlordName?.charAt(0)?.toUpperCase() || 'L';
                    return (
                      <Box key={conv.id}>
                        {idx > 0 && <Divider />}
                        <ListItem disablePadding>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => selectConversation(conv)}
                            sx={{
                              py: 1.5,
                              px: 2,
                              '&.Mui-selected': {
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) }
                              }
                            }}
                          >
                            <ListItemAvatar>
                              <Badge
                                badgeContent={conv.unreadCount > 0 ? conv.unreadCount : null}
                                color="primary"
                                max={9}
                              >
                                <Avatar sx={{ bgcolor: isSelected ? 'primary.main' : 'primary.light', color: '#fff', width: 42, height: 42 }}>
                                  {avatarLetter}
                                </Avatar>
                              </Badge>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography variant="subtitle2" fontWeight={conv.unreadCount > 0 ? 700 : 500} noWrap sx={{ maxWidth: 140 }}>
                                    {conv.landlordName || 'Landlord'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                                    {formatConversationTime(conv.lastMessageAt)}
                                  </Typography>
                                </Stack>
                              }
                              secondary={
                                <Stack spacing={0.25}>
                                  {conv.propertyName && (
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                                      {conv.propertyName}
                                    </Typography>
                                  )}
                                  <Typography
                                    variant="caption"
                                    color={conv.unreadCount > 0 ? 'text.primary' : 'text.secondary'}
                                    fontWeight={conv.unreadCount > 0 ? 600 : 400}
                                    noWrap
                                    sx={{ fontSize: '0.78rem' }}
                                  >
                                    {conv.lastMessagePreview || 'Start the conversation'}
                                  </Typography>
                                </Stack>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      </Box>
                    );
                  })}
                </List>
              )}
            </Box>
          </Grid>

          {/* ── Chat Area ── */}
          <Grid
            size={{ xs: 12, md: 8 }}
            sx={{
              height: '100%',
              overflow: 'hidden',
              display: isMobile && !selectedConversation ? 'none' : 'flex',
              flexDirection: 'column'
            }}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.025)
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    spacing={{ xs: 1, sm: 1.5 }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                      {isMobile && (
                        <IconButton
                          size="small"
                          onClick={() => setSelectedConversation(null)}
                          sx={{
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            flexShrink: 0,
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <ArrowLeftOutlined />
                        </IconButton>
                      )}
                      <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: { xs: 38, sm: 40 }, height: { xs: 38, sm: 40 }, flexShrink: 0 }}>
                        {selectedConversation.landlordName?.charAt(0)?.toUpperCase() || 'L'}
                      </Avatar>
                      <Stack sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={600} noWrap sx={{ lineHeight: 1.2 }}>
                          {selectedConversation.landlordName || 'Landlord'}
                        </Typography>
                        {selectedConversation.propertyName && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {selectedConversation.propertyName}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                    {/* SMS hint */}
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent={{ xs: 'center', sm: 'flex-start' }}
                      spacing={0.75}
                      sx={{
                        px: 1.5, py: 0.75, borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, 0.15),
                        flexShrink: 0,
                        maxWidth: { xs: '100%', sm: 260 }
                      }}
                    >
                      <MobileOutlined style={{ fontSize: 13, opacity: 0.7, flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', minWidth: 0 }}>
                        Reply by SMS to{' '}
                        <Box component="span" sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap' }}>
                          {formatPhone(selectedConversation.landlordSmsNumber || selectedConversation.LandlordSmsNumber || FALLBACK_SMS_NUMBER)}
                        </Box>
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {/* Messages */}
                <Box
                  ref={messagesContainerRef}
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    p: 2,
                    bgcolor: 'background.paper',
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: 4 }
                  }}
                >
                  {loadingMessages && messages.length === 0 && pendingMessages.size === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : messageError ? (
                    <Alert severity="error">{messageError}</Alert>
                  ) : messages.length === 0 && pendingMessages.size === 0 ? (
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <MessageOutlined style={{ fontSize: 48, opacity: 0.2, marginBottom: 8 }} />
                      <Typography variant="body2" color="text.secondary">
                        No messages yet. Start the conversation!
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={0}>
                      {messages.map((message, index) => {
                        const isOwn = message.senderId === userId;
                        const prev = index > 0 ? messages[index - 1] : null;
                        const isConsecutive = prev?.senderId === message.senderId &&
                          new Date(message.createdAt).toDateString() === new Date(prev.createdAt).toDateString();
                        const showDateSeparator = !prev ||
                          new Date(message.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                        const showCheckmark = isOwn && sentMessageIds.has(message.id);
                        return (
                          <Fragment key={message.id}>
                            {showDateSeparator && (
                              <Box sx={{ display: 'flex', alignItems: 'center', my: 2, px: 1 }}>
                                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mx: 2, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                  {getDateLabel(message.createdAt)}
                                </Typography>
                                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                              </Box>
                            )}
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: isOwn ? 'flex-end' : 'flex-start',
                              alignItems: 'flex-start',
                              mt: isConsecutive ? 0.25 : 1.5,
                              px: 1
                            }}
                          >
                            {!isOwn && (
                              <Box sx={{ width: 40, height: 40, flexShrink: 0, mr: 1, display: 'flex', alignItems: 'flex-start', pt: isConsecutive ? 0.5 : 0 }}>
                                {!isConsecutive && (
                                  <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: '#fff' }}>
                                    {message.senderName?.charAt(0)?.toUpperCase() || '?'}
                                  </Avatar>
                                )}
                              </Box>
                            )}
                            <Box sx={{ maxWidth: isOwn ? '70%' : 'calc(70% - 50px)', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                              {!isConsecutive && (
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                                  {!isOwn && (
                                    <Typography variant="caption" fontWeight={500} color="text.primary">
                                      {message.senderName || 'Unknown'}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>
                                    {formatMessageTime(message.createdAt)}
                                  </Typography>
                                </Stack>
                              )}
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 1.25, px: 1.5,
                                  width: 'fit-content',
                                  maxWidth: '100%',
                                  bgcolor: isOwn ? 'primary.main' : (t => t.palette.mode === 'dark' ? 'grey.800' : 'grey.100'),
                                  color: isOwn ? '#fff' : 'text.primary',
                                  borderRadius: 3,
                                  borderTopLeftRadius: isConsecutive ? 2 : (isOwn ? 3 : 0),
                                  borderTopRightRadius: isConsecutive ? 2 : (isOwn ? 0 : 3),
                                  borderBottomLeftRadius: 3,
                                  borderBottomRightRadius: 3,
                                  boxShadow: 'none',
                                  border: isOwn ? 'none' : (t => `1px solid ${alpha(t.palette.mode === 'dark' ? '#fff' : '#000', t.palette.mode === 'dark' ? 0.1 : 0.06)}`)
                                }}
                              >
                                <Stack direction="row" alignItems="flex-end" spacing={0.5}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: isOwn ? '#fff' : 'inherit', flex: 1 }}>
                                    {message.content}
                                  </Typography>
                                  {showCheckmark && (
                                    <CheckCircleOutlined style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', flexShrink: 0, marginBottom: 2 }} />
                                  )}
                                </Stack>
                              </Paper>
                            </Box>
                          </Box>
                          </Fragment>
                        );
                      })}

                      {/* Pending optimistic messages */}
                      {Array.from(pendingMessages.values()).map(message => (
                        <Box
                          key={message.id}
                          sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', mt: 1.5, px: 1 }}
                        >
                          <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>
                                {formatMessageTime(message.createdAt)}
                              </Typography>
                            </Stack>
                            <Paper elevation={0} sx={{ p: 1.25, px: 1.5, bgcolor: 'primary.main', color: '#fff', borderRadius: 3, borderTopRightRadius: 0, boxShadow: 'none' }}>
                              <Stack direction="row" alignItems="flex-end" spacing={0.5}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: '#fff', flex: 1 }}>
                                  {message.content}
                                </Typography>
                                <CircularProgress size={11} sx={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0, mb: '2px' }} />
                              </Stack>
                            </Paper>
                          </Box>
                        </Box>
                      ))}

                      <div ref={messagesEndRef} />
                    </Stack>
                  )}
                </Box>

                {/* Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      px: 1, py: 0.5,
                      '&:focus-within': { borderColor: 'primary.main' }
                    }}
                  >
                    <TextField
                      fullWidth multiline maxRows={4}
                      placeholder="Type a message"
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      disabled={sendingMessage}
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: { fontSize: '0.9375rem', py: 0.5, '& .MuiInputBase-input': { py: 0.5 } }
                      }}
                      sx={{ flex: 1 }}
                    />
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: 'center' }} />
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendingMessage}
                      sx={{ ml: 0.5, color: 'primary.main', '&.Mui-disabled': { color: 'text.disabled' } }}
                    >
                      {sendingMessage ? <CircularProgress size={20} /> : <SendOutlined style={{ fontSize: 18 }} />}
                    </IconButton>
                  </Paper>
                </Box>
              </>
            ) : (
              /* Empty state — no conversation selected */
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Stack spacing={2} alignItems="center">
                  <MessageOutlined style={{ fontSize: 64, opacity: 0.2 }} />
                  <Typography variant="h6" color="text.secondary">
                    {conversations.length === 0 ? 'No conversations yet' : 'Select a conversation'}
                  </Typography>
                  {conversations.length === 0 && (
                    <Button variant="contained" startIcon={<PlusOutlined />} onClick={handleOpenNewMessage} sx={{ textTransform: 'none' }}>
                      New Message
                    </Button>
                  )}
                </Stack>
              </Box>
            )}
          </Grid>
        </Grid>
      </MainCard>

      {/* New Message Dialog */}
      <Dialog open={newMessageOpen} onClose={() => setNewMessageOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MessageOutlined style={{ fontSize: 20 }} />
            <Typography variant="h6">New Message</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {loadingLandlords ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : availableLandlords.length === 0 ? (
            <Alert severity="info">
              We could not find a landlord connected to your tenant account yet. Ask your landlord to add you as a tenant or resend your invite.
            </Alert>
          ) : (
            <List disablePadding>
              {availableLandlords.map(landlord => (
                <ListItem key={landlord.landlordUserId} disablePadding>
                  <ListItemButton
                    onClick={() => handleStartConversation(landlord.landlordUserId)}
                    disabled={startingConversation}
                    sx={{ borderRadius: 1, mb: 0.5 }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main', color: '#fff' }}>
                        <UserOutlined />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography fontWeight={600}>{landlord.name}</Typography>}
                      secondary={landlord.propertyName}
                    />
                    {startingConversation && <CircularProgress size={18} />}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
