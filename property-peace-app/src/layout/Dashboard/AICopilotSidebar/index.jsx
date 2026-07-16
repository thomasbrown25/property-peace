import { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Divider,
  List,
  ListItem,
  TextField,
  OutlinedInput,
  FormControl,
  InputAdornment,
  CircularProgress,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import {
  RobotOutlined,
  SendOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useAICopilot } from 'contexts/AICopilotContext';
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import { parseCommand } from 'services/commandParser';
import { executeAction } from 'services/copilotActions';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { isConfigured } from 'services/azureAIService';

const SIDEBAR_WIDTH = 400;
const COLLAPSED_WIDTH = 60;

// Export for use in layout
export { SIDEBAR_WIDTH, COLLAPSED_WIDTH };

export default function AICopilotSidebar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    sidebarOpen,
    conversation,
    addToConversation,
    clearConversation,
    setConversationState,
    isCollapsed,
    setIsCollapsed
  } = useAICopilot();
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { data: summaryData, refetch: refetchSummary } = useOrganizationSummary();
  const configured = isConfigured();

  const handleSendCommand = async () => {
    if (!aiQuery.trim() || !configured || !summaryData) return;

    const userMessage = aiQuery.trim();
    setAiQuery('');
    setAiLoading(true);

    // Add user message to conversation
    const newConversation = [...conversation, { role: 'user', content: userMessage }];
    setConversationState(newConversation);

    try {
      // Parse the command
      const parsedAction = await parseCommand(userMessage, summaryData);

      if (parsedAction.action) {
        // Execute the action
        const result = await executeAction(parsedAction, navigate);

        // Add assistant response
        const assistantMessage = result.success
          ? result.message || 'Action completed successfully!'
          : result.message || 'Action failed. Please try again.';

        setConversationState([
          ...newConversation,
          { role: 'assistant', content: assistantMessage }
        ]);

        if (result.success) {
          enqueueSnackbar(assistantMessage, { variant: 'success' });
          // Refresh summary data
          setTimeout(() => {
            refetchSummary();
          }, 1000);
        } else {
          enqueueSnackbar(assistantMessage, { variant: 'error' });
        }
      } else {
        // No action found - show helpful message
        const assistantMessage = parsedAction.error || "I couldn't understand that command. Try asking me to:\n- Send a payment reminder\n- Review an application\n- View maintenance requests\n- Navigate to a page";
        setConversationState([
          ...newConversation,
          { role: 'assistant', content: assistantMessage }
        ]);
        enqueueSnackbar(assistantMessage, { variant: 'warning' });
      }
    } catch (err) {
      console.error('Error processing AI command:', err);
      const errorMessage = 'Failed to process command. Please try again.';
      setConversationState([
        ...newConversation,
        { role: 'assistant', content: errorMessage }
      ]);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={sidebarOpen}
      onClose={() => setIsCollapsed(true)}
      variant="persistent"
      sx={{
        width: isCollapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isCollapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          }),
          borderLeft: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.customShadows?.z1 || 'none',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 64px)', // Full height minus header
          top: 64, // Header height
          overflow: 'hidden' // Prevent overflow
        }
      }}
    >
      {isCollapsed ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 1,
            height: '100%',
            justifyContent: 'space-between'
          }}
        >
          <Tooltip title="AI Copilot" placement="left">
            <IconButton
              size="small"
              onClick={() => setIsCollapsed(false)}
              sx={{ mb: 2 }}
            >
              <RobotOutlined />
            </IconButton>
          </Tooltip>
          
          {/* Input at bottom when collapsed */}
          <Box sx={{ width: '100%', px: 0.5 }}>
            {configured ? (
              <FormControl fullWidth>
                <OutlinedInput
                  size="small"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Command..."
                  disabled={aiLoading}
                  sx={{ fontSize: '0.75rem' }}
                  startAdornment={
                    <InputAdornment position="start" sx={{ mr: -0.5 }}>
                      {aiLoading ? (
                        <CircularProgress size={12} />
                      ) : (
                        <RobotOutlined style={{ fontSize: 12, color: configured ? '#1877F2' : '#999' }} />
                      )}
                    </InputAdornment>
                  }
                  endAdornment={
                    aiQuery.length > 0 ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={handleSendCommand}
                          disabled={aiLoading || !aiQuery.trim()}
                          sx={{ p: 0.25 }}
                        >
                          <SendOutlined style={{ fontSize: 12 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }
                  slotProps={{
                    input: {
                      'aria-label': 'AI Copilot command input',
                      sx: { py: 0.5, fontSize: '0.75rem' }
                    }
                  }}
                />
              </FormControl>
            ) : (
              <Tooltip title="Expand" placement="left">
                <IconButton
                  size="small"
                  onClick={() => setIsCollapsed(false)}
                >
                  <ArrowLeftOutlined />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              flexShrink: 0 // Prevent header from shrinking
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <RobotOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                AI Copilot
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              {conversation.length > 0 && (
                <Tooltip title="Clear conversation">
                  <IconButton size="small" onClick={clearConversation}>
                    <DeleteOutlined />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Collapse">
                <IconButton size="small" onClick={() => setIsCollapsed(true)}>
                  <ArrowRightOutlined style={{ transform: 'rotate(0deg)' }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Conversation Area */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 2,
              bgcolor: theme.palette.background.default,
              minHeight: 0, // Allow flexbox to shrink
              maxHeight: '100%' // Prevent overflow
            }}
          >
            {conversation.length === 0 ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Try asking me to:
                </Typography>
                <List dense sx={{ p: 0 }}>
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      • Send payment reminder
                    </Typography>
                  </ListItem>
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      • Review applications
                    </Typography>
                  </ListItem>
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      • View maintenance requests
                    </Typography>
                  </ListItem>
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      • Navigate to pages
                    </Typography>
                  </ListItem>
                </List>
              </Box>
            ) : (
              <Stack spacing={2}>
                {conversation.map((msg, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: msg.role === 'user'
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.success.main, 0.1),
                      border: `1px solid ${
                        msg.role === 'user'
                          ? alpha(theme.palette.primary.main, 0.2)
                          : alpha(theme.palette.success.main, 0.2)
                      }`
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}
                    >
                      {msg.role === 'user' ? 'You' : 'AI Copilot'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
                {aiLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Processing...
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Input Area - Fixed at bottom */}
          <Box 
            sx={{ 
              p: 2, 
              borderTop: `1px solid ${theme.palette.divider}`,
              flexShrink: 0, // Prevent shrinking
              bgcolor: theme.palette.background.paper,
              position: 'relative',
              zIndex: 1,
              minHeight: '80px' // Ensure minimum height
            }}
          >
            {!configured ? (
              <Typography variant="body2" color="error" sx={{ p: 1 }}>
                AI Copilot is not configured. Please set Azure OpenAI environment variables.
              </Typography>
            ) : (
              <FormControl fullWidth>
                <OutlinedInput
                  size="small"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to do something... (e.g., 'Send payment reminder to John')"
                  disabled={aiLoading}
                  startAdornment={
                    <InputAdornment position="start" sx={{ mr: -0.5 }}>
                      {aiLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RobotOutlined style={{ color: configured ? '#1877F2' : '#999' }} />
                      )}
                    </InputAdornment>
                  }
                  endAdornment={
                    aiQuery.length > 0 ? (
                      <InputAdornment position="end">
                        <Tooltip title="Send">
                          <IconButton
                            size="small"
                            onClick={handleSendCommand}
                            disabled={aiLoading || !aiQuery.trim()}
                            sx={{ p: 0.5 }}
                          >
                            <SendOutlined style={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : null
                  }
                  slotProps={{
                    input: {
                      'aria-label': 'AI Copilot command input'
                    }
                  }}
                />
              </FormControl>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
