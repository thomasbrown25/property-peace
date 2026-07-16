import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import SendOutlined from '@ant-design/icons/SendOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import ArrowRightOutlined from '@ant-design/icons/ArrowRightOutlined';

import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { formatMessageTime } from 'utils/formatters';
import { selectConversations } from 'store/conversation/conversation.selector';
import { getConversations, addConversation } from 'store/conversation/conversation.action';

const DRAWER_WIDTH = 440;
const SENT_MESSAGE_BLUE = '#1877F2';

export default function TenantMessageDrawer({ open, onClose, tenant, property }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();

  const conversations = useSelector(selectConversations);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tenantId = tenant?.id || tenant?.Id;
  const firstName = tenant?.firstname || tenant?.Firstname || '';
  const lastName = tenant?.lastname || tenant?.Lastname || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Tenant';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
  const tenantUserId = tenant?.userId || tenant?.UserId;

  // On open: ensure conversations are loaded so we can find this tenant's thread
  useEffect(() => {
    if (open) {
      dispatch(getConversations(false));
    }
  }, [open, dispatch]);

  // Once conversations are in store, find the one for this tenant
  useEffect(() => {
    if (!open || !tenantId) return;
    const found = conversations.find((c) => c.tenantId === tenantId && !c.isArchived) || null;
    setConversation(found);
  }, [conversations, tenantId, open]);

  // Fetch last 10 messages when conversation is identified
  useEffect(() => {
    if (!open || !conversation?.id) {
      if (open && !conversation) setMessages([]);
      return;
    }

    let cancelled = false;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await axiosServices.get(`/api/Message/conversation/${conversation.id}?skip=0&take=10`);
        if (!cancelled && res.data.success) {
          setMessages(res.data.data || []);
        }
      } catch {
        // silently fail — drawer is supplementary
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    fetchMessages();
    return () => { cancelled = true; };
  }, [open, conversation?.id]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
    }
  }, [messages.length]);

  const handleClose = () => {
    setMessages([]);
    setMessageInput('');
    setConversation(null);
    onClose();
  };

  const handleOpenFull = () => {
    handleClose();
    if (conversation?.id) {
      navigate(`/landlord/messages?conversationId=${conversation.id}`);
    } else {
      navigate('/landlord/messages');
    }
  };

  const handleSend = async () => {
    const content = messageInput.trim();
    if (!content || sending) return;

    setMessageInput('');
    setSending(true);

    try {
      let convId = conversation?.id;

      // Create conversation first if none exists
      if (!convId) {
        if (!tenantUserId) {
          openSnackbar({
            open: true,
            message: 'This tenant does not have a user account yet.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setMessageInput(content);
          return;
        }

        const unit = property?.units?.[0];
        const propertyName = property?.name?.trim() || property?.streetAddress?.trim() || 'Property';
        const isMultiUnit = property?.propertyType?.toLowerCase() !== 'singlefamily';
        const title = isMultiUnit && unit?.name ? `${propertyName} - ${unit.name}` : propertyName;

        const result = await dispatch(
          addConversation({
            Title: title,
            TenantId: tenantId,
            PropertyId: property?.id || null,
            LeaseId: unit?.lease?.id || unit?.Lease?.id || null,
            ParticipantUserIds: [tenantUserId],
            IsGroupChat: false
          })
        );

        if (!result.success || !result.data?.id) {
          openSnackbar({ open: true, message: 'Failed to start conversation.', variant: 'alert', alert: { color: 'error' } });
          setMessageInput(content);
          return;
        }

        convId = result.data.id;
        setConversation(result.data);
      }

      // Send message directly — avoid touching global Redux message state
      const res = await axiosServices.post('/api/Message', { conversationId: convId, content });

      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      } else {
        openSnackbar({ open: true, message: 'Failed to send message.', variant: 'alert', alert: { color: 'error' } });
        setMessageInput(content);
      }
    } catch {
      openSnackbar({ open: true, message: 'Failed to send message.', variant: 'alert', alert: { color: 'error' } });
      setMessageInput(content);
    } finally {
      setSending(false);
      // Return focus to input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const userId = user?.Id || user?.id;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: DRAWER_WIDTH },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ px: 2.5, py: 2, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 42, height: 42, bgcolor: theme.palette.success.main, fontWeight: 700, fontSize: '1rem' }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{fullName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {property?.name?.trim() || property?.streetAddress || ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Open full conversation">
            <IconButton size="small" onClick={handleOpenFull}>
              <ArrowRightOutlined style={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleClose}>
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      </Box>
      <Divider />

      {/* ── Message list ── */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 2,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: 3 }
        }}
      >
        {loadingMessages ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress size={28} />
          </Box>
        ) : messages.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, gap: 1 }}>
            <MessageOutlined style={{ fontSize: 40, color: '#ccc' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {conversation ? 'No messages yet' : `No conversation with ${fullName} yet`}
            </Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Send a message below to get started
            </Typography>
          </Stack>
        ) : (
          <>
            {/* "View full conversation" hint when capped at 10 */}
            {messages.length >= 10 && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={handleOpenFull}
                  sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
                >
                  Showing last 10 messages · View full conversation →
                </Button>
              </Box>
            )}

            {messages.map((message, index) => {
              const isOwn = message.senderId === userId;
              const prev = index > 0 ? messages[index - 1] : null;
              const isConsecutive = prev?.senderId === message.senderId;

              return (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    mt: isConsecutive ? 0.25 : 1.5
                  }}
                >
                  <Box sx={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    {!isConsecutive && !isOwn && (
                      <Typography variant="caption" sx={{ px: 0.5, mb: 0.4, fontWeight: 500, color: 'text.primary', fontSize: '0.72rem' }}>
                        {message.senderName || fullName}
                      </Typography>
                    )}
                    <Paper
                      elevation={0}
                      sx={{
                        px: 1.5,
                        py: 1,
                        bgcolor: isOwn ? (t) => (t.palette.mode === 'dark' ? SENT_MESSAGE_BLUE : t.palette.primary.main) : (t) => t.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                        color: isOwn ? '#fff' : 'text.primary',
                        borderRadius: 3,
                        borderTopRightRadius: isOwn ? (isConsecutive ? 3 : 0) : 3,
                        borderTopLeftRadius: isOwn ? 3 : (isConsecutive ? 3 : 0),
                        boxShadow: isOwn ? (t) => t.palette.mode === 'dark' ? `0 6px 16px ${alpha(SENT_MESSAGE_BLUE, 0.18)}` : 'none' : 'none',
                        border: isOwn
                          ? (t) => t.palette.mode === 'dark' ? `1px solid ${alpha('#ffffff', 0.12)}` : 'none'
                          : (t) => `1px solid ${alpha(t.palette.mode === 'dark' ? '#fff' : '#000', 0.06)}`
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: 'inherit', fontSize: '0.875rem' }}>
                        {message.content}
                      </Typography>
                    </Paper>
                    {!isConsecutive && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, px: 0.5, fontSize: '0.68rem' }}>
                        {formatMessageTime(message.createdAt)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>

      {/* ── Input ── */}
      <Divider />
      <Box sx={{ p: 2, flexShrink: 0, bgcolor: 'background.paper' }}>
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            px: 1.5,
            py: 0.5,
            '&:focus-within': { borderColor: 'primary.main' }
          }}
        >
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder={`Message ${fullName}…`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: { fontSize: '0.9rem', py: 0.25 }
            }}
          />
          <IconButton
            size="small"
            onClick={handleSend}
            disabled={!messageInput.trim() || sending}
            sx={{ ml: 0.5, color: 'primary.main', flexShrink: 0, '&.Mui-disabled': { color: 'text.disabled' } }}
          >
            {sending ? <CircularProgress size={18} /> : <SendOutlined style={{ fontSize: 16 }} />}
          </IconButton>
        </Paper>
      </Box>
    </Drawer>
  );
}
