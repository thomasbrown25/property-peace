import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Checkbox,
  Button,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';

// Icons
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import CustomerServiceOutlined from '@ant-design/icons/CustomerServiceOutlined';
import BulbOutlined from '@ant-design/icons/BulbOutlined';
import StarOutlined from '@ant-design/icons/StarOutlined';
import StarFilled from '@ant-design/icons/StarFilled';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined';
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

// ==============================|| ADMIN MESSAGES PAGE ||============================== //

export default function AdminMessages() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Main tab: 'support' or 'conversations'
  const [mainTab, setMainTab] = useState('conversations');
  
  // Mobile state for conversations
  const [showConversationList, setShowConversationList] = useState(!isMobile);

  // Support/Feedback state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'support', 'feedback', 'favorites'
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [supportAndFeedbackItems, setSupportAndFeedbackItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

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

  // Load support and feedback requests from SupportAndFeedbacks table
  const loadSupportAndFeedback = useCallback(async () => {
    try {
      setLoadingItems(true);
      // Build query params based on filter
      const params = new URLSearchParams();
      if (filterType === 'support') {
        params.append('type', '0'); // ESupportAndFeedbackType.Support
      } else if (filterType === 'feedback') {
        params.append('type', '1'); // ESupportAndFeedbackType.Feedback
      } else if (filterType === 'favorites') {
        params.append('isFavorite', 'true');
      }
      
      const url = `/api/admin/support-and-feedback${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axiosServices.get(url);
      console.log('Admin support and feedback response:', response.data);
      
      if (response.data?.success && response.data?.data) {
        setSupportAndFeedbackItems(response.data.data);
        console.log('Loaded support and feedback items:', response.data.data.length);
      } else {
        console.warn('Unexpected response format:', response.data);
        if (response.data?.data && Array.isArray(response.data.data)) {
          setSupportAndFeedbackItems(response.data.data);
        }
      }
    } catch (err) {
      console.error('Error loading support and feedback:', err);
      console.error('Error details:', err.response?.data || err.message);
    } finally {
      setLoadingItems(false);
    }
  }, [filterType]);
  
  useEffect(() => {
    loadSupportAndFeedback();
  }, [loadSupportAndFeedback]);


  // Determine request type from SupportAndFeedback type enum
  // Handle both number (0/1) and string ("support"/"feedback") enum values
  const getRequestType = (type) => {
    // Handle number enum values
    if (type === 0 || type === '0') return 'support';
    if (type === 1 || type === '1') return 'feedback';
    // Handle string enum values (camelCase from JSON serialization)
    if (typeof type === 'string') {
      const lowerType = type.toLowerCase();
      if (lowerType === 'support') return 'support';
      if (lowerType === 'feedback') return 'feedback';
    }
    return null;
  };

  // Calculate counts for tabs (need to load all items for accurate counts)
  const [allItems, setAllItems] = useState([]);
  
  // Load all items for counts
  useEffect(() => {
    const loadAllItems = async () => {
      try {
        const response = await axiosServices.get('/api/admin/support-and-feedback');
        if (response.data?.success && response.data?.data) {
          setAllItems(response.data.data);
        }
      } catch (err) {
        console.error('Error loading all items for counts:', err);
      }
    };
    loadAllItems();
  }, []);

  const allCount = allItems.length;
  // Handle both number (0/1) and string ("support"/"feedback") enum values
  const supportCount = allItems.filter(item => {
    const type = item.type;
    return type === 0 || type === '0' || (typeof type === 'string' && type.toLowerCase() === 'support');
  }).length;
  const feedbackCount = allItems.filter(item => {
    const type = item.type;
    return type === 1 || type === '1' || (typeof type === 'string' && type.toLowerCase() === 'feedback');
  }).length;
  const favoritesCount = allItems.filter(item => item.isFavorite).length;

  // Filter support and feedback items by search (type filtering is done server-side)
  const filteredItems = supportAndFeedbackItems.filter((item) => {
    // Filter by search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.subject?.toLowerCase().includes(query) ||
      item.message?.toLowerCase().includes(query) ||
      item.userName?.toLowerCase().includes(query) ||
      item.userEmail?.toLowerCase().includes(query)
    );
  });

  // Handle item selection
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setViewMode('detail');
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (item, e) => {
    e.stopPropagation();
    try {
      const newFavoriteStatus = !item.isFavorite;
      console.log('Toggling favorite for item:', item.id, 'New status:', newFavoriteStatus);
      
      const response = await axiosServices.put(`/api/admin/support-and-feedback/${item.id}/favorite`, {
        IsFavorite: newFavoriteStatus
      });
      console.log('Favorite toggle response:', response.data);
      
      // Update local state
      const updatedItems = supportAndFeedbackItems.map(i => 
        i.id === item.id ? { ...i, isFavorite: newFavoriteStatus } : i
      );
      setSupportAndFeedbackItems(updatedItems);
      
      // Update selected item if it's the same
      if (selectedItem?.id === item.id) {
        setSelectedItem({ ...selectedItem, isFavorite: newFavoriteStatus });
      }
      
      // Update all items for counts
      const updatedAllItems = allItems.map(i => 
        i.id === item.id ? { ...i, isFavorite: newFavoriteStatus } : i
      );
      setAllItems(updatedAllItems);
    } catch (err) {
      console.error('Error toggling favorite:', err);
      console.error('Error details:', err.response?.data || err.message);
    }
  };

  // Handle resolve toggle
  const handleToggleResolve = async (item, e) => {
    e.stopPropagation();
    try {
      const newResolvedStatus = !item.isResolved;
      console.log('Toggling resolve for item:', item.id, 'New status:', newResolvedStatus);
      
      const response = await axiosServices.put(`/api/admin/support-and-feedback/${item.id}/resolve`, newResolvedStatus);
      console.log('Resolve toggle response:', response.data);
      
      // Update local state
      const updatedItems = supportAndFeedbackItems.map(i => 
        i.id === item.id ? { ...i, isResolved: newResolvedStatus } : i
      );
      setSupportAndFeedbackItems(updatedItems);
      
      // Update selected item if it's the same
      if (selectedItem?.id === item.id) {
        setSelectedItem({ ...selectedItem, isResolved: newResolvedStatus });
      }
      
      // Update all items for counts
      const updatedAllItems = allItems.map(i => 
        i.id === item.id ? { ...i, isResolved: newResolvedStatus } : i
      );
      setAllItems(updatedAllItems);
    } catch (err) {
      console.error('Error toggling resolve:', err);
      console.error('Error details:', err.response?.data || err.message);
    }
  };

  useEffect(() => {
    loadSupportAndFeedback();
  }, [filterType]);

  // Load conversations for admin
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

    try {
      setSendingMessage(true);

      const result = await dispatch(
        addMessage({
          conversationId: selectedConversation.id,
          content: messageInput.trim()
        })
      );

      if (result.success) {
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
                setSelectedItem(null);
                setViewMode('list');
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
                    {allCount > 0 && (
                      <Chip 
                        label={allCount} 
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
            // Support & Feedback View (existing code)
            <>
              {viewMode === 'list' ? (
            // Gmail-style List View
            <Box sx={{ height: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 250px)' }, minHeight: { xs: 400, md: 600 }, display: 'flex', flexDirection: 'column' }}>
              {/* Search Bar */}
              <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search mail"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined />
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              {/* Filter Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={filterType}
                  onChange={(e, newValue) => setFilterType(newValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>All</span>
                        <Chip 
                          label={allCount} 
                          size="small" 
                          sx={{ height: 20, minWidth: 20 }}
                        />
                      </Box>
                    } 
                    value="all" 
                  />
                  <Tab 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CustomerServiceOutlined />
                        <span>Support</span>
                        <Chip 
                          label={supportCount} 
                          size="small" 
                          sx={{ height: 20, minWidth: 20 }}
                        />
                      </Box>
                    } 
                    value="support" 
                  />
                  <Tab 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BulbOutlined />
                        <span>Feedback</span>
                        <Chip 
                          label={feedbackCount} 
                          size="small" 
                          sx={{ height: 20, minWidth: 20 }}
                        />
                      </Box>
                    } 
                    value="feedback" 
                  />
                  <Tab 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StarFilled style={{ fontSize: 16, color: '#ffa500' }} />
                        <span>Favorites</span>
                        <Chip 
                          label={favoritesCount} 
                          size="small" 
                          sx={{ height: 20, minWidth: 20 }}
                        />
                      </Box>
                    } 
                    value="favorites" 
                  />
                </Tabs>
              </Box>

              {/* Messages List - Gmail Style */}
              <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.paper' }}>
                {loadingItems ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : filteredItems.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <MessageOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      No support or feedback requests found
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {filteredItems.map((item) => {
                      const requestType = getRequestType(item.type);
                      const isSelected = selectedItem?.id === item.id;
                      const isUnread = !item.isResolved;
                      
                      return (
                        <ListItem
                          key={item.id}
                          disablePadding
                          sx={{
                            borderBottom: 1,
                            borderColor: 'divider',
                            bgcolor: isSelected ? 'action.selected' : 'transparent',
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                        >
                          <ListItemButton
                            onClick={() => handleItemClick(item)}
                            sx={{
                              py: { xs: 1, md: 1.5 },
                              px: { xs: 1, md: 2 },
                              alignItems: 'flex-start'
                            }}
                          >
                            {/* Checkbox - Hide on mobile */}
                            <Checkbox
                              size="small"
                              sx={{ 
                                mr: 1, 
                                mt: 0.5,
                                display: { xs: 'none', md: 'block' }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />

                            {/* Star Icon - Favorite Toggle */}
                            <IconButton
                              size="small"
                              sx={{ 
                                mr: { xs: 0.5, md: 1 }, 
                                mt: 0.5,
                                zIndex: 10,
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                              onClick={(e) => handleToggleFavorite(item, e)}
                              color={item.isFavorite ? 'warning' : 'default'}
                              title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {item.isFavorite ? (
                                <StarFilled style={{ fontSize: 18, color: '#ffa500' }} />
                              ) : (
                                <StarOutlined style={{ fontSize: 18 }} />
                              )}
                            </IconButton>

                            {/* Resolve/Unresolve Icon */}
                            <IconButton
                              size="small"
                              sx={{ 
                                mr: { xs: 0.5, md: 1 }, 
                                mt: 0.5,
                                zIndex: 10,
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                              onClick={(e) => handleToggleResolve(item, e)}
                              color={item.isResolved ? 'success' : 'default'}
                              title={item.isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                            >
                              {item.isResolved ? (
                                <CheckCircleOutlined style={{ fontSize: 18, color: '#4caf50' }} />
                              ) : (
                                <CloseCircleOutlined style={{ fontSize: 18 }} />
                              )}
                            </IconButton>

                            {/* Avatar */}
                            <Avatar
                              sx={{
                                width: { xs: 32, md: 40 },
                                height: { xs: 32, md: 40 },
                                mr: { xs: 1, md: 2 },
                                bgcolor: requestType === 'support' ? 'primary.main' : requestType === 'feedback' ? 'secondary.main' : 'grey.500'
                              }}
                            >
                              {requestType === 'support' ? (
                                <CustomerServiceOutlined />
                              ) : requestType === 'feedback' ? (
                                <BulbOutlined />
                              ) : (
                                <MessageOutlined />
                              )}
                            </Avatar>

                            {/* Message Content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack 
                                direction={{ xs: 'column', md: 'row' }} 
                                spacing={{ xs: 0.5, md: 1 }} 
                                alignItems={{ xs: 'flex-start', md: 'center' }} 
                                sx={{ mb: 0.5 }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: isUnread ? 600 : 400,
                                    color: isUnread ? 'text.primary' : 'text.secondary',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: { xs: '0.875rem', md: '0.9375rem' }
                                  }}
                                >
                                  {item.userName || item.userEmail || 'Unknown'}
                                </Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                  {requestType && (
                                    <Chip
                                      label={requestType === 'support' ? 'Support' : 'Feedback'}
                                      size="small"
                                      color={requestType === 'support' ? 'primary' : 'secondary'}
                                      sx={{ 
                                        height: { xs: 18, md: 20 }, 
                                        fontSize: { xs: '0.65rem', md: '0.7rem' },
                                        display: { xs: 'none', sm: 'flex' }
                                      }}
                                    />
                                  )}
                                  <Chip
                                    label={item.isResolved ? 'Resolved' : 'Open'}
                                    size="small"
                                    color={item.isResolved ? 'success' : 'warning'}
                                    sx={{ 
                                      height: { xs: 18, md: 20 }, 
                                      fontSize: { xs: '0.65rem', md: '0.7rem' }, 
                                      fontWeight: item.isResolved ? 400 : 600 
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ 
                                      ml: { xs: 0, md: 'auto' },
                                      flexShrink: 0,
                                      fontSize: { xs: '0.7rem', md: '0.75rem' }
                                    }}
                                  >
                                    {formatRelativeTime(item.createdAt)}
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: isUnread ? 500 : 400,
                                  color: 'text.secondary',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  mb: 0.5
                                }}
                              >
                                {item.subject}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block'
                                }}
                              >
                                {item.message?.substring(0, 100) || 'No message'}
                                {item.message && item.message.length > 100 ? '...' : ''}
                              </Typography>
                            </Box>
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            </Box>
          ) : (
              // Detail View (when item is selected)
            <Box sx={{ height: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 250px)' }, minHeight: { xs: 400, md: 600 }, display: 'flex', flexDirection: 'column' }}>
              {/* Back Button and Header */}
              <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
                <IconButton onClick={() => setViewMode('list')} size={isMobile ? 'medium' : 'large'}>
                  <ArrowLeftOutlined />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">{selectedItem?.subject}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    From: {selectedItem?.userName || selectedItem?.userEmail || 'Unknown'}
                  </Typography>
                </Box>
                {selectedItem && (
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={getRequestType(selectedItem.type) === 'support' ? 'Support' : 'Feedback'}
                      size="small"
                      color={getRequestType(selectedItem.type) === 'support' ? 'primary' : 'secondary'}
                    />
                    {selectedItem.isResolved && (
                      <Chip
                        label="Resolved"
                        size="small"
                        color="success"
                      />
                    )}
                  </Stack>
                )}
              </Box>

              {/* Message Content */}
              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 3,
                  bgcolor: 'grey.50'
                }}
              >
                {selectedItem ? (
                  <Stack spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Message
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                        {selectedItem.message}
                      </Typography>

                      <Divider sx={{ my: 2 }} />

                      <Stack direction="row" spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Submitted
                          </Typography>
                          <Typography variant="body2">
                            {formatRelativeTime(selectedItem.createdAt)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Status
                          </Typography>
                          <Typography variant="body2">
                            {selectedItem.isResolved ? 'Resolved' : 'Open'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No item selected
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Action Buttons */}
              {selectedItem && (
                <Box sx={{ 
                  p: { xs: 1.5, md: 2 }, 
                  borderTop: 1, 
                  borderColor: 'divider', 
                  bgcolor: 'background.paper', 
                  display: 'flex', 
                  gap: { xs: 1, md: 2 }, 
                  justifyContent: 'flex-end', 
                  alignItems: 'center',
                  flexWrap: { xs: 'wrap', md: 'nowrap' }
                }}>
                  <IconButton
                    onClick={async () => {
                      try {
                        const newFavoriteStatus = !selectedItem.isFavorite;
                        await axiosServices.put(`/api/admin/support-and-feedback/${selectedItem.id}/favorite`, {
                          IsFavorite: newFavoriteStatus
                        });
                        await loadSupportAndFeedback();
                        setSelectedItem({ ...selectedItem, isFavorite: newFavoriteStatus });
                      } catch (err) {
                        console.error('Error toggling favorite:', err);
                      }
                    }}
                    color={selectedItem.isFavorite ? 'warning' : 'default'}
                    title={selectedItem.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    {selectedItem.isFavorite ? (
                      <StarFilled style={{ fontSize: 24, color: '#ffa500' }} />
                    ) : (
                      <StarOutlined style={{ fontSize: 24 }} />
                    )}
                  </IconButton>
                  <Button
                    variant={selectedItem.isResolved ? 'outlined' : 'contained'}
                    color={selectedItem.isResolved ? 'warning' : 'success'}
                    startIcon={selectedItem.isResolved ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                    size={isMobile ? 'small' : 'medium'}
                    onClick={async () => {
                      try {
                        const newResolvedStatus = !selectedItem.isResolved;
                        await axiosServices.put(`/api/admin/support-and-feedback/${selectedItem.id}/resolve`, newResolvedStatus);
                        await loadSupportAndFeedback();
                        setSelectedItem({ ...selectedItem, isResolved: newResolvedStatus });
                      } catch (err) {
                        console.error('Error updating resolved status:', err);
                      }
                    }}
                    sx={{ flex: { xs: '1 1 100%', md: '0 0 auto' } }}
                  >
                    {selectedItem.isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
            </>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}

