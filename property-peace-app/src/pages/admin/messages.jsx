import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';

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
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  CircularProgress,
  Alert,
  Chip,
  Tabs,
  Tab,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';

// Icons
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import CustomerServiceOutlined from '@ant-design/icons/CustomerServiceOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import PushpinOutlined from '@ant-design/icons/PushpinOutlined';
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import MenuOutlined from '@ant-design/icons/MenuOutlined';

// Project imports
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import axiosServices from 'utils/axios';
import { formatRelativeTime, formatMessageTime } from 'utils/formatters';
import { getMessages, addMessage, markConversationAsRead } from 'store/message/message.action';
import { selectMessages, selectMessageLoading, selectMessageError, selectCurrentConversationId } from 'store/message/message.selector';
import useSignalRConversations from 'hooks/useSignalRConversations';
import { openSnackbar } from 'api/snackbar';
import AdminSupportWorkspace from 'sections/admin/support/AdminSupportWorkspace';
import { getSendAttempt } from 'utils/clientRequestId';

// ==============================|| ADMIN MESSAGES PAGE ||============================== //

export default function AdminMessages() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  // Main tab: 'support' or 'conversations'
  const [mainTab, setMainTab] = useState(searchParams.get('tab') === 'support' ? 'support' : 'conversations');
  const [supportRequestCount, setSupportRequestCount] = useState(0);
  
  // Mobile state for conversations
  const [showConversationList, setShowConversationList] = useState(!isMobile);


  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  // Redux state for messages
  const messages = useSelector(selectMessages);
  const loadingMessages = useSelector(selectMessageLoading);
  const messageError = useSelector(selectMessageError);
  const currentConversationId = useSelector(selectCurrentConversationId);

  // SignalR for real-time updates
  const { isConnected, onMessageUpdate, joinConversation, leaveConversation } = useSignalRConversations();

  // Refs
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sendAttemptRef = useRef(null);


  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const response = await axiosServices.get('/api/Conversation/admin/conversations?includeArchived=false');
      
      if (response.data?.success && response.data?.data) {
        // Filter out conversations without messages
        const conversationsWithMessages = response.data.data.filter(conv => 
          conv.lastMessagePreview || conv.lastMessageAt
        );
        setConversations(conversationsWithMessages);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        const conversationsWithMessages = response.data.data.filter(conv => 
          conv.lastMessagePreview || conv.lastMessageAt
        );
        setConversations(conversationsWithMessages);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Load conversations on mount and when main tab changes
  useEffect(() => {
    if (mainTab === 'conversations') {
      loadConversations();
    }
  }, [mainTab, loadConversations]);

  // Load messages for selected conversation
  const loadMessages = useCallback(
    async (conversationId) => {
      if (currentConversationId === conversationId) {
        return;
      }

      dispatch(getMessages(conversationId));

      // Mark conversation as read
      try {
        await dispatch(markConversationAsRead(conversationId));
        loadConversations(); // Reload to update unread count
      } catch (err) {
        console.error('Error marking conversation as read:', err);
      }

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    [dispatch, currentConversationId, loadConversations]
  );

  // Handle conversation selection
  const handleSelectConversation = useCallback(
    (conversation) => {
      const conversationId = typeof conversation === 'object' && conversation !== null 
        ? conversation.id 
        : conversation;

      if (!conversationId) {
        return;
      }

      setSelectedConversation(conversation);
      if (isMobile) {
        setShowConversationList(false);
      }

      setTimeout(() => {
        if (isConnected) {
          joinConversation(conversationId);
        }
        loadMessages(conversationId);
      }, 0);
    },
    [dispatch, loadMessages, isConnected, joinConversation, isMobile]
  );

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) {
      return;
    }

    const content = messageInput.trim();
    const attempt = getSendAttempt(sendAttemptRef.current, selectedConversation.id, content);
    sendAttemptRef.current = attempt;

    try {
      setSendingMessage(true);

      const result = await dispatch(
        addMessage({
          conversationId: selectedConversation.id,
          content,
          clientRequestId: attempt.clientRequestId
        })
      );

      if (result.success) {
        sendAttemptRef.current = null;
        setMessageInput('');
        loadConversations(); // Reload to update last message

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to send message',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      openSnackbar({
        open: true,
        message: 'Error sending message',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (!conversationSearchQuery) return true;
      const query = conversationSearchQuery.toLowerCase();
      return (
        conv.title?.toLowerCase().includes(query) ||
        conv.lastMessagePreview?.toLowerCase().includes(query) ||
        conv.tenantName?.toLowerCase().includes(query) ||
        conv.propertyName?.toLowerCase().includes(query) ||
        conv.landlordName?.toLowerCase().includes(query)
      );
    });
  }, [conversations, conversationSearchQuery]);

  // Listen for real-time message updates via SignalR
  useEffect(() => {
    if (!isConnected) return;
    
    if (!selectedConversation?.id) return;

    const unsubscribe = onMessageUpdate((message) => {
      if (message?.conversationId === selectedConversation.id) {
        const messageExists = messages.some((msg) => msg.id === message.id);
        
        if (!messageExists) {
          dispatch({
            type: 'message/ADD_MESSAGE_SUCCESS',
            payload: message
          });
          
          loadConversations();
          
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    });

    return unsubscribe;
  }, [isConnected, onMessageUpdate, selectedConversation?.id, messages, dispatch, loadConversations]);

  // Leave conversation group when conversation changes
  useEffect(() => {
    return () => {
      if (selectedConversation?.id && isConnected) {
        leaveConversation(selectedConversation.id);
      }
    };
  }, [selectedConversation?.id, isConnected, leaveConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

  // Reset conversation list visibility when switching between mobile and desktop
  useEffect(() => {
    if (!isMobile) {
      setShowConversationList(true);
    } else if (!selectedConversation) {
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation]);


  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <PageBreadcrumbs title="Support & Messages" />
      </Grid>

      <Grid size={12}>
        <MainCard>
          {/* Main Tab Switcher */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={mainTab}
              onChange={(e, newValue) => {
                setMainTab(newValue);
                setSelectedConversation(null);
                setSearchParams(newValue === 'support' ? { tab: 'support' } : {});
              }}
            >
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MessageOutlined />
                    <span>Conversations</span>
                    {conversations.length > 0 && (
                      <Chip 
                        label={conversations.filter(c => c.unreadCount > 0).length} 
                        size="small" 
                        color="error"
                        sx={{ height: 20, minWidth: 20 }}
                      />
                    )}
                  </Box>
                } 
                value="conversations" 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CustomerServiceOutlined />
                    <span>Support & Feedback</span>
                    {supportRequestCount > 0 && (
                      <Chip 
                        label={supportRequestCount} 
                        size="small" 
                        sx={{ height: 20, minWidth: 20 }}
                      />
                    )}
                  </Box>
                } 
                value="support" 
              />
            </Tabs>
          </Box>

          {mainTab === 'conversations' ? (
            // Conversations View
            <Box sx={{ 
              height: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 350px)' }, 
              minHeight: { xs: 400, md: 600 }, 
              display: 'flex',
              position: 'relative'
            }}>
              {/* Conversations Sidebar */}
              <Box sx={{ 
                width: { xs: '100%', md: 350 },
                borderRight: { md: 1 },
                borderColor: 'divider',
                display: { xs: showConversationList ? 'flex' : 'none', md: 'flex' },
                flexDirection: 'column',
                position: { xs: 'absolute', md: 'relative' },
                zIndex: { xs: 10, md: 1 },
                bgcolor: { xs: 'background.paper', md: 'transparent' },
                height: { xs: '100%', md: 'auto' }
              }}>
                {/* Search */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search conversations..."
                    value={conversationSearchQuery}
                    onChange={(e) => setConversationSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined style={{ fontSize: 18 }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Box>

                {/* Conversations List */}
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {loadingConversations ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : filteredConversations.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <MessageOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        {conversationSearchQuery ? 'No conversations found' : 'No conversations yet'}
                      </Typography>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {filteredConversations.map((conversation) => (
                        <ListItem
                          key={conversation.id}
                          disablePadding
                          sx={{
                            bgcolor: selectedConversation?.id === conversation.id ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <ListItemButton onClick={() => handleSelectConversation(conversation)}>
                            <ListItemAvatar>
                              <Badge badgeContent={conversation.unreadCount > 0 ? conversation.unreadCount : 0} color="error">
                                <Avatar sx={{ bgcolor: 'primary.main' }}>
                                  {conversation.title?.charAt(0)?.toUpperCase() || conversation.tenantName?.charAt(0)?.toUpperCase() || '?'}
                                </Avatar>
                              </Badge>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                                    {conversation.title || conversation.tenantName || conversation.landlordName || 'Untitled Conversation'}
                                  </Typography>
                                  {conversation.isPinned && <PushpinOutlined style={{ fontSize: 14, color: '#999' }} />}
                                </Stack>
                              }
                              secondary={
                                <Box component="div" sx={{ mt: 0.5 }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                                      {conversation.lastMessagePreview || 'No messages yet'}
                                    </Typography>
                                    {conversation.lastMessageAt && (
                                      <Typography variant="caption" color="text.secondary">
                                        {formatRelativeTime(conversation.lastMessageAt)}
                                      </Typography>
                                    )}
                                  </Stack>
                                </Box>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Box>

              {/* Chat Area */}
              <Box sx={{ 
                flex: 1, 
                display: { xs: selectedConversation ? 'flex' : 'none', md: 'flex' },
                flexDirection: 'column',
                width: '100%'
              }}>
                {selectedConversation ? (
                  <>
                    {/* Chat Header */}
                    <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {isMobile && (
                        <IconButton
                          onClick={() => {
                            setShowConversationList(true);
                            setSelectedConversation(null);
                          }}
                          size="small"
                        >
                          <ArrowLeftOutlined />
                        </IconButton>
                      )}
                      <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 32, md: 40 }, height: { xs: 32, md: 40 } }}>
                        {selectedConversation.title?.charAt(0)?.toUpperCase() || selectedConversation.tenantName?.charAt(0)?.toUpperCase() || '?'}
                      </Avatar>
                      <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedConversation.title || selectedConversation.tenantName || selectedConversation.landlordName || 'Untitled Conversation'}
                        </Typography>
                        {selectedConversation.propertyName && (
                          <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedConversation.propertyName}
                          </Typography>
                        )}
                      </Stack>
                    </Box>

                    {/* Messages */}
                    <Box
                      ref={messagesContainerRef}
                      sx={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        p: 2,
                        bgcolor: 'grey.50',
                        '&::-webkit-scrollbar': { width: '8px' },
                        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: '4px' }
                      }}
                    >
                      {loadingMessages && selectedConversation?.id && selectedConversation.id !== currentConversationId ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : messageError ? (
                        <Alert severity="error">{messageError}</Alert>
                      ) : messages.length === 0 ? (
                        <Box sx={{ textAlign: 'center', p: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No messages yet. Start the conversation!
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={0.5}>
                          {messages.map((message, index) => {
                            const isOwnMessage = message.senderId === user?.id;
                            const previousMessage = index > 0 ? messages[index - 1] : null;
                            const isConsecutive = previousMessage && previousMessage.senderId === message.senderId;
                            const showAvatar = !isConsecutive;
                            const showSenderName = !isOwnMessage && !isConsecutive;
                            
                            return (
                              <Box
                                key={message.id}
                                sx={{
                                  display: 'flex',
                                  justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                                  mt: isConsecutive ? 0.25 : 1.5
                                }}
                              >
                                <Stack direction="row" spacing={0.5} justifyContent={isOwnMessage ? 'flex-end' : 'flex-start'} sx={{ width: 'fit-content', maxWidth: { xs: '85%', md: '70%' } }}>
                                  {!isOwnMessage && (
                                    <Box sx={{ width: 32, flexShrink: 0, visibility: showAvatar ? 'visible' : 'hidden' }}>
                                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                        {message.senderName?.charAt(0)?.toUpperCase() || '?'}
                                      </Avatar>
                                    </Box>
                                  )}
                                  <Box>
                                    <Paper
                                      elevation={0}
                                      sx={{
                                        p: 1.5,
                                        width: 'fit-content',
                                        maxWidth: '100%',
                                        bgcolor: isOwnMessage ? 'primary.main' : 'background.paper',
                                        color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
                                        borderRadius: 2,
                                        borderTopLeftRadius: isConsecutive ? 2 : (isOwnMessage ? 2 : 0),
                                        borderTopRightRadius: isConsecutive ? 2 : (isOwnMessage ? 0 : 2),
                                        borderBottomLeftRadius: 2,
                                        borderBottomRightRadius: 2
                                      }}
                                    >
                                      {showSenderName && (
                                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>
                                          {message.senderName}
                                        </Typography>
                                      )}
                                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {message.content}
                                      </Typography>
                                      <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                                        {formatMessageTime(message.createdAt)}
                                      </Typography>
                                    </Paper>
                                  </Box>
                                  {isOwnMessage && (
                                    <Box sx={{ width: 32, flexShrink: 0, visibility: showAvatar ? 'visible' : 'hidden' }}>
                                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                        {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                                      </Avatar>
                                    </Box>
                                  )}
                                </Stack>
                              </Box>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </Stack>
                      )}
                    </Box>

                    {/* Message Input */}
                    <Box sx={{ p: { xs: 1.5, md: 2 }, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                      <Paper
                        elevation={0}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 3,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          px: 1,
                          py: 0.5,
                          '&:focus-within': {
                            borderColor: 'primary.main'
                          }
                        }}
                      >
                        <TextField
                          fullWidth
                          multiline
                          maxRows={4}
                          placeholder="Type a message"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={sendingMessage}
                          variant="standard"
                          InputProps={{
                            disableUnderline: true,
                            sx: {
                              fontSize: '0.9375rem',
                              py: 0.5,
                              '& .MuiInputBase-input': {
                                py: 0.5
                              }
                            }
                          }}
                          sx={{
                            flex: 1,
                            '& .MuiInputBase-root': {
                              border: 'none'
                            }
                          }}
                        />
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: 'center' }} />
                        <IconButton
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || sendingMessage}
                          sx={{
                            ml: 0.5,
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'action.hover'
                            },
                            '&.Mui-disabled': {
                              color: 'text.disabled'
                            }
                          }}
                          title="Send"
                        >
                          {sendingMessage ? <CircularProgress size={20} /> : <SendOutlined style={{ fontSize: 18 }} />}
                        </IconButton>
                      </Paper>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Stack spacing={2} alignItems="center">
                      <MessageOutlined style={{ fontSize: 64, color: '#ccc' }} />
                      <Typography variant="h6" color="text.secondary">
                        Select a conversation to start messaging
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Box>
              
              {/* Mobile: Show conversation list toggle when no conversation selected */}
              {isMobile && !selectedConversation && !showConversationList && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<MenuOutlined />}
                    onClick={() => setShowConversationList(true)}
                  >
                    View Conversations
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <AdminSupportWorkspace onCountChange={setSupportRequestCount} />
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}

