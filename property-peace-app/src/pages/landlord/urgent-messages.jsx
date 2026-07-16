import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

// Material-UI
import {
  Box,
  Grid,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
  alpha
} from '@mui/material';

// Icons
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import ArrowRightOutlined from '@ant-design/icons/ArrowRightOutlined';

// Project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { formatMessageTime } from 'utils/formatters';
import { conversationAPI } from 'api';
import { getConversations } from 'store/conversation/conversation.action';
import { openSnackbar } from 'api/snackbar';
import { useDrawer } from 'contexts/DrawerContext';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import { createMaintenanceFromUrgent } from 'services/copilotActions';
import useFetchProperties from 'hooks/useFetchProperties';

// Severity color mapping
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
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const { properties } = useFetchProperties();
  
  const [urgentMessages, setUrgentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearingIds, setClearingIds] = useState(new Set());

  const loadUrgentMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await conversationAPI.getAllUrgentMessageDetails();
      if (response?.success && response?.data) {
        setUrgentMessages(response.data);
      } else {
        setUrgentMessages([]);
      }
    } catch (err) {
      console.error('Error loading urgent messages:', err);
      setError('Failed to load urgent messages');
      setUrgentMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUrgentMessages();
  }, [loadUrgentMessages]);

  const handleClearUrgency = async (message) => {
    if (clearingIds.has(message.messageId)) return;

    try {
      setClearingIds(prev => new Set(prev).add(message.messageId));
      
      const response = await conversationAPI.clearUrgentItems(
        message.conversationId,
        message.urgentItem?.id || '',
        message.messageId
      );

      if (response?.success) {
        openSnackbar({
          open: true,
          message: 'Urgency cleared for this message',
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Reload urgent messages and conversations
        await loadUrgentMessages();
        dispatch(getConversations(false));
      } else {
        openSnackbar({
          open: true,
          message: response?.message || 'Failed to clear urgency',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      console.error('Error clearing urgency:', err);
      openSnackbar({
        open: true,
        message: 'Failed to clear urgency',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setClearingIds(prev => {
        const next = new Set(prev);
        next.delete(message.messageId);
        return next;
      });
    }
  };

  const handleViewMessage = (conversationId) => {
    navigate(`/landlord/messages?conversation=${conversationId}`);
  };

  const getPropertyDisplay = (message) => {
    if (!message.propertyName) return 'N/A';
    if (message.isMultiUnitProperty && message.unitName) {
      return `${message.propertyName} / ${message.unitName}`;
    }
    return message.propertyName;
  };

  const handleRecommendedAction = async (e, message) => {
    e.stopPropagation(); // Prevent row click navigation
    
    const action = message.recommendedAction?.toLowerCase() || '';
    const urgentItem = message.urgentItem;

    if (action.includes('maintenance')) {
      // Use the same logic as dashboard - createMaintenanceFromUrgent
      try {
        // Get property info from message, or look it up from lease if missing
        let propertyId = message.propertyId || message.PropertyId;
        let propertyName = message.propertyName || message.PropertyName;
        let unitName = message.unitName || message.UnitName;
        let unitId = null;
        const leaseId = message.leaseId || message.LeaseId;
        
        // If property info is missing but we have a leaseId, try to find it from properties
        if ((!propertyId || !propertyName) && leaseId && properties && properties.length > 0) {
          for (const property of properties) {
            if (property.units) {
              for (const unit of property.units) {
                if (unit.lease && unit.lease.id === leaseId) {
                  propertyId = property.id;
                  propertyName = property.name;
                  if (!unitName) {
                    unitName = unit.name;
                  }
                  unitId = unit.id;
                  break;
                }
              }
              if (propertyId) break;
            }
          }
        }
        
        // Format the message to match the structure expected by createMaintenanceFromUrgent
        // Handle both camelCase and PascalCase property names from API
        const urgentMessage = {
          conversationId: message.conversationId,
          propertyName: propertyName,
          propertyId: propertyId,
          unitName: unitName,
          unitId: unitId, // Include unitId if we found it
          leaseId: leaseId, // Include leaseId for potential unitId lookup
          title: message.messageContent?.substring(0, 100) || 'Urgent Message',
          aiSummary: message.messageContent,
          tenantName: message.tenantName || message.TenantName,
          messageId: message.messageId || message.MessageId // Include messageId for suppression
        };
        
        console.log('[UrgentMessages] Urgent message data:', {
          originalMessage: message,
          formattedUrgentMessage: urgentMessage,
          foundFromLease: !!(leaseId && propertyId && !message.propertyId)
        });

        const result = await createMaintenanceFromUrgent({
          urgentMessage,
          urgentItem,
          onUrgencyCleared: loadUrgentMessages,
          onDashboardRefresh: () => {
            // Refresh conversations list if needed
            dispatch(getConversations(false));
          }
        });

        if (result.success && result.data?.action === 'openMaintenanceDrawer') {
          // Open the drawer with the pre-filled initial values
          // Ensure propertyId, unitName, and messageId are included from the urgent message
          // Use the formatted urgentMessage values which handle both camelCase and PascalCase
          const initialValues = {
            ...result.data.initialValues,
            propertyId: urgentMessage.propertyId || result.data.initialValues.propertyId,
            propertyName: urgentMessage.propertyName || result.data.initialValues.propertyName,
            unitName: urgentMessage.unitName || result.data.initialValues.unitName,
            unitId: urgentMessage.unitId || result.data.initialValues.unitId, // Use unitId from lease lookup if available
            messageId: urgentMessage.messageId || result.data.initialValues.messageId
          };
          
          console.log('[UrgentMessages] Opening maintenance drawer with initialValues:', {
            propertyId: initialValues.propertyId,
            propertyName: initialValues.propertyName,
            unitName: initialValues.unitName,
            unitId: initialValues.unitId,
            messagePropertyId: urgentMessage.propertyId,
            messagePropertyName: urgentMessage.propertyName,
            messageUnitName: urgentMessage.unitName,
            originalMessagePropertyId: message.propertyId || message.PropertyId,
            originalMessagePropertyName: message.propertyName || message.PropertyName,
            originalMessageUnitName: message.unitName || message.UnitName
          });
          
          drawer.openMaintenanceAddDrawer(initialValues);
        } else {
          openSnackbar({
            open: true,
            message: result.message || 'Failed to prepare maintenance request',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error creating maintenance from urgent:', error);
        openSnackbar({
          open: true,
          message: 'Failed to prepare maintenance request',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } else if (action.includes('payment')) {
      // Navigate to rent collection page
      if (message.leaseId) {
        navigate(`/landlord/leases/${message.leaseId}`);
      } else if (message.propertyId) {
        navigate(`/landlord/rent-collection/${message.propertyId}`);
      } else {
        navigate('/landlord/rent-collection');
      }
    } else if (action.includes('lease')) {
      // Navigate to lease page
      if (message.leaseId) {
        navigate(`/landlord/leases/${message.leaseId}`);
      } else {
        navigate('/landlord/leases');
      }
    } else {
      // Default: Navigate to conversation
      navigate(`/landlord/messages?conversation=${message.conversationId}`);
    }
  };

  const getActionIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('maintenance')) {
      return ToolOutlined;
    } else if (actionLower.includes('payment')) {
      return DollarOutlined;
    } else if (actionLower.includes('lease')) {
      return FileTextOutlined;
    }
    return ArrowRightOutlined;
  };

  const getActionTooltip = (action) => {
    return action || 'Review message and respond';
  };

  return (
    <MainCard>
      {/* Breadcrumbs */}
      <Box sx={{ p: 2, pb: 0 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Urgent Messages' }
          ]}
        />
      </Box>

      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          All Urgent Messages
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : urgentMessages.length === 0 ? (
          <Alert severity="info">
            No urgent messages found. All conversations are up to date.
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Property / Unit</TableCell>
                  <TableCell>Date / Time</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Recommended Action</TableCell>
                  <TableCell align="right">Clear Urgency</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {urgentMessages.map((message, index) => {
                  const severityColor = getSeverityColor(message.urgentItem?.severity);
                  const isClearing = clearingIds.has(message.messageId);
                  
                  // Ensure unique key - use messageId and urgentItem id, with index as fallback
                  const uniqueKey = message.messageId 
                    ? `${message.messageId}-${message.urgentItem?.id || 'no-item'}` 
                    : `msg-${index}-${message.conversationId}`;

                  return (
                    <TableRow
                      key={uniqueKey}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette[severityColor]?.main || t.palette.error.main, 0.05)
                        }
                      }}
                      onClick={() => handleViewMessage(message.conversationId)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {getPropertyDisplay(message)}
                        </Typography>
                        {message.tenantName && (
                          <Typography variant="caption" color="text.secondary">
                            {message.tenantName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatMessageTime(message.messageCreatedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {message.messageContent}
                        </Typography>
                        {message.urgentItem?.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {message.urgentItem.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={message.urgentItem?.severity?.toUpperCase() || 'URGENT'}
                          size="small"
                          color={severityColor}
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Tooltip title={`Click to ${getActionTooltip(message.recommendedAction).toLowerCase()}`}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => handleRecommendedAction(e, message)}
                            startIcon={(() => {
                              const ActionIcon = getActionIcon(message.recommendedAction);
                              return <ActionIcon style={{ fontSize: 16 }} />;
                            })()}
                            sx={{
                              textTransform: 'none',
                              color: 'primary.main',
                              borderColor: 'primary.main',
                              '&:hover': {
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                borderColor: 'primary.dark'
                              }
                            }}
                          >
                            {message.recommendedAction || 'Review message and respond'}
                          </Button>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Clear urgency for this message">
                          <IconButton
                            size="small"
                            onClick={() => handleClearUrgency(message)}
                            disabled={isClearing}
                            sx={{
                              color: 'text.secondary',
                              '&:hover': {
                                color: 'error.main',
                                bgcolor: 'error.light'
                              }
                            }}
                          >
                            {isClearing ? (
                              <CircularProgress size={16} />
                            ) : (
                              <CloseOutlined style={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      
      {/* Maintenance Add Drawer */}
      <LandlordMaintenanceDrawer
        onAddSuccess={async () => {
          // Show success snackbar
          openSnackbar({
            open: true,
            message: 'Maintenance request created successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          // Refresh urgent messages list
          await loadUrgentMessages();
          // Refresh conversations list to update hasUrgentItems flag
          dispatch(getConversations(false));
        }}
      />
    </MainCard>
  );
}
