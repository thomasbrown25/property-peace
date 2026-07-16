import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha,
  useTheme,
  OutlinedInput,
  InputAdornment,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Chip
} from '@mui/material';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PropertySelect from 'components/PropertySelect';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import { LandlordEmptyState, LandlordKpiCard, LandlordPageHeader } from 'components/landlord/PagePrimitives';
import { openSnackbar } from 'api/snackbar';
import { CSVLink } from 'react-csv';
import { formatCurrency } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';

const noLabelBg = {
  '& .MuiOutlinedInput-notchedOutline': { top: 0 },
  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Strip the auto-generated " - Amount: $X.XX" suffix added by the system
const stripAmountSuffix = (ref) => ref.replace(/\s*-\s*Amount:\s*\$[\d,.]+/i, '').trim();

const formatReference = (raw) => {
  const ref = raw?.trim() ?? '';
  if (!ref) return 'Rent payment - manually entered';
  const hasAmountSuffix = /- Amount:\s*\$/i.test(ref);
  const name = stripAmountSuffix(ref);
  return hasAmountSuffix ? `${name} - paid through Stripe` : ref;
};

export default function Payments() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const [wasPaymentDrawerOpen, setWasPaymentDrawerOpen] = useState(false);
  const selectedProperty = useSelector(selectProperty);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setPaymentError(null);
      const params = new URLSearchParams();
      if (selectedProperty?.id) params.append('propertyId', selectedProperty.id);
      const res = await axiosServices.get(`/api/payment/all?${params.toString()}`);
      const raw = res.data;
      const data = Array.isArray(raw) ? raw : raw?.data ?? raw?.Data ?? [];
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      setPayments([]);
      setPaymentError(error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [selectedProperty?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (drawer.isOpenPaymentAdd) {
      setWasPaymentDrawerOpen(true);
      return;
    }

    if (wasPaymentDrawerOpen) {
      setWasPaymentDrawerOpen(false);
      fetchPayments();
    }
  }, [drawer.isOpenPaymentAdd, fetchPayments, wasPaymentDrawerOpen]);

  useEffect(() => () => { dispatch(setProperty(null)); }, [dispatch]);

  const filteredByDate = useMemo(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;
    return payments.filter((p) => {
      const dateVal = p.paymentDate ?? p.PaymentDate;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [payments, startDate, endDate]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return filteredByDate;
    const q = search.toLowerCase();
    return filteredByDate.filter((p) => {
      const ref = p.reference ?? p.Reference ?? '';
      const prop = p.propertyName ?? p.PropertyName ?? '';
      const unit = p.unitName ?? p.UnitName ?? '';
      return (
        ref.toLowerCase().includes(q) ||
        prop.toLowerCase().includes(q) ||
        unit.toLowerCase().includes(q)
      );
    });
  }, [filteredByDate, search]);

  const metrics = useMemo(() => {
    const total = filteredByDate.reduce((s, p) => s + (parseFloat(p.amount ?? p.Amount) || 0), 0);
    const now = new Date();
    const thisMonth = filteredByDate
      .filter((p) => {
        const d = new Date(p.paymentDate ?? p.PaymentDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + (parseFloat(p.amount ?? p.Amount) || 0), 0);
    const count = filteredByDate.length;
    const avg = count > 0 ? total / count : 0;
    return { total, thisMonth, count, avg };
  }, [filteredByDate]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginated = useMemo(
    () => filteredEntries.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage),
    [filteredEntries, page, itemsPerPage]
  );

  useEffect(() => { setPage(0); }, [itemsPerPage, search, selectedProperty?.id, startDate, endDate]);

  const csvData = useMemo(() =>
    filteredByDate.map((p) => ({
      Date: formatDate(p.paymentDate ?? p.PaymentDate),
      Reference: p.reference ?? p.Reference ?? '',
      Property: p.propertyName ?? p.PropertyName ?? '',
      Unit: (p.isSingleUnitProperty ?? p.IsSingleUnitProperty) ? '-' : (p.unitName ?? p.UnitName ?? ''),
      Amount: parseFloat(p.amount ?? p.Amount) || 0
    })), [filteredByDate]);

  const closeActionsMenu = () => {
    setActionsAnchor(null);
  };

  const handleActionsClick = (event, payment) => {
    setActionsAnchor(event.currentTarget);
    setSelectedPayment(payment);
  };

  const handleEditPayment = () => {
    setEditDrawerOpen(true);
    closeActionsMenu();
  };

  const handleDeletePayment = () => {
    setDeleteDialogOpen(true);
    closeActionsMenu();
  };

  const handleEditDrawerClose = () => {
    setEditDrawerOpen(false);
    setSelectedPayment(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedPayment(null);
  };

  const handlePaymentUpdated = () => {
    fetchPayments();
  };

  const handleDeleteConfirm = async () => {
    const paymentId = selectedPayment?.id ?? selectedPayment?.Id;
    if (!paymentId) return;

    try {
      setDeleting(true);
      await axiosServices.delete(`/api/payment/${paymentId}`);
      openSnackbar({
        open: true,
        message: 'Payment deleted successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handleDeleteCancel();
      fetchPayments();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.response?.data?.Message || error?.response?.data || 'Failed to delete payment.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ overflow: 'visible' }}>
      {/* Header */}
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <LandlordPageHeader
          title="Payments"
          subtitle="Track all rent payments and income received across your properties"
          actions={
            <>
              <CSVLink data={csvData} filename={`payments-${new Date().toISOString().slice(0, 10)}.csv`} style={{ textDecoration: 'none' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadOutlined style={{ fontSize: 13 }} />}
                  disabled={filteredByDate.length === 0}
                  sx={{ textTransform: 'none', borderRadius: 1.5 }}
                >
                  Export CSV
                </Button>
              </CSVLink>
              <Button
                size="small"
                variant="contained"
                startIcon={<PlusOutlined style={{ fontSize: 11 }} />}
                onClick={() => drawer.openPaymentAddDrawer()}
                sx={{ textTransform: 'none', borderRadius: 1.5, boxShadow: 'none' }}
              >
                Add Payment
              </Button>
            </>
          }
        />
      </AnimateIn>

      {/* KPI cards */}
      <AnimateIn direction="bottom" delay={150} distance={120}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'TOTAL RECEIVED', value: formatCurrency(metrics.total) },
            { label: 'THIS MONTH', value: formatCurrency(metrics.thisMonth) },
            { label: 'TOTAL PAYMENTS', value: metrics.count },
            { label: 'AVERAGE PAYMENT', value: formatCurrency(metrics.avg) }
          ].map((kpi) => (
            <LandlordKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </Box>
      </AnimateIn>

      {/* Toolbar */}
      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <OutlinedInput
            size="small"
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment>}
            sx={{ flex: 2, minWidth: 0, width: { xs: '100%', md: 'auto' }, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
          />
          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{ flex: 1.5, minWidth: 0, width: { xs: '100%', md: 'auto' }, ...noLabelBg }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <TextField
            size="small"
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{ flex: 1.5, minWidth: 0, width: { xs: '100%', md: 'auto' }, ...noLabelBg }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <Box sx={{
            flex: 2, minWidth: 0, width: { xs: '100%', md: 'auto' },
            '& .MuiInputLabel-root': { backgroundColor: 'transparent !important' },
            ...noLabelBg
          }}>
            <PropertySelect width="100%" disableAllOption={false} />
          </Box>
        </Box>
      </AnimateIn>

      {/* Table */}
      <AnimateIn direction="bottom" delay={250} distance={120}>
        <MainCard content={false} boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ bgcolor: 'background.paper', overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : paymentError ? (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" startIcon={<ReloadOutlined />} onClick={fetchPayments} sx={{ textTransform: 'none' }}>
                    Retry
                  </Button>
                }
              >
                {paymentError}
              </Alert>
            </Box>
          ) : filteredEntries.length === 0 ? (
            <LandlordEmptyState
              title={payments.length === 0 ? 'No payments recorded yet' : 'No payments match your filters'}
              description={payments.length === 0 ? 'Record your first rent payment or income item to start building a clean payment history.' : 'Try widening the date range, changing the selected property, or clearing your search.'}
              actionLabel={payments.length === 0 ? 'Add Payment' : undefined}
              actionIcon={<PlusOutlined />}
              onAction={() => drawer.openPaymentAddDrawer()}
            />
          ) : (
            <>
              <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Property</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginated.map((p) => {
                      const id = p.id ?? p.Id;
                      const amount = parseFloat(p.amount ?? p.Amount) || 0;
                      return (
                        <TableRow key={id} hover>
                          <TableCell>{formatDate(p.paymentDate ?? p.PaymentDate)}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatReference(p.reference ?? p.Reference)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{p.propertyName ?? p.PropertyName ?? '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {(p.isSingleUnitProperty ?? p.IsSingleUnitProperty) ? '-' : (p.unitName ?? p.UnitName ?? '-')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={500} color="success.main">
                              {formatCurrency(amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(event) => handleActionsClick(event, p)}
                              aria-label="Payment actions"
                              sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, borderRadius: 1.25 }}
                            >
                              <MoreOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, p: 1.5 }}>
                {paginated.map((p) => {
                  const id = p.id ?? p.Id;
                  const amount = parseFloat(p.amount ?? p.Amount) || 0;
                  const unitLabel = (p.isSingleUnitProperty ?? p.IsSingleUnitProperty) ? 'Single-unit' : (p.unitName ?? p.UnitName ?? 'No unit');
                  return (
                    <Box
                      key={id}
                      sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        borderRadius: 2,
                        p: 1.5,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {formatReference(p.reference ?? p.Reference)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {p.propertyName ?? p.PropertyName ?? 'No property'} · {unitLabel}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={(event) => handleActionsClick(event, p)} aria-label="Payment actions">
                          <MoreOutlined style={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                        <Chip size="small" label={formatDate(p.paymentDate ?? p.PaymentDate)} sx={{ borderRadius: 1 }} />
                        <Typography variant="h6" color="success.main" fontWeight={700}>
                          {formatCurrency(amount)}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}

        </MainCard>
        {filteredEntries.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Items per page:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} sx={{ minWidth: 100 }}>Previous</Button>
                <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
              </Box>
            </Box>
          </Box>
        )}
      </AnimateIn>

      <Menu
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={closeActionsMenu}
        PaperProps={{ sx: { mt: 0.5, minWidth: 170, borderRadius: 1.5 } }}
      >
        <MenuItem onClick={handleEditPayment} sx={{ gap: 1, fontSize: '0.85rem' }}>
          <EditOutlined style={{ fontSize: 14 }} />
          Edit payment
        </MenuItem>
        <MenuItem onClick={handleDeletePayment} sx={{ gap: 1, fontSize: '0.85rem', color: 'error.main' }}>
          <DeleteOutlined style={{ fontSize: 14 }} />
          Delete payment
        </MenuItem>
      </Menu>

      <PaymentEditDrawer
        payment={selectedPayment}
        open={editDrawerOpen}
        onClose={handleEditDrawerClose}
        onUpdateSuccess={handlePaymentUpdated}
      />

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment? This action cannot be undone.
            {selectedPayment && (
              <Box component="span" sx={{ display: 'block', mt: 2, fontWeight: 600, color: 'text.primary' }}>
                Amount: {formatCurrency(parseFloat(selectedPayment.amount ?? selectedPayment.Amount) || 0)}
                <br />
                Date: {formatDate(selectedPayment.paymentDate ?? selectedPayment.PaymentDate)}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting} sx={{ textTransform: 'none' }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
