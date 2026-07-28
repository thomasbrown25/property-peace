import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

// material-ui
import { Badge } from '@mui/material';
import { Box } from '@mui/material';
import { Tooltip } from '@mui/material';

// project imports
import IconButton from 'components/@extended/IconButton';
import { getConversations } from 'store/conversation/conversation.action';
import { CONVERSATION_ACTION_TYPES } from 'store/conversation/conversation.types';
import { selectConversations } from 'store/conversation/conversation.selector';
import useIsAdmin from 'hooks/useIsAdmin';
import useAuth from 'hooks/useAuth';
import useSignalRConversations from 'hooks/useSignalRConversations';
import axiosServices from 'utils/axios';

// assets
import CommentOutlined from '@ant-design/icons/CommentOutlined';
import CustomerServiceOutlined from '@ant-design/icons/CustomerServiceOutlined';

// ==============================|| HEADER CONTENT - MESSAGES ||============================== //

export default function Message() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  
  // Redux state
  const conversations = useSelector(selectConversations);
  
  // SignalR for real-time updates
  const { isConnected, onConversationUpdate, onMessageUpdate } = useSignalRConversations();
  
  // Determine if user is tenant
  const userRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  const normalizedRoles = userRoles.map((r) => String(r).toLowerCase().trim());
  const isTenant = normalizedRoles.includes('tenant');
  
  // Determine base path based on user role
  const basePath = isAdmin ? '/admin' : isTenant ? '/tenant' : '/landlord';

  const handleClick = () => {
    navigate(`${basePath}/messages`);
  };

  // Load conversations function
  const loadConversations = useCallback(() => {
    if (isTenant) {
      // For tenants, conversations are optional - only load existing conversations.
      // Use the plural endpoint so the header unread badge reflects every tenant conversation,
      // not just the first/default tenant-landlord conversation.
      const loadTenantConversation = async () => {
        try {
          dispatch({ type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_START });
          const response = await axiosServices.get('/api/Conversation/tenant/my-conversations');
          
          if (response.data && response.data.success) {
            dispatch({
              type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS,
              payload: response.data.data || []
            });
          } else {
            // No conversation exists yet, return empty array (non-fatal for tenants)
            dispatch({
              type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS,
              payload: []
            });
          }
        } catch (error) {
          // For tenants, conversation errors are non-fatal - they might not have a lease yet
          // Check if it's a "no conversation" or "no lease" error
          const actualError = error?.response || error;
          const responseData = actualError?.data || error || {};
          const status = actualError?.status || responseData?.status || error?.status;
          const is404 = status === 404 || status === '404';
          const is400 = status === 400 || status === '400';
          
          const errorMessage = responseData?.message || error?.message || '';
          const errorDetails = responseData?.errors?.details || responseData?.details || '';
          const errorErrorsMessage = responseData?.errors?.message || '';
          const errorText = `${errorMessage} ${errorDetails} ${errorErrorsMessage}`.toLowerCase();
          
          // Treat 404, 400, or "no conversation" messages as "no conversation" (non-fatal)
          const isNoConversationError = is404 || is400 || 
                                        errorText.includes('no conversation') ||
                                        errorText.includes('no active lease') ||
                                        errorText.includes('lease not found');
          
          if (isNoConversationError) {
            // No conversation exists - this is OK for tenants without a lease
            dispatch({
              type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS,
              payload: []
            });
          } else {
            // Real error - but still don't fail completely, just log it
            dispatch({
              type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS,
              payload: []
            });
          }
        }
      };
      
      loadTenantConversation();
    } else {
      // For landlords/admins, use the regular endpoint
      dispatch(getConversations(false)); // Exclude archived
    }
  }, [dispatch, isTenant]);

  // Load conversations on mount to get unread count
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Listen for real-time conversation updates via SignalR
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onConversationUpdate((conversation) => {
      // Refresh conversations list to update unread count
      loadConversations();
    });

    return unsubscribe;
  }, [isConnected, onConversationUpdate, loadConversations]);

  // Listen for real-time message updates via SignalR
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onMessageUpdate((message) => {
      // When a new message arrives, refresh conversations to update unread count
      loadConversations();
    });

    return unsubscribe;
  }, [isConnected, onMessageUpdate, loadConversations]);

  // Calculate unread count - handle both camelCase and PascalCase
  const unreadCount = conversations.reduce((sum, conv) => {
    const count = conv.unreadCount ?? conv.UnreadCount ?? 0;
    return sum + count;
  }, 0);


  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <Tooltip title={isAdmin ? "Support" : "Messages"}>
        <IconButton
          color="secondary"
          sx={(theme) => ({
            color: 'text.primary',
            transition: theme.transitions.create(['background-color', 'box-shadow'], {
              duration: theme.transitions.duration.shorter
            }),
            '&:hover': {
              bgcolor: 'action.hover',
              boxShadow: 'none'
            },
            ...theme.applyStyles('dark', { '&:hover': { bgcolor: 'action.hover' } })
          })}
          aria-label={isAdmin ? "open support" : "open messages"}
          onClick={handleClick}
        >
          <Badge badgeContent={unreadCount > 0 ? unreadCount : 0} color="primary" max={99} showZero={false}>
            {isAdmin ? <CustomerServiceOutlined /> : <CommentOutlined />}
          </Badge>
        </IconButton>
      </Tooltip>
    </Box>
  );
}
