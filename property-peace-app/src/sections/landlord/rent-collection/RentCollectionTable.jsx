import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Paper,
  alpha,
  useTheme
} from '@mui/material';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  MailOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  AlertOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatRentStatus, getRentStatusColor } from 'utils/formatters';
import { useModal } from 'contexts/ModalContext';
import { normalizeRentBalance } from 'utils/rentBalance';

export default function RentCollectionTable({ sortedRents, sortField, sortOrder, onSort, onSendReminder }) {
  const navigate = useNavigate();
  const modal = useModal();
  const theme = useTheme();

  const handleSort = (field) => {
    onSort(field);
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!sortedRents || sortedRents.length === 0) {
    return null;
  }

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
              '& .MuiTableCell-head': {
                fontWeight: 700,
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: `2px solid ${alpha(theme.palette.divider, 0.1)}`
              }
            }}
          >
            <TableCell
              sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) } }}
              onClick={() => handleSort('property')}
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <span>Property / Unit</span>
                {sortField === 'property' &&
                  (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
              </Stack>
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Tenant(s)</TableCell>
            <TableCell
              sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) } }}
              align="right"
              onClick={() => handleSort('rentAmount')}
            >
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                <span>Rent Amount</span>
                {sortField === 'rentAmount' &&
                  (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
              </Stack>
            </TableCell>
            <TableCell
              sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) } }}
              onClick={() => handleSort('dueDate')}
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <span>Due Date</span>
                {sortField === 'dueDate' &&
                  (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
              </Stack>
            </TableCell>
            <TableCell
              sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) } }}
              align="right"
              onClick={() => handleSort('overdue')}
            >
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                <span>Overdue</span>
                {sortField === 'overdue' &&
                  (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
              </Stack>
            </TableCell>
            <TableCell
              sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) } }}
              align="center"
              onClick={() => handleSort('status')}
            >
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                <span>Status</span>
                {sortField === 'status' &&
                  (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
              </Stack>
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="center">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRents.map((rent) => {
            const { overdueAmount, rentDueIsOverdue } = normalizeRentBalance(rent);
            const isOverdue = rentDueIsOverdue;
            const isNotStarted = rent.status === 'notStarted';
            const hasPaymentIssue = rent.paymentIssueCount > 0 || rent.hasLongProcessingPayment;

            // Format property display
            const propertyDisplay =
              rent.propertyType?.toLowerCase() === 'singlefamily'
                ? rent.propertyName
                : rent.unitName
                  ? `${rent.propertyName} – ${rent.unitName}`
                  : rent.propertyName;

            // Format tenants
            const tenantsDisplay =
              rent.tenants && Array.isArray(rent.tenants) && rent.tenants.length > 0
                ? rent.tenants
                    .map((t) => `${t.firstname || ''} ${t.lastname || ''}`.trim())
                    .filter((n) => n)
                    .join(', ') || 'No Tenant'
                : 'No Tenant';

            const handleMakePayment = () => {
              modal.openPaymentModal(rent);
            };

            const handleViewPayments = () => {
              navigate(`/landlord/rent-collection/${rent.leaseId}`);
            };

            return (
              <TableRow
                key={rent.leaseId || rent.id}
                hover
                onClick={() => handleViewPayments()}
                sx={{
                  cursor: 'pointer',
                  bgcolor: (t) =>
                    hasPaymentIssue
                      ? alpha(t.palette.error.main, 0.05)
                      : isOverdue
                        ? alpha(t.palette.error.main, 0.04)
                        : isNotStarted
                          ? alpha(t.palette.warning.main, 0.04)
                          : 'transparent',
                  '&:hover': {
                    bgcolor: (t) =>
                      hasPaymentIssue
                        ? alpha(t.palette.error.main, 0.09)
                        : isOverdue
                          ? alpha(t.palette.error.main, 0.08)
                          : isNotStarted
                            ? alpha(t.palette.warning.main, 0.08)
                            : alpha(t.palette.primary.main, 0.04)
                  },
                  borderLeft: (t) =>
                    hasPaymentIssue
                      ? `4px solid ${t.palette.error.main}`
                      : isOverdue
                        ? `4px solid ${t.palette.error.main}`
                        : isNotStarted
                          ? `4px solid ${t.palette.warning.main}`
                          : '4px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <HomeOutlined style={{ fontSize: 18, color: isOverdue ? theme.palette.error.main : theme.palette.primary.main }} />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {propertyDisplay}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <UserOutlined style={{ fontSize: 16, opacity: 0.7 }} />
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                      {tenantsDisplay}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                    <DollarOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                    <Typography variant="body2" fontWeight={600} color="success.main">
                      {formatCurrency(rent.rentAmount)}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarOutlined style={{ fontSize: 16, opacity: 0.7 }} />
                    <Typography variant="body2" color="text.secondary">
                      {formatDueDate(rent.dueDate)}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  {overdueAmount > 0 ? (
                    <Typography variant="body2" fontWeight={700} color="error.main">
                      {formatCurrency(overdueAmount)}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Stack spacing={0.75} alignItems="center">
                    <Chip
                      label={formatRentStatus(rent.status)}
                      color={getRentStatusColor(rent.status)}
                      size="small"
                      variant={isOverdue ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: isOverdue ? 700 : 500,
                        minWidth: 100
                      }}
                    />
                    {hasPaymentIssue && (
                      <Tooltip title={rent.paymentIssueSummary || 'Payment issue needs review'}>
                        <Chip size="small" color="error" icon={<AlertOutlined />} label="Review payment" variant="outlined" />
                      </Tooltip>
                    )}
                    {!hasPaymentIssue && rent.processingPaymentCount > 0 && (
                      <Tooltip title={rent.paymentIssueSummary || 'Payment is still processing'}>
                        <Chip size="small" color="info" label="Processing ACH" variant="outlined" />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                    <Tooltip title="Make Payment">
                      <Button
                        size="small"
                        variant={isOverdue ? 'contained' : 'outlined'}
                        color={isOverdue ? 'error' : 'success'}
                        startIcon={<CheckCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMakePayment();
                        }}
                        sx={{
                          minWidth: 110,
                          boxShadow: isOverdue ? `0 2px 8px ${alpha(theme.palette.error.main, 0.3)}` : 'none',
                          '&:hover': {
                            boxShadow: isOverdue ? `0 4px 12px ${alpha(theme.palette.error.main, 0.4)}` : 'none',
                            transform: 'translateY(-1px)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Payment
                      </Button>
                    </Tooltip>
                    <Tooltip title="View Payments">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPayments();
                        }}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <EyeOutlined />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Send Reminder">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSendReminder) {
                            onSendReminder(rent);
                          }
                        }}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <MailOutlined />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
