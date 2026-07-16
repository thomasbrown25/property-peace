import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { alpha, CardContent, Box, Alert, IconButton, Tooltip, keyframes } from '@mui/material';
import { Grid } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import { formatRelativeTime } from 'utils/formatters';
import { conversationAPI } from 'api';
import CircularLoader from 'components/CircularLoader';
import useSignalRConversations from 'hooks/useSignalRConversations';
import AnimateItem from 'components/AnimateItem';

// assets
import CloseOutlined from '@ant-design/icons/CloseOutlined';

// ==============================|| URGENT MESSAGES CARD ||============================== //

// Slow pulsing animation for urgent items - creates a subtle glow effect
const createPulseAnimation = (color) => keyframes`
  0% {
    box-shadow: 0 0 0 0 ${alpha(color, 0.4)};
  }
  50% {
    box-shadow: 0 0 0 6px ${alpha(color, 0)};
  }
  100% {
    box-shadow: 0 0 0 0 ${alpha(color, 0)};
  }
`;

// Severity color mapping (used for card border/background)
const getSeverityColor = (severity) => {
  const severityMap = {
    high: 'error',
    medium: 'warning',
    low: 'info',
    default: 'default'
  };
  return severityMap[severity?.toLowerCase()] || severityMap.default;
};

export default function UrgentMessages() {
  const navigate = useNavigate();
  const { isConnected, onConversationUpdate, onMessageUpdate } = useSignalRConversations();
  const [urgentMessages, setUrgentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUrgentMessages = async (isInitial = false) => {
    try {
      // Only show loading spinner on initial load, not on background refreshes
      if (isInitial) {
        setLoading(true);
      }
      setError(null);
      const response = await conversationAPI.getAllUrgentMessageDetails();
      if (response?.success && response?.data) {
        setUrgentMessages(response.data);
      } else {
        setUrgentMessages([]);
      }
    } catch (err) {
      console.error('Error loading urgent messages:', err);
      // Only set error on initial load to avoid flickering
      if (isInitial) {
        setError('Failed to load urgent messages');
      }
      setUrgentMessages([]);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    loadUrgentMessages(true);
  }, []);

  // Listen for real-time updates via SignalR
  useEffect(() => {
    if (!isConnected) return;

    // Refresh urgent messages when conversation is updated (could have new urgent items)
    const unsubscribeConversation = onConversationUpdate(() => {
      loadUrgentMessages(false);
    });

    // Refresh urgent messages when new message is received (could trigger urgent item detection)
    const unsubscribeMessage = onMessageUpdate(() => {
      loadUrgentMessages(false);
    });

    return () => {
      unsubscribeConversation();
      unsubscribeMessage();
    };
  }, [isConnected, onConversationUpdate, onMessageUpdate]);

  // Transform urgent message details to the format needed for display
  const allUrgentItems = useMemo(() => {
    return urgentMessages.map((message) => {
      const urgentItem = message.urgentItem || {};
      const itemId = urgentItem.id || `msg-${message.messageId}`;
      
      // Build conversation title
      const conversationTitle = message.tenantName 
        ? `Conversation with ${message.tenantName}`
        : 'Conversation';
      
      return {
        id: itemId,
        conversationId: message.conversationId,
        conversationTitle: conversationTitle,
        tenantName: message.tenantName,
        propertyName: message.propertyName,
        unitName: message.unitName,
        isMultiUnitProperty: message.isMultiUnitProperty,
        // Use the actual tenant message content (not AI follow-up messages)
        lastMessagePreview: message.messageContent || urgentItem.messageExcerpt || '',
        detectedAt: message.messageCreatedAt,
        type: urgentItem.type,
        severity: urgentItem.severity,
        description: urgentItem.description || 'Urgent item requires attention',
        messageId: message.messageId
      };
    });
  }, [urgentMessages]);

  const handleUrgentItemClick = () => {
    navigate('/landlord/urgent-messages');
  };

  const handleDismissUrgentItem = async (e, item) => {
    e.stopPropagation(); // Prevent navigation when clicking dismiss
    try {
      const response = await conversationAPI.clearUrgentItems(
        item.conversationId, 
        item.id,
        item.messageId
      );
      if (response?.success) {
        // Reload urgent messages to reflect the change
        await loadUrgentMessages();
      }
    } catch (error) {
      console.error('Error dismissing urgent item:', error);
    }
  };

  // Determine shadow color based on whether there are urgent messages
  const hasUrgentMessages = allUrgentItems.length > 0;
  const shadowColor = hasUrgentMessages ? 'error' : 'primary';

  return (
    <MainCard
      title="Urgent Tenant Messages"
      sx={{
        height: '100%'
      }}
      content={false}
      secondary={
        <Link 
          component="button" 
          onClick={() => navigate('/landlord/urgent-messages')} 
          color="primary"
          sx={{ 
            cursor: 'pointer', 
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          View all
        </Link>
      }
    >
      <CardContent
        sx={{
          maxHeight: '400px',
          overflowY: 'auto',
          px: 2,
          py: 1.5
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '200px' }}>
            <CircularLoader />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : allUrgentItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4, fontSize: '0.875rem' }}>
            No urgent items found. All conversations are up to date.
          </Typography>
        ) : (
          <Grid container spacing={1.5}>
            {allUrgentItems.slice(0, 3).map((item, index) => {
              const severityColor = getSeverityColor(item.severity);
              const displayTime = item.detectedAt ? formatRelativeTime(new Date(item.detectedAt)) : 'Recently';
              
              // Ensure unique key - use conversationId and index as fallback
              const uniqueKey = item.id || `conv-${item.conversationId}-item-${index}`;

              return (
                <Grid size={12} key={uniqueKey}>
                  <AnimateItem delay={index * 50} direction="right">
                    <Box
                    onClick={handleUrgentItemClick}
                    sx={(theme) => {
                      const color = theme.palette[severityColor]?.main || theme.palette.error.main;
                      const pulseAnimation = createPulseAnimation(color);
                      return {
                        p: 1.5,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(color, 0.2)}`,
                        bgcolor: alpha(color, 0.04),
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        // Slow pulsing animation for urgent items (3 second duration)
                        animation: `${pulseAnimation} 2s ease-in-out infinite`,
                        '&:hover': {
                          bgcolor: alpha(color, 0.08),
                          borderColor: alpha(color, 0.4),
                          transform: 'translateY(-1px)',
                          boxShadow: `0 2px 8px ${alpha(color, 0.15)}`,
                          animation: 'none' // Stop pulsing on hover
                        }
                      };
                    }}
                  >
                    <Grid container spacing={1} alignItems="flex-start">
                      <Grid size="grow">
                        <Box>
                          {/* Property/Unit Info */}
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            {item.propertyName || 'Property'}
                            {item.isMultiUnitProperty && item.unitName && ` • ${item.unitName}`}
                          </Typography>
                          
                          {/* Tenant Name */}
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {item.tenantName || 'Tenant'}
                          </Typography>
                          
                          {/* Summary/Description */}
                          <Typography variant="body2" color="text.secondary">
                            {item.description || 'Urgent item requires attention'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size="auto" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, pt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {displayTime}
                        </Typography>
                        <Tooltip title="Dismiss this urgent item">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDismissUrgentItem(e, item)}
                            sx={{
                              width: 20,
                              height: 20,
                              color: 'text.secondary',
                              '&:hover': {
                                color: 'error.main',
                                bgcolor: 'error.light'
                              }
                            }}
                          >
                            <CloseOutlined style={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                    </Grid>
                    </Box>
                  </AnimateItem>
                </Grid>
              );
            })}
          </Grid>
        )}
      </CardContent>
    </MainCard>
  );
}

