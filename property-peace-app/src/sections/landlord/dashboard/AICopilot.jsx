import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Collapse,
  IconButton,
  Alert,
  Typography,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Button,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { SettingOutlined, ThunderboltOutlined, RocketOutlined, MessageOutlined, DollarOutlined, HomeOutlined, UnorderedListOutlined, ToolOutlined, DollarCircleOutlined, FileTextOutlined, BarChartOutlined, WalletOutlined } from '@ant-design/icons';
import { useSnackbar } from 'notistack';

// Components
import MainCard from 'components/MainCard';
import CopilotHeader from './CopilotHeader';
import CopilotMessage from './CopilotMessage';
import CopilotActions from './CopilotActions';

// Services and hooks
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import { isConfigured } from 'services/azureAIService';
import { executeAction } from 'services/copilotActions';
import { parseCommand } from 'services/commandParser';
import { useDrawer } from 'contexts/DrawerContext';

export default function AICopilot({ onDashboardRefresh }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const drawer = useDrawer();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: summaryData, loading: dataLoading, error: dataError, refetch } = useOrganizationSummary();

  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);
  const [dataResult, setDataResult] = useState(null);
  const [loadingActionIndex, setLoadingActionIndex] = useState(null);
  const [createMenuAnchor, setCreateMenuAnchor] = useState(null);

  const configured = isConfigured();

  const handleAction = useCallback(
    async (action, actionIndex = null) => {
      try {
        setLoading(true);
        setLoadingActionIndex(actionIndex);
        setDataResult(null); // Clear previous data results
        const result = await executeAction(action, navigate, summaryData, drawer.openMaintenanceAddDrawer, refetch, onDashboardRefresh);

        if (result.success) {
          // Check if this is a drawer-opening action
          if (result.data?.action === 'openMaintenanceDrawer') {
            // Drawer is already opened by executeAction, no need to show snackbar
            setLoading(false);
            setLoadingActionIndex(null);
            return;
          }
          // If it's a showData action, display the data instead of showing a snackbar
          if (action.action === 'showData' && result.data) {
            setDataResult(result.data);
            setMessage(`Here's your ${result.data.title.toLowerCase()}:`);
          } 
          // Navigation actions - no snackbar needed, just navigate
          else if (
            action.action === 'navigateToPage' || 
            action.action === 'navigateToSpecificItem' ||
            action.action === 'viewApplication' ||
            action.action === 'viewMaintenanceRequest'
          ) {
            // Refresh data after navigation (don't auto-regenerate summary)
            setTimeout(() => {
              refetch();
            }, 1000);
          } 
          // Actions that should show snackbars (follow-ups, reminders, etc.)
          else if (action.action === 'sendAIFollowUp' || action.action === 'sendRentReminder') {
            enqueueSnackbar(result.message || 'Action completed successfully', { 
              variant: 'success',
              autoHideDuration: 3000
            });
            // Refresh data after action (don't auto-regenerate summary)
            setTimeout(() => {
              refetch();
            }, 1000);
          } 
          // Other actions - show snackbar only if not a navigation/modal action
          else {
            enqueueSnackbar(result.message || 'Action completed successfully', { 
              variant: 'success',
              autoHideDuration: 3000
            });
            // Refresh data after action (don't auto-regenerate summary)
            setTimeout(() => {
              refetch();
            }, 1000);
          }
        } else {
          // Only show error snackbar for non-navigation actions
          const isNavigationAction = 
            action.action === 'navigateToPage' || 
            action.action === 'navigateToSpecificItem' ||
            action.action === 'viewApplication' ||
            action.action === 'viewMaintenanceRequest';
          
          if (!isNavigationAction) {
            enqueueSnackbar(result.message || 'Action failed', { 
              variant: 'error',
              autoHideDuration: 3000
            });
          }
        }
      } catch (err) {
        console.error('Error executing action:', err);
        enqueueSnackbar('Failed to execute action', { 
          variant: 'error',
          autoHideDuration: 3000
        });
      } finally {
        setLoading(false);
        setLoadingActionIndex(null);
      }
    },
    [navigate, enqueueSnackbar, refetch, summaryData, drawer, onDashboardRefresh]
  );

  const handleCommand = useCallback(
    async (command) => {
      try {
        setLoading(true);
        setError(null);
        setDataResult(null); // Clear previous data results

        const parsedAction = await parseCommand(command, summaryData);

        if (parsedAction.action) {
          // Pass summaryData to showData actions for better context
          if (parsedAction.action === 'showData' && parsedAction.params) {
            parsedAction.params.summaryData = summaryData;
          }
          await handleAction(parsedAction);
        } else {
          enqueueSnackbar(parsedAction.error || 'Could not understand command', { 
            variant: 'warning',
            autoHideDuration: 3000
          });
        }
      } catch (err) {
        console.error('Error parsing command:', err);
        enqueueSnackbar('Failed to process command', { 
          variant: 'error',
          autoHideDuration: 3000
        });
      } finally {
        setLoading(false);
      }
    },
    [summaryData, handleAction, enqueueSnackbar]
  );

  if (!configured) {
    return (
      <MainCard title="AI Summary">
        <Alert severity="info" sx={{ m: 2 }}>AI Copilot is not configured. Please set Azure OpenAI environment variables.</Alert>
      </MainCard>
    );
  }

  if (dataError) {
    return (
      <MainCard title="AI Summary">
        <Alert severity="error" sx={{ m: 2 }}>{dataError}</Alert>
      </MainCard>
    );
  }

  return (
    <>
    <MainCard
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<RocketOutlined style={{ fontSize: 14 }} />}
            onClick={(e) => setCreateMenuAnchor(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              px: 2,
              py: 0.75,
              minWidth: 'auto',
              bgcolor: 'primary.main',
              color: '#ffffff',
              boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'primary.dark',
                boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                transform: 'translateY(-1px)'
              }
            }}
          >
            Quick Actions
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<ThunderboltOutlined style={{ fontSize: 14 }} />}
              onClick={() => navigate('/landlord/portfolio-summary')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                px: 2,
                py: 0.75,
                minWidth: 'auto',
                bgcolor: 'primary.main',
                color: '#ffffff',
                boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  transform: 'translateY(-1px)'
                }
              }}
            >
              {isXs ? 'Generate Summary' : 'Generate Portfolio Summary'}
            </Button>
            <Tooltip title="AI Summary Settings">
              <IconButton
                size="small"
                onClick={() => navigate('/landlord/settings?tab=aiSummary')}
                sx={{ 
                  color: 'text.secondary',
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08)
                  } 
                }}
              >
                <SettingOutlined style={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      }
      content={false}
    >
      <Collapse in={expanded} timeout={400}>
        <Box sx={{ p: 2 }}>
          <CopilotHeader status="idle" />
          {error && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}

          {/* Display data query results */}
          {dataResult && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
                  {dataResult.title}
                </Typography>

                {dataResult.type === 'rentCollection' && dataResult.summary && (
                  <Stack spacing={1.5} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip label={`Expected: ${dataResult.summary.totalExpected}`} color="primary" variant="outlined" />
                      <Chip label={`Collected: ${dataResult.summary.totalCollected}`} color="success" variant="outlined" />
                      <Chip label={`Overdue: ${dataResult.summary.overdueCount}`} color="error" variant="outlined" />
                      <Chip label={`Due Soon: ${dataResult.summary.dueSoonCount}`} color="warning" variant="outlined" />
                    </Box>
                  </Stack>
                )}

                {dataResult.items && dataResult.items.length > 0 && (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {Object.keys(dataResult.items[0])
                            .filter((key) => key !== 'id')
                            .map((key) => (
                              <TableCell key={key} sx={{ fontWeight: 600, textTransform: 'capitalize', fontFamily: "'Poppins', sans-serif" }}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </TableCell>
                            ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dataResult.items.slice(0, 10).map((item, index) => (
                          <TableRow key={item.id || index} hover>
                            {Object.keys(item)
                              .filter((key) => key !== 'id')
                              .map((key) => (
                                <TableCell key={key}>
                                  {typeof item[key] === 'object' ? JSON.stringify(item[key]) : String(item[key] || 'N/A')}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {dataResult.items && dataResult.items.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No items found.
                  </Alert>
                )}

                {dataResult.message && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {dataResult.message}
                  </Typography>
                )}

                {dataResult.items && dataResult.items.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Showing first 10 of {dataResult.items.length} items. Navigate to the full page to see all.
                  </Typography>
                )}
              </Box>
            )}

          {actions.length > 0 && !dataResult && <CopilotActions actions={actions} onAction={handleAction} loading={loading} loadingActionIndex={loadingActionIndex} />}
        </Box>
      </Collapse>
      <Menu
        anchorEl={createMenuAnchor}
        open={Boolean(createMenuAnchor)}
        onClose={() => setCreateMenuAnchor(null)}
        TransitionComponent={Collapse}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 220,
            borderRadius: 2,
            boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
            py: 0.5
          }
        }}
      >
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); drawer.openPropertyAddWorkflowDrawer(); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Add Property
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/expense/add-workflow'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WalletOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Add an Expense
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/expenses'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UnorderedListOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            View Expenses
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); drawer.openPaymentAddDrawer(); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DollarCircleOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Add Payment
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/maintenances/add'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToolOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Create Maintenance Request
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/leases?view=renewals'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileTextOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Renew a Lease
          </Box>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/messages'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Send a Message
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/rent-collection'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DollarOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            View Rent Collection
          </Box>
        </MenuItem>
        <MenuItem 
          onClick={() => { setCreateMenuAnchor(null); navigate('/landlord/accounting/tax-center'); }}
          sx={{ py: 1.25, px: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
            Open Tax Center
          </Box>
        </MenuItem>
      </Menu>
    </MainCard>
    </>
  );
}
