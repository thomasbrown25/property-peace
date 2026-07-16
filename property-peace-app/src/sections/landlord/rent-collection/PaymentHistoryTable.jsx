import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Paper,
  alpha,
  useTheme,
  Box,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  DollarOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  UserOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { formatCurrency } from 'utils/formatters';
import moment from 'moment';
import MainCard from 'components/MainCard';
import { useState, useMemo } from 'react';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import axios from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

export default function PaymentHistoryTable({ payments, deposits = [], onPaymentUpdated }) {
  const theme = useTheme();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Combine payments and deposits, normalize them to have the same structure
  const combinedTransactions = useMemo(() => {
    const paymentItems = (payments || []).map((p) => ({
      ...p,
      type: 'payment',
      date: p.paymentDate ?? p.PaymentDate,
      id: p.id ?? p.Id
    }));

    const depositItems = (deposits || []).map((d) => ({
      ...d,
      type: 'deposit',
      date: d.receivedDate,
      id: `deposit-${d.id}`,
      paymentDate: d.receivedDate, // For compatibility with existing code
      status: 'Completed',
      method: 'Deposit'
    }));

    // Combine and sort by date (newest first)
    return [...paymentItems, ...depositItems].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });
  }, [payments, deposits]);

  const handleActionsClick = (event, payment) => {
    setActionsAnchor(event.currentTarget);
    setSelectedPayment(payment);
  };

  const handleActionsClose = () => {
    setActionsAnchor(null);
  };

  const handleEditClick = (payment = selectedPayment) => {
    setSelectedPayment(payment);
    setEditDrawerOpen(true);
    handleActionsClose();
  };

  const handleEditDrawerClose = () => {
    setEditDrawerOpen(false);
    setSelectedPayment(null);
  };

  const handleUpdateSuccess = () => {
    if (onPaymentUpdated) {
      onPaymentUpdated();
    }
    handleEditDrawerClose();
  };

  const handleDeleteClick = (payment = selectedPayment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
    handleActionsClose();
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPaymentToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;

    try {
      setDeleting(true);
      const response = await axios.delete(`/api/payment/${paymentToDelete.id}`);

      if (response.data) {
        openSnackbar({
          open: true,
          message: 'Payment deleted successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        if (onPaymentUpdated) {
          onPaymentUpdated();
        }
        handleDeleteCancel();
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.response?.data || 'Failed to delete payment.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  // Deposits are displayed for context, but only payment rows can be edited/deleted here.
  const canEditOrDeletePayment = (payment) => payment?.type === 'payment';

  const getPaymentStatusChip = (statusValue) => {
    const status = statusValue || 'Completed';
    const normalized = status.toLowerCase();

    if (normalized === 'completed') return { label: 'Completed', color: 'success', icon: <CheckCircleOutlined /> };
    if (normalized === 'processing') return { label: 'Processing', color: 'info', icon: null };
    if (normalized === 'failed') return { label: 'Failed', color: 'error', icon: null };
    if (normalized === 'canceled' || normalized === 'cancelled') return { label: 'Canceled', color: 'default', icon: null };
    if (normalized === 'disputed') return { label: 'Disputed', color: 'error', icon: null };

    return { label: status, color: 'warning', icon: null };
  };

  return (
    <MainCard
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="h5" fontWeight={600}>
          Payment History
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {combinedTransactions.length} {combinedTransactions.length === 1 ? 'transaction' : 'transactions'} recorded
        </Typography>
      </Box>
      <TableContainer>
        <Table>
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
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Method</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {combinedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <DollarOutlined style={{ fontSize: 40, color: alpha(theme.palette.text.secondary, 0.3) }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        No Payments Found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Payment history will appear here once payments are recorded.
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              combinedTransactions.map((t, i) => (
                <TableRow
                  key={t.id || i}
                  hover
                  sx={{
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.04)
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {moment(t.paymentDate || t.date).format('MMM D, YYYY')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {moment(t.paymentDate || t.date).format('h:mm A')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {t.type === 'deposit'
                        ? 'Deposit'
                        : t.feeId != null || t.FeeId != null
                          ? t.feeName || t.FeeName || 'Fee'
                          : 'Rent payment'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <DollarOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {formatCurrency(t.amount)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const statusChip = getPaymentStatusChip(t.status || t.Status);
                      return (
                        <Chip
                          size="small"
                          label={statusChip.label}
                          color={statusChip.color}
                          icon={statusChip.icon}
                          sx={{ fontWeight: 500 }}
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const method = t.method || t.Method || (t.type === 'deposit' ? 'Deposit' : 'N/A');
                      const isOnline =
                        method === 'Online Payment' || method?.toLowerCase().includes('stripe') || method?.toLowerCase().includes('online');
                      const isManual = method === 'Manual Entry' || method?.toLowerCase().includes('manual');

                      return (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {isOnline && <CreditCardOutlined style={{ fontSize: 14, color: theme.palette.primary.main }} />}
                          {isManual && <UserOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />}
                          <Typography variant="body2" color="text.secondary">
                            {isOnline ? 'Online Payment' : isManual ? 'Manual Entry' : method}
                          </Typography>
                        </Stack>
                      );
                    })()}
                  </TableCell>
                  <TableCell align="right">
                    {canEditOrDeletePayment(t) && (
                      <IconButton
                        size="small"
                        onClick={(event) => handleActionsClick(event, t)}
                        aria-label="Payment actions"
                        sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, borderRadius: 1.25 }}
                      >
                        <MoreOutlined style={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={handleActionsClose}
        PaperProps={{ sx: { mt: 0.5, minWidth: 170, borderRadius: 1.5 } }}
      >
        <MenuItem onClick={() => handleEditClick()} sx={{ gap: 1, fontSize: '0.85rem' }}>
          <EditOutlined style={{ fontSize: 14 }} />
          Edit payment
        </MenuItem>
        <MenuItem onClick={() => handleDeleteClick()} sx={{ gap: 1, fontSize: '0.85rem', color: 'error.main' }}>
          <DeleteOutlined style={{ fontSize: 14 }} />
          Delete payment
        </MenuItem>
      </Menu>

      {/* Edit Payment Drawer */}
      <PaymentEditDrawer
        payment={selectedPayment}
        open={editDrawerOpen}
        onClose={handleEditDrawerClose}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment? This action cannot be undone.
            <br />
            <br />
            <strong>
              Amount: {paymentToDelete ? formatCurrency(paymentToDelete.amount ?? paymentToDelete.Amount ?? 0) : ''}
              <br />
              Date:{' '}
              {paymentToDelete
                ? moment(paymentToDelete.paymentDate ?? paymentToDelete.PaymentDate ?? paymentToDelete.date).format('MMM D, YYYY')
                : ''}
            </strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
}
