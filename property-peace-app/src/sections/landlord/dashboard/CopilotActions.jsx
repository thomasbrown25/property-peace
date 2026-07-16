import { Stack, Button, Typography, CircularProgress, Tooltip } from '@mui/material';
import { alpha } from '@mui/system';
import { CheckCircleOutlined, SendOutlined, FileTextOutlined, DollarOutlined, ToolOutlined, HomeOutlined, MessageOutlined } from '@ant-design/icons';

const getActionIcon = (actionType) => {
  switch (actionType) {
    case 'resendInvite':
      return <SendOutlined />;
    case 'sendPaymentReminder':
      return <DollarOutlined />;
    case 'approveApplication':
      return <CheckCircleOutlined />;
    case 'createWorkOrder':
      return <ToolOutlined />;
    case 'createMaintenanceFromUrgent':
      return <ToolOutlined />;
    case 'sendAIFollowUp':
      return <MessageOutlined />;
    case 'sendLeaseRenewalNotice':
      return <FileTextOutlined />;
    case 'navigateToPage':
      // Check if route contains 'property' to show home icon
      return <HomeOutlined />;
    default:
      return null;
  }
};

const getActionLabel = (actionType, params) => {
  switch (actionType) {
    case 'resendInvite':
      return 'Resend Invite';
    case 'sendPaymentReminder':
      return `Remind ${params?.tenantName || 'Tenant'}`;
    case 'approveApplication':
      return 'Approve Application';
    case 'createWorkOrder':
      return 'Create Work Order';
    case 'sendAIFollowUp':
      return 'Send Follow-up';
    case 'sendLeaseRenewalNotice':
      return 'Send Renewal Notice';
    case 'navigateToPage':
      return `View ${params?.route?.split('/').pop() || 'Page'}`;
    default:
      return 'Take Action';
  }
};

export default function CopilotActions({ actions = [], onAction, loading = false, loadingActionIndex = null }) {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        Suggested Actions:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {actions.map((action, index) => {
          const actionType = typeof action === 'string' ? action : action.action;
          const params = typeof action === 'object' ? action.params : {};
          const label = typeof action === 'object' && action.label ? action.label : getActionLabel(actionType, params);
          const tooltip = typeof action === 'object' && action.tooltip ? action.tooltip : null;
          const isActionLoading = loading && loadingActionIndex === index;
          
          // Get icon - check if it's a property navigation
          let icon = getActionIcon(actionType);
          if (actionType === 'navigateToPage' && params?.route?.includes('/property/')) {
            icon = <HomeOutlined />;
          }
          
          // Show spinner if this specific action is loading
          const displayIcon = isActionLoading ? (
            <CircularProgress size={16} sx={{ color: 'primary.main' }} />
          ) : icon;

          // For sendAIFollowUp action, show "Sending follow up..." when loading
          const displayLabel = isActionLoading && actionType === 'sendAIFollowUp' 
            ? 'Sending follow up...' 
            : label;

          const button = (
            <Button
              variant="contained"
              size="small"
              startIcon={displayIcon}
              onClick={() => onAction && onAction(action, index)}
              disabled={loading}
            >
              {displayLabel}
            </Button>
          );

          // Wrap button with tooltip if tooltip text exists
          return tooltip ? (
            <Tooltip key={index} title={tooltip} arrow>
              {button}
            </Tooltip>
          ) : (
            <span key={index}>{button}</span>
          );
        })}
      </Stack>
    </Stack>
  );
}

